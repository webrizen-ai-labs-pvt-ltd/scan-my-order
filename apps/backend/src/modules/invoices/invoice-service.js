const { getPrismaClient, Prisma } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { verifyStoreAccess } = require("../menu/menu-service");
const { sendMail } = require("../../lib/mailer");
const { logOrderEvent } = require("../audit/audit-service");
const { validateGstin, financialYear, rupeesInWords, GST_STATES, RESTAURANT_SAC } = require("@smo/shared/gst");

const VIEW_ROLES = ["CASHIER", "STORE_MANAGER", "TENANT_ADMIN", "SUPER_ADMIN"];
const MANAGER_ROLES = ["STORE_MANAGER", "TENANT_ADMIN", "SUPER_ADMIN"];

// Lazy to avoid a require cycle with order-service
const orderService = () => require("../orders/order-service");

async function assertCanView(actor, storeId) {
  if (!VIEW_ROLES.includes(actor.role)) throw createHttpError(403, "Only cashiers and managers can handle invoices");
  await verifyStoreAccess(actor, storeId);
}

/** Short invoice-number prefix from the store slug: "northern-lights-cafe" → "NLC" */
function storePrefix(store) {
  const parts = String(store.slug || store.name || "STORE").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  const initials = parts.length > 1 ? parts.map(p => p[0]).join("") : parts[0] || "ST";
  return initials.slice(0, 4);
}

/**
 * Reserves the next number in a series. Must run inside the same transaction that creates
 * the invoice, so a failed insert never burns a number (GST expects gap-free series).
 */
async function nextInvoiceNumber(tx, store, series, issuedAt) {
  const fy = financialYear(issuedAt);
  const row = await tx.invoiceSequence.upsert({
    where: { storeId_series_financialYear: { storeId: store.id, series, financialYear: fy } },
    update: { lastSeq: { increment: 1 } },
    create: { storeId: store.id, series, financialYear: fy, lastSeq: 1 }
  });
  const seq = row.lastSeq;
  const prefix = storePrefix(store);
  // Max 16 characters: NLC/25-26/00012 · NLC/C25-26/0001
  const number = series === "CN"
    ? `${prefix}/C${fy}/${String(seq).padStart(4, "0")}`
    : `${prefix}/${fy}/${String(seq).padStart(5, "0")}`;
  return { number, seq, financialYear: fy };
}

function supplierFrom(store) {
  const tenant = store.tenant || {};
  const gst = tenant.gstin ? validateGstin(tenant.gstin) : null;
  const stateCode = gst?.stateCode || (tenant.gstin ? String(tenant.gstin).slice(0, 2) : null);
  return {
    // No valid GSTIN → the document is a plain bill, not a tax invoice
    gstinValid: Boolean(gst?.valid),
    legalName: tenant.companyLegalName || tenant.name || store.name,
    tradeName: tenant.name || store.name,
    gstin: tenant.gstin || null,
    registeredAddress: tenant.registeredAddress || null,
    stateCode,
    stateName: stateCode ? GST_STATES[stateCode] || null : null,
    outlet: { name: store.name, address: store.address || null, phone: store.contactPhone || null, email: store.contactEmail || null }
  };
}

/**
 * Splits an order's stored tax total across its tax rules (e.g. CGST/SGST), so the lines add up exactly.
 */
function taxLinesForOrder(order, fallbackRules) {
  const rules = Array.isArray(order.taxRules) ? order.taxRules : (Array.isArray(fallbackRules) ? fallbackRules : []);
  const taxable = order.subTotal - order.discountAmount - (order.walletDiscount || 0);
  if (rules.length === 0 || order.taxAmount === 0) return [];
  const lines = rules.map(r => ({ name: r.name, rate: Number(r.rate) || 0, amount: Math.round(taxable * ((Number(r.rate) || 0) / 100)) }));
  const drift = order.taxAmount - lines.reduce((s, l) => s + l.amount, 0);
  lines[lines.length - 1].amount += drift;

  // A single "GST 5%" rule must appear as CGST 2.5% + SGST 2.5% on a tax invoice
  // (restaurant service is always taxed in the restaurant's own state)
  return lines.flatMap(l => {
    const name = String(l.name || '').trim().toUpperCase();
    if (!['GST', 'TAX', 'VAT'].includes(name) && !name.startsWith('GST ')) return [l];
    // CGST and SGST must be equal, so an odd rupee total splits into paise (e.g. ₹29 → ₹14.50 + ₹14.50)
    const half = l.amount / 2;
    return [
      { name: 'CGST', rate: l.rate / 2, amount: half },
      { name: 'SGST', rate: l.rate / 2, amount: half }
    ];
  });
}

