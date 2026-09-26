const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { userRoles } = require("../../constants/roles");
const { cleanPhone, cleanEmail } = require("../../lib/contact");
const { logOrderEvent } = require("../audit/audit-service");

// Cashiers see dues (and put bills on dues from the POS); managers also take payments and manage accounts
const VIEW_ROLES = [userRoles.superAdmin, userRoles.tenantAdmin, userRoles.storeManager, userRoles.cashier];
const MANAGE_ROLES = [userRoles.superAdmin, userRoles.tenantAdmin, userRoles.storeManager];
const METHODS = ["CASH", "UPI", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"];
const METHOD_LABEL = { CASH: "Cash", UPI: "UPI", BANK_TRANSFER: "Bank transfer", CARD: "Card", CHEQUE: "Cheque", OTHER: "Other" };

const outstandingOf = (p) => Math.max(0, p.amount - p.duesSettled - p.duesReduced);
const shortRef = (id) => String(id).slice(-6).toUpperCase();

/** Start of the current month in IST, as a Date */
function startOfMonthIst() {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const start = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1);
  return new Date(start - 5.5 * 60 * 60 * 1000);
}

/**
 * Which brand (and store) a request works on. Store staff are always limited to their own store;
 * owners may look at one store or all of them.
 */
async function resolveScope(actor, query = {}, { manage = false } = {}) {
  const roles = manage ? MANAGE_ROLES : VIEW_ROLES;
  if (!actor || !roles.includes(actor.role)) {
    throw createHttpError(403, manage ? "Only managers can do this" : "You don't have access to dues");
  }
  const prisma = getPrismaClient();
  const requestedStore = query.storeId || null;

  if (actor.role === userRoles.superAdmin) {
    if (requestedStore) {
      const store = await prisma.store.findUnique({ where: { id: requestedStore }, select: { tenantId: true } });
      if (!store) throw createHttpError(404, "Store not found");
      return { tenantId: store.tenantId, storeId: requestedStore };
    }
    if (!query.tenantId) throw createHttpError(400, "Choose a store");
    return { tenantId: query.tenantId, storeId: null };
  }

  if (actor.role === userRoles.tenantAdmin) {
    if (requestedStore) {
      const store = await prisma.store.findUnique({ where: { id: requestedStore }, select: { tenantId: true } });
      if (!store || store.tenantId !== actor.tenantId) throw createHttpError(404, "Store not found");
    }
    return { tenantId: actor.tenantId, storeId: requestedStore };
  }

  if (!actor.storeId) throw createHttpError(403, "Your account isn't linked to a store");
  return { tenantId: actor.tenantId, storeId: actor.storeId };
}

/** The brand owner's own dues account, created the first time it's needed */
async function ensureOwnerAccount(tenantId) {
  const prisma = getPrismaClient();
  const existing = await prisma.duesAccount.findFirst({ where: { tenantId, isOwner: true } });
  if (existing) return existing;
  const [tenant, owner] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
    prisma.user.findFirst({ where: { tenantId, role: userRoles.tenantAdmin }, orderBy: { createdAt: "asc" } })
  ]);
  return prisma.duesAccount.create({
    data: {
      tenantId,
      name: owner?.name ? `${owner.name} (Owner)` : `${tenant?.name || "Brand"} owner`,
      phone: owner?.phone || null,
      email: owner?.email || null,
      isOwner: true
    }
  });
}

/** The account a bill goes on: the one picked (must be active and in this brand), else the owner's */
async function resolveDuesAccount(tenantId, accountId) {
  if (!accountId) return ensureOwnerAccount(tenantId);
  const account = await getPrismaClient().duesAccount.findUnique({ where: { id: accountId } });
  if (!account || account.tenantId !== tenantId) throw createHttpError(404, "Dues account not found");
  if (!account.isActive) throw createHttpError(409, `${account.name} is no longer taking dues`);
  return account;
}

function serializeAccount(a, stats = {}) {
  return {
    id: a.id,
    name: a.name,
    phone: a.phone,
    email: a.email,
    note: a.note,
    isOwner: a.isOwner,
    isActive: a.isActive,
    createdAt: a.createdAt,
    outstanding: stats.outstanding || 0,
    openBills: stats.openBills || 0,
    oldestOpenAt: stats.oldestOpenAt || null
  };
}

