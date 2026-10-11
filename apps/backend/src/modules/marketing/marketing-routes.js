const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const { getAudienceSummary, listCampaigns, sendCampaign } = require("./marketing-service");

const router = express.Router({ mergeParams: true });

router.use(authenticate);

// GET /api/stores/:storeId/marketing/audience
router.get("/audience", asyncHandler(async (req, res) => {
  res.json(createApiResponse(await getAudienceSummary(req.user, req.params.storeId)));
}));

// GET /api/stores/:storeId/marketing/campaigns
router.get("/campaigns", asyncHandler(async (req, res) => {
  res.json(createApiResponse(await listCampaigns(req.user, req.params.storeId)));
}));

// POST /api/stores/:storeId/marketing/campaigns  { title, body, audience, promoCode? }
router.post("/campaigns", asyncHandler(async (req, res) => {
  res.status(201).json(createApiResponse(await sendCampaign(req.user, req.params.storeId, req.body)));
}));

module.exports = router;
