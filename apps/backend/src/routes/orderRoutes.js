const express = require("express")
const router = express.Router()
const orderController = require("../controllers/orderController.js")
const { authenticateToken } = require("../middleware/auth.js")

// Public routes for customers
router.post("/", orderController.createOrder)
router.get("/:id", orderController.getOrderById)

// Staff / Waiter / Kitchen routes
router.get("/store/:storeId", authenticateToken, orderController.getStoreOrders)
router.patch("/:id/verify", authenticateToken, orderController.verifyPostpaidOrder)
router.patch("/:id/status", authenticateToken, orderController.updateOrderStatus)

module.exports = router
