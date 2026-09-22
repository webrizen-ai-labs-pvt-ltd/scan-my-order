const express = require("express");
const { authenticate } = require("../../middleware/auth");
const { asyncHandler } = require("../../middleware/async-handler");
const { createApiResponse } = require("@smo/shared");
const { getVapidPublicKey } = require("./vapid-service");
const {
  saveSubscription,
  removeSubscription,
  sendNotification,
  getStaffNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getCustomerNotifications
} = require("./notification-service");
const { verifyJwt } = require("../../lib/jwt");

// Staff Router (requires authentication)
const staffRouter = express.Router();
staffRouter.use(authenticate);

// GET /api/notifications/vapid-public-key (convenience for authenticated staff)
staffRouter.get("/vapid-public-key", (req, res) => {
  res.json(createApiResponse({ publicKey: getVapidPublicKey() }));
});

// POST /api/notifications/subscribe
staffRouter.post("/subscribe", asyncHandler(async (req, res) => {
  const { endpoint, keys, storeId } = req.body;
  const targetStoreId = storeId || req.user.storeId;

  const subscription = await saveSubscription({
    endpoint,
    keys,
    userType: "STAFF",
    storeId: targetStoreId,
    userId: req.user.id,
    role: req.user.role
  });

  res.json(createApiResponse(subscription, "Staff push subscription saved"));
}));

// DELETE /api/notifications/subscribe
staffRouter.delete("/subscribe", asyncHandler(async (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) {
    await removeSubscription(endpoint);
  }
  res.json(createApiResponse({ success: true }));
}));

// GET /api/notifications
staffRouter.get("/", asyncHandler(async (req, res) => {
  const storeId = req.query.storeId || req.user.storeId;
  if (!storeId) {
    return res.status(400).json(createApiResponse(null, "storeId is required"));
  }

  const isRead = req.query.isRead !== undefined ? req.query.isRead === "true" : undefined;
  const notifications = await getStaffNotifications(req.user, storeId, {
    limit: req.query.limit,
    isRead,
    type: req.query.type
  });

  res.json(createApiResponse(notifications));
}));

// PATCH /api/notifications/:id/read
staffRouter.patch("/:id/read", asyncHandler(async (req, res) => {
  const updated = await markNotificationAsRead(req.params.id);
  res.json(createApiResponse(updated));
}));

// POST /api/notifications/mark-all-read
staffRouter.post("/mark-all-read", asyncHandler(async (req, res) => {
  const storeId = req.body.storeId || req.user.storeId;
  if (!storeId) {
    return res.status(400).json(createApiResponse(null, "storeId is required"));
  }

  await markAllNotificationsAsRead(req.user, storeId);
  res.json(createApiResponse({ success: true }, "All notifications marked as read"));
}));

// POST /api/notifications/test
staffRouter.post("/test", asyncHandler(async (req, res) => {
  const storeId = req.body.storeId || req.user.storeId;
  const notification = await sendNotification({
    storeId,
    type: "TEST_NOTIFICATION",
    title: "Quantum Notification Test",
    body: "Audio chime and background push are connected successfully!",
    data: {
      sound: "notification.mp3",
      timestamp: Date.now()
    },
    target: {
      userId: req.user.id,
      storeId,
      role: req.user.role
    }
  });

  res.json(createApiResponse(notification, "Test notification dispatched"));
}));


// Public Customer Router (for menu frontend)
const publicNotificationRouter = express.Router();

// GET /api/public/notifications/vapid-public-key
publicNotificationRouter.get("/vapid-public-key", (req, res) => {
  res.json(createApiResponse({ publicKey: getVapidPublicKey() }));
});

// POST /api/public/notifications/subscribe
publicNotificationRouter.post("/subscribe", asyncHandler(async (req, res) => {
  const { endpoint, keys, storeId, sessionId, token } = req.body;
  let customerId = null;

  if (token) {
    try {
      const decoded = verifyJwt(token);
      if (decoded && decoded.sub) customerId = decoded.sub;
    } catch (e) {
      // Optional token, continue if invalid
    }
  }

  const subscription = await saveSubscription({
    endpoint,
    keys,
    userType: "CUSTOMER",
    storeId,
    userId: customerId,
    sessionId: sessionId || null,
    role: "CUSTOMER"
  });

  res.json(createApiResponse(subscription, "Customer push subscription saved"));
}));

// DELETE /api/public/notifications/subscribe
publicNotificationRouter.delete("/subscribe", asyncHandler(async (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) {
    await removeSubscription(endpoint);
  }
  res.json(createApiResponse({ success: true }));
}));

// GET /api/public/notifications
publicNotificationRouter.get("/", asyncHandler(async (req, res) => {
  const { storeId, sessionId, token, limit } = req.query;
  let customerId = null;

  if (token) {
    try {
      const decoded = verifyJwt(token);
      if (decoded && decoded.sub) customerId = decoded.sub;
    } catch (e) {
      // Optional token
    }
  }

  if (!sessionId && !customerId) {
    return res.status(400).json(createApiResponse(null, "sessionId or customer token is required"));
  }

  const notifications = await getCustomerNotifications({
    storeId,
    sessionId,
    customerId,
    limit
  });

  res.json(createApiResponse(notifications));
}));

module.exports = {
  staffNotificationRouter: staffRouter,
  publicNotificationRouter
};
