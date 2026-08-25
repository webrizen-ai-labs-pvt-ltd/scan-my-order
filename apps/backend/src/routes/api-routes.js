const express = require("express");
const authRoutes = require("../modules/auth/auth-routes");
const userRoutes = require("../modules/users/user-routes");
const billingRoutes = require("../modules/billing/billing-routes");
const storeRoutes = require("../modules/stores/store-routes");
const tenantRoutes = require("../modules/tenants/tenant-routes");
const publicRoutes = require("../modules/public/public-routes");
const dashboardRoutes = require("../modules/dashboard/dashboard-routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/billing", billingRoutes);
router.use("/stores", storeRoutes);
router.use("/tenants", tenantRoutes);
router.use("/public", publicRoutes);
router.use("/dashboard", dashboardRoutes);

module.exports = router;
