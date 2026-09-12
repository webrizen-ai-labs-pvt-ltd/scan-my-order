const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const { 
  createOrder, 
  getActiveOrders,
  getKdsOrders,
  updateOrderStatus, 
  handleRazorpayWebhook,
  getOrderById,
  getOrderHistory
} = require("./order-service");
const { subscribeToStore } = require("./sse-service");

const router = express.Router({ mergeParams: true });

// === PUBLIC / CUSTOMER ROUTES ===
// These routes do NOT require `authenticate` if they are mounted under `/api/public`.
// However, since we are merging params, let's export a separate router or handle it conditionally.
// Actually, it's better to separate public order routes to avoid confusion.
// We will export staff routes from this file.

router.use(authenticate);

// === SSE STREAM ===
// GET /api/stores/:storeId/orders/stream
router.get("/stream", (req, res) => {
  subscribeToStore(req.params.storeId, req, res);
});

// === STAFF ROUTES ===

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
  const { status, paymentMethod, cashAmount, onlineAmount } = req.body;
  const result = await updateOrderStatus(req.user, req.params.storeId, req.params.id, status, false, {
    paymentMethod,
    cashAmount,
    onlineAmount
  });
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/orders/:id/payment-link
router.post("/:id/payment-link", asyncHandler(async (req, res) => {
  const { generatePaymentLink } = require("./order-service");
  const { onlineAmount } = req.body || {};
  const result = await generatePaymentLink(req.user, req.params.storeId, req.params.id, onlineAmount);
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/orders/:id/verify-payment
router.post("/:id/verify-payment", asyncHandler(async (req, res) => {
  const { verifyRazorpayPayment } = require("./order-service");
  const result = await verifyRazorpayPayment(req.user, req.params.storeId, req.params.id);
  res.json(createApiResponse(result));
}));

// GET /api/stores/:storeId/orders/:id/payment-status
router.get("/:id/payment-status", asyncHandler(async (req, res) => {
  const { checkPaymentStatus } = require("./order-service");
  const result = await checkPaymentStatus(req.params.storeId, req.params.id);
  res.json(createApiResponse(result));
}));

// GET /api/stores/:storeId/orders/:id
router.get("/:id", asyncHandler(async (req, res) => {
  const result = await getOrderById(req.params.storeId, req.params.id);
  res.json(createApiResponse(result));
}));

// === TABLE SESSION ROUTES ===
// POST /api/stores/:storeId/orders/sessions/:sessionId/settle
router.post("/sessions/:sessionId/settle", asyncHandler(async (req, res) => {
  const { settleTableSession } = require("./order-service");
  const result = await settleTableSession(req.user, req.params.storeId, req.params.sessionId, false, req.body);
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/orders/sessions/:sessionId/payment-link
router.post("/sessions/:sessionId/payment-link", asyncHandler(async (req, res) => {
  const { generateSessionPaymentLink } = require("./order-service");
  const { onlineAmount } = req.body || {};
  const result = await generateSessionPaymentLink(req.user, req.params.storeId, req.params.sessionId, onlineAmount);
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/orders/sessions/:sessionId/verify-payment
router.post("/sessions/:sessionId/verify-payment", asyncHandler(async (req, res) => {
  const { verifySessionPayment } = require("./order-service");
  const result = await verifySessionPayment(req.user, req.params.storeId, req.params.sessionId);
  res.json(createApiResponse(result));
}));

// GET /api/stores/:storeId/orders/sessions/:sessionId
router.get("/sessions/:sessionId", asyncHandler(async (req, res) => {
  const { getTableSessionBill } = require("./order-service");
  const result = await getTableSessionBill(req.params.storeId, req.params.sessionId);
  res.json(createApiResponse(result));
}));

module.exports = router;
