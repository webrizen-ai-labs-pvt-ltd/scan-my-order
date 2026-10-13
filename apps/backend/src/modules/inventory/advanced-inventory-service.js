const crypto = require("crypto");
const { getPrismaClient } = require("../../lib/prisma");
const { Prisma } = require("../../generated/prisma_v2");
const { createHttpError } = require("../../middleware/error-handler");
const { verifyStoreAccess } = require("../menu/menu-service");
const { invalidateMaterialsCache, invalidateMenuCache } = require("../../lib/cache");
const { evaluateMenuItemAvailability } = require("./inventory-service");

/*
 * Advanced inventory is a layer on top of the basic stock figure (RawMaterial.currentStock),
 * which the POS, recipes and "sold out" logic keep using unchanged.
 *
 * Deliveries are recorded as lots (StockBatch) with a use-by date. How much of each lot is left
 * is never stored: it is worked out from the stock figure, assuming the kitchen uses the oldest
 * lots first. So lots can never disagree with stock, and selling a dish needs no extra work.
 * Reality is brought back in line by small daily counts and by confirming expired lots.
 */

const MANAGE_ROLES = ["STORE_MANAGER", "TENANT_ADMIN", "SUPER_ADMIN"];
// Daily work in the store room: receiving, throwing away, counting
const WORK_ROLES = [...MANAGE_ROLES, "KITCHEN_STAFF", "CASHIER"];
const UNITS = ["KG", "GRAM", "LITER", "MILLILITER", "PIECE", "DOZEN"];
const WASTE_REASONS = ["Expired", "Spoiled", "Spilled or dropped", "Overcooked or burnt", "Prepared but not sold", "Returned by guest", "Other"];
const SOON_DAYS = 3;
const COUNT_PER_DAY = 6;
const EPS = 1e-6;
const DAY_MS = 86400000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const round = (n) => Math.round(n * 1000) / 1000;
const money = (n) => Math.round(n * 100) / 100;
const istNow = () => new Date(Date.now() + IST_OFFSET_MS);
const istDayKey = (date = new Date()) => new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
// Days are counted the way a kitchen counts them: by the calendar in India, not in 24-hour blocks
const istDayNumber = (time) => Math.floor((time + IST_OFFSET_MS) / DAY_MS);
/** The last moment of the day (in India) that a date falls on: stock is good through its use-by date */
function endOfIstDay(date) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 23, 59, 59, 999) - IST_OFFSET_MS);
}

function positive(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw createHttpError(400, `${label} must be more than 0`);
  return round(n);
}
const optionalText = (value, max) => (value === undefined ? undefined : String(value || "").trim().slice(0, max) || null);

async function assertAdvanced(actor, storeId, roles = WORK_ROLES) {
  if (!actor || !roles.includes(actor.role)) {
    throw createHttpError(403, roles === MANAGE_ROLES ? "Only managers and owners can change inventory setup" : "You don't have access to inventory");
  }
  await verifyStoreAccess(actor, storeId);
  const store = await getPrismaClient().store.findUnique({ where: { id: storeId }, select: { id: true, inventoryMode: true } });
  if (!store) throw createHttpError(404, "Store not found");
  if (store.inventoryMode !== "ADVANCED") {
    throw createHttpError(409, "Advanced inventory is switched off for this store. Turn it on under Store settings → Inventory.");
  }
}

/* ---------- Lots ---------- */

// The order the kitchen is assumed to use stock in: stock from before lots existed and stock
// found in a count first (nobody knows its age), then the earliest use-by date, then the oldest delivery
function useOrder(a, b) {
  const early = (x) => (x.kind === "RECEIVED" ? 1 : 0);
  if (early(a) !== early(b)) return early(a) - early(b);
  const ax = a.expiresAt ? a.expiresAt.getTime() : Infinity;
  const bx = b.expiresAt ? b.expiresAt.getTime() : Infinity;
  return ax - bx || a.receivedAt.getTime() - b.receivedAt.getTime();
}

/**
 * Works out how much of each open lot is left, from the stock on hand.
 * @returns {{ rows: Array<{ batch: object, remaining: number }>, untracked: number }}
 *          untracked: stock on hand that no lot accounts for
 */
function allocate(currentStock, openBatches) {
  const stock = Math.max(0, currentStock);
  const ordered = [...openBatches].sort(useOrder);
  const received = ordered.reduce((sum, b) => sum + b.quantity, 0);
  let used = Math.max(0, received - stock);
  const rows = ordered.map(batch => {
    const taken = Math.min(batch.quantity, used);
    used -= taken;
    return { batch, remaining: round(batch.quantity - taken) };
  });
  return { rows, untracked: round(Math.max(0, stock - received)) };
}

/**
 * Tidies one ingredient's lots after its stock changed: lots that are used up are closed, and
 * stock no lot accounts for (returned by a cancelled order, or added the basic way) becomes a
 * "found" lot. Runs inside the caller's transaction.
 */
