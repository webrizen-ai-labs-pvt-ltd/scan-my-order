const crypto = require("crypto");
const { env } = require("../../config/env");
const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { verifyStoreAccess } = require("../menu/menu-service");
const { invalidateMenuCache } = require("../../lib/cache");
const { broadcastToStore } = require("../orders/sse-service");
const { sendNotification } = require("../notifications/notification-service");
const { storeHasFeature } = require("../billing/entitlements-service");
const { SYSTEM_OPEN_ITEM_NAME } = require("../menu/system-items");

// A guest can rate once their food has been served; the invitation stays open this long
const REVIEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const REVIEWABLE_STATUSES = ["SERVED", "SETTLED"];
// A dish shows its average on the guest menu only once this many guests have rated it,
// so one early rating can't brand a dish
const MIN_RATINGS_TO_SHOW = 5;
const LOW_RATING = 2;
const REVIEW_VIEWER_ROLES = ["STORE_MANAGER", "TENANT_ADMIN", "SUPER_ADMIN"];
const GOOGLE_HOSTS = ["google.com", "google.co.in", "g.page", "goo.gl", "g.co"];

const stars = (n) => Number.isInteger(n) && n >= 1 && n <= 5;
const average = (sum, count) => (count > 0 ? Math.round((sum / count) * 10) / 10 : null);

/**
 * A Google review link as the store typed it, checked. Empty clears it.
 * Accepts the links Google itself hands out (g.page/r/…/review, search.google.com/local/writereview,
 * maps.app.goo.gl, google.com/maps); anything else is refused so guests are never sent elsewhere.
 */
function cleanGoogleReviewUrl(value) {
  if (value === undefined) return undefined;
  const text = String(value || "").trim();
  if (!text) return null;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    throw createHttpError(400, "That Google review link isn't a valid web address");
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !GOOGLE_HOSTS.some(g => host === g || host.endsWith(`.${g}`))) {
    throw createHttpError(400, "Paste the review link from Google (it starts with g.page, google.com or maps.app.goo.gl)");
  }
  return url.toString().slice(0, 500);
}

/** The store's own Google review link, or its brand's when the store has none */
async function googleReviewUrlFor(prisma, storeId) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { googleReviewUrl: true, tenant: { select: { googleReviewUrl: true } } } });
  return store?.googleReviewUrl || store?.tenant?.googleReviewUrl || null;
}

/* ---------- Guest side ---------- */

const REVIEW_ORDER_INCLUDE = {
  table: { select: { tableNumber: true } },
  items: { where: { status: "ACTIVE" }, include: { menuItem: { select: { id: true, name: true, image: true, dietary: true } } } }
};

/** One row per dish across every round; custom "open" dishes aren't on the menu, so they aren't rated */
function mergeDishes(orders) {
  const dishes = new Map();
  for (const order of orders) {
    for (const item of order.items) {
      if (!item.menuItem || item.menuItem.name === SYSTEM_OPEN_ITEM_NAME) continue;
      const dish = dishes.get(item.menuItemId) || { menuItemId: item.menuItemId, name: item.menuItem.name, image: item.menuItem.image, dietary: item.menuItem.dietary, quantity: 0 };
      dish.quantity += item.quantity;
      dishes.set(item.menuItemId, dish);
    }
  }
  return [...dishes.values()];
}

/** The guest's served, not-yet-rated orders at this store (found by their sign-in or browser session) */
async function loadReviewable(prisma, storeId, guest) {
  if (!guest.customerId && !guest.sessionId) return { orders: [], dishes: [] };
  const orders = await prisma.order.findMany({
    where: {
      storeId,
      status: { in: REVIEWABLE_STATUSES },
      reviewId: null,
      updatedAt: { gte: new Date(Date.now() - REVIEW_WINDOW_MS) },
      ...(guest.customerId ? { customerId: guest.customerId } : { sessionId: guest.sessionId })
    },
    orderBy: { createdAt: "asc" },
    include: REVIEW_ORDER_INCLUDE
  });
  return { orders, dishes: mergeDishes(orders) };
}

/**
 * What the menu needs to decide whether to invite this guest to rate.
 * @param {{ customerId?: string, sessionId?: string }} guest
 */
