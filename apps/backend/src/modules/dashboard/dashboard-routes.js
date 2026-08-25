const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const { getDashboardMetrics } = require("./dashboard-service");

const router = express.Router();

router.use(authenticate);

router.get("/", asyncHandler(async (req, res) => {
  const result = await getDashboardMetrics(req.user);
  res.json(createApiResponse(result));
}));

module.exports = router;