async function tidyLots(tx, materialId) {
  const material = await tx.rawMaterial.findUnique({ where: { id: materialId }, select: { id: true, storeId: true, currentStock: true } });
  const open = await tx.stockBatch.findMany({ where: { materialId, closedAt: null } });
  const { rows, untracked } = allocate(material.currentStock, open);
  const usedUp = rows.filter(r => r.remaining <= EPS).map(r => r.batch.id);
  if (usedUp.length > 0) {
    await tx.stockBatch.updateMany({ where: { id: { in: usedUp } }, data: { closedAt: new Date(), closedReason: "USED" } });
  }
  if (untracked > EPS) {
    await tx.stockBatch.create({ data: { storeId: material.storeId, materialId, kind: "FOUND", quantity: untracked, originalQuantity: untracked } });
  }
}

function describeLot(batch, remaining, now) {
  // 0 means the use-by date is today (still good), negative means it has passed
  const daysLeft = batch.expiresAt ? istDayNumber(batch.expiresAt.getTime()) - istDayNumber(now) : null;
  return {
    id: batch.id,
    kind: batch.kind,
    remaining,
    received: batch.originalQuantity,
    unitCost: batch.unitCost,
    receivedAt: batch.receivedAt,
    expiresAt: batch.expiresAt,
    daysLeft,
    state: daysLeft === null ? "NO_DATE" : daysLeft < 0 ? "EXPIRED" : daysLeft <= SOON_DAYS ? "SOON" : "OK",
    supplierName: batch.supplier?.name || null,
    billNumber: batch.receipt?.billNumber || null
  };
}

/* ---------- Overview ---------- */

/**
 * Everything the inventory screen shows: each ingredient with its lots, and what needs
 * attention today (expired, expiring soon, running low, due for a count).
 */
async function getOverview(actor, storeId) {
  await assertAdvanced(actor, storeId);
  return computeOverview(storeId, MANAGE_ROLES.includes(actor.role));
}

/** The overview itself, without the access check (also used by the morning brief) */
async function computeOverview(storeId, canManage) {
  await postDueStandingDeliveries(storeId).catch(err => console.error("[Inventory] standing deliveries:", err.message));
  const prisma = getPrismaClient();
  const [materials, batches, suppliers] = await Promise.all([
    prisma.rawMaterial.findMany({ where: { storeId }, orderBy: { name: "asc" } }),
    prisma.stockBatch.findMany({ where: { storeId, closedAt: null }, include: { supplier: { select: { name: true } }, receipt: { select: { billNumber: true } } } }),
    prisma.supplier.count({ where: { storeId, isActive: true } })
  ]);

  const now = Date.now();
  const today = istDayKey();
  const byMaterial = new Map();
  for (const batch of batches) {
    if (!byMaterial.has(batch.materialId)) byMaterial.set(batch.materialId, []);
    byMaterial.get(batch.materialId).push(batch);
  }

  const attention = { expired: [], soon: [], low: [] };
  const list = materials.map(m => {
    const { rows, untracked } = allocate(m.currentStock, byMaterial.get(m.id) || []);
    const lots = rows.filter(r => r.remaining > EPS).map(r => describeLot(r.batch, r.remaining, now));
    const stock = Math.max(0, m.currentStock);
    const low = stock <= EPS || (m.lowStockThreshold > 0 && stock <= m.lowStockThreshold);
    for (const lot of lots) {
      const entry = { materialId: m.id, name: m.name, unit: m.unit, lotId: lot.id, remaining: lot.remaining, expiresAt: lot.expiresAt, daysLeft: lot.daysLeft, value: lot.unitCost ? money(lot.remaining * lot.unitCost) : null, supplierName: lot.supplierName };
      if (lot.state === "EXPIRED") attention.expired.push(entry);
      else if (lot.state === "SOON") attention.soon.push(entry);
    }
    if (low) attention.low.push({ materialId: m.id, name: m.name, unit: m.unit, stock: round(stock), threshold: m.lowStockThreshold });
    return {
      id: m.id,
      name: m.name,
      unit: m.unit,
      shortCode: m.shortCode,
      stock: round(stock),
      lowStockThreshold: m.lowStockThreshold,
      shelfLifeDays: m.shelfLifeDays,
      packName: m.packName,
      packSize: m.packSize,
      costPerUnit: m.costPerUnit,
      stockValue: m.costPerUnit ? money(stock * m.costPerUnit) : null,
      lastCountedAt: m.lastCountedAt,
      countedToday: Boolean(m.lastCountedAt) && istDayKey(m.lastCountedAt) === today,
      low,
      untracked,
      lots,
      worstState: lots.some(l => l.state === "EXPIRED") ? "EXPIRED" : lots.some(l => l.state === "SOON") ? "SOON" : "OK"
    };
  });

  // A few ingredients to count each day, never the whole store room: the ones counted longest
  // ago first, the most valuable first among those
  const toCount = list
    .filter(m => m.stock > EPS && !m.countedToday)
    .sort((a, b) => (a.lastCountedAt ? new Date(a.lastCountedAt).getTime() : 0) - (b.lastCountedAt ? new Date(b.lastCountedAt).getTime() : 0) || (b.stockValue || 0) - (a.stockValue || 0))
    .slice(0, COUNT_PER_DAY)
    .map(m => ({ materialId: m.id, name: m.name, unit: m.unit, stock: m.stock, lastCountedAt: m.lastCountedAt }));
  attention.expired.sort((a, b) => a.daysLeft - b.daysLeft);
  attention.soon.sort((a, b) => a.daysLeft - b.daysLeft);
  const compliance = await require("./compliance-service").getSummary(storeId);

  return {
    materials: list,
    attention: { ...attention, toCount, countedToday: list.filter(m => m.countedToday).length },
    totals: {
      materials: list.length,
      stockValue: money(list.reduce((sum, m) => sum + (m.stockValue || 0), 0)),
      expiredValue: money(attention.expired.reduce((sum, e) => sum + (e.value || 0), 0)),
      withoutCost: list.filter(m => m.stock > EPS && !m.costPerUnit).length,
      suppliers
    },
    compliance,
    // Setup (ingredients, suppliers, standing deliveries, licences) is for managers and owners
    canManage,
    wasteReasons: WASTE_REASONS,
    units: UNITS
  };
}

