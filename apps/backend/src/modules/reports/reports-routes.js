const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const { getSalesReport, getSalesBills } = require("./sales-service");

const router = express.Router();
router.use(authenticate);

// GET /api/reports/sales?storeId=&from=YYYY-MM-DD&to=YYYY-MM-DD   (IST dates, inclusive)
router.get("/sales", asyncHandler(async (req, res) => {
  res.json(createApiResponse(await getSalesReport(req.user, req.query)));
}));

// GET /api/reports/sales/bills?storeId=&from=&to=   (one row per bill, for Excel export)
router.get("/sales/bills", asyncHandler(async (req, res) => {
  res.json(createApiResponse(await getSalesBills(req.user, req.query)));
}));

module.exports = router;