/**
 * Freezes everything the invoice shows. Only non-cancelled orders and made (non-rejected) items count.
 */
async function buildSnapshot(prisma, storeId, ref) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, include: { tenant: true } });
  const orderInclude = {
    table: true,
    items: { where: { status: "ACTIVE" }, include: { menuItem: true, modifiers: { include: { modifierOption: true } } } }
  };

  let orders;
  let tableNumber = null;
  if (ref.orderId) {
    const order = await prisma.order.findUnique({ where: { id: ref.orderId }, include: orderInclude });
    if (!order || order.storeId !== storeId) throw createHttpError(404, "Order not found");
    orders = [order];
    tableNumber = order.table?.tableNumber ?? null;
  } else {
    const session = await prisma.tableSession.findUnique({ where: { id: ref.tableSessionId }, include: { table: true } });
    if (!session || session.storeId !== storeId) throw createHttpError(404, "Table bill not found");
    // The table bill covers orders paid through the session (not ones paid on their own)
    const orderLevelPaid = await prisma.payment.findMany({
      where: { status: "PAID", order: { tableSessionId: ref.tableSessionId } },
      select: { orderId: true }
    });
    const paidAlone = new Set(orderLevelPaid.map(p => p.orderId));
    orders = (await prisma.order.findMany({
      where: { tableSessionId: ref.tableSessionId, status: { not: "CANCELLED" } },
      include: orderInclude,
      orderBy: { createdAt: "asc" }
    })).filter(o => !paidAlone.has(o.id));
    tableNumber = session.table?.tableNumber ?? null;
  }
  if (orders.length === 0) throw createHttpError(409, "Nothing to invoice on this bill");

  const serialize = orderService().serializeOrder;
  const lineMap = new Map();
  for (const order of orders.map(serialize)) {
    for (const item of order.items) {
      const mods = (item.modifiers || []).map(m => m.modifierOption?.name).filter(Boolean);
      const name = mods.length ? `${item.displayName} (${mods.join(", ")})` : item.displayName;
      const key = `${name}|${item.priceAtOrder}`;
      const line = lineMap.get(key) || { name, sac: RESTAURANT_SAC, quantity: 0, rate: item.priceAtOrder, amount: 0 };
      line.quantity += item.quantity;
      line.amount += item.priceAtOrder * item.quantity;
      lineMap.set(key, line);
    }
  }

  const taxByName = new Map();
  for (const order of orders) {
    for (const t of taxLinesForOrder(order, store.taxRules)) {
      const agg = taxByName.get(t.name) || { name: t.name, rate: t.rate, amount: 0 };
      agg.amount += t.amount;
      taxByName.set(t.name, agg);
    }
  }

  const sum = (fn) => orders.reduce((s, o) => s + fn(o), 0);
  const subTotal = sum(o => o.subTotal);
  const discount = sum(o => o.discountAmount);
  const storeCredits = sum(o => o.walletDiscount || 0);
  const taxAmount = sum(o => o.taxAmount);
  const totalAmount = sum(o => o.totalAmount);

  const payments = await prisma.payment.findMany({
    where: { status: "PAID", ...(ref.orderId ? { orderId: ref.orderId } : { tableSessionId: ref.tableSessionId }) },
    select: { channel: true, amount: true, paidAt: true }
  });

  const supplier = supplierFrom(store);
  return {
    store,
    snapshot: {
      supplier,
      placeOfSupply: supplier.stateCode ? { code: supplier.stateCode, name: supplier.stateName } : null,
      tableNumber,
      orderIds: orders.map(o => o.id),
      lines: [...lineMap.values()],
      subTotal,
      discount,
      storeCredits,
      taxableValue: subTotal - discount - storeCredits,
      taxes: [...taxByName.values()],
      taxAmount,
      totalAmount,
      amountInWords: rupeesInWords(totalAmount),
      payments: payments.map(p => ({ channel: p.channel, amount: p.amount, paidAt: p.paidAt }))
    }
  };
}

