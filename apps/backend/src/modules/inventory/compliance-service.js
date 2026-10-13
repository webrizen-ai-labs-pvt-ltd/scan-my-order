const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const inventory = require("./advanced-inventory-service");

/*
 * Food-safety records, part of Advanced inventory: the hygiene checks a kitchen does each day,
 * the licences the store must keep valid, and the inspection pack that puts both next to the
 * stock, supplier and wastage records the system already has.
 *
 * Days are India calendar days. A check redone the same day replaces that day's entry;
 * earlier days are a record and are never edited.
 */

const DAY_MS = 86400000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const LICENCE_SOON_DAYS = 30;
const CHECK_KINDS = ["CHECK", "TEMPERATURE"];
const LICENCE_KINDS = {
  FSSAI: "FSSAI licence",
  FIRE: "Fire safety certificate",
  PEST_CONTROL: "Pest control contract",
  WATER_TEST: "Water test report",
  HEALTH_TRADE: "Health / trade licence",
  MEDICAL: "Staff medical fitness certificates",
  OTHER: "Other"
};

// A starting list a store can edit. Temperatures are the usual cold, frozen and hot-holding limits.
const STANDARD_CHECKS = [
  { name: "Fridge temperature", kind: "TEMPERATURE", minValue: 0, maxValue: 5 },
  { name: "Freezer temperature", kind: "TEMPERATURE", minValue: null, maxValue: -18 },
  { name: "Hot food held hot", kind: "TEMPERATURE", minValue: 60, maxValue: null },
  { name: "Hand-wash station has soap and running water", kind: "CHECK" },
  { name: "Work surfaces and chopping boards cleaned and sanitised", kind: "CHECK" },
  { name: "Raw and cooked food stored separately, covered and labelled", kind: "CHECK" },
  { name: "Staff in clean uniform with cap and gloves", kind: "CHECK" },
  { name: "No sign of pests", kind: "CHECK" },
  { name: "Bins emptied and covered", kind: "CHECK" },
  { name: "Drinking water filter working", kind: "CHECK" }
];

const dayKey = (date = new Date()) => new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
const dayNumber = (time) => Math.floor((time + IST_OFFSET_MS) / DAY_MS);
const text = (value, max) => String(value || "").trim().slice(0, max) || null;
const actorName = (actor) => actor?.name || actor?.email || null;

/** Whether a reading is inside a check's range (an open end has no limit) */
function inRange(check, value) {
  return (check.minValue === null || value >= check.minValue) && (check.maxValue === null || value <= check.maxValue);
}

function describeCheck(check) {
  return { id: check.id, name: check.name, kind: check.kind, minValue: check.minValue, maxValue: check.maxValue, sortOrder: check.sortOrder, isActive: check.isActive };
}
function describeLog(log) {
  return { ok: log.ok, value: log.value, note: log.note, actorName: log.actorName, at: log.updatedAt };
}

/* ---------- Hygiene checks ---------- */

