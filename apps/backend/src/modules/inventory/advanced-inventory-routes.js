const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const service = require("./advanced-inventory-service");
const compliance = require("./compliance-service");

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

// What the records say when read together: losses, price rises, waste, things about to run out
router.get("/insights", send(req => require("./insights-service").getInsights(req.user, req.params.storeId)));

// Daily hygiene checks
router.get("/checks", send(req => compliance.getChecks(req.user, req.params.storeId)));
router.post("/checks/log", send(req => compliance.logCheck(req.user, req.params.storeId, req.body), 201));
router.post("/checks/standard", send(req => compliance.addStandardChecks(req.user, req.params.storeId), 201));
router.post("/checks", send(req => compliance.saveCheck(req.user, req.params.storeId, null, req.body), 201));
router.patch("/checks/:id", send(req => compliance.saveCheck(req.user, req.params.storeId, req.params.id, req.body)));

// Licences and certificates
router.get("/licences", send(req => compliance.listLicences(req.user, req.params.storeId)));
router.post("/licences", send(req => compliance.saveLicence(req.user, req.params.storeId, null, req.body), 201));
router.patch("/licences/:id", send(req => compliance.saveLicence(req.user, req.params.storeId, req.params.id, req.body)));
router.delete("/licences/:id", send(req => compliance.deleteLicence(req.user, req.params.storeId, req.params.id)));

// Everything an inspector asks for, for the last 7, 30 or 90 days
router.get("/inspection-pack", send(req => compliance.getInspectionPack(req.user, req.params.storeId, req.query)));

module.exports = router;
