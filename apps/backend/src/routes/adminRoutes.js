const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController.js");
const { authenticateToken } = require("../middleware/auth.js");
const { authorizeRoles } = require("../middleware/role.js");

// Protect all admin routes with JWT auth and ADMIN role requirement
router.use(authenticateToken, authorizeRoles("ADMIN"));

// User Management Routes
router.get("/users", adminController.listUsers);
router.get("/users/:id", adminController.getUserById);
router.post("/users", adminController.createUser);
router.put("/users/:id", adminController.updateUser);
router.delete("/users/:id", adminController.deleteUser);
router.patch("/users/:id/role", adminController.changeUserRole);
router.patch("/users/:id/status", adminController.changeUserStatus);

// Store Management & Onboarding Routes
router.get("/stores", adminController.listStores);
router.get("/stores/:id", adminController.getStoreById);
router.put("/stores/:id", adminController.updateStore);
router.delete("/stores/:id", adminController.deleteStore);
router.post("/onboard-store", adminController.onboardStore);

// Store Digital Menu Items CRUD Routes
router.post("/stores/:id/menu", adminController.createMenuItem);
router.put("/stores/:id/menu/:itemId", adminController.updateMenuItem);
router.delete("/stores/:id/menu/:itemId", adminController.deleteMenuItem);
router.patch("/stores/:id/menu/:itemId/availability", adminController.toggleMenuItemAvailability);

module.exports = router;
