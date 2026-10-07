const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const {
  getPaymentChannels,
  getPaymentSummary,
  createPayment,
  getPayment,
  confirmOfflinePayment,
  listGuestUpiPayments,
  cancelPayment,
  putBillOnDues
} = require("./payment-service");

const router = express.Router({ mergeParams: true });

router.use(authenticate);

// GET /api/stores/:storeId/payments/channels
// Ways this store can take money, with no bill yet (POS checkout before the order exists)
router.get("/channels", asyncHandler(async (req, res) => {
  const result = await getPaymentChannels(req.user, req.params.storeId);
  res.json(createApiResponse(result));
}));

// GET /api/stores/:storeId/payments/summary?orderId=… | ?tableSessionId=…
router.get("/summary", asyncHandler(async (req, res) => {
  const result = await getPaymentSummary(req.user, req.params.storeId, {
    orderId: req.query.orderId,
    tableSessionId: req.query.tableSessionId
  });
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/payments  { orderId | tableSessionId, channel, amount, cashTendered? }
router.post("/", asyncHandler(async (req, res) => {
  const result = await createPayment(req.user, req.params.storeId, req.body);
  res.status(201).json(createApiResponse(result));
}));

// GET /api/stores/:storeId/payments/guest-upi  (guests' UPI payments waiting for a cashier)
router.get("/guest-upi", asyncHandler(async (req, res) => {
  res.json(createApiResponse(await listGuestUpiPayments(req.user, req.params.storeId)));
}));

// GET /api/stores/:storeId/payments/:paymentId  (re-checks Razorpay if still pending)
router.get("/:paymentId", asyncHandler(async (req, res) => {
  const result = await getPayment(req.user, req.params.storeId, req.params.paymentId);
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/payments/:paymentId/confirm  (offline UPI received)
router.post("/:paymentId/confirm", asyncHandler(async (req, res) => {
  const result = await confirmOfflinePayment(req.user, req.params.storeId, req.params.paymentId);
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/payments/:paymentId/cancel
router.post("/:paymentId/cancel", asyncHandler(async (req, res) => {
  const result = await cancelPayment(req.user, req.params.storeId, req.params.paymentId);
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/payments/dues  { orderId | tableSessionId, accountId?, note, guest: { name, phone?, whatsapp?, email? } }
// Closes what is left of the bill on dues (owed by a dues account, collected later)
router.post("/dues", asyncHandler(async (req, res) => {
  const { orderId, tableSessionId, accountId, note, guest } = req.body || {};
  const ref = orderId ? { orderId } : { tableSessionId };
  const result = await putBillOnDues(req.user, req.params.storeId, ref, { accountId, note, guest });
  res.json(createApiResponse(result));
}));

module.exports = router;