async function getPendingReview(storeId, guest) {
  if (!(await storeHasFeature(storeId, "REVIEWS"))) return { enabled: false, orderIds: [], dishes: [] };
  const { orders, dishes } = await loadReviewable(getPrismaClient(), storeId, guest);
  return {
    enabled: true,
    orderIds: orders.map(o => o.id),
    dishes,
    tableNumber: orders.find(o => o.table)?.table.tableNumber ?? null
  };
}

/**
 * Stores one review for a set of orders that were just checked to be rateable by this guest.
 * Everyone gets the Google review link afterwards, whatever they rated: asking only happy
 * guests is against Google's review policy.
 */
async function saveReview(prisma, storeId, orders, guest, input = {}) {
  const rating = Number(input.rating);
  if (!stars(rating)) throw createHttpError(400, "Please choose 1 to 5 stars");
  const comment = typeof input.comment === "string" ? input.comment.trim().slice(0, 500) || null : null;

  const ordered = new Set(mergeDishes(orders).map(d => d.menuItemId));
  const itemRatings = new Map();
  for (const entry of Array.isArray(input.items) ? input.items : []) {
    const value = Number(entry?.rating);
    // Only dishes this guest was actually served count
    if (ordered.has(entry?.menuItemId) && stars(value)) itemRatings.set(entry.menuItemId, value);
  }

  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.review.create({
      data: {
        storeId,
        rating,
        comment,
        customerId: guest.customerId || null,
        sessionId: guest.sessionId || orders[0].sessionId || null,
        customerName: orders.find(o => o.customerName)?.customerName || guest.name || null,
        customerPhone: orders.find(o => o.customerPhone)?.customerPhone || null,
        tableNumber: orders.find(o => o.table)?.table.tableNumber ?? null,
        orderTotal: orders.reduce((sum, o) => sum + o.totalAmount, 0)
      }
    });
    // Claim the orders: if another tab rated them a moment ago, this one backs out
    const claim = await tx.order.updateMany({ where: { id: { in: orders.map(o => o.id) }, reviewId: null }, data: { reviewId: created.id } });
    if (claim.count === 0) throw createHttpError(409, "You've already rated this order. Thank you!");

    for (const [menuItemId, value] of itemRatings) {
      await tx.itemRating.create({ data: { reviewId: created.id, storeId, menuItemId, rating: value } });
      await tx.menuItem.update({ where: { id: menuItemId }, data: { ratingSum: { increment: value }, ratingCount: { increment: 1 } } });
    }
    return created;
  });

  if (itemRatings.size > 0) invalidateMenuCache(storeId);
  broadcastToStore(storeId, "REVIEW_RECEIVED", { reviewId: review.id, rating });

  // An unhappy guest who may still be at the table: tell the people who can put it right
  if (rating <= LOW_RATING) {
    const where = review.tableNumber ? `Table ${review.tableNumber}` : review.customerName || "A guest";
    sendNotification({
      storeId,
      type: "LOW_RATING",
      title: `${where} rated ${rating} of 5`,
      body: comment ? `“${comment.slice(0, 140)}”` : "No comment left. They may still be here: worth a word.",
      data: { reviewId: review.id, sound: "notification.mp3", url: "/dashboard/reviews" },
      target: { roles: ["STORE_MANAGER", "CASHIER"], storeId }
    }).catch(() => {});
  }

  return { reviewId: review.id, rating, googleReviewUrl: await googleReviewUrlFor(prisma, storeId) };
}

/**
 * A guest rates their visit from the QR menu: overall stars (required), stars per dish and a
 * comment (optional). Covers every served order of theirs that hasn't been rated yet.
 *
 * @param {object} input rating 1-5, comment?, items?: [{ menuItemId, rating }]
 */
async function submitReview(storeId, guest, input = {}) {
  if (!(await storeHasFeature(storeId, "REVIEWS"))) throw createHttpError(403, "This restaurant isn't taking ratings right now");
  const prisma = getPrismaClient();
  const { orders } = await loadReviewable(prisma, storeId, guest);
  if (orders.length === 0) throw createHttpError(409, "There's nothing to rate right now. You may have already rated this order.");
  return saveReview(prisma, storeId, orders, guest, input);
}

/* ---------- Rating from a printed bill ---------- */