/* ---------- Ingredients ---------- */

function materialSetup(input, { partial }) {
  const data = {};
  if (input.name !== undefined || !partial) {
    const name = String(input.name || "").trim().slice(0, 80);
    if (name.length < 2) throw createHttpError(400, "Give the ingredient a name");
    data.name = name;
  }
  if (input.unit !== undefined || !partial) {
    if (!UNITS.includes(input.unit)) throw createHttpError(400, "Choose a unit");
    data.unit = input.unit;
  }
  if (input.lowStockThreshold !== undefined) data.lowStockThreshold = Math.max(0, Number(input.lowStockThreshold) || 0);
  if (input.shortCode !== undefined) {
    const code = String(input.shortCode || "").trim().toUpperCase();
    if (code && !/^[A-Z0-9]{1,10}$/.test(code)) throw createHttpError(400, "Short codes use letters and numbers only (up to 10)");
    data.shortCode = code || null;
  }
  if (input.shelfLifeDays !== undefined) {
    const days = input.shelfLifeDays === null || input.shelfLifeDays === "" ? null : Number(input.shelfLifeDays);
    if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) throw createHttpError(400, "Shelf life must be a whole number of days");
    data.shelfLifeDays = days;
  }
  if (input.packName !== undefined || input.packSize !== undefined) {
    const packName = String(input.packName || "").trim().slice(0, 20) || null;
    const packSize = packName ? Number(input.packSize) : null;
    if (packName && (!Number.isFinite(packSize) || packSize <= 0)) throw createHttpError(400, `Say how much one ${packName} holds`);
    data.packName = packName;
    data.packSize = packName ? round(packSize) : null;
  }
  return data;
}

