const prisma = require("../config/prisma.js")
const {
  broadcastNewOrder,
  broadcastOrderUpdate,
  broadcastTableServiceRequest,
} = require("../sockets/orderSocketManager.js")

// Generate clean readable order number e.g. ORD-8472
function generateOrderNumber() {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000)
  return `ORD-${randomSuffix}`
}

/**
 * Place a new food order (Prepaid or Postpaid)
 * POST /api/orders
 */
async function createOrder(req, res) {
  try {
    const {
      storeId,
      tableNumber,
      orderType = "DINING",
      items,
      paymentType = "POSTPAID",
      notes,
      customerName,
      customerEmail,
      customerPhone,
      discount = 0,
      appliedCouponCode,
    } = req.body

    if (!storeId) {
      return res.status(400).json({ success: false, message: "Store ID is required." })
    }

    const isTakeaway = String(orderType).toUpperCase() === "TAKEAWAY"
    const finalOrderType = isTakeaway ? "TAKEAWAY" : "DINING"
    const finalTableNumber = isTakeaway ? "TAKEAWAY" : String(tableNumber || "").trim()

    if (!isTakeaway && (!finalTableNumber || finalTableNumber === "")) {
      return res.status(400).json({ success: false, message: "Table number is required for dining orders." })
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Order must contain at least one menu item." })
    }

    // Check store exists & fetch tax/billing configuration
    const store = await prisma.store.findUnique({ where: { id: storeId } })
    if (!store) {
      return res.status(404).json({ success: false, message: "Store establishment not found." })
    }

    // Validate and compute itemized subtotal
    let calculatedSubtotal = 0
    const orderItemsData = items.map((item) => {
      const price = parseFloat(item.price) || 0
      const quantity = parseInt(item.quantity, 10) || 1
      const itemTotal = price * quantity
      calculatedSubtotal += itemTotal

      return {
        menuItemId: item.menuItemId || item.id || null,
        name: item.name || "Menu Item",
        price,
        quantity,
        itemTotal,
        notes: item.notes || null,
      }
    })

    const subtotal = Math.max(0, calculatedSubtotal)

    // Dynamic Tax Breakdown based on Store Owner Configuration
    const taxType = (store.taxType || "FORWARD").toUpperCase() // "FORWARD" (Exclusive) or "BACKWARD" (Inclusive)
    const taxValueType = (store.taxValueType || "PERCENTAGE").toUpperCase() // "PERCENTAGE" or "FIXED"
    const storeTaxValue = parseFloat(store.taxValue) || 0

    let tax = 0
    if (taxValueType === "PERCENTAGE") {
      if (taxType === "BACKWARD") {
        tax = Math.round((subtotal - subtotal / (1 + storeTaxValue / 100)) * 100) / 100
      } else {
        tax = Math.round((subtotal * (storeTaxValue / 100)) * 100) / 100
      }
    } else {
      tax = Math.round(storeTaxValue * 100) / 100
    }

    const serviceFee = subtotal > 0 ? parseFloat(store.serviceFee) || 0 : 0

    let calculatedDiscount = parseFloat(discount) || 0
    if (appliedCouponCode && store.couponCode && appliedCouponCode.trim().toUpperCase() === store.couponCode.trim().toUpperCase()) {
      const couponValue = parseFloat(store.couponValue) || 0
      if ((store.couponValueType || "PERCENTAGE").toUpperCase() === "PERCENTAGE") {
        calculatedDiscount += Math.round((subtotal * (couponValue / 100)) * 100) / 100
      } else {
        calculatedDiscount += couponValue
      }
    }

    const numericDiscount = Math.min(subtotal, Math.max(0, calculatedDiscount))
    const basePayable = taxType === "BACKWARD" ? subtotal : subtotal + tax
    const totalAmount = Math.max(0, Math.round((basePayable + serviceFee - numericDiscount) * 100) / 100)

    const isPrepaid = String(paymentType).toUpperCase() === "PREPAID"
    const finalPaymentType = isPrepaid ? "PREPAID" : "POSTPAID"
    const orderStatus = isPrepaid ? "ACCEPTED" : "PENDING_VERIFICATION"
    const paymentStatus = isPrepaid ? "PAID" : "PENDING"

    const orderNumber = generateOrderNumber()

    // Create Order with nested items
    const order = await prisma.order.create({
      data: {
        orderNumber,
        storeId,
        tableNumber: finalTableNumber,
        orderType: finalOrderType,
        customerName: customerName ? String(customerName).trim() : "Guest Diner",
        customerEmail: customerEmail ? String(customerEmail).trim().toLowerCase() : null,
        customerPhone: customerPhone ? String(customerPhone).trim() : null,
        paymentType: finalPaymentType,
        paymentStatus,
        orderStatus,
        notes: notes ? String(notes).trim() : null,
        subtotal,
        tax,
        serviceFee,
        discount: numericDiscount,
        totalAmount,
        items: {
          create: orderItemsData,
        },
      },
      include: {
        items: true,
        store: {
          select: {
            id: true,
            name: true,
            brandingLogo: true,
            gstNumber: true,
            taxType: true,
            taxValueType: true,
            taxValue: true,
          },
        },
      },
    })

    // REAL-TIME WEBSOCKET BROADCAST TO KITCHEN / WAITER DASHBOARDS
    broadcastNewOrder(storeId, order)

    return res.status(201).json({
      success: true,
      message: isPrepaid
        ? "Prepaid order confirmed and sent directly to kitchen!"
        : "Postpaid order placed! Waiting for waiter manual verification.",
      data: order,
    })
  } catch (error) {
    console.error("Create Order Error:", error)
    return res.status(500).json({
      success: false,
      message: "Failed to place order.",
      error: error.message,
    })
  }
}

