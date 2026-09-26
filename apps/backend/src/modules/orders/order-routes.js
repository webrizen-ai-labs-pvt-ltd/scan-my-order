const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const {
  createOrder,
  getActiveOrders,
  getOrderStats,
  getKdsOrders,
  updateOrderStatus,
  updateOrderItems,
  getOrderById,
  getOrderHistory,
  getTableSessionBill,
  getActiveTableSession,
  rejectOrderItems,
  getRefundsDue,
  setOrderItemReady,
  recallOrder,
  announceOrderDelay
} = require("./order-service");
const { verifyStoreAccess } = require("../menu/menu-service");
const { getRefundOptions, createRefund } = require("../payments/refund-service");
const { getOrderAudit } = require("../audit/audit-service");
const { getInvoiceForOrder } = require("../invoices/invoice-service");
const { subscribeToStore } = require("./sse-service");

const router = express.Router({ mergeParams: true });

router.use(authenticate);

// === SSE STREAM ===
// GET /api/stores/:storeId/orders/stream
router.get("/stream", asyncHandler(async (req, res) => {
  // Customers fall through to 403 inside verifyStoreAccess
  await verifyStoreAccess(req.user, req.params.storeId);
  subscribeToStore(req.params.storeId, req, res);
}));

// === STAFF ROUTES ===

// GET /api/stores/:storeId/orders/stats (Fast real-time stats for POS polling)
router.get("/stats", asyncHandler(async (req, res) => {
  const result = await getOrderStats(req.user, req.params.storeId);
  res.json(createApiResponse(result));
}));

// GET /api/stores/:storeId/orders
router.get("/", asyncHandler(async (req, res) => {
  let statuses = [];
  if (req.query.statuses) {
    statuses = req.query.statuses.split(',').map(s => s.trim());
  } else if (req.query.status) {
    statuses = [req.query.status];
  }
  
  const result = await getActiveOrders(req.user, req.params.storeId, statuses);
  res.json(createApiResponse(result));
}));

// GET /api/stores/:storeId/orders/history
router.get("/history", asyncHandler(async (req, res) => {
  const result = await getOrderHistory(req.user, req.params.storeId, req.query);
  res.json(createApiResponse(result));
}));

// GET /api/stores/:storeId/orders/refunds-due  (kitchen rejected items on paid orders)
router.get("/refunds-due", asyncHandler(async (req, res) => {
  const result = await getRefundsDue(req.user, req.params.storeId);
  res.json(createApiResponse(result));
}));

// GET /api/stores/:storeId/orders/kds
router.get("/kds", asyncHandler(async (req, res) => {
  const result = await getKdsOrders(req.user, req.params.storeId);
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/orders (Staff POS Order)
router.post("/", asyncHandler(async (req, res) => {
  const result = await createOrder(req.params.storeId, req.user, 'POS', req.body);
  res.status(201).json(createApiResponse(result));
}));

// PATCH /api/stores/:storeId/orders/:id/verify (Waiter Approval)
router.patch("/:id/verify", asyncHandler(async (req, res) => {
  const result = await updateOrderStatus(req.user, req.params.storeId, req.params.id, 'PROCESSING');
  res.json(createApiResponse(result));
}));

// PATCH /api/stores/:storeId/orders/:id/status
router.patch("/:id/status", asyncHandler(async (req, res) => {
  const result = await updateOrderStatus(req.user, req.params.storeId, req.params.id, req.body.status, false, {
    reason: req.body.reason
  });
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/orders/:id/reject  { itemIds? | all, reason, markSoldOut? }
router.post("/:id/reject", asyncHandler(async (req, res) => {
  const result = await rejectOrderItems(req.user, req.params.storeId, req.params.id, req.body || {});
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/orders/:id/items/:itemId/ready  { ready: boolean }  (kitchen, per line)
router.post("/:id/items/:itemId/ready", asyncHandler(async (req, res) => {
  const ready = req.body?.ready !== false;
  const result = await setOrderItemReady(req.user, req.params.storeId, req.params.id, req.params.itemId, ready);
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/orders/:id/recall  (undo "Mark ready" within 5 minutes)
router.post("/:id/recall", asyncHandler(async (req, res) => {
  const result = await recallOrder(req.user, req.params.storeId, req.params.id);
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/orders/:id/delay  { minutes: 5|10|15|20|30 }
router.post("/:id/delay", asyncHandler(async (req, res) => {
  const result = await announceOrderDelay(req.user, req.params.storeId, req.params.id, req.body?.minutes);
  res.json(createApiResponse(result));
}));

// GET /api/stores/:storeId/orders/:id/invoice  (the order's GST invoice, or its table bill's)
router.get("/:id/invoice", asyncHandler(async (req, res) => {
  const result = await getInvoiceForOrder(req.user, req.params.storeId, req.params.id);
  res.json(createApiResponse(result));
}));

// GET /api/stores/:storeId/orders/:id/audit  (full change history, managers/owners)
router.get("/:id/audit", asyncHandler(async (req, res) => {
  const result = await getOrderAudit(req.user, req.params.storeId, req.params.id);
  res.json(createApiResponse(result));
}));

// GET /api/stores/:storeId/orders/:id/refunds  (amount owed, refundable Razorpay payments, history)
router.get("/:id/refunds", asyncHandler(async (req, res) => {
  const result = await getRefundOptions(req.user, req.params.storeId, req.params.id);
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/orders/:id/refunds  { amount, method: RAZORPAY|CASH|UPI_OFFLINE, paymentId?, note? }
router.post("/:id/refunds", asyncHandler(async (req, res) => {
  const result = await createRefund(req.user, req.params.storeId, req.params.id, req.body || {});
  res.status(201).json(createApiResponse(result));
}));

// PUT /api/stores/:storeId/orders/:id/items (Manager Update Order Items)
router.put("/:id/items", asyncHandler(async (req, res) => {
  const result = await updateOrderItems(req.user, req.params.storeId, req.params.id, req.body);
  res.json(createApiResponse(result));
}));

// GET /api/stores/:storeId/orders/:id
router.get("/:id", asyncHandler(async (req, res) => {
  await verifyStoreAccess(req.user, req.params.storeId);
  const result = await getOrderById(req.params.storeId, req.params.id);
  res.json(createApiResponse(result));
}));

// === TABLE SESSION ROUTES ===
// Payments for a table go through /api/stores/:storeId/payments with a tableSessionId.

// GET /api/stores/:storeId/orders/sessions/by-table/:tableId  (active session incl. PIN, for POS)
router.get("/sessions/by-table/:tableId", asyncHandler(async (req, res) => {
  const result = await getActiveTableSession(req.user, req.params.storeId, req.params.tableId);
  res.json(createApiResponse(result));
}));

// GET /api/stores/:storeId/orders/sessions/:sessionId
router.get("/sessions/:sessionId", asyncHandler(async (req, res) => {
  await verifyStoreAccess(req.user, req.params.storeId);
  const result = await getTableSessionBill(req.params.storeId, req.params.sessionId, { includePin: true });
  res.json(createApiResponse(result));
}));

module.exports = router;