function serializeInvoice(inv) {
  return {
    id: inv.id,
    number: inv.number,
    kind: inv.kind,
    status: inv.status,
    financialYear: inv.financialYear,
    orderId: inv.orderId,
    tableSessionId: inv.tableSessionId,
    relatedInvoiceId: inv.relatedInvoiceId,
    relatedNumber: inv.relatedInvoice?.number || null,
    totalAmount: inv.totalAmount,
    taxAmount: inv.taxAmount,
    snapshot: inv.snapshot,
    billTo: inv.billTo,
    issuedAt: inv.issuedAt,
    issuedBy: inv.issuedBy ? { id: inv.issuedBy.id, name: inv.issuedBy.name } : null,
    cancelledAt: inv.cancelledAt,
    cancelReason: inv.cancelReason,
    emailedTo: inv.emailedTo,
    emailedAt: inv.emailedAt
  };
}

const invoiceInclude = { issuedBy: { select: { id: true, name: true } }, relatedInvoice: { select: { number: true } } };

function refWhere(ref) {
  return ref.orderId ? { orderId: ref.orderId } : { tableSessionId: ref.tableSessionId };
}

function auditRef(inv) {
  return { storeId: inv.storeId, orderId: inv.orderId, tableSessionId: inv.tableSessionId };
}

/**
 * Issues the regular GST invoice for a bill once it is paid. Safe to call repeatedly.
 * @param {{orderId?: string, tableSessionId?: string}} ref
 */
async function issueStandardInvoice(storeId, ref, actor = null) {
  const prisma = getPrismaClient();
  const existing = await prisma.invoice.findFirst({
    where: { storeId, ...refWhere(ref), status: "ISSUED", kind: { in: ["STANDARD", "CORPORATE"] } }
  });
  if (existing) return existing;

  const { store, snapshot } = await buildSnapshot(prisma, storeId, ref);
  if (snapshot.totalAmount <= 0) return null;

  // Corporate details picked at checkout: issue the corporate invoice straight away (no credit note)
  const request = await loadInvoiceRequest(prisma, ref);
  const billTo = request?.billTo && store.tenant?.gstin ? request.billTo : null;
  const kind = billTo ? "CORPORATE" : "STANDARD";
  const issuer = actor || request?.requestedBy || null;

  const issuedAt = new Date();
  const invoice = await prisma.$transaction(async (tx) => {
    const n = await nextInvoiceNumber(tx, store, "INV", issuedAt);
    return tx.invoice.create({
      data: {
        storeId,
        ...refWhere(ref),
        number: n.number,
        series: "INV",
        financialYear: n.financialYear,
        seq: n.seq,
        kind,
        totalAmount: snapshot.totalAmount,
        taxAmount: snapshot.taxAmount,
        snapshot,
        billTo: billTo ?? undefined,
        issuedById: issuer?.id || null,
        issuedAt
      }
    });
  });
  await logOrderEvent({
    ...auditRef(invoice),
    type: "INVOICE_ISSUED",
    actor: issuer,
    source: issuer ? undefined : "SYSTEM",
    amountAfter: invoice.totalAmount,
    data: { number: invoice.number, kind, ...(billTo ? { company: billTo.name, gstin: billTo.gstin || null } : {}) }
  });

  if (billTo) {
    if (request.saveClient !== false) {
      await saveCorporateClient(store.tenantId, billTo).catch(err => console.warn("[Invoices] save client:", err.message));
    }
    if (request.sendEmail && billTo.email) {
      // Not awaited: settlement must not wait on the mail server
      sendInvoiceEmail(storeId, invoice.id, billTo.email, issuer).catch(err => console.warn("[Invoices] email:", err.message));
    }
  }
  return invoice;
}

async function loadInvoiceRequest(prisma, ref) {
  const row = ref.orderId
    ? await prisma.order.findUnique({ where: { id: ref.orderId }, select: { invoiceRequest: true } })
    : await prisma.tableSession.findUnique({ where: { id: ref.tableSessionId }, select: { invoiceRequest: true } });
  return row?.invoiceRequest || null;
}

/**
 * Saves (or clears, with billTo: null) the company details a bill should be invoiced to once it is
 * paid. Only open bills: paid ones are converted from their invoice instead.
 * @param {{orderId?: string, tableSessionId?: string, billTo?: object|null, saveClient?: boolean, sendEmail?: boolean}} input
 */
