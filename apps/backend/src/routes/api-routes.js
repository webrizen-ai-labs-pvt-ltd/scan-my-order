const express = require("express");
const authRoutes = require("../modules/auth/auth-routes");
const userRoutes = require("../modules/users/user-routes");
const billingRoutes = require("../modules/billing/billing-routes");
const storeRoutes = require("../modules/stores/store-routes");
const tenantRoutes = require("../modules/tenants/tenant-routes");
const publicRoutes = require("../modules/public/public-routes");
const dashboardRoutes = require("../modules/dashboard/dashboard-routes");
const maintenanceRoutes = require("../modules/maintenance/maintenance-routes");
const analyticsRoutes = require("../modules/analytics/analytics-routes");
const duesRoutes = require("../modules/dues/dues-routes");
const reportsRoutes = require("../modules/reports/reports-routes");
const { staffNotificationRouter } = require("../modules/notifications/notification-routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/billing", billingRoutes);
router.use("/stores", storeRoutes);
router.use("/tenants", tenantRoutes);
router.use("/public", publicRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/maintenance", maintenanceRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/dues", duesRoutes);
router.use("/reports", reportsRoutes);
router.use("/notifications", staffNotificationRouter);

module.exports = router;