async function assertCodeFree(prisma, storeId, shortCode, exceptId = null) {
  if (!shortCode) return;
  const taken = await prisma.rawMaterial.findFirst({ where: { storeId, shortCode, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { name: true } });
  if (taken) throw createHttpError(409, `Short code ${shortCode} is already used by ${taken.name}`);
}

async function createMaterial(actor, storeId, input = {}) {
  await assertAdvanced(actor, storeId, MANAGE_ROLES);
  const prisma = getPrismaClient();
  const data = materialSetup(input, { partial: false });
  await assertCodeFree(prisma, storeId, data.shortCode);
  const created = await prisma.rawMaterial.create({ data: { storeId, currentStock: 0, ...data } });
  invalidateMaterialsCache(storeId);
  return created;
}

async function updateMaterial(actor, storeId, materialId, input = {}) {
  await assertAdvanced(actor, storeId, MANAGE_ROLES);
  const prisma = getPrismaClient();
  const material = await prisma.rawMaterial.findUnique({ where: { id: materialId } });
  if (!material || material.storeId !== storeId) throw createHttpError(404, "Ingredient not found");
  const data = materialSetup(input, { partial: true });
  await assertCodeFree(prisma, storeId, data.shortCode, materialId);
  const updated = await prisma.rawMaterial.update({ where: { id: materialId }, data });
  invalidateMaterialsCache(storeId);
  return updated;
}

/* ---------- Receiving ---------- */

/**
 * Records a delivery: one lot per line, stock goes up, dishes that were sold out come back.
 * The use-by date is filled in from the ingredient's shelf life when it isn't given.
 *
 * @param {object} input supplierId?, billNumber?, note?, receivedAt?, lines: [{ materialId, quantity, unitCost?, expiresAt? }]
 * @param {object} [system] Used when a standing delivery posts itself: { source, standingDeliveryId, receivedAt }
 */
async function receiveDelivery(actor, storeId, input = {}, system = null) {
  const prisma = getPrismaClient();
  const lines = Array.isArray(input.lines) ? input.lines : [];
  if (lines.length === 0) throw createHttpError(400, "Add at least one item to the delivery");
  if (lines.length > 100) throw createHttpError(400, "That's too many lines for one delivery. Split it in two.");

  const receivedAt = system?.receivedAt || (input.receivedAt ? new Date(input.receivedAt) : new Date());
  if (Number.isNaN(receivedAt.getTime()) || receivedAt.getTime() > Date.now() + DAY_MS) throw createHttpError(400, "The delivery date isn't valid");

  // Looked up side by side: every trip to the database is time someone stands waiting at the door
  const [, materials, supplier] = await Promise.all([
    system ? null : assertAdvanced(actor, storeId),
    prisma.rawMaterial.findMany({ where: { storeId, id: { in: lines.map(l => String(l.materialId)) } } }),
    input.supplierId ? prisma.supplier.findUnique({ where: { id: String(input.supplierId) } }) : null
  ]);
  const byId = new Map(materials.map(m => [m.id, m]));
  if (input.supplierId && (!supplier || supplier.storeId !== storeId)) throw createHttpError(404, "Supplier not found");

  const clean = lines.map(line => {
    const material = byId.get(String(line.materialId));
    if (!material) throw createHttpError(400, "One of the items isn't an ingredient of this store");
    const quantity = positive(line.quantity, `Quantity of ${material.name}`);
    const unitCost = line.unitCost === undefined || line.unitCost === null || line.unitCost === "" ? null : Number(line.unitCost);
    if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) throw createHttpError(400, `The price of ${material.name} isn't valid`);
    let expiresAt = line.expiresAt ? new Date(line.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) throw createHttpError(400, `The use-by date of ${material.name} isn't valid`);
    if (!expiresAt && material.shelfLifeDays) expiresAt = new Date(receivedAt.getTime() + material.shelfLifeDays * DAY_MS);
    if (expiresAt) expiresAt = endOfIstDay(expiresAt);
    return { material, quantity, unitCost, expiresAt };
  });
  const totalCost = money(clean.reduce((sum, l) => sum + (l.unitCost ? l.unitCost * l.quantity : 0), 0));

  const billNumber = optionalText(input.billNumber, 40) || null;
  const receivedByName = actor ? (actor.name || actor.email || null) : "Standing delivery";
  const reference = `Delivery${supplier ? ` from ${supplier.name}` : ""}${billNumber ? `, bill ${billNumber}` : ""}`;

  // What each ingredient goes up by (it may be on the delivery twice), and the latest price paid
  const increases = new Map();
  for (const line of clean) {
    const entry = increases.get(line.material.id) || { quantity: 0, unitCost: null };
    entry.quantity = round(entry.quantity + line.quantity);
    if (line.unitCost !== null) entry.unitCost = line.unitCost;
    increases.set(line.material.id, entry);
  }
  const receiptId = `c${Date.now().toString(36)}${crypto.randomBytes(8).toString("hex")}`;

  // The whole delivery is written in one go, in four statements however long it is (the receipt,
  // its lots, the stock figures, the history): it all lands or none of it does
  const [receipt] = await prisma.$transaction([
    prisma.stockReceipt.create({
      data: {
        id: receiptId,
        storeId,
        supplierId: supplier?.id || null,
        billNumber,
        note: optionalText(input.note, 200) || null,
        totalCost,
        source: system?.source || "MANUAL",
        standingDeliveryId: system?.standingDeliveryId || null,
        receivedById: actor?.id || null,
        receivedByName,
        receivedAt
      }
    }),
    prisma.stockBatch.createMany({
      data: clean.map(line => ({ storeId, materialId: line.material.id, receiptId, supplierId: supplier?.id || null, kind: "RECEIVED", quantity: line.quantity, originalQuantity: line.quantity, unitCost: line.unitCost, receivedAt, expiresAt: line.expiresAt }))
    }),
    prisma.$executeRaw`
      UPDATE "RawMaterial" AS m
      SET "currentStock" = m."currentStock" + v.quantity,
          "costPerUnit" = COALESCE(v.cost, m."costPerUnit"),
          "updatedAt" = NOW()
      FROM (VALUES ${Prisma.join([...increases].map(([id, e]) => Prisma.sql`(${id}, ${e.quantity}::double precision, ${e.unitCost}::double precision)`))}) AS v(id, quantity, cost)
      WHERE m.id = v.id AND m."storeId" = ${storeId}`,
    prisma.stockTransaction.createMany({
      data: clean.map(line => ({ materialId: line.material.id, type: "RESTOCK", quantity: line.quantity, reference, actorName: receivedByName }))
    })
  ]);

  invalidateMaterialsCache(storeId);
  invalidateMenuCache(storeId);

  // The stock is saved; the rest follows without keeping anyone waiting. Per ingredient, a few
  // at a time: lots tidied, and dishes that were sold out for want of it come back on the menu.
  (async () => {
    const materialIds = [...increases.keys()];
    for (let i = 0; i < materialIds.length; i += 4) {
      await Promise.all(materialIds.slice(i, i + 4).map(async (materialId) => {
        await prisma.$transaction((tx) => tidyLots(tx, materialId), { timeout: 20000 });
        await evaluateMenuItemAvailability(prisma, materialId);
      }));
    }
    invalidateMenuCache(storeId);
  })().catch(error => console.error(`[Inventory] Follow-up of delivery ${receipt.id} failed:`, error.message));

  return { id: receipt.id, totalCost, lines: clean.length };
}