async function setInvoiceRequest(actor, storeId, input = {}) {
  await assertCanView(actor, storeId);
  const prisma = getPrismaClient();
  const { orderId, tableSessionId } = input;
  if (Boolean(orderId) === Boolean(tableSessionId)) throw createHttpError(400, "Pass either an order or a table bill");

  const closed = "This bill is already closed. Open its invoice to convert it to a corporate invoice.";
  if (orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { storeId: true, paidAt: true, status: true } });
    if (!order || order.storeId !== storeId) throw createHttpError(404, "Order not found");
    if (order.paidAt || ["SETTLED", "CANCELLED"].includes(order.status)) throw createHttpError(409, closed);
  } else {
    const session = await prisma.tableSession.findUnique({ where: { id: tableSessionId }, select: { storeId: true, status: true } });
    if (!session || session.storeId !== storeId) throw createHttpError(404, "Table bill not found");
    if (session.status !== "ACTIVE") throw createHttpError(409, closed);
  }

  let request = null;
  if (input.billTo) {
    const store = await prisma.store.findUnique({ where: { id: storeId }, include: { tenant: true } });
    if (!store.tenant?.gstin) {
      throw createHttpError(409, "Add your brand's GSTIN under Brand Setup before issuing corporate tax invoices");
    }
    request = {
      billTo: cleanBillTo(input.billTo),
      saveClient: input.saveClient !== false,
      sendEmail: Boolean(input.sendEmail),
      requestedBy: { id: actor.id, name: actor.name || actor.email || null, role: actor.role },
      requestedAt: new Date().toISOString()
    };
  }

  const data = { invoiceRequest: request ?? Prisma.DbNull };
  if (orderId) await prisma.order.update({ where: { id: orderId }, data });
  else await prisma.tableSession.update({ where: { id: tableSessionId }, data });

  await logOrderEvent({
    storeId,
    orderId: orderId || null,
    tableSessionId: tableSessionId || null,
    type: request ? "INVOICE_DETAILS_SET" : "INVOICE_DETAILS_CLEARED",
    actor,
    data: request ? { company: request.billTo.name, gstin: request.billTo.gstin || null } : undefined
  });
  return request;
}

/**
 * The invoice covering an order: its own, or the table bill's. Issues one for paid bills that
 * predate invoicing.
 */
async function getInvoiceForOrder(actor, storeId, orderId) {
  await assertCanView(actor, storeId);
  const prisma = getPrismaClient();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.storeId !== storeId) throw createHttpError(404, "Order not found");

  const where = {
    storeId,
    status: "ISSUED",
    kind: { in: ["STANDARD", "CORPORATE"] },
    OR: [{ orderId }, ...(order.tableSessionId ? [{ tableSessionId: order.tableSessionId }] : [])]
  };
  let invoice = await prisma.invoice.findFirst({ where, include: invoiceInclude, orderBy: { issuedAt: "desc" } });

  if (!invoice) {
    const paid = Boolean(order.paidAt) || order.status === "SETTLED";
    if (!paid) throw createHttpError(409, "The invoice is issued once the bill is paid");
    // Paid through the table bill → invoice the whole table; otherwise the order alone
    const paidAlone = await prisma.payment.count({ where: { orderId, status: "PAID" } });
    const ref = order.tableSessionId && !paidAlone ? { tableSessionId: order.tableSessionId } : { orderId };
    const issued = await issueStandardInvoice(storeId, ref, actor);
    if (!issued) throw createHttpError(409, "Nothing to invoice on this bill");
    invoice = await prisma.invoice.findUnique({ where: { id: issued.id }, include: invoiceInclude });
  }
  return serializeInvoice(invoice);
}

async function getInvoice(actor, storeId, invoiceId) {
  await assertCanView(actor, storeId);
  const invoice = await getPrismaClient().invoice.findUnique({ where: { id: invoiceId }, include: invoiceInclude });
  if (!invoice || invoice.storeId !== storeId) throw createHttpError(404, "Invoice not found");
  return serializeInvoice(invoice);
}

