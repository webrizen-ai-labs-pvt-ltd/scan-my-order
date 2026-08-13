const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController.js");
const { authenticateToken } = require("../middleware/auth.js");

// Protect all user self-service routes with JWT auth
router.use(authenticateToken);

router.get("/me", userController.getProfile);
router.put("/me", userController.updateProfile);
router.delete("/me", userController.deleteProfile);
router.patch("/me/password", userController.changePassword);
router.patch("/me/email", userController.updateEmail);
router.patch("/me/avatar", userController.updateAvatar);

module.exports = router;
