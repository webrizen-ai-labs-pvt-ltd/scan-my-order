const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const { bootstrapSuperAdmin, login, loginWithGoogle } = require("./auth-service");
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