/** Today's checks with what has been recorded, and how the last week went */
async function getChecks(actor, storeId) {
  await inventory.assertAdvanced(actor, storeId);
  const prisma = getPrismaClient();
  const today = dayKey();
  const weekAgo = dayKey(new Date(Date.now() - 7 * DAY_MS));
  const [checks, logs] = await Promise.all([
    prisma.hygieneCheck.findMany({ where: { storeId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.hygieneLog.findMany({ where: { storeId, day: { gte: weekAgo } } })
  ]);
  const active = checks.filter(c => c.isActive);
  const todayLogs = new Map(logs.filter(l => l.day === today).map(l => [l.checkId, l]));

  // The seven days before today: how many of the checks that existed then were done
  const history = [];
  for (let back = 1; back <= 7; back += 1) {
    const date = new Date(Date.now() - back * DAY_MS);
    const day = dayKey(date);
    const existed = active.filter(c => dayKey(c.createdAt) <= day).length;
    const dayLogs = logs.filter(l => l.day === day);
    history.push({ day, total: existed, done: dayLogs.length, problems: dayLogs.filter(l => !l.ok).length });
  }

  return {
    day: today,
    checks: active.map(c => ({ ...describeCheck(c), log: todayLogs.has(c.id) ? describeLog(todayLogs.get(c.id)) : null })),
    paused: checks.filter(c => !c.isActive).map(describeCheck),
    history,
    kinds: CHECK_KINDS
  };
}

/**
 * Records one check for today.
 * @param {object} input checkId, and `ok` (yes/no checks) or `value` (temperature); note?
 */
async function logCheck(actor, storeId, input = {}) {
  await inventory.assertAdvanced(actor, storeId);
  const prisma = getPrismaClient();
  const check = await prisma.hygieneCheck.findUnique({ where: { id: String(input.checkId || "") } });
  if (!check || check.storeId !== storeId || !check.isActive) throw createHttpError(404, "Check not found");

  let ok;
  let value = null;
  if (check.kind === "TEMPERATURE") {
    value = Number(input.value);
    if (input.value === "" || input.value === null || input.value === undefined || !Number.isFinite(value) || value < -100 || value > 300) {
      throw createHttpError(400, `Enter the reading for ${check.name}`);
    }
    value = Math.round(value * 10) / 10;
    ok = inRange(check, value);
  } else {
    if (typeof input.ok !== "boolean") throw createHttpError(400, `Say whether ${check.name} is fine or not`);
    ok = input.ok;
  }

  const data = { ok, value, note: text(input.note, 200), actorId: actor.id, actorName: actorName(actor) };
  const day = dayKey();
  const log = await prisma.hygieneLog.upsert({
    where: { checkId_day: { checkId: check.id, day } },
    update: data,
    create: { storeId, checkId: check.id, day, ...data }
  });
  return { checkId: check.id, log: describeLog(log) };
}

function checkData(input, { partial }) {
  const data = {};
  if (input.name !== undefined || !partial) {
    const name = String(input.name || "").trim().slice(0, 100);
    if (name.length < 3) throw createHttpError(400, "Say what is being checked");
    data.name = name;
  }
  if (input.kind !== undefined || !partial) {
    if (!CHECK_KINDS.includes(input.kind)) throw createHttpError(400, "Choose yes/no or temperature");
    data.kind = input.kind;
  }
  if (input.minValue !== undefined || input.maxValue !== undefined) {
    const limit = (value) => (value === null || value === "" || value === undefined ? null : Number(value));
    const min = limit(input.minValue);
    const max = limit(input.maxValue);
    if ((min !== null && !Number.isFinite(min)) || (max !== null && !Number.isFinite(max))) throw createHttpError(400, "The temperature limits must be numbers");
    if (min !== null && max !== null && min > max) throw createHttpError(400, "The lowest temperature is above the highest");
    data.minValue = min;
    data.maxValue = max;
  }
  if (typeof input.isActive === "boolean") data.isActive = input.isActive;
  return data;
}

async function saveCheck(actor, storeId, checkId, input = {}) {
  await inventory.assertAdvanced(actor, storeId, inventory.MANAGE_ROLES);
  const prisma = getPrismaClient();
  if (!checkId) {
    const data = checkData(input, { partial: false });
    if (data.kind === "TEMPERATURE" && data.minValue == null && data.maxValue == null) throw createHttpError(400, "Give the lowest or the highest temperature allowed");
    const last = await prisma.hygieneCheck.findFirst({ where: { storeId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    return describeCheck(await prisma.hygieneCheck.create({ data: { storeId, ...data, sortOrder: (last?.sortOrder ?? -1) + 1 } }));
  }
  const existing = await prisma.hygieneCheck.findUnique({ where: { id: checkId } });
  if (!existing || existing.storeId !== storeId) throw createHttpError(404, "Check not found");
  const data = checkData(input, { partial: true });
  // What a check measures can't change once it has a history: that would rewrite past records
  delete data.kind;
  return describeCheck(await prisma.hygieneCheck.update({ where: { id: checkId }, data }));
}

/** Gives a store with no checks the standard list to start from */
async function addStandardChecks(actor, storeId) {
  await inventory.assertAdvanced(actor, storeId, inventory.MANAGE_ROLES);
  const prisma = getPrismaClient();
  if (await prisma.hygieneCheck.count({ where: { storeId } }) > 0) throw createHttpError(409, "This store already has its own checks");
  await prisma.hygieneCheck.createMany({
    data: STANDARD_CHECKS.map((c, i) => ({ storeId, name: c.name, kind: c.kind, minValue: c.minValue ?? null, maxValue: c.maxValue ?? null, sortOrder: i }))
  });
  return { added: STANDARD_CHECKS.length };
}

/* ---------- Licences ---------- */

function describeLicence(licence, now = Date.now()) {
  const daysLeft = licence.expiresOn ? dayNumber(licence.expiresOn.getTime()) - dayNumber(now) : null;
  return {
    id: licence.id,
    kind: licence.kind,
    kindLabel: LICENCE_KINDS[licence.kind] || LICENCE_KINDS.OTHER,
    name: licence.name,
    number: licence.number,
    issuedBy: licence.issuedBy,
    expiresOn: licence.expiresOn,
    notes: licence.notes,
    daysLeft,
    state: daysLeft === null ? "NO_DATE" : daysLeft < 0 ? "EXPIRED" : daysLeft <= LICENCE_SOON_DAYS ? "SOON" : "OK"
  };
}

const licenceOrder = (a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) || a.name.localeCompare(b.name);

async function listLicences(actor, storeId) {
  await inventory.assertAdvanced(actor, storeId, inventory.MANAGE_ROLES);
  const licences = await getPrismaClient().storeLicence.findMany({ where: { storeId } });
  return {
    licences: licences.map(l => describeLicence(l)).sort(licenceOrder),
    kinds: Object.entries(LICENCE_KINDS).map(([id, label]) => ({ id, label }))
  };
}

function licenceData(input, { partial }) {
  const data = {};
  if (input.kind !== undefined || !partial) {
    if (!LICENCE_KINDS[input.kind]) throw createHttpError(400, "Choose what kind of licence this is");
    data.kind = input.kind;
  }
  if (input.name !== undefined || !partial) {
    const name = String(input.name || "").trim().slice(0, 80) || LICENCE_KINDS[data.kind || input.kind] || "";
    if (name.length < 2) throw createHttpError(400, "Give the licence a name");
    data.name = name;
  }
  if (input.number !== undefined) data.number = text(input.number, 40);
  if (input.issuedBy !== undefined) data.issuedBy = text(input.issuedBy, 80);
  if (input.notes !== undefined) data.notes = text(input.notes, 200);
  if (input.expiresOn !== undefined) {
    if (!input.expiresOn) data.expiresOn = null;
    else {
      const date = new Date(input.expiresOn);
      if (Number.isNaN(date.getTime())) throw createHttpError(400, "The expiry date isn't valid");
      // Valid through the whole of its last day, in India
      const ist = new Date(date.getTime() + IST_OFFSET_MS);
      data.expiresOn = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 23, 59, 59, 999) - IST_OFFSET_MS);
    }
  }
  return data;
}

async function saveLicence(actor, storeId, licenceId, input = {}) {
  await inventory.assertAdvanced(actor, storeId, inventory.MANAGE_ROLES);
  const prisma = getPrismaClient();
  if (!licenceId) return describeLicence(await prisma.storeLicence.create({ data: { storeId, ...licenceData(input, { partial: false }) } }));
  const existing = await prisma.storeLicence.findUnique({ where: { id: licenceId } });
  if (!existing || existing.storeId !== storeId) throw createHttpError(404, "Licence not found");
  return describeLicence(await prisma.storeLicence.update({ where: { id: licenceId }, data: licenceData(input, { partial: true }) }));
}

async function deleteLicence(actor, storeId, licenceId) {
  await inventory.assertAdvanced(actor, storeId, inventory.MANAGE_ROLES);
  const prisma = getPrismaClient();
  const existing = await prisma.storeLicence.findUnique({ where: { id: licenceId } });
  if (!existing || existing.storeId !== storeId) throw createHttpError(404, "Licence not found");
  await prisma.storeLicence.delete({ where: { id: licenceId } });
  return { id: licenceId };
}

/* ---------- Summary for the Today screen ---------- */

/** Where today's checks stand and which licences need renewing (no access check: for getOverview) */
async function getSummary(storeId) {
  const prisma = getPrismaClient();
  const today = dayKey();
  const [checks, logs, licences] = await Promise.all([
    prisma.hygieneCheck.count({ where: { storeId, isActive: true } }),
    prisma.hygieneLog.findMany({ where: { storeId, day: today, check: { isActive: true } }, select: { ok: true } }),
    prisma.storeLicence.findMany({ where: { storeId, expiresOn: { not: null } } })
  ]);
  const dated = licences.map(l => describeLicence(l)).filter(l => l.state === "EXPIRED" || l.state === "SOON").sort(licenceOrder);
  return {
    checks: { total: checks, done: logs.length, problems: logs.filter(l => !l.ok).length },
    licences: dated.map(l => ({ id: l.id, name: l.name, expiresOn: l.expiresOn, daysLeft: l.daysLeft, state: l.state }))
  };
}

/* ---------- Inspection pack ---------- */

/**
 * Everything an inspector asks for, in one place: licences, suppliers and their licence numbers,
 * what is on the shelves with use-by dates, deliveries, wastage and the hygiene record.
 * @param {object} query days: 7 | 30 | 90 (how far back the records go)
 */
async function getInspectionPack(actor, storeId, query = {}) {
  await inventory.assertAdvanced(actor, storeId, inventory.MANAGE_ROLES);
  const prisma = getPrismaClient();
  const days = [7, 30, 90].includes(Number(query.days)) ? Number(query.days) : 30;
  const since = new Date(Date.now() - days * DAY_MS);
  const sinceDay = dayKey(since);

  const [store, overview, licences, suppliers, receipts, losses, checks, logs] = await Promise.all([
    prisma.store.findUnique({ where: { id: storeId }, select: { name: true, address: true, contactPhone: true, registrationNumber: true, tenant: { select: { name: true, companyLegalName: true, gstin: true } } } }),
    inventory.getOverview(actor, storeId),
    prisma.storeLicence.findMany({ where: { storeId } }),
    prisma.supplier.findMany({ where: { storeId, isActive: true }, orderBy: { name: "asc" }, select: { name: true, phone: true, fssaiNumber: true, gstin: true } }),
    prisma.stockReceipt.findMany({
      where: { storeId, receivedAt: { gte: since } },
      orderBy: { receivedAt: "desc" },
      take: 400,
      include: { supplier: { select: { name: true } }, batches: { include: { material: { select: { name: true, unit: true } } } } }
    }),
    prisma.stockTransaction.findMany({
      where: { type: { in: ["WASTE", "COUNT"] }, createdAt: { gte: since }, material: { storeId } },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { material: { select: { name: true, unit: true } } }
    }),
    prisma.hygieneCheck.findMany({ where: { storeId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.hygieneLog.findMany({ where: { storeId, day: { gte: sinceDay } }, orderBy: { day: "desc" } })
  ]);

  const checkById = new Map(checks.map(c => [c.id, c]));
  const active = checks.filter(c => c.isActive);
  const byDay = new Map();
  for (const log of logs) {
    if (!byDay.has(log.day)) byDay.set(log.day, []);
    byDay.get(log.day).push(log);
  }
  // Every day in the period is listed, so a day with nothing recorded shows as one
  const hygieneDays = [];
  for (let back = 0; back < days; back += 1) {
    const day = dayKey(new Date(Date.now() - back * DAY_MS));
    const dayLogs = byDay.get(day) || [];
    const expected = active.filter(c => dayKey(c.createdAt) <= day).length;
    if (expected === 0 && dayLogs.length === 0) continue;
    hygieneDays.push({
      day,
      expected,
      done: dayLogs.length,
      entries: dayLogs
        .map(l => ({ check: checkById.get(l.checkId), log: l }))
        .filter(e => e.check)
        .sort((a, b) => a.check.sortOrder - b.check.sortOrder)
        .map(({ check, log }) => ({ name: check.name, kind: check.kind, minValue: check.minValue, maxValue: check.maxValue, ok: log.ok, value: log.value, note: log.note, actorName: log.actorName, at: log.updatedAt }))
    });
  }

  return {
    generatedAt: new Date(),
    generatedBy: actorName(actor),
    days,
    since,
    store: {
      name: store.name,
      brand: store.tenant?.companyLegalName || store.tenant?.name || null,
      address: store.address,
      phone: store.contactPhone,
      registrationNumber: store.registrationNumber,
      gstin: store.tenant?.gstin || null
    },
    licences: licences.map(l => describeLicence(l)).sort(licenceOrder),
    suppliers,
    stock: overview.materials.filter(m => m.stock > 0).map(m => ({ name: m.name, unit: m.unit, stock: m.stock, lots: m.lots })),
    deliveries: receipts.map(r => ({
      id: r.id,
      receivedAt: r.receivedAt,
      supplierName: r.supplier?.name || (r.source === "STANDING" ? r.note : null),
      billNumber: r.billNumber,
      receivedByName: r.receivedByName,
      lines: r.batches.map(b => ({ name: b.material.name, unit: b.material.unit, quantity: b.originalQuantity, expiresAt: b.expiresAt }))
    })),
    wastage: losses.filter(l => l.type === "WASTE").map(l => ({ id: l.id, at: l.createdAt, name: l.material.name, unit: l.material.unit, quantity: Math.abs(l.quantity), reason: l.reason, actorName: l.actorName })),
    hygiene: { today: dayKey(), checks: active.map(describeCheck), days: hygieneDays }
  };
}

module.exports = {
  getChecks,
  logCheck,
  saveCheck,
  addStandardChecks,
  listLicences,
  saveLicence,
  deleteLicence,
  getSummary,
  getInspectionPack
};
