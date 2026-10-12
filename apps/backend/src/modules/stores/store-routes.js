const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const {
  createStore,
  getStores,
  getStoreById,
  updateStore,
  deleteStore,
  getStoreFloorStatus
} = require("./store-service");
const menuRoutes = require("../menu/menu-routes");
const inventoryRoutes = require("../inventory/inventory-routes");
const tableRoutes = require("../tables/table-routes");
const orderRoutes = require("../orders/order-routes");
const kdsRoutes = require("../orders/kds-routes");
const waiterCallRoutes = require("../waiter-calls/waiter-call-routes");
const feedbackRoutes = require("../feedback/feedback-routes");
const promoRoutes = require("./promo-routes");
const reservationRoutes = require("../reservations/reservation-routes");
const loyaltyRoutes = require("../loyalty/loyalty-routes");
const paymentRoutes = require("../payments/payment-routes");
const auditRoutes = require("../audit/audit-routes");
const invoiceRoutes = require("../invoices/invoice-routes");
const { billingGuard } = require("../../middleware/billing-guard");
const { requireFeature } = require("../billing/entitlements-service");

const router = express.Router();

// All store routes require authentication
router.use(authenticate);

router.post("/", asyncHandler(async (req, res) => {
  const result = await createStore(req.user, req.body);
  res.status(201).json(createApiResponse(result));
}));

router.get("/", asyncHandler(async (req, res) => {
  const result = await getStores(req.user, req.query);
  res.json(createApiResponse(result));
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const result = await getStoreById(req.user, req.params.id);
  res.json(createApiResponse(result));
}));

router.get("/:id/floor-status", asyncHandler(async (req, res) => {
  const result = await getStoreFloorStatus(req.user, req.params.id);
  res.json(createApiResponse(result));
}));

router.patch("/:id", asyncHandler(async (req, res) => {
  const result = await updateStore(req.user, req.params.id, req.body);
  res.json(createApiResponse(result));
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const result = await deleteStore(req.user, req.params.id);
  res.json(createApiResponse(result));
}));

// ---------------------------------------------------------
// SaaS Kill Switch: Protects ALL staff Store interactions
// ---------------------------------------------------------
router.use("/:storeId", billingGuard);

router.use("/:storeId/menu", menuRoutes);
router.use("/:storeId/inventory", requireFeature("INVENTORY", { writesOnly: true }), inventoryRoutes);
router.use("/:storeId/tables", tableRoutes);
router.use("/:storeId/orders", orderRoutes);
router.use("/:storeId/kds", kdsRoutes);
router.use("/:storeId/calls", waiterCallRoutes);
router.use("/:storeId/waiter-calls", waiterCallRoutes);
router.use("/:storeId/feedback", feedbackRoutes);
router.use("/:storeId/promos", requireFeature("PROMO_CODES", { writesOnly: true }), promoRoutes);
router.use("/:storeId/reservations", requireFeature("RESERVATIONS", { writesOnly: true }), reservationRoutes);
router.use("/:storeId/loyalty", requireFeature("LOYALTY", { writesOnly: true }), loyaltyRoutes);
router.use("/:storeId/payments", paymentRoutes);
router.use("/:storeId/audit", requireFeature("LEAKAGES"), auditRoutes);
router.use("/:storeId/marketing", requireFeature("CAMPAIGNS"), require("../marketing/marketing-routes"));
router.use("/:storeId/invoices", invoiceRoutes);

// GET /api/stores/:storeId/reviews?days=&filter=&page=  (guest ratings: score, dishes, comments)
router.get("/:storeId/reviews", requireFeature("REVIEWS"), asyncHandler(async (req, res) => {
  const { listReviews } = require("../reviews/review-service");
  res.json(createApiResponse(await listReviews(req.user, req.params.storeId, req.query)));
}));

module.exports = router;
