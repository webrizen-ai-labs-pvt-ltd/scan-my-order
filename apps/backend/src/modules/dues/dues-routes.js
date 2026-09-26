const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const {
  getSummary,
  listAccounts,
  createAccount,
  updateAccount,
  listBills,
  recordRepayment,
  listRepayments
} = require("./dues-service");

// Brand-wide dues. ?storeId= narrows to one store (store staff always see only their own).
const router = express.Router();
router.use(authenticate);

// GET /api/dues/summary?storeId=
router.get("/summary", asyncHandler(async (req, res) => {
  res.json(createApiResponse(await getSummary(req.user, req.query)));
}));

// GET /api/dues/accounts?storeId=&includeInactive=1
router.get("/accounts", asyncHandler(async (req, res) => {
  res.json(createApiResponse(await listAccounts(req.user, req.query)));
}));

// POST /api/dues/accounts { name, phone?, email?, note? }
router.post("/accounts", asyncHandler(async (req, res) => {
  res.status(201).json(createApiResponse(await createAccount(req.user, req.body || {})));
}));

// PATCH /api/dues/accounts/:id { name?, phone?, email?, note?, isActive? }
router.patch("/accounts/:id", asyncHandler(async (req, res) => {
  res.json(createApiResponse(await updateAccount(req.user, req.params.id, req.body || {})));
}));

// GET /api/dues/bills?storeId=&accountId=&status=open|paid|all&q=&page=
router.get("/bills", asyncHandler(async (req, res) => {
  res.json(createApiResponse(await listBills(req.user, req.query)));
}));

// GET /api/dues/repayments?storeId=&accountId=&page=
router.get("/repayments", asyncHandler(async (req, res) => {
  res.json(createApiResponse(await listRepayments(req.user, req.query)));
}));

// POST /api/dues/repayments { accountId, storeId?, amount, method, reference?, note?, receivedAt? }
router.post("/repayments", asyncHandler(async (req, res) => {
  res.status(201).json(createApiResponse(await recordRepayment(req.user, req.body || {})));
}));

module.exports = router;
