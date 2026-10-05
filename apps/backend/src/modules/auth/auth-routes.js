const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const { bootstrapSuperAdmin, customerRegister, login, loginWithGoogle, changeOwnPassword, getOwnPasswordStatus } = require("./auth-service");
const { rateLimit } = require("../../lib/rate-limit");
const { generateAuthOptions, generateRegistrationOptions, verifyAuth, verifyRegistration, listPasskeys, deletePasskey } = require("./passkey-service");

const router = express.Router();

router.post("/bootstrap-super-admin", asyncHandler(async (req, res) => {
  const result = await bootstrapSuperAdmin(req.body);
  res.status(201).json(createApiResponse(result));
}));

router.post("/login", asyncHandler(async (req, res) => {
  const result = await login(req.body);
  res.json(createApiResponse(result));
}));

router.post("/customer-register", asyncHandler(async (req, res) => {
  const result = await customerRegister(req.body);
  res.status(201).json(createApiResponse(result));
}));

router.post("/google", asyncHandler(async (req, res) => {
  const result = await loginWithGoogle(req.body);
  res.json(createApiResponse(result));
}));

// Passkeys - Public Auth
router.post("/passkeys/auth-options", asyncHandler(async (req, res) => {
  const result = await generateAuthOptions(req.body);
  res.json(createApiResponse(result));
}));

router.post("/passkeys/authenticate", asyncHandler(async (req, res) => {
  const result = await verifyAuth(req.body);
  res.json(createApiResponse(result));
}));

// Passkeys - Authenticated Registration
// Signed-in owner's own password (employees are reset by their manager)
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => `pw:${req.user?.id || req.ip}`,
  message: "Too many password attempts. Try again in a few minutes."
});

// POST /api/auth/stream-ticket -> { ticket }
// Short-lived token for opening a live-updates stream, so the real login token never goes in a URL
router.post("/stream-ticket", authenticate, (req, res) => {
  const { signJwt } = require("../../lib/jwt");
  const ticket = signJwt({ sub: req.user.id, tv: req.user.tokenVersion || 0, purpose: "stream" }, { expiresIn: "2m" });
  res.json(createApiResponse({ ticket }));
});

// GET /api/auth/password -> { canChange, hasPassword }
router.get("/password", authenticate, asyncHandler(async (req, res) => {
  res.json(createApiResponse(await getOwnPasswordStatus(req.user)));
}));

// POST /api/auth/password { currentPassword, newPassword } -> { token, user }
router.post("/password", authenticate, passwordLimiter, asyncHandler(async (req, res) => {
  res.json(createApiResponse(await changeOwnPassword(req.user, req.body || {})));
}));

router.get("/passkeys/register-options", authenticate, asyncHandler(async (req, res) => {
  const result = await generateRegistrationOptions(req.user);
  res.json(createApiResponse(result));
}));

router.post("/passkeys/register", authenticate, asyncHandler(async (req, res) => {
  const result = await verifyRegistration(req.user, req.body);
  res.json(createApiResponse(result));
}));

// Passkeys - Authenticated Management
router.get("/passkeys", authenticate, asyncHandler(async (req, res) => {
  const result = await listPasskeys(req.user);
  res.json(createApiResponse(result));
}));

router.delete("/passkeys/:id", authenticate, asyncHandler(async (req, res) => {
  const result = await deletePasskey(req.user, req.params.id);
  res.json(createApiResponse(result));
}));

module.exports = router;