function cleanBillTo(input = {}) {
  const text = (v, max = 120) => (v === undefined || v === null ? "" : String(v).trim().slice(0, max));
  const billTo = {
    name: text(input.name, 150),
    gstin: text(input.gstin, 15).toUpperCase(),
    address: text(input.address, 300),
    email: text(input.email, 120),
    employeeName: text(input.employeeName),
    employeeId: text(input.employeeId, 40),
    costCenter: text(input.costCenter, 60),
    poNumber: text(input.poNumber, 60),
    guests: input.guests ? Math.max(1, Math.min(500, parseInt(input.guests, 10) || 1)) : null,
    purpose: text(input.purpose, 150)
  };
  if (billTo.name.length < 2) throw createHttpError(400, "Enter the company's legal name");
  if (billTo.gstin) {
    const check = validateGstin(billTo.gstin);
    if (!check.valid) throw createHttpError(400, check.error);
    billTo.stateCode = check.stateCode;
    billTo.stateName = check.stateName;
  }
  if (billTo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billTo.email)) throw createHttpError(400, "Enter a valid email address");
  return Object.fromEntries(Object.entries(billTo).filter(([, v]) => v !== "" && v !== null));
}

/** Start of today in IST, as a Date */
function startOfTodayIst() {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 5.5 * 60 * 60 * 1000);
}

/**
 * Re-issues a bill as a corporate tax invoice: the current invoice is cancelled with a credit
 * note, and a new invoice with the company's details takes its place (numbers are never edited).
 * Cashiers can do this on the day of the bill; afterwards only managers.
 */
async function issueCorporateInvoice(actor, storeId, invoiceId, input = {}) {
  await assertCanView(actor, storeId);
  const prisma = getPrismaClient();
  const original = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!original || original.storeId !== storeId) throw createHttpError(404, "Invoice not found");
  if (original.status !== "ISSUED" || original.kind === "CREDIT_NOTE") {
    throw createHttpError(409, "Only an active invoice can be re-issued for a company");
  }
  if (original.issuedAt < startOfTodayIst() && !MANAGER_ROLES.includes(actor.role)) {
    throw createHttpError(403, "Bills from previous days can only be re-issued by a manager");
  }

  const billTo = cleanBillTo(input.billTo || input);
  const store = await prisma.store.findUnique({ where: { id: storeId }, include: { tenant: true } });
  if (!store.tenant?.gstin) {
    throw createHttpError(409, "Add your brand's GSTIN under Brand Setup before issuing corporate tax invoices");
  }
  const issuedAt = new Date();
  const reason = original.kind === "CORPORATE" ? "Corporate details corrected" : "Converted to corporate invoice";

  const { creditNote, corporate } = await prisma.$transaction(async (tx) => {
    const cn = await nextInvoiceNumber(tx, store, "CN", issuedAt);
    const creditNote = await tx.invoice.create({
      data: {
        storeId,
        orderId: original.orderId,
        tableSessionId: original.tableSessionId,
        number: cn.number,
        series: "CN",
        financialYear: cn.financialYear,
        seq: cn.seq,
        kind: "CREDIT_NOTE",
        relatedInvoiceId: original.id,
        totalAmount: original.totalAmount,
        taxAmount: original.taxAmount,
        snapshot: { ...original.snapshot, creditNoteReason: reason },
        billTo: original.billTo ?? undefined,
        issuedById: actor.id,
        issuedAt
      }
    });
    await tx.invoice.update({
      where: { id: original.id },
      data: { status: "CANCELLED", cancelledAt: issuedAt, cancelReason: `${reason} (credit note ${cn.number})` }
    });
    const inv = await nextInvoiceNumber(tx, store, "INV", issuedAt);
    const corporate = await tx.invoice.create({
      data: {
        storeId,
        orderId: original.orderId,
        tableSessionId: original.tableSessionId,
        number: inv.number,
        series: "INV",
        financialYear: inv.financialYear,
        seq: inv.seq,
        kind: "CORPORATE",
        relatedInvoiceId: original.id,
        totalAmount: original.totalAmount,
        taxAmount: original.taxAmount,
        // Same supply, same amounts; now billed to the company
        snapshot: { ...original.snapshot, supplier: supplierFrom(store) },
        billTo,
        issuedById: actor.id,
        issuedAt
      },
      include: invoiceInclude
    });
    return { creditNote, corporate };
  });

  if (input.saveClient !== false) {
    await saveCorporateClient(store.tenantId, billTo).catch(err => console.warn("[Invoices] save client:", err.message));
  }

  const ref = auditRef(original);
  await logOrderEvent({ ...ref, type: "CREDIT_NOTE_ISSUED", actor, reason, amountAfter: creditNote.totalAmount, data: { number: creditNote.number, reverses: original.number } });
  await logOrderEvent({ ...ref, type: "INVOICE_CANCELLED", actor, reason, data: { number: original.number } });
  await logOrderEvent({ ...ref, type: "INVOICE_ISSUED", actor, amountAfter: corporate.totalAmount, data: { number: corporate.number, kind: "CORPORATE", company: billTo.name, gstin: billTo.gstin || null } });

  if (billTo.email && input.sendEmail) {
    await emailInvoice(actor, storeId, corporate.id, billTo.email).catch(err => console.warn("[Invoices] email:", err.message));
  }
  return serializeInvoice(await prisma.invoice.findUnique({ where: { id: corporate.id }, include: invoiceInclude }));
}