// Bills handed over at the counter or by a waiter carry a small QR. Those guests never used the
// menu on their phone, so the link itself proves which bill they hold: the id plus a signature
// only this server can make. Kept short so the QR stays easy to scan when printed small.
const BILL_KINDS = { o: "order", t: "tableSession" };
const BILL_REVIEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
// A takeaway bill is printed while the food is still being made, so "ready" counts too
const BILL_REVIEWABLE_STATUSES = ["READY", "SERVED", "SETTLED"];

const signBill = (kind, id) => crypto.createHmac("sha256", env.auth.jwtSecret).update(`bill-review:${kind}:${id}`).digest("base64url").slice(0, 12);

function parseBillToken(token) {
  const match = /^([ot])([a-z0-9-]{8,40})\.([A-Za-z0-9_-]{12})$/.exec(String(token || ""));
  if (!match) return null;
  const [, kind, id, signature] = match;
  const expected = signBill(kind, id);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return { kind, id };
}

/**
 * The link printed as a QR on a bill, or null when the store doesn't take ratings (or the menu
 * app's address isn't configured).
 * @param {'o'|'t'} kind o = one order's bill, t = a table's bill
 */
async function billReviewUrl(storeId, kind, id) {
  if (!BILL_KINDS[kind] || !id || !env.apps.menuUrl) return null;
  if (!(await storeHasFeature(storeId, "REVIEWS"))) return null;
  return `${env.apps.menuUrl.replace(/\/+$/, "")}/rate/${kind}${id}.${signBill(kind, id)}`;
}

async function loadBill(prisma, token) {
  const bill = parseBillToken(token);
  if (!bill) throw createHttpError(404, "This rating link isn't valid. Please scan the code on your bill again.");
  const orders = await prisma.order.findMany({
    where: bill.kind === "o" ? { id: bill.id } : { tableSessionId: bill.id },
    orderBy: { createdAt: "asc" },
    include: { ...REVIEW_ORDER_INCLUDE, store: { select: { id: true, name: true, tenant: { select: { name: true, logo: true } } } } }
  });
  const live = orders.filter(o => o.status !== "CANCELLED");
  if (live.length === 0) throw createHttpError(404, "We couldn't find this bill.");
  return { store: live[0].store, orders: live };
}

/**
 * What the "rate your order" page shows for a scanned bill.
 * state: RATE (ready to rate) · DONE (already rated) · WAIT (food not out yet) · CLOSED (too old, or ratings are off)
 */
async function getBillReview(token) {
  const prisma = getPrismaClient();
  const { store, orders } = await loadBill(prisma, token);
  const base = { storeName: store.name, brandName: store.tenant?.name || null, logo: store.tenant?.logo || null, dishes: [], tableNumber: orders.find(o => o.table)?.table.tableNumber ?? null };
  if (!(await storeHasFeature(store.id, "REVIEWS"))) return { ...base, state: "CLOSED" };

  const unrated = orders.filter(o => !o.reviewId);
  if (unrated.length === 0) return { ...base, state: "DONE", googleReviewUrl: await googleReviewUrlFor(prisma, store.id) };
  const rateable = unrated.filter(o => BILL_REVIEWABLE_STATUSES.includes(o.status));
  if (rateable.length === 0) return { ...base, state: "WAIT" };
  if (rateable.every(o => Date.now() - o.createdAt.getTime() > BILL_REVIEW_WINDOW_MS)) return { ...base, state: "CLOSED" };
  return { ...base, state: "RATE", dishes: mergeDishes(rateable) };
}

/** A guest rates from the QR on their printed bill */
async function submitBillReview(token, input = {}) {
  const prisma = getPrismaClient();
  const { store, orders } = await loadBill(prisma, token);
  if (!(await storeHasFeature(store.id, "REVIEWS"))) throw createHttpError(403, "This restaurant isn't taking ratings right now");
  const rateable = orders.filter(o => !o.reviewId && BILL_REVIEWABLE_STATUSES.includes(o.status) && Date.now() - o.createdAt.getTime() <= BILL_REVIEW_WINDOW_MS);
  if (rateable.length === 0) {
    throw createHttpError(409, orders.some(o => o.reviewId) ? "This bill has already been rated. Thank you!" : "This bill can't be rated right now.");
  }
  const sessionId = typeof input.sessionId === "string" ? input.sessionId.slice(0, 100) : null;
  return saveReview(prisma, store.id, rateable, { customerId: null, sessionId }, input);
}