/**
 * Get active orders for a store (For Waiters/Staff/Kitchen)
 * GET /api/orders/store/:storeId
 */
async function getStoreOrders(req, res) {
  try {
    const { storeId } = req.params
    const { status, paymentType, orderType, search } = req.query

    if (!storeId) {
      return res.status(400).json({ success: false, message: "Store ID is required." })
    }

    const where = { storeId }
    if (status && status !== "ALL") {
      where.orderStatus = status
    }
    if (paymentType && paymentType !== "ALL") {
      where.paymentType = paymentType
    }
    if (orderType && orderType !== "ALL") {
      where.orderType = orderType
    }

    if (search && String(search).trim() !== "") {
      const q = String(search).trim()
      where.OR = [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { customerName: { contains: q, mode: "insensitive" } },
        { customerPhone: { contains: q, mode: "insensitive" } },
        { tableNumber: { contains: q, mode: "insensitive" } },
      ]
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return res.status(200).json({
      success: true,
      data: orders,
    })
  } catch (error) {
    console.error("Get Store Orders Error:", error)
    return res.status(500).json({
      success: false,
      message: "Failed to fetch store orders.",
      error: error.message,
    })
  }
}

/**
 * Waiter Verification for Postpaid Orders
 * PATCH /api/orders/:id/verify
 */
async function verifyPostpaidOrder(req, res) {
  try {
    const { id } = req.params

    const existing = await prisma.order.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ success: false, message: "Order not found." })
    }

    if (existing.orderStatus !== "PENDING_VERIFICATION") {
      return res.status(400).json({
        success: false,
        message: `Order is already in state: ${existing.orderStatus}`,
      })
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        orderStatus: "ACCEPTED",
      },
      include: {
        items: true,
      },
    })

    // REAL-TIME WEBSOCKET BROADCAST
    broadcastOrderUpdate(updated.storeId, updated.id, updated)

    return res.status(200).json({
      success: true,
      message: "Postpaid order verified by waiter and dispatched to kitchen!",
      data: updated,
    })
  } catch (error) {
    console.error("Verify Postpaid Order Error:", error)
    return res.status(500).json({
      success: false,
      message: "Failed to verify order.",
      error: error.message,
    })
  }
}

/**
 * Update Order Status (Kitchen / Staff workflow)
 * PATCH /api/orders/:id/status
 */