/** Past deliveries, newest first, with their lines: the trail from a dish back to a supplier's bill */
async function listReceipts(actor, storeId, query = {}) {
  await assertAdvanced(actor, storeId);
  const prisma = getPrismaClient();
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = 15;
  const where = { storeId, ...(query.supplierId ? { supplierId: String(query.supplierId) } : {}) };
  const [total, receipts] = await Promise.all([
    prisma.stockReceipt.count({ where }),
    prisma.stockReceipt.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { supplier: { select: { name: true } }, batches: { include: { material: { select: { name: true, unit: true } } } } }
    })
  ]);
  return {
    receipts: receipts.map(r => ({
      id: r.id,
      supplierName: r.supplier?.name || null,
      billNumber: r.billNumber,
      note: r.note,
      totalCost: r.totalCost,
      source: r.source,
      receivedByName: r.receivedByName,
      receivedAt: r.receivedAt,
      lines: r.batches.map(b => ({ name: b.material.name, unit: b.material.unit, quantity: b.originalQuantity, unitCost: b.unitCost, expiresAt: b.expiresAt }))
    })),
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) }
  };
}

/* ---------- Wastage, counts, expired lots ---------- */

/**
 * Something was thrown away. With a lot, it comes off that lot; without one, it is taken from
 * the oldest stock like normal use.
 * @param {object} input materialId, quantity, reason, lotId?
 */
async function recordWaste(actor, storeId, input = {}) {
  await assertAdvanced(actor, storeId);
  const prisma = getPrismaClient();
  const reason = String(input.reason || "").trim().slice(0, 120);
  if (reason.length < 3) throw createHttpError(400, "Say why it was thrown away");
  const material = await prisma.rawMaterial.findUnique({ where: { id: String(input.materialId || "") } });
  if (!material || material.storeId !== storeId) throw createHttpError(404, "Ingredient not found");
  const quantity = positive(input.quantity, "Quantity");
  if (quantity > Math.max(0, material.currentStock) + EPS) {
    throw createHttpError(400, `Only ${round(Math.max(0, material.currentStock))} ${material.unit} of ${material.name} is in stock`);
  }

  await prisma.$transaction(async (tx) => {
    if (input.lotId) {
      const open = await tx.stockBatch.findMany({ where: { materialId: material.id, closedAt: null } });
      const row = allocate(material.currentStock, open).rows.find(r => r.batch.id === String(input.lotId));
      if (!row) throw createHttpError(404, "That lot is no longer in stock");
      if (quantity > row.remaining + EPS) throw createHttpError(400, `Only ${row.remaining} ${material.unit} of that lot is left`);
      const left = round(row.batch.quantity - quantity);
      await tx.stockBatch.update({ where: { id: row.batch.id }, data: left <= EPS ? { quantity: 0, closedAt: new Date(), closedReason: "WASTED" } : { quantity: left } });
    }
    await tx.rawMaterial.update({ where: { id: material.id }, data: { currentStock: { decrement: quantity } } });
    await tx.stockTransaction.create({
      data: { materialId: material.id, type: "WASTE", quantity: -quantity, reason, batchId: input.lotId ? String(input.lotId) : null, actorName: actor.name || actor.email || null, reference: `Wastage: ${reason}` }
    });
    await tidyLots(tx, material.id);
    await evaluateMenuItemAvailability(tx, material.id);
  }, { timeout: 20000 });

  invalidateMaterialsCache(storeId);
  invalidateMenuCache(storeId);
  return { materialId: material.id, wasted: quantity, value: material.costPerUnit ? money(quantity * material.costPerUnit) : null };
}

/**
 * An expired lot that the screen still shows as in stock, but the kitchen says was used up in
 * time (they didn't use the oldest first). It is closed; the stock on hand is unchanged.
 */
async function confirmLotUsed(actor, storeId, lotId) {
  await assertAdvanced(actor, storeId);
  const prisma = getPrismaClient();
  const lot = await prisma.stockBatch.findUnique({ where: { id: lotId } });
  if (!lot || lot.storeId !== storeId || lot.closedAt) throw createHttpError(404, "That lot is no longer in stock");
  await prisma.$transaction(async (tx) => {
    await tx.stockBatch.update({ where: { id: lotId }, data: { closedAt: new Date(), closedReason: "CHECKED" } });
    await tidyLots(tx, lot.materialId);
  });
  invalidateMaterialsCache(storeId);
  return { lotId };
}