/**
 * Partial credit note for money refunded after the bill was invoiced (e.g. kitchen couldn't make a paid item).
 */
async function issueRefundCreditNote(order, refund, actor = null) {
  const prisma = getPrismaClient();
  const invoice = await prisma.invoice.findFirst({
    where: {
      storeId: order.storeId,
      status: "ISSUED",
      kind: { in: ["STANDARD", "CORPORATE"] },
      OR: [{ orderId: order.id }, ...(order.tableSessionId ? [{ tableSessionId: order.tableSessionId }] : [])]
    },
    orderBy: { issuedAt: "desc" }
  });
  if (!invoice) return null;

  const store = await prisma.store.findUnique({ where: { id: order.storeId }, include: { tenant: true } });
  const snap = invoice.snapshot || {};
  // Split the refund into taxable value and tax in the same proportion as the invoice
  const share = invoice.totalAmount > 0 ? refund.amount / invoice.totalAmount : 0;
  const paise = (n) => Math.round(n * 100) / 100;
  const taxes = (snap.taxes || []).map(t => ({ ...t, amount: paise(t.amount * share) }));
  const taxAmount = paise(taxes.reduce((s, t) => s + t.amount, 0));
  const taxableValue = paise(refund.amount - taxAmount);
  const issuedAt = new Date();

  const creditNote = await prisma.$transaction(async (tx) => {
    const cn = await nextInvoiceNumber(tx, store, "CN", issuedAt);
    return tx.invoice.create({
      data: {
        storeId: order.storeId,
        orderId: invoice.orderId,
        tableSessionId: invoice.tableSessionId,
        number: cn.number,
        series: "CN",
        financialYear: cn.financialYear,
        seq: cn.seq,
        kind: "CREDIT_NOTE",
        relatedInvoiceId: invoice.id,
        totalAmount: refund.amount,
        taxAmount: Math.round(taxAmount), // column is whole rupees; exact split is in the snapshot
        snapshot: {
          supplier: snap.supplier,
          placeOfSupply: snap.placeOfSupply,
          tableNumber: snap.tableNumber,
          lines: [{ name: `Refund: ${refund.reason || "items not served"}`, sac: RESTAURANT_SAC, quantity: 1, rate: taxableValue, amount: taxableValue }],
          subTotal: taxableValue,
          discount: 0,
          storeCredits: 0,
          taxableValue: taxableValue,
          taxes,
          taxAmount,
          totalAmount: refund.amount,
          amountInWords: rupeesInWords(refund.amount),
          creditNoteReason: refund.reason || "Refund",
          payments: [{ channel: refund.method, amount: -refund.amount, paidAt: issuedAt }]
        },
        billTo: invoice.billTo ?? undefined,
        issuedById: actor?.id || null,
        issuedAt
      }
    });
  });
  await logOrderEvent({ ...auditRef(invoice), type: "CREDIT_NOTE_ISSUED", actor, source: actor ? undefined : "SYSTEM", reason: refund.reason, amountAfter: refund.amount, data: { number: creditNote.number, against: invoice.number, refundId: refund.id } });
  return creditNote;
}

async function saveCorporateClient(tenantId, billTo) {
  const prisma = getPrismaClient();
  const data = { name: billTo.name, address: billTo.address || null, email: billTo.email || null };
  if (billTo.gstin) {
    return prisma.corporateClient.upsert({
      where: { tenantId_gstin: { tenantId, gstin: billTo.gstin } },
      update: data,
      create: { tenantId, gstin: billTo.gstin, ...data }
    });
  }
  const existing = await prisma.corporateClient.findFirst({ where: { tenantId, gstin: null, name: { equals: billTo.name, mode: "insensitive" } } });
  return existing
    ? prisma.corporateClient.update({ where: { id: existing.id }, data })
    : prisma.corporateClient.create({ data: { tenantId, ...data } });
}

