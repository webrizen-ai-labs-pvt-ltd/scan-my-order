const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { verifyStoreAccess } = require("../menu/menu-service");
const { webPush } = require("../notifications/vapid-service");
const { removeSubscription } = require("../notifications/notification-service");

const MARKETING_ROLES = ["STORE_MANAGER", "TENANT_ADMIN", "SUPER_ADMIN"];
// Who a campaign can go to. Everyone here has allowed notifications AND agreed to offers.
const AUDIENCES = {
  ALL: { label: "Everyone", hint: "All guests who agreed to get offers" },
  REGULARS: { label: "Regulars", hint: "Guests with 5 or more orders here" },
  LAPSED: { label: "Haven't come back", hint: "Guests whose last order was over 30 days ago" }
};
const REGULAR_ORDERS = 5;
const LAPSED_DAYS = 30;
const WENT_AHEAD = ["PROCESSING", "READY", "SERVED", "SETTLED"];

async function assertMarketer(actor, storeId) {
  if (!MARKETING_ROLES.includes(actor.role)) {
    throw createHttpError(403, "Only managers and owners can send campaigns");
  }
  await verifyStoreAccess(actor, storeId);
}

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * The devices that agreed to offers from this store, split by audience.
 * A device is tied to its guest by their sign-in or their browser session, which is how
 * their past orders (count, last visit) are found.
 */
async function loadAudiences(prisma, storeId) {
  const devices = await prisma.pushSubscription.findMany({
    where: { storeId, userType: "CUSTOMER", marketingOptIn: true }
  });
  const userIds = [...new Set(devices.map(d => d.userId).filter(Boolean))];
  const sessionIds = [...new Set(devices.map(d => d.sessionId).filter(Boolean))];
  const scope = { storeId, status: { in: WENT_AHEAD } };
  const figures = { _count: { _all: true }, _max: { createdAt: true } };
  const [byUser, bySession] = await Promise.all([
    userIds.length ? prisma.order.groupBy({ by: ["customerId"], where: { ...scope, customerId: { in: userIds } }, ...figures }) : [],
    sessionIds.length ? prisma.order.groupBy({ by: ["sessionId"], where: { ...scope, sessionId: { in: sessionIds } }, ...figures }) : []
  ]);
  const userStats = new Map(byUser.map(g => [g.customerId, g]));
  const sessionStats = new Map(bySession.map(g => [g.sessionId, g]));
  const lapsedBefore = Date.now() - LAPSED_DAYS * 86400000;

  const audiences = { ALL: [], REGULARS: [], LAPSED: [] };
  for (const device of devices) {
    const stats = [userStats.get(device.userId), sessionStats.get(device.sessionId)].filter(Boolean);
    const orders = stats.reduce((sum, s) => sum + s._count._all, 0);
    const lastOrderAt = stats.reduce((max, s) => Math.max(max, s._max.createdAt.getTime()), 0);
    audiences.ALL.push(device);
    if (orders >= REGULAR_ORDERS) audiences.REGULARS.push(device);
    if (orders > 0 && lastOrderAt < lapsedBefore) audiences.LAPSED.push(device);
  }
  return audiences;
}

/**
 * What the Campaigns page needs before composing: how many devices each audience reaches,
 * how many devices allowed notifications at all, and whether today's campaign was already sent.
 */
async function getAudienceSummary(actor, storeId) {
  await assertMarketer(actor, storeId);
  const prisma = getPrismaClient();
  const [audiences, allowedNotifications, sentToday] = await Promise.all([
    loadAudiences(prisma, storeId),
    prisma.pushSubscription.count({ where: { storeId, userType: "CUSTOMER" } }),
    prisma.marketingCampaign.findFirst({ where: { storeId, createdAt: { gte: startOfToday() } }, orderBy: { createdAt: "desc" } })
  ]);
  return {
    audiences: Object.entries(AUDIENCES).map(([id, a]) => ({ id, ...a, devices: audiences[id].length })),
    allowedNotifications,
    canSendToday: !sentToday,
    sentToday
  };
}

async function listCampaigns(actor, storeId) {
  await assertMarketer(actor, storeId);
  return getPrismaClient().marketingCampaign.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: 50 });
}

/**
 * Sends an offer as a push notification to the chosen audience, once.
 * - one campaign per store per day, so a store can't wear out its audience
 * - a promo code, if given, must be live; it is added to the message
 * - tapping the notification opens this store's menu
 * - devices that have gone away are removed
 *
 * @param {object} input title (3-60), body (5-160), audience (ALL | REGULARS | LAPSED), promoCode (optional)
 */
async function sendCampaign(actor, storeId, input = {}) {
  await assertMarketer(actor, storeId);
  const prisma = getPrismaClient();

  const title = typeof input.title === "string" ? input.title.trim() : "";
  const message = typeof input.body === "string" ? input.body.trim() : "";
  if (title.length < 3 || title.length > 60) throw createHttpError(400, "The title must be 3 to 60 characters");
  if (message.length < 5 || message.length > 160) throw createHttpError(400, "The message must be 5 to 160 characters");
  if (!AUDIENCES[input.audience]) throw createHttpError(400, "Choose who should get this campaign");

  let promoCode = null;
  if (input.promoCode) {
    const promo = await prisma.promoCode.findUnique({ where: { storeId_code: { storeId, code: String(input.promoCode).toUpperCase() } } });
    if (!promo || !promo.isActive || (promo.validUntil && promo.validUntil <= new Date())) {
      throw createHttpError(400, "That promo code isn't active. Pick a live code or send without one.");
    }
    promoCode = promo.code;
  }

  const sentToday = await prisma.marketingCampaign.count({ where: { storeId, createdAt: { gte: startOfToday() } } });
  if (sentToday > 0) throw createHttpError(429, "Today's campaign has already been sent. You can send the next one tomorrow.");

  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { name: true, slug: true, tenant: { select: { slug: true } } } });
  const devices = (await loadAudiences(prisma, storeId))[input.audience];
  if (devices.length === 0) throw createHttpError(400, "Nobody in this audience has agreed to get offers yet");

  // Recorded first: it is also what enforces the once-a-day limit if two people press Send together
  const campaign = await prisma.marketingCampaign.create({
    data: { storeId, title, body: message, promoCode, audience: input.audience, sentById: actor.id, sentByName: actor.name || actor.email || null, targeted: devices.length }
  });

  const payload = JSON.stringify({
    title,
    body: promoCode ? `${message} Use code ${promoCode}.` : message,
    tag: `smo-offer-${campaign.id}`,
    data: { type: "MARKETING", campaignId: campaign.id, url: `/${store.tenant.slug}/${store.slug}` }
  });
  let delivered = 0;
  let failed = 0;
  await Promise.all(devices.map(async (device) => {
    try {
      await webPush.sendNotification({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } }, payload);
      delivered += 1;
    } catch (error) {
      failed += 1;
      // The guest removed the permission or the browser: stop sending to this device
      if (error.statusCode === 410 || error.statusCode === 404) await removeSubscription(device.endpoint);
    }
  }));

  return prisma.marketingCampaign.update({ where: { id: campaign.id }, data: { delivered, failed } });
}

module.exports = { AUDIENCES, getAudienceSummary, listCampaigns, sendCampaign };