/**
 * A counted figure replaces the stock figure. Less than expected is recorded as a shortfall
 * (unrecorded use, wastage or theft); more than expected becomes a "found" lot.
 * @param {object} input counts: [{ materialId, counted }]
 */
async function recordCounts(actor, storeId, input = {}) {
  await assertAdvanced(actor, storeId);
  const prisma = getPrismaClient();
  const counts = Array.isArray(input.counts) ? input.counts : [];
  if (counts.length === 0) throw createHttpError(400, "Enter at least one count");
  const materials = await prisma.rawMaterial.findMany({ where: { storeId, id: { in: counts.map(c => String(c.materialId)) } } });
  const byId = new Map(materials.map(m => [m.id, m]));

  const results = [];
  await prisma.$transaction(async (tx) => {
    for (const entry of counts) {
      const material = byId.get(String(entry.materialId));
      if (!material) throw createHttpError(400, "One of the items isn't an ingredient of this store");
      const counted = Number(entry.counted);
      if (!Number.isFinite(counted) || counted < 0) throw createHttpError(400, `The count for ${material.name} isn't valid`);
      const expected = Math.max(0, material.currentStock);
      const difference = round(counted - expected);
      await tx.rawMaterial.update({ where: { id: material.id }, data: { currentStock: round(counted), lastCountedAt: new Date() } });
      if (Math.abs(difference) > EPS) {
        await tx.stockTransaction.create({
          data: { materialId: material.id, type: "COUNT", quantity: difference, reason: difference < 0 ? "Shortfall found in count" : "Extra found in count", actorName: actor.name || actor.email || null, reference: `Counted ${round(counted)}, expected ${round(expected)}` }
        });
      }
      await tidyLots(tx, material.id);
      await evaluateMenuItemAvailability(tx, material.id);
      results.push({ materialId: material.id, name: material.name, unit: material.unit, expected: round(expected), counted: round(counted), difference, value: material.costPerUnit ? money(difference * material.costPerUnit) : null });
    }
  }, { timeout: 30000 });

  invalidateMaterialsCache(storeId);
  invalidateMenuCache(storeId);
  return { results };
}

/** Recent wastage and count differences: where stock went other than into dishes */
async function listLosses(actor, storeId, query = {}) {
  await assertAdvanced(actor, storeId);
  const days = [7, 30, 90].includes(Number(query.days)) ? Number(query.days) : 30;
  const rows = await getPrismaClient().stockTransaction.findMany({
    where: { type: { in: ["WASTE", "COUNT"] }, createdAt: { gte: new Date(Date.now() - days * DAY_MS) }, material: { storeId } },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { material: { select: { name: true, unit: true, costPerUnit: true } } }
  });
  const entries = rows.map(r => ({
    id: r.id,
    type: r.type,
    name: r.material.name,
    unit: r.material.unit,
    quantity: r.quantity,
    value: r.material.costPerUnit ? money(r.quantity * r.material.costPerUnit) : null,
    reason: r.reason,
    actorName: r.actorName,
    createdAt: r.createdAt
  }));
  const lost = (type) => money(entries.filter(e => e.type === type && e.quantity < 0).reduce((sum, e) => sum + Math.abs(e.value || 0), 0));
  return { days, entries, wasteValue: lost("WASTE"), shortfallValue: lost("COUNT") };
}

/* ---------- Suppliers ---------- */

function supplierData(input, { partial }) {
  const data = {};
  if (input.name !== undefined || !partial) {
    const name = String(input.name || "").trim().slice(0, 80);
    if (name.length < 2) throw createHttpError(400, "Give the supplier a name");
    data.name = name;
  }
  if (input.phone !== undefined) data.phone = optionalText(input.phone, 20);
  if (input.fssaiNumber !== undefined) {
    const fssai = String(input.fssaiNumber || "").replace(/\s/g, "");
    if (fssai && !/^\d{14}$/.test(fssai)) throw createHttpError(400, "An FSSAI licence number has 14 digits");
    data.fssaiNumber = fssai || null;
  }
  if (input.gstin !== undefined) data.gstin = optionalText(String(input.gstin || "").toUpperCase(), 15);
  if (input.notes !== undefined) data.notes = optionalText(input.notes, 200);
  if (typeof input.isActive === "boolean") data.isActive = input.isActive;
  return data;
}

/** Suppliers with what they brought last time, ready to be received again with a tap */
async function listSuppliers(actor, storeId) {
  await assertAdvanced(actor, storeId);
  const prisma = getPrismaClient();
  const suppliers = await prisma.supplier.findMany({
    where: { storeId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { receipts: true } },
      receipts: { where: { source: "MANUAL" }, orderBy: { receivedAt: "desc" }, take: 1, include: { batches: { select: { materialId: true, originalQuantity: true, unitCost: true } } } }
    }
  });
  return suppliers.map(({ receipts, _count, ...s }) => ({
    ...s,
    deliveries: _count.receipts,
    lastDeliveryAt: receipts[0]?.receivedAt || null,
    lastLines: (receipts[0]?.batches || []).map(b => ({ materialId: b.materialId, quantity: b.originalQuantity, unitCost: b.unitCost }))
  }));
}

