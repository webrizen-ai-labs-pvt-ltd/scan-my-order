const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController.js");
const { authenticateToken } = require("../middleware/auth.js");

// Public Auth Routes
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/google", authController.googleAuth);

// Passkey Routes
router.post("/passkey/authenticate-options", authController.passkeyAuthOptions);
router.post("/passkey/authenticate-verify", authController.passkeyAuthVerify);

// Protected Passkey Registration Routes
router.post("/passkey/register-options", authenticateToken, authController.passkeyRegisterOptions);
router.post("/passkey/register-verify", authenticateToken, authController.passkeyRegisterVerify);

// Password Reset Routes
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

// Logout Route
router.post("/logout", authenticateToken, authController.logout);

module.exports = router;