/** Every dues bill in scope (small tables; outstanding is worked out here) */
async function loadDuesBills(prisma, scope, extraWhere = {}) {
  return prisma.payment.findMany({
    relationLoadStrategy: "join",
    where: {
      channel: "DUES",
      status: "PAID",
      store: { tenantId: scope.tenantId },
      ...(scope.storeId ? { storeId: scope.storeId } : {}),
      ...extraWhere
    },
    orderBy: { paidAt: "asc" },
    include: {
      duesAccount: { select: { id: true, name: true, isOwner: true } },
      store: { select: { id: true, name: true } },
      collectedBy: { select: { id: true, name: true } },
      order: { select: { id: true, table: { select: { tableNumber: true } } } },
      tableSession: { select: { id: true, table: { select: { tableNumber: true } } } }
    }
  });
}

async function listAccounts(actor, query = {}) {
  const scope = await resolveScope(actor, query);
  await ensureOwnerAccount(scope.tenantId);
  const prisma = getPrismaClient();
  const [accounts, bills] = await Promise.all([
    prisma.duesAccount.findMany({
      where: { tenantId: scope.tenantId, ...(query.includeInactive === "1" ? {} : { isActive: true }) },
      orderBy: [{ isOwner: "desc" }, { name: "asc" }]
    }),
    loadDuesBills(prisma, scope)
  ]);
  const stats = new Map();
  for (const b of bills) {
    const due = outstandingOf(b);
    if (due <= 0) continue;
    const s = stats.get(b.duesAccountId) || { outstanding: 0, openBills: 0, oldestOpenAt: null };
    s.outstanding += due;
    s.openBills += 1;
    if (!s.oldestOpenAt || b.paidAt < s.oldestOpenAt) s.oldestOpenAt = b.paidAt;
    stats.set(b.duesAccountId, s);
  }
  return accounts.map(a => serializeAccount(a, stats.get(a.id)));
}

function cleanAccountInput(input = {}, { partial = false } = {}) {
  const data = {};
  if (!partial || input.name !== undefined) {
    const name = String(input.name || "").trim().slice(0, 80);
    if (name.length < 2) throw createHttpError(400, "Enter a name for the account");
    data.name = name;
  }
  if (!partial || input.phone !== undefined) data.phone = cleanPhone(input.phone);
  if (!partial || input.email !== undefined) data.email = cleanEmail(input.email);
  if (!partial || input.note !== undefined) data.note = String(input.note || "").trim().slice(0, 200) || null;
  return data;
}

async function createAccount(actor, input = {}) {
  const scope = await resolveScope(actor, input, { manage: true });
  const data = cleanAccountInput(input);
  const clash = await getPrismaClient().duesAccount.findFirst({
    where: { tenantId: scope.tenantId, name: { equals: data.name, mode: "insensitive" }, isActive: true }
  });
  if (clash) throw createHttpError(409, `There is already an account called ${clash.name}`);
  const account = await getPrismaClient().duesAccount.create({ data: { tenantId: scope.tenantId, ...data } });
  return serializeAccount(account);
}

async function updateAccount(actor, accountId, input = {}) {
  const scope = await resolveScope(actor, input, { manage: true });
  const prisma = getPrismaClient();
  const account = await prisma.duesAccount.findUnique({ where: { id: accountId } });
  if (!account || account.tenantId !== scope.tenantId) throw createHttpError(404, "Dues account not found");
  const data = cleanAccountInput(input, { partial: true });
  if (input.isActive !== undefined) {
    if (account.isOwner && !input.isActive) throw createHttpError(409, "The owner's account can't be closed");
    data.isActive = Boolean(input.isActive);
  }
  const updated = await prisma.duesAccount.update({ where: { id: accountId }, data });
  return serializeAccount(updated);
}

function billLabel(b) {
  if (b.tableSessionId) return `Table ${b.tableSession?.table?.tableNumber ?? "?"} bill`;
  return `Order #${shortRef(b.orderId)}${b.order?.table ? ` · Table ${b.order.table.tableNumber}` : ""}`;
}

function serializeBill(b, invoiceNumber = null) {
  return {
    id: b.id,
    storeId: b.storeId,
    storeName: b.store?.name || null,
    orderId: b.orderId,
    tableSessionId: b.tableSessionId,
    label: billLabel(b),
    amount: b.amount,
    settled: b.duesSettled,
    reduced: b.duesReduced,
    outstanding: outstandingOf(b),
    account: b.duesAccount ? { id: b.duesAccount.id, name: b.duesAccount.name } : null,
    guest: b.duesGuest || null,
    note: b.duesNote,
    putBy: b.collectedBy ? { id: b.collectedBy.id, name: b.collectedBy.name } : null,
    createdAt: b.paidAt || b.createdAt,
    invoiceNumber
  };
}

