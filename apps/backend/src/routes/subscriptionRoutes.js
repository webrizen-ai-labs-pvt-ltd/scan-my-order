const express = require("express");
const router = express.Router();
const subscriptionController = require("../controllers/subscriptionController.js");
const { authenticateToken } = require("../middleware/auth.js");
const { authorizeRoles } = require("../middleware/role.js");

// Public list of active subscription plans
router.get("/plans", subscriptionController.listPlans);
router.get("/plans/:id", subscriptionController.getPlanById);

// Admin routes for managing plans and store subscriptions
router.post("/plans", authenticateToken, authorizeRoles("ADMIN"), subscriptionController.createPlan);
router.put("/plans/:id", authenticateToken, authorizeRoles("ADMIN"), subscriptionController.updatePlan);
router.delete("/plans/:id", authenticateToken, authorizeRoles("ADMIN"), subscriptionController.deletePlan);

router.get("/store-subscriptions", authenticateToken, authorizeRoles("ADMIN", "OWNER"), subscriptionController.listStoreSubscriptions);
router.post("/assign", authenticateToken, authorizeRoles("ADMIN"), subscriptionController.assignStoreSubscription);
router.delete("/store-subscriptions/:id", authenticateToken, authorizeRoles("ADMIN"), subscriptionController.deleteStoreSubscription);
router.post("/phonepe-checkout", authenticateToken, authorizeRoles("ADMIN", "OWNER"), subscriptionController.initiatePhonePeCheckout);
router.post("/phonepe-verify", authenticateToken, authorizeRoles("ADMIN", "OWNER"), subscriptionController.verifyPhonePePayment);

module.exports = router;
