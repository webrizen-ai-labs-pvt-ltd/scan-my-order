const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const { getFeedback } = require("./feedback-service");

const router = express.Router({ mergeParams: true });

router.use(authenticate);

// GET /api/stores/:storeId/feedback
router.get("/", asyncHandler(async (req, res) => {
  const result = await getFeedback(req.params.storeId);
  res.json(createApiResponse(result));
}));

module.exports = router;