async function saveSupplier(actor, storeId, supplierId, input = {}) {
  await assertAdvanced(actor, storeId, MANAGE_ROLES);
  const prisma = getPrismaClient();
  if (!supplierId) return prisma.supplier.create({ data: { storeId, ...supplierData(input, { partial: false }) } });
  const existing = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!existing || existing.storeId !== storeId) throw createHttpError(404, "Supplier not found");
  return prisma.supplier.update({ where: { id: supplierId }, data: supplierData(input, { partial: true }) });
}

/* ---------- Standing deliveries ---------- */

async function standingData(prisma, storeId, input, { partial }) {
  const data = {};
  if (input.name !== undefined || !partial) {
    const name = String(input.name || "").trim().slice(0, 60);
    if (name.length < 2) throw createHttpError(400, "Give the standing delivery a name, like “Morning milk”");
    data.name = name;
  }
  if (input.daysOfWeek !== undefined || !partial) {
    const days = [...new Set((Array.isArray(input.daysOfWeek) ? input.daysOfWeek : []).map(Number))].filter(d => Number.isInteger(d) && d >= 0 && d <= 6).sort();
    if (days.length === 0) throw createHttpError(400, "Choose at least one day it arrives");
    data.daysOfWeek = days;
  }
  if (input.arrivesByHour !== undefined) {
    const hour = Number(input.arrivesByHour);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw createHttpError(400, "Choose the hour it has arrived by");
    data.arrivesByHour = hour;
  }
  if (input.lines !== undefined || !partial) {
    const lines = Array.isArray(input.lines) ? input.lines : [];
    if (lines.length === 0) throw createHttpError(400, "Add at least one item");
    const known = new Set((await prisma.rawMaterial.findMany({ where: { storeId, id: { in: lines.map(l => String(l.materialId)) } }, select: { id: true } })).map(m => m.id));
    data.lines = lines.map(l => {
      if (!known.has(String(l.materialId))) throw createHttpError(400, "One of the items isn't an ingredient of this store");
      const unitCost = l.unitCost === undefined || l.unitCost === null || l.unitCost === "" ? null : Number(l.unitCost);
      return { materialId: String(l.materialId), quantity: positive(l.quantity, "Quantity"), unitCost: Number.isFinite(unitCost) && unitCost >= 0 ? unitCost : null };
    });
  }
  if (input.supplierId !== undefined) {
    if (input.supplierId) {
      const supplier = await prisma.supplier.findUnique({ where: { id: String(input.supplierId) } });
      if (!supplier || supplier.storeId !== storeId) throw createHttpError(404, "Supplier not found");
      data.supplierId = supplier.id;
    } else data.supplierId = null;
  }
  if (typeof input.isActive === "boolean") data.isActive = input.isActive;
  return data;
}

async function listStanding(actor, storeId) {
  await assertAdvanced(actor, storeId);
  return getPrismaClient().standingDelivery.findMany({ where: { storeId }, orderBy: [{ isActive: "desc" }, { name: "asc" }], include: { supplier: { select: { name: true } } } });
}

async function saveStanding(actor, storeId, id, input = {}) {
  await assertAdvanced(actor, storeId, MANAGE_ROLES);
  const prisma = getPrismaClient();
  if (!id) {
    const data = await standingData(prisma, storeId, input, { partial: false });
    // A delivery set up today starts tomorrow: today's has usually been received by hand already
    return prisma.standingDelivery.create({ data: { storeId, ...data, lastPostedOn: istDayKey() } });
  }
  const existing = await prisma.standingDelivery.findUnique({ where: { id } });
  if (!existing || existing.storeId !== storeId) throw createHttpError(404, "Standing delivery not found");
  return prisma.standingDelivery.update({ where: { id }, data: await standingData(prisma, storeId, input, { partial: true }) });
}

async function deleteStanding(actor, storeId, id) {
  await assertAdvanced(actor, storeId, MANAGE_ROLES);
  const prisma = getPrismaClient();
  const existing = await prisma.standingDelivery.findUnique({ where: { id } });
  if (!existing || existing.storeId !== storeId) throw createHttpError(404, "Standing delivery not found");
  await prisma.standingDelivery.delete({ where: { id } });
  return { id };
}

// Each store is checked at most once every few minutes: this runs when menus are loaded
const standingChecked = new Map();

/**
 * Posts today's standing deliveries that are due and not yet posted. Safe to call often:
 * each delivery is claimed for the day before it is posted, so it can never be posted twice.
 */