/* ---------- Guest menu ---------- */

/**
 * Turns the stored rating totals on menu items into what guests see: an average and a count,
 * only when the store shows ratings, has the feature, and enough guests have rated the dish.
 * The raw totals never leave the server.
 */
async function decorateMenuRatings(storeId, categories) {
  const prisma = getPrismaClient();
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { showRatings: true } });
  const show = Boolean(store?.showRatings) && (await storeHasFeature(storeId, "REVIEWS"));
  return categories.map(category => ({
    ...category,
    items: category.items.map(({ ratingSum, ratingCount, ...item }) => (
      show && ratingCount >= MIN_RATINGS_TO_SHOW ? { ...item, rating: average(ratingSum, ratingCount), ratingCount } : item
    ))
  }));
}

/* ---------- Staff side ---------- */

/**
 * The Reviews page: score and spread for the period, every dish's all-time average, and the
 * reviews themselves (newest first) with what was ordered.
 *
 * @param {object} query days (7 | 30 | 90 | 365, default 30), filter ("low" = 1-2 stars, "comments"), page
 */
async function listReviews(actor, storeId, query = {}) {
  if (!REVIEW_VIEWER_ROLES.includes(actor.role)) throw createHttpError(403, "Only managers and owners can see reviews");
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  const days = [7, 30, 90, 365].includes(Number(query.days)) ? Number(query.days) : 30;
  const since = new Date(Date.now() - days * 86400000);
  const period = { storeId, createdAt: { gte: since } };
  const listWhere = { ...period };
  if (query.filter === "low") listWhere.rating = { lte: LOW_RATING };
  if (query.filter === "comments") listWhere.comment = { not: null };
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = 20;

  const [spread, total, reviews, dishes, store] = await Promise.all([
    prisma.review.groupBy({ by: ["rating"], where: period, _count: { _all: true } }),
    prisma.review.count({ where: listWhere }),
    prisma.review.findMany({
      where: listWhere,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        items: { include: { menuItem: { select: { name: true } } } },
        orders: { select: { id: true, type: true } }
      }
    }),
    prisma.menuItem.findMany({
      where: { storeId, ratingCount: { gt: 0 } },
      select: { id: true, name: true, ratingSum: true, ratingCount: true, category: { select: { name: true } } }
    }),
    prisma.store.findUnique({ where: { id: storeId }, select: { showRatings: true, googleReviewUrl: true, tenant: { select: { googleReviewUrl: true } } } })
  ]);

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let count = 0;
  let sum = 0;
  for (const row of spread) {
    distribution[row.rating] = row._count._all;
    count += row._count._all;
    sum += row.rating * row._count._all;
  }

  return {
    days,
    summary: { average: average(sum, count), count, distribution, low: distribution[1] + distribution[2] },
    dishes: dishes
      .map(d => ({ menuItemId: d.id, name: d.name, category: d.category?.name || null, average: average(d.ratingSum, d.ratingCount), count: d.ratingCount, shownToGuests: d.ratingCount >= MIN_RATINGS_TO_SHOW }))
      .sort((a, b) => b.average - a.average || b.count - a.count),
    reviews: reviews.map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      tableNumber: r.tableNumber,
      orderTotal: r.orderTotal,
      createdAt: r.createdAt,
      orderIds: r.orders.map(o => o.id),
      items: r.items.map(i => ({ name: i.menuItem?.name || "Dish", rating: i.rating }))
    })),
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
    settings: {
      showRatings: Boolean(store?.showRatings),
      googleReviewUrl: store?.googleReviewUrl || store?.tenant?.googleReviewUrl || null,
      usingBrandLink: !store?.googleReviewUrl && Boolean(store?.tenant?.googleReviewUrl),
      minRatingsToShow: MIN_RATINGS_TO_SHOW
    }
  };
}

module.exports = {
  MIN_RATINGS_TO_SHOW,
  cleanGoogleReviewUrl,
  getPendingReview,
  submitReview,
  billReviewUrl,
  getBillReview,
  submitBillReview,
  decorateMenuRatings,
  listReviews
};
