const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController.js");
const { authenticateToken } = require("../middleware/auth.js");
const { authorizeRoles } = require("../middleware/role.js");

// Protect all admin routes with JWT auth and ADMIN role requirement
router.use(authenticateToken, authorizeRoles("ADMIN"));

router.get("/users", adminController.listUsers);
router.get("/users/:id", adminController.getUserById);
router.post("/users", adminController.createUser);
router.put("/users/:id", adminController.updateUser);
router.delete("/users/:id", adminController.deleteUser);
router.patch("/users/:id/role", adminController.changeUserRole);
router.patch("/users/:id/status", adminController.changeUserStatus);

router.get("/stores", adminController.listStores);
router.post("/onboard-store", adminController.onboardStore);

module.exports = router;