/** GST invoice numbers for a set of dues bills (by order or table session) */
async function invoiceNumbersFor(prisma, bills) {
  const orderIds = bills.map(b => b.orderId).filter(Boolean);
  const sessionIds = bills.map(b => b.tableSessionId).filter(Boolean);
  if (!orderIds.length && !sessionIds.length) return new Map();
  const invoices = await prisma.invoice.findMany({
    where: {
      status: "ISSUED",
      kind: { in: ["STANDARD", "CORPORATE"] },
      OR: [
        ...(orderIds.length ? [{ orderId: { in: orderIds } }] : []),
        ...(sessionIds.length ? [{ tableSessionId: { in: sessionIds } }] : [])
      ]
    },
    select: { number: true, orderId: true, tableSessionId: true }
  });
  const map = new Map();
  for (const inv of invoices) map.set(inv.orderId || inv.tableSessionId, inv.number);
  return map;
}

/** Dues bills, newest first. status: open (default) | paid | all */
async function listBills(actor, query = {}) {
  const scope = await resolveScope(actor, query);
  const prisma = getPrismaClient();
  const all = await loadDuesBills(prisma, scope, query.accountId ? { duesAccountId: query.accountId } : {});
  const status = ["open", "paid", "all"].includes(query.status) ? query.status : "open";
  const q = String(query.q || "").trim().toLowerCase();
  const rows = all
    .filter(b => status === "all" || (status === "open" ? outstandingOf(b) > 0 : outstandingOf(b) === 0))
    .filter(b => !q || [b.duesGuest?.name, b.duesGuest?.phone, b.duesGuest?.email, b.duesNote, shortRef(b.orderId || b.tableSessionId), b.duesAccount?.name]
      .some(v => v && String(v).toLowerCase().includes(q)))
    .reverse();

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 30));
  const slice = rows.slice((page - 1) * limit, page * limit);
  const numbers = await invoiceNumbersFor(prisma, slice);
  return {
    bills: slice.map(b => serializeBill(b, numbers.get(b.orderId || b.tableSessionId) || null)),
    pagination: { total: rows.length, page, pages: Math.max(1, Math.ceil(rows.length / limit)), limit }
  };
}

async function getSummary(actor, query = {}) {
  const scope = await resolveScope(actor, query);
  const prisma = getPrismaClient();
  const monthStart = startOfMonthIst();
  const [bills, received] = await Promise.all([
    loadDuesBills(prisma, scope),
    prisma.duesRepayment.aggregate({
      where: { tenantId: scope.tenantId, receivedAt: { gte: monthStart }, ...(scope.storeId ? { storeId: scope.storeId } : {}) },
      _sum: { amount: true },
      _count: true
    })
  ]);
  const open = bills.filter(b => outstandingOf(b) > 0);
  return {
    outstanding: open.reduce((s, b) => s + outstandingOf(b), 0),
    openBills: open.length,
    accountsOwing: new Set(open.map(b => b.duesAccountId)).size,
    oldestOpenAt: open[0]?.paidAt || null,
    receivedThisMonth: received._sum.amount || 0,
    paymentsThisMonth: received._count || 0
  };
}

/**
 * Records money received against an account's dues and clears its bills oldest first.
 * Part-payments are fine; paying more than is owed is not.
 */