async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params
    const { orderStatus, paymentStatus } = req.body

    const existing = await prisma.order.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ success: false, message: "Order not found." })
    }

    const updateData = {}
    if (orderStatus) {
      updateData.orderStatus = orderStatus
    }

    if (paymentStatus) {
      updateData.paymentStatus = paymentStatus
    } else if (orderStatus === "COMPLETED") {
      updateData.paymentStatus = "PAID"
    }

    const updated = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        items: true,
      },
    })

    // REAL-TIME WEBSOCKET BROADCAST TO STAFF & CUSTOMER
    broadcastOrderUpdate(updated.storeId, updated.id, updated)

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${updated.orderStatus}!`,
      data: updated,
    })
  } catch (error) {
    console.error("Update Order Status Error:", error)
    return res.status(500).json({
      success: false,
      message: "Failed to update order status.",
      error: error.message,
    })
  }
}

/**
 * Cancel Order (Staff / Waiter / Kitchen)
 * POST /api/orders/:id/cancel
 */
async function cancelOrder(req, res) {
  try {
    const { id } = req.params
    const { reason = "Cancelled by staff" } = req.body

    const existing = await prisma.order.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ success: false, message: "Order not found." })
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        orderStatus: "CANCELLED",
        notes: existing.notes ? `${existing.notes} | Cancellation Reason: ${reason}` : `Cancellation Reason: ${reason}`,
      },
      include: {
        items: true,
      },
    })

    // REAL-TIME WEBSOCKET BROADCAST
    broadcastOrderUpdate(updated.storeId, updated.id, updated)

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully.",
      data: updated,
    })
  } catch (error) {
    console.error("Cancel Order Error:", error)
    return res.status(500).json({
      success: false,
      message: "Failed to cancel order.",
      error: error.message,
    })
  }
}

/**
 * Request Table Service ("Call Waiter", "Request Bill", "Need Water", "Clear Table")
 * POST /api/orders/call-waiter
 */
async function requestTableService(req, res) {
  try {
    const { storeId, tableNumber, serviceType = "WAITER", notes } = req.body

    if (!storeId || !tableNumber) {
      return res.status(400).json({ success: false, message: "Store ID and Table Number are required." })
    }

    const payload = {
      tableNumber: String(tableNumber).trim(),
      serviceType: String(serviceType).toUpperCase(),
      notes: notes ? String(notes).trim() : null,
      requestedAt: new Date().toISOString(),
    }

    // Broadcast table alert in real-time to waiter/staff dashboards
    broadcastTableServiceRequest(storeId, payload)

    return res.status(200).json({
      success: true,
      message: `Table ${tableNumber} ${serviceType} request dispatched to staff!`,
      data: payload,
    })
  } catch (error) {
    console.error("Table Service Request Error:", error)
    return res.status(500).json({
      success: false,
      message: "Failed to request table service.",
      error: error.message,
    })
  }
}

/**
 * Fetch Store Order Analytics / Metrics
 * GET /api/orders/store/:storeId/analytics
 */
async function getStoreOrderAnalytics(req, res) {
  try {
    const { storeId } = req.params

    if (!storeId) {
      return res.status(400).json({ success: false, message: "Store ID is required." })
    }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [
      pendingCount,
      preparingCount,
      readyCount,
      completedTodayCount,
      revenueResult,
    ] = await Promise.all([
      prisma.order.count({ where: { storeId, orderStatus: "PENDING_VERIFICATION" } }),
      prisma.order.count({ where: { storeId, orderStatus: "PREPARING" } }),
      prisma.order.count({ where: { storeId, orderStatus: "READY" } }),
      prisma.order.count({ where: { storeId, orderStatus: "COMPLETED", createdAt: { gte: todayStart } } }),
      prisma.order.aggregate({
        where: { storeId, paymentStatus: "PAID", createdAt: { gte: todayStart } },
        _sum: { totalAmount: true },
      }),
    ])

    const totalRevenueToday = parseFloat(revenueResult._sum.totalAmount || 0)

    return res.status(200).json({
      success: true,
      data: {
        pendingVerification: pendingCount,
        preparing: preparingCount,
        ready: readyCount,
        completedToday: completedTodayCount,
        totalRevenueToday,
      },
    })
  } catch (error) {
    console.error("Get Order Analytics Error:", error)
    return res.status(500).json({
      success: false,
      message: "Failed to fetch order analytics.",
      error: error.message,
    })
  }
}

/**
 * Fetch Single Order Status (For Customer real-time status tracker)
 * GET /api/orders/:id
 */
async function getOrderById(req, res) {
  try {
    const { id } = req.params

    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id }, { orderNumber: id }],
      },
      include: {
        items: true,
        store: {
          select: {
            id: true,
            name: true,
            brandingLogo: true,
            operatingHours: true,
          },
        },
      },
    })

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." })
    }

    return res.status(200).json({
      success: true,
      data: order,
    })
  } catch (error) {
    console.error("Get Order By ID Error:", error)
    return res.status(500).json({
      success: false,
      message: "Failed to fetch order details.",
      error: error.message,
    })
  }
}

module.exports = {
  createOrder,
  getStoreOrders,
  verifyPostpaidOrder,
  updateOrderStatus,
  cancelOrder,
  requestTableService,
  getStoreOrderAnalytics,
  getOrderById,
}