async function postDueStandingDeliveries(storeId, { force = false } = {}) {
  const last = standingChecked.get(storeId) || 0;
  if (!force && Date.now() - last < 5 * 60 * 1000) return 0;
  standingChecked.set(storeId, Date.now());

  const prisma = getPrismaClient();
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { inventoryMode: true } });
  if (store?.inventoryMode !== "ADVANCED") return 0;

  const now = istNow();
  const today = istDayKey();
  const due = (await prisma.standingDelivery.findMany({ where: { storeId, isActive: true } }))
    .filter(d => d.daysOfWeek.includes(now.getUTCDay()) && now.getUTCHours() >= d.arrivesByHour && d.lastPostedOn !== today);

  let posted = 0;
  for (const delivery of due) {
    const claim = await prisma.standingDelivery.updateMany({ where: { id: delivery.id, OR: [{ lastPostedOn: null }, { lastPostedOn: { not: today } }] }, data: { lastPostedOn: today } });
    if (claim.count === 0) continue;
    try {
      // Ingredients deleted since it was set up are skipped
      const known = new Set((await prisma.rawMaterial.findMany({ where: { storeId, id: { in: delivery.lines.map(l => l.materialId) } }, select: { id: true } })).map(m => m.id));
      const lines = delivery.lines.filter(l => known.has(l.materialId));
      if (lines.length > 0) {
        await receiveDelivery(null, storeId, { supplierId: delivery.supplierId, note: delivery.name, lines }, { source: "STANDING", standingDeliveryId: delivery.id, receivedAt: new Date() });
        posted += 1;
      }
    } catch (error) {
      console.error(`[Inventory] Standing delivery ${delivery.id} could not be posted:`, error.message);
      // Give the day back so it is tried again
      await prisma.standingDelivery.update({ where: { id: delivery.id }, data: { lastPostedOn: delivery.lastPostedOn } }).catch(() => {});
    }
  }
  return posted;
}

/* ---------- Food cost ---------- */

/** What each dish costs to make, from its recipe and the last price paid for each ingredient */
async function getFoodCost(actor, storeId) {
  await assertAdvanced(actor, storeId, MANAGE_ROLES);
  const items = await getPrismaClient().menuItem.findMany({
    where: { storeId, recipe: { some: {} } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, price: true, category: { select: { name: true } }, recipe: { select: { quantity: true, rawMaterial: { select: { name: true, unit: true, costPerUnit: true } } } } }
  });
  const dishes = items.map(item => {
    const missing = item.recipe.filter(r => !r.rawMaterial.costPerUnit).map(r => r.rawMaterial.name);
    const cost = money(item.recipe.reduce((sum, r) => sum + r.quantity * (r.rawMaterial.costPerUnit || 0), 0));
    return {
      id: item.id,
      name: item.name,
      category: item.category?.name || null,
      price: item.price,
      cost,
      // Only meaningful when every ingredient has a price
      costPercent: missing.length === 0 && item.price > 0 ? Math.round((cost / item.price) * 1000) / 10 : null,
      margin: missing.length === 0 ? money(item.price - cost) : null,
      missingCosts: missing,
      ingredients: item.recipe.length
    };
  });
  return { dishes, withoutRecipe: await getPrismaClient().menuItem.count({ where: { storeId, recipe: { none: {} } } }) };
}

/* ---------- Switching a store between Basic and Advanced ---------- */

/**
 * Called when a store's inventory mode changes. Turning Advanced on wraps the stock already
 * on the shelves in "opening" lots (no use-by date known). Turning it off changes nothing:
 * the stock figure is the same in both modes and the lots are kept for when it's turned back on.
 */
async function onModeChanged(storeId, mode) {
  if (mode !== "ADVANCED") return;
  const prisma = getPrismaClient();
  const materials = await prisma.rawMaterial.findMany({ where: { storeId, currentStock: { gt: 0 } }, select: { id: true } });
  await prisma.$transaction(async (tx) => {
    for (const material of materials) {
      const open = await tx.stockBatch.findMany({ where: { materialId: material.id, closedAt: null } });
      const current = await tx.rawMaterial.findUnique({ where: { id: material.id }, select: { currentStock: true } });
      const { untracked } = allocate(current.currentStock, open);
      if (untracked > EPS) {
        await tx.stockBatch.create({ data: { storeId, materialId: material.id, kind: "OPENING", quantity: untracked, originalQuantity: untracked } });
      }
    }
  }, { timeout: 30000 });
  standingChecked.delete(storeId);
}

module.exports = {
  MANAGE_ROLES,
  assertAdvanced,
  computeOverview,
  allocate,
  getOverview,
  createMaterial,
  updateMaterial,
  receiveDelivery,
  listReceipts,
  recordWaste,
  confirmLotUsed,
  recordCounts,
  listLosses,
  listSuppliers,
  saveSupplier,
  listStanding,
  saveStanding,
  deleteStanding,
  postDueStandingDeliveries,
  getFoodCost,
  onModeChanged
};
