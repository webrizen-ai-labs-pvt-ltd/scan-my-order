const { Server } = require("socket.io");

let io = null;

/**
 * Initialize Socket.IO Server on Express HTTP Server
 */
function initOrderSockets(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log(`⚡ Client connected to Real-Time Order Socket: ${socket.id}`);

    // Join Store Room (For Kitchen, Waiter, Staff, Owner Dashboards)
    socket.on("join_store", (storeId) => {
      if (storeId) {
        const room = `store_${storeId}`;
        socket.join(room);
        console.log(`📌 Socket ${socket.id} joined room: ${room}`);
        socket.emit("store_joined", { storeId, room, timestamp: new Date() });
      }
    });

    // Leave Store Room
    socket.on("leave_store", (storeId) => {
      if (storeId) {
        const room = `store_${storeId}`;
        socket.leave(room);
        console.log(`👋 Socket ${socket.id} left room: ${room}`);
      }
    });

    // Join Order Room (For Customer Order Status Tracking Screen)
    socket.on("join_order", (orderId) => {
      if (orderId) {
        const room = `order_${orderId}`;
        socket.join(room);
        console.log(`📌 Customer socket ${socket.id} joined order room: ${room}`);
        socket.emit("order_joined", { orderId, room, timestamp: new Date() });
      }
    });

    // Leave Order Room
    socket.on("leave_order", (orderId) => {
      if (orderId) {
        const room = `order_${orderId}`;
        socket.leave(room);
        console.log(`👋 Customer socket ${socket.id} left order room: ${room}`);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`🔌 Client disconnected from Order Socket: ${socket.id} (${reason})`);
    });
  });

  return io;
}

/**
 * Get active Socket.IO instance
 */
function getIoInstance() {
  return io;
}

/**
 * Broadcast New Order to Store Staff Room (Kitchen, Waiter, Owner)
 */
function broadcastNewOrder(storeId, order) {
  if (!io || !storeId) return;
  const room = `store_${storeId}`;
  io.to(room).emit("order_created", {
    type: "ORDER_CREATED",
    storeId,
    order,
    timestamp: new Date().toISOString(),
  });
  console.log(`📢 Real-time event [order_created] broadcasted to room ${room} for order ${order?.orderNumber || order?.id}`);
}

/**
 * Broadcast Order Status Update to Store Staff Room & Customer Order Room
 */
function broadcastOrderUpdate(storeId, orderId, updatedOrder) {
  if (!io) return;

  // Broadcast to Staff Room
  if (storeId) {
    const storeRoom = `store_${storeId}`;
    io.to(storeRoom).emit("order_updated", {
      type: "ORDER_UPDATED",
      storeId,
      orderId,
      order: updatedOrder,
      timestamp: new Date().toISOString(),
    });
    console.log(`📢 Real-time event [order_updated] broadcasted to store room ${storeRoom}`);
  }

  // Broadcast to Customer Order Tracker Room
  if (orderId) {
    const orderRoom = `order_${orderId}`;
    io.to(orderRoom).emit("order_status_changed", {
      type: "ORDER_STATUS_CHANGED",
      orderId,
      orderStatus: updatedOrder.orderStatus,
      paymentStatus: updatedOrder.paymentStatus,
      order: updatedOrder,
      timestamp: new Date().toISOString(),
    });
    console.log(`📢 Real-time event [order_status_changed] broadcasted to customer room ${orderRoom}`);
  }
}

/**
 * Broadcast Customer Table Service Request ("Call Waiter", "Request Bill", "Need Assistance")
 */
function broadcastTableServiceRequest(storeId, serviceData) {
  if (!io || !storeId) return;
  const room = `store_${storeId}`;
  io.to(room).emit("table_service_requested", {
    type: "TABLE_SERVICE_REQUESTED",
    storeId,
    ...serviceData,
    timestamp: new Date().toISOString(),
  });
  console.log(`📢 Real-time event [table_service_requested] broadcasted to room ${room} for Table ${serviceData.tableNumber}`);
}

module.exports = {
  initOrderSockets,
  getIoInstance,
  broadcastNewOrder,
  broadcastOrderUpdate,
  broadcastTableServiceRequest,
};