async function searchCorporateClients(actor, storeId, q = "") {
  await assertCanView(actor, storeId);
  const prisma = getPrismaClient();
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { tenantId: true } });
  const term = String(q).trim();
  return prisma.corporateClient.findMany({
    where: {
      tenantId: store.tenantId,
      ...(term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { gstin: { contains: term.toUpperCase() } }] } : {})
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: { id: true, name: true, gstin: true, address: true, email: true }
  });
}

function listWhere(storeId, query = {}) {
  const where = { storeId };
  if (query.kind) where.kind = { in: String(query.kind).split(",") };
  if (query.status) where.status = query.status;
  if (query.q) {
    const q = String(query.q).trim();
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { billTo: { path: ["name"], string_contains: q } },
      { billTo: { path: ["gstin"], string_contains: q.toUpperCase() } }
    ];
  }
  if (query.from || query.to) {
    where.issuedAt = {};
    if (query.from) where.issuedAt.gte = new Date(query.from);
    if (query.to) where.issuedAt.lte = new Date(query.to);
  }
  return where;
}

async function listInvoices(actor, storeId, query = {}) {
  await assertCanView(actor, storeId);
  const prisma = getPrismaClient();
  const where = listWhere(storeId, query);
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(10, parseInt(query.limit, 10) || 30));
  const [total, rows, sums] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({ where, include: invoiceInclude, orderBy: { issuedAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.invoice.groupBy({ by: ["kind"], where: { ...where, status: "ISSUED" }, _sum: { totalAmount: true, taxAmount: true }, _count: { _all: true } })
  ]);
  return {
    invoices: rows.map(serializeInvoice),
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    totals: sums.map(s => ({ kind: s.kind, count: s._count._all, amount: s._sum.totalAmount || 0, tax: s._sum.taxAmount || 0 }))
  };
}

const csvCell = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