async function recordRepayment(actor, input = {}) {
  const scope = await resolveScope(actor, input, { manage: true });
  const prisma = getPrismaClient();
  const account = await prisma.duesAccount.findUnique({ where: { id: String(input.accountId || "") } });
  if (!account || account.tenantId !== scope.tenantId) throw createHttpError(404, "Dues account not found");

  const amount = Number(input.amount);
  if (!Number.isInteger(amount) || amount <= 0) throw createHttpError(400, "Enter the amount received in whole rupees");
  const method = String(input.method || "");
  if (!METHODS.includes(method)) throw createHttpError(400, "Choose how the money was received");
  const reference = String(input.reference || "").trim().slice(0, 60) || null;
  const note = String(input.note || "").trim().slice(0, 200) || null;
  let receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();
  if (Number.isNaN(receivedAt.getTime())) throw createHttpError(400, "Enter a valid date");
  if (receivedAt.getTime() > Date.now() + 60 * 1000) throw createHttpError(400, "The date can't be in the future");

  const { repayment, applied } = await prisma.$transaction(async (tx) => {
    // One repayment at a time per account, so two screens can't clear the same bill twice
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`dues_account:${account.id}`}))`;
    const bills = await tx.payment.findMany({
      where: { channel: "DUES", status: "PAID", duesAccountId: account.id, ...(scope.storeId ? { storeId: scope.storeId } : {}) },
      orderBy: { paidAt: "asc" }
    });
    const open = bills.filter(b => outstandingOf(b) > 0);
    const owed = open.reduce((s, b) => s + outstandingOf(b), 0);
    if (owed === 0) throw createHttpError(409, `${account.name} doesn't owe anything${scope.storeId ? " at this store" : ""}`);
    if (amount > owed) throw createHttpError(400, `${account.name} only owes ₹${owed.toLocaleString("en-IN")}`);

    const repayment = await tx.duesRepayment.create({
      data: {
        tenantId: scope.tenantId,
        accountId: account.id,
        storeId: scope.storeId,
        amount,
        method,
        reference,
        note,
        receivedAt,
        recordedById: actor.id
      }
    });
    let remaining = amount;
    const applied = [];
    for (const bill of open) {
      if (remaining <= 0) break;
      const part = Math.min(remaining, outstandingOf(bill));
      await tx.duesAllocation.create({ data: { repaymentId: repayment.id, paymentId: bill.id, amount: part } });
      await tx.payment.update({ where: { id: bill.id }, data: { duesSettled: { increment: part } } });
      applied.push({ bill, part, cleared: part === outstandingOf(bill) });
      remaining -= part;
    }
    return { repayment, applied };
  }, { timeout: 20000 });

  // Each bill's history shows the money that came in for it
  for (const { bill, part, cleared } of applied) {
    await logOrderEvent({
      storeId: bill.storeId,
      orderId: bill.orderId,
      tableSessionId: bill.tableSessionId,
      type: "DUES_REPAID",
      actor,
      amountAfter: part,
      reason: note,
      data: { account: account.name, method: METHOD_LABEL[method], reference, cleared, repaymentId: repayment.id }
    });
  }

  return { id: repayment.id, amount, method, billsCleared: applied.filter(a => a.cleared).length, billsTouched: applied.length };
}

async function listRepayments(actor, query = {}) {
  const scope = await resolveScope(actor, query);
  const prisma = getPrismaClient();
  const where = {
    tenantId: scope.tenantId,
    ...(scope.storeId ? { storeId: scope.storeId } : {}),
    ...(query.accountId ? { accountId: query.accountId } : {})
  };
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 30));
  const [total, rows] = await Promise.all([
    prisma.duesRepayment.count({ where }),
    prisma.duesRepayment.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        account: { select: { id: true, name: true } },
        store: { select: { id: true, name: true } },
        recordedBy: { select: { id: true, name: true } },
        _count: { select: { allocations: true } }
      }
    })
  ]);
  return {
    repayments: rows.map(r => ({
      id: r.id,
      account: r.account,
      storeName: r.store?.name || null,
      amount: r.amount,
      method: r.method,
      reference: r.reference,
      note: r.note,
      receivedAt: r.receivedAt,
      recordedBy: r.recordedBy,
      bills: r._count.allocations
    })),
    pagination: { total, page, pages: Math.max(1, Math.ceil(total / limit)), limit }
  };
}

/**
 * Dues bills on an order (or its table bill) that still have something owed, for refunds that
 * reduce the dues instead of handing money back.
 */
async function openDuesForOrder(prisma, order) {
  const bills = await prisma.payment.findMany({
    where: {
      channel: "DUES",
      status: "PAID",
      OR: [{ orderId: order.id }, ...(order.tableSessionId ? [{ tableSessionId: order.tableSessionId }] : [])]
    },
    include: { duesAccount: { select: { id: true, name: true } } },
    orderBy: { paidAt: "asc" }
  });
  return bills.filter(b => outstandingOf(b) > 0).map(b => ({ id: b.id, outstanding: outstandingOf(b), accountName: b.duesAccount?.name || "Dues" }));
}

/** Takes `amount` off a dues bill's balance, only if that much is still owed there */
async function reduceDuesBill(prisma, paymentId, amount) {
  const updated = await prisma.$executeRaw`
    UPDATE "Payment" SET "duesReduced" = "duesReduced" + ${amount}
    WHERE "id" = ${paymentId} AND "channel" = 'DUES' AND "amount" - "duesSettled" - "duesReduced" >= ${amount}`;
  if (updated === 0) throw createHttpError(409, "That is more than is still owed on the dues");
}

module.exports = {
  METHODS,
  resolveDuesAccount,
  ensureOwnerAccount,
  listAccounts,
  createAccount,
  updateAccount,
  listBills,
  getSummary,
  recordRepayment,
  listRepayments,
  openDuesForOrder,
  reduceDuesBill
};
