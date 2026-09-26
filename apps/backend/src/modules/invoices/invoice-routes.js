const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const {
  listInvoices,
  exportInvoicesCsv,
  getInvoice,
  issueCorporateInvoice,
  setInvoiceRequest,
  searchCorporateClients,
  emailInvoice
} = require("./invoice-service");

const router = express.Router({ mergeParams: true });

router.use(authenticate);

// GET /api/stores/:storeId/invoices?from=&to=&kind=&status=&q=&page=
router.get("/", asyncHandler(async (req, res) => {
  const result = await listInvoices(req.user, req.params.storeId, req.query);
  res.json(createApiResponse(result));
}));

// GET /api/stores/:storeId/invoices/export.csv  (same filters; credit notes are negative)
router.get("/export.csv", asyncHandler(async (req, res) => {
  const csv = await exportInvoicesCsv(req.user, req.params.storeId, req.query);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="invoices-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
}));

// GET /api/stores/:storeId/invoices/clients?q=  (saved companies for the brand)
router.get("/clients", asyncHandler(async (req, res) => {
  const result = await searchCorporateClients(req.user, req.params.storeId, req.query.q);
  res.json(createApiResponse(result));
}));

// PUT /api/stores/:storeId/invoices/request  { orderId | tableSessionId, billTo | null, saveClient?, sendEmail? }
// Corporate details for an unpaid bill; the corporate invoice is issued when it is paid
router.put("/request", asyncHandler(async (req, res) => {
  const result = await setInvoiceRequest(req.user, req.params.storeId, req.body || {});
  res.json(createApiResponse(result));
}));

// GET /api/stores/:storeId/invoices/:id
router.get("/:id", asyncHandler(async (req, res) => {
  const result = await getInvoice(req.user, req.params.storeId, req.params.id);
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/invoices/:id/corporate  { billTo: {...}, saveClient?, sendEmail? }
router.post("/:id/corporate", asyncHandler(async (req, res) => {
  const result = await issueCorporateInvoice(req.user, req.params.storeId, req.params.id, req.body || {});
  res.status(201).json(createApiResponse(result));
}));

// POST /api/stores/:storeId/invoices/:id/email  { email }
router.post("/:id/email", asyncHandler(async (req, res) => {
  const result = await emailInvoice(req.user, req.params.storeId, req.params.id, req.body?.email);
  res.json(createApiResponse(result));
}));

module.exports = router;
