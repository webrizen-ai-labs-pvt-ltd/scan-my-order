const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const service = require("./advanced-inventory-service");

// Mounted at /api/stores/:storeId/inventory/advanced (the plan must include Advanced inventory)
const router = express.Router({ mergeParams: true });
router.use(authenticate);

const send = (handler, status = 200) => asyncHandler(async (req, res) => {
  res.status(status).json(createApiResponse(await handler(req)));
});

// Ingredients with their lots, and what needs attention today
router.get("/overview", send(req => service.getOverview(req.user, req.params.storeId)));

// Ingredients (setup: short code, shelf life, pack size, low-stock level)
router.post("/materials", send(req => service.createMaterial(req.user, req.params.storeId, req.body), 201));
router.patch("/materials/:id", send(req => service.updateMaterial(req.user, req.params.storeId, req.params.id, req.body)));

// Deliveries
router.get("/receipts", send(req => service.listReceipts(req.user, req.params.storeId, req.query)));
router.post("/receipts", send(req => service.receiveDelivery(req.user, req.params.storeId, req.body), 201));

// Wastage, counts and expired lots
router.get("/losses", send(req => service.listLosses(req.user, req.params.storeId, req.query)));
router.post("/waste", send(req => service.recordWaste(req.user, req.params.storeId, req.body), 201));
router.post("/counts", send(req => service.recordCounts(req.user, req.params.storeId, req.body), 201));
router.post("/lots/:id/used", send(req => service.confirmLotUsed(req.user, req.params.storeId, req.params.id)));

// Suppliers
router.get("/suppliers", send(req => service.listSuppliers(req.user, req.params.storeId)));
router.post("/suppliers", send(req => service.saveSupplier(req.user, req.params.storeId, null, req.body), 201));
router.patch("/suppliers/:id", send(req => service.saveSupplier(req.user, req.params.storeId, req.params.id, req.body)));

// Standing deliveries
router.get("/standing", send(req => service.listStanding(req.user, req.params.storeId)));
router.post("/standing", send(req => service.saveStanding(req.user, req.params.storeId, null, req.body), 201));
router.patch("/standing/:id", send(req => service.saveStanding(req.user, req.params.storeId, req.params.id, req.body)));
router.delete("/standing/:id", send(req => service.deleteStanding(req.user, req.params.storeId, req.params.id)));

// What each dish costs to make
router.get("/food-cost", send(req => service.getFoodCost(req.user, req.params.storeId)));

module.exports = router;
