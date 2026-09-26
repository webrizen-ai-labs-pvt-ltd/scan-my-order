const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const { listStoreAudit, exportStoreAuditCsv } = require("./audit-service");

const router = express.Router({ mergeParams: true });

router.use(authenticate);

// GET /api/stores/:storeId/audit?from=&to=&type=&actorId=&orderId=&page=&limit=
router.get("/", asyncHandler(async (req, res) => {
  const result = await listStoreAudit(req.user, req.params.storeId, req.query);
  res.json(createApiResponse(result));
}));

// GET /api/stores/:storeId/audit/export.csv  (same filters)
router.get("/export.csv", asyncHandler(async (req, res) => {
  const csv = await exportStoreAuditCsv(req.user, req.params.storeId, req.query);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="audit-${req.params.storeId}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
}));

module.exports = router;
