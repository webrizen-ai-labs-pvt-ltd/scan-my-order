/**
 * "Ready in about N minutes" for an order entering the kitchen.
 *
 * estimate = typical prep time at this store
 *          + a little extra for bigger orders
 *          + the queue: orders already cooking, shared across a kitchen that works on ~3 at once
 *
 * Typical prep time is the median of this store's recent orders (kitchen → ready). Until a
 * store has enough history it uses 12 minutes. The guest sees the promised time; the kitchen's
 * "running late" button pushes it back (see announceOrderDelay).
 */

const DEFAULT_PREP_MINUTES = 12;
const MIN_SAMPLES = 5;
const LOOKBACK_DAYS = 21;
const KITCHEN_PARALLEL_ORDERS = 3;
const MIN_ESTIMATE = 4;
const MAX_ESTIMATE = 60;

const minutesBetween = (from, to) => (new Date(to).getTime() - new Date(from).getTime()) / 60000;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Typical kitchen-to-ready minutes at this store */
async function typicalPrepMinutes(db, storeId) {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const timed = await db.order.findMany({
    where: { storeId, readyAt: { not: null }, kitchenAt: { not: null }, createdAt: { gte: since } },
    select: { kitchenAt: true, readyAt: true },
    orderBy: { readyAt: 'desc' },
    take: 60
  });
  let samples = timed.map(o => minutesBetween(o.kitchenAt, o.readyAt));

  // Orders from before kitchen times were recorded: placed → ready (a slight overestimate)
  if (samples.length < MIN_SAMPLES) {
    const older = await db.order.findMany({
      where: { storeId, readyAt: { not: null }, kitchenAt: null, createdAt: { gte: since } },
      select: { createdAt: true, readyAt: true },
      orderBy: { readyAt: 'desc' },
      take: 60
    });
    samples = samples.concat(older.map(o => minutesBetween(o.createdAt, o.readyAt)));
  }

  samples = samples.filter(m => m >= 1 && m <= 90);
  return samples.length >= MIN_SAMPLES ? median(samples) : DEFAULT_PREP_MINUTES;
}

/**
 * @param {object} db Prisma client
 * @param {{ id: string, storeId: string }} order
 * @returns {Promise<number>} whole minutes until it should be ready
 */
async function estimatePrepMinutes(db, order) {
  const [typical, items, cookingAhead] = await Promise.all([
    typicalPrepMinutes(db, order.storeId),
    db.orderItem.findMany({ where: { orderId: order.id, status: 'ACTIVE' }, select: { quantity: true } }),
    db.order.count({ where: { storeId: order.storeId, status: 'PROCESSING', kitchenAt: { not: null }, id: { not: order.id } } })
  ]);

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const sizeExtra = Math.min(8, Math.max(0, itemCount - 2));
  // Orders ahead are half done on average, and the kitchen works on several at once
  const queueExtra = (cookingAhead * typical) / (2 * KITCHEN_PARALLEL_ORDERS);

  return Math.round(Math.min(MAX_ESTIMATE, Math.max(MIN_ESTIMATE, typical + sizeExtra + queueExtra)));
}

module.exports = { estimatePrepMinutes, typicalPrepMinutes };