async function exportInvoicesCsv(actor, storeId, query = {}) {
  await assertCanView(actor, storeId);
  const rows = await getPrismaClient().invoice.findMany({
    where: listWhere(storeId, query),
    include: { relatedInvoice: { select: { number: true } } },
    orderBy: { issuedAt: "asc" },
    take: 20000
  });
  const taxNames = [...new Set(rows.flatMap(r => (r.snapshot?.taxes || []).map(t => t.name)))];
  const header = ["Number", "Date", "Type", "Status", "Bill to", "Customer GSTIN", "Related", "Taxable value", ...taxNames, "Total tax", "Total"];
  const lines = rows.map(r => {
    const sign = r.kind === "CREDIT_NOTE" ? -1 : 1;
    const snap = r.snapshot || {};
    const taxFor = (name) => sign * ((snap.taxes || []).find(t => t.name === name)?.amount || 0);
    return [
      r.number,
      r.issuedAt.toISOString().slice(0, 10),
      r.kind,
      r.status,
      r.billTo?.name || "",
      r.billTo?.gstin || "",
      r.relatedInvoice?.number || "",
      sign * (snap.taxableValue ?? (r.totalAmount - r.taxAmount)),
      ...taxNames.map(taxFor),
      sign * r.taxAmount,
      sign * r.totalAmount
    ].map(csvCell).join(",");
  });
  return [header.map(csvCell).join(","), ...lines].join("\n");
}

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = (v) => String(v ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Plain HTML version of an invoice for email */
function renderInvoiceHtml(inv) {
  const s = inv.snapshot || {};
  const title = inv.kind === "CREDIT_NOTE" ? "Credit Note" : "Tax Invoice";
  const b = inv.billTo;
  const rows = (s.lines || []).map(l => `<tr><td style="padding:4px 6px">${esc(l.name)}</td><td style="padding:4px 6px">${esc(l.sac)}</td><td style="padding:4px 6px;text-align:right">${l.quantity}</td><td style="padding:4px 6px;text-align:right">${money(l.rate)}</td><td style="padding:4px 6px;text-align:right">${money(l.amount)}</td></tr>`).join("");
  const taxRows = (s.taxes || []).map(t => `<tr><td colspan="4" style="padding:2px 6px;text-align:right">${esc(t.name)} @ ${t.rate}%</td><td style="padding:2px 6px;text-align:right">${money(t.amount)}</td></tr>`).join("");
  return `<div style="font-family:Arial,sans-serif;font-size:13px;color:#111;max-width:680px">
  <h2 style="margin:0 0 4px">${title} ${esc(inv.number)}</h2>
  <div style="color:#555">Date: ${new Date(inv.issuedAt).toLocaleDateString("en-IN")}${inv.relatedNumber ? ` · Against ${esc(inv.relatedNumber)}` : ""}</div>
  <table style="width:100%;margin:12px 0;border-collapse:collapse"><tr>
    <td style="vertical-align:top;width:50%"><strong>${esc(s.supplier?.legalName)}</strong><br>${esc(s.supplier?.registeredAddress || s.supplier?.outlet?.address || "")}<br>GSTIN: ${esc(s.supplier?.gstin || "—")}<br>State: ${esc(s.supplier?.stateName || "")} (${esc(s.supplier?.stateCode || "")})</td>
    <td style="vertical-align:top">${b ? `<strong>Bill to: ${esc(b.name)}</strong><br>${esc(b.address || "")}<br>${b.gstin ? `GSTIN: ${esc(b.gstin)}<br>` : ""}${b.employeeName ? `Attn: ${esc(b.employeeName)}${b.employeeId ? ` (${esc(b.employeeId)})` : ""}<br>` : ""}${b.poNumber ? `PO/Ref: ${esc(b.poNumber)}<br>` : ""}${b.costCenter ? `Cost centre: ${esc(b.costCenter)}` : ""}` : ""}</td>
  </tr></table>
  <table style="width:100%;border-collapse:collapse;border-top:1px solid #ccc;border-bottom:1px solid #ccc">
    <tr style="background:#f4f4f5"><th style="padding:4px 6px;text-align:left">Item</th><th style="padding:4px 6px;text-align:left">SAC</th><th style="padding:4px 6px;text-align:right">Qty</th><th style="padding:4px 6px;text-align:right">Rate</th><th style="padding:4px 6px;text-align:right">Amount</th></tr>
    ${rows}
    <tr><td colspan="4" style="padding:4px 6px;text-align:right">Taxable value</td><td style="padding:4px 6px;text-align:right">${money(s.taxableValue)}</td></tr>
    ${taxRows}
    <tr><td colspan="4" style="padding:6px;text-align:right"><strong>Total</strong></td><td style="padding:6px;text-align:right"><strong>${money(s.totalAmount)}</strong></td></tr>
  </table>
  <p style="margin:8px 0">${esc(s.amountInWords)}</p>
  <p style="color:#777;font-size:11px">This is a computer-generated ${title.toLowerCase()} and does not need a signature.</p>
</div>`;
}

async function emailInvoice(actor, storeId, invoiceId, email) {
  await assertCanView(actor, storeId);
  return sendInvoiceEmail(storeId, invoiceId, email, actor);
}

async function sendInvoiceEmail(storeId, invoiceId, email, actor = null) {
  const to = String(email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw createHttpError(400, "Enter a valid email address");
  const prisma = getPrismaClient();
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: invoiceInclude });
  if (!invoice || invoice.storeId !== storeId) throw createHttpError(404, "Invoice not found");

  const inv = serializeInvoice(invoice);
  const title = inv.kind === "CREDIT_NOTE" ? "Credit note" : "Tax invoice";
  try {
    await sendMail({
      to,
      subject: `${title} ${inv.number} from ${inv.snapshot?.supplier?.tradeName || "the restaurant"}`,
      html: renderInvoiceHtml(inv),
      text: `${title} ${inv.number}: total ${money(inv.totalAmount)}.`
    });
  } catch (error) {
    throw createHttpError(502, `Could not send the email: ${error.message}`);
  }
  await prisma.invoice.update({ where: { id: invoiceId }, data: { emailedTo: to, emailedAt: new Date() } });
  await logOrderEvent({ ...auditRef(invoice), type: "INVOICE_EMAILED", actor, source: actor ? undefined : "SYSTEM", data: { number: invoice.number, to } });
  return { sent: true, to };
}

module.exports = {
  buildInvoiceSnapshot: (storeId, ref) => buildSnapshot(getPrismaClient(), storeId, ref),
  issueStandardInvoice,
  setInvoiceRequest,
  issueRefundCreditNote,
  getInvoiceForOrder,
  getInvoice,
  issueCorporateInvoice,
  searchCorporateClients,
  listInvoices,
  exportInvoicesCsv,
  emailInvoice
};
