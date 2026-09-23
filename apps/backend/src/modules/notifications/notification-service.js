const { getPrismaClient } = require("../../lib/prisma");
const { webPush } = require("./vapid-service");
const { broadcastToStore, broadcastToCustomer } = require("../orders/sse-service");

/**
 * Save or update a Web Push subscription
 */
async function saveSubscription({ endpoint, keys, userType, storeId, userId, sessionId, role }) {
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new Error("Invalid push subscription payload");
  }

  const prisma = getPrismaClient();

  return prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userType: userType || (role && role !== "CUSTOMER" ? "STAFF" : "CUSTOMER"),
      storeId: storeId || null,
      userId: userId || null,
      sessionId: sessionId || null,
      role: role || (userType === "STAFF" ? "STORE_MANAGER" : "CUSTOMER")
    },
    update: {
      p256dh: keys.p256dh,
      auth: keys.auth,
      userType: userType || undefined,
      storeId: storeId !== undefined ? storeId : undefined,
      userId: userId !== undefined ? userId : undefined,
      sessionId: sessionId !== undefined ? sessionId : undefined,
      role: role !== undefined ? role : undefined,
      updatedAt: new Date()
    }
  });
}

/**
 * Remove an invalid/unsubscribed endpoint
 */
async function removeSubscription(endpoint) {
  const prisma = getPrismaClient();
  try {
    await prisma.pushSubscription.delete({
      where: { endpoint }
    });
  } catch (err) {
    // Ignore not found
  }
}

/**
 * Centralized Quantum Notification Dispatcher
 * Dispatches:
 * 1. Database record persistence
 * 2. In-app SSE event stream (store staff / customer session)
 * 3. Background W3C Web Push with automatic cleanup of expired endpoints
 *
 * @param {Object} params
 * @param {string} [params.storeId]
 * @param {string} params.type - e.g. 'ORDER_STATUS', 'WAITER_CALL', 'PAYMENT_WEBHOOK', 'KITCHEN_ALERT'
 * @param {string} params.title
 * @param {string} params.body
 * @param {Object} [params.data] - payload e.g. { orderId, tableNumber, url, status, sound: 'notification.mp3' }
 * @param {Object} [params.target] - { customerId, sessionId, role, roles, storeId, userId }
 */
async function sendNotification({ storeId, type, title, body, data = {}, target = {} }) {
  const prisma = getPrismaClient();
  const soundName = data.sound || "notification.mp3";
  const enrichedData = {
    ...data,
    sound: soundName,
    timestamp: Date.now()
  };

  // 1. In-App SSE Broadcasts
  try {
    if (storeId) {
      broadcastToStore(storeId, "NOTIFICATION", {
        type,
        title,
        body,
        data: enrichedData,
        target
      });
    }

    if (target.customerId) {
      broadcastToCustomer(target.customerId, "NOTIFICATION", {
        type,
        title,
        body,
        data: enrichedData,
        target
      });
    }

    if (target.sessionId) {
      broadcastToCustomer(target.sessionId, "NOTIFICATION", {
        type,
        title,
        body,
        data: enrichedData,
        target
      });
    }
  } catch (sseErr) {
    console.warn("[NotificationService] SSE broadcast warning:", sseErr.message);
  }

  // 2. Persist to Database
  let savedNotification = null;
  try {
    savedNotification = await prisma.notification.create({
      data: {
        storeId: storeId || target.storeId || null,
        userId: target.userId || target.customerId || null,
        sessionId: target.sessionId || null,
        role: target.role || (target.roles ? target.roles.join(",") : null),
        title,
        body,
        type,
        data: enrichedData,
        isRead: false
      }
    });
  } catch (dbErr) {
    console.error("[NotificationService] Failed to persist notification to DB:", dbErr.message);
  }

  // 3. Web Push Subscriptions Match & Background Dispatch
  try {
    const whereConditions = [];

    if (target.customerId || target.userId) {
      whereConditions.push({ userId: target.customerId || target.userId });
    }

    if (target.sessionId) {
      whereConditions.push({ sessionId: target.sessionId });
    }

    if (storeId && (target.role || target.roles)) {
      const roles = target.roles || [target.role];
      whereConditions.push({
        storeId,
        role: { in: roles }
      });
    } else if (storeId && !target.customerId && !target.sessionId) {
      // General store staff notification
      whereConditions.push({
        storeId,
        userType: "STAFF"
      });
    }

    if (whereConditions.length > 0) {
      const subscriptions = await prisma.pushSubscription.findMany({
        where: {
          OR: whereConditions
        }
      });

      if (subscriptions && subscriptions.length > 0) {
        const payloadString = JSON.stringify({
          title,
          body,
          icon: "/pwa-192x192.png",
          badge: "/favicon.ico",
          data: {
            ...enrichedData,
            type,
            url: data.url || (target.sessionId ? `/m/${storeId}` : `/orders`)
          }
        });

        const pushPromises = subscriptions.map(async (sub) => {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          };

          try {
            await webPush.sendNotification(pushSubscription, payloadString);
          } catch (pushErr) {
            // If subscription has expired or unsubscribed, delete from DB
            if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
              await removeSubscription(sub.endpoint);
            } else {
              console.warn(`[NotificationService] Push delivery error (${sub.endpoint.slice(-8)}):`, pushErr.message);
            }
          }
        });

        // Run push notifications in background without blocking response
        Promise.all(pushPromises).catch(err => {
          console.error("[NotificationService] WebPush batch error:", err.message);
        });
      }
    }
  } catch (pushLookupErr) {
    console.error("[NotificationService] Error querying push subscriptions:", pushLookupErr.message);
  }

  return savedNotification;
}

/**
 * Get Staff notifications for Store
 */
async function getStaffNotifications(actor, storeId, { limit = 30, isRead, type } = {}) {
  const prisma = getPrismaClient();

  const where = {
    storeId,
    ...(isRead !== undefined ? { isRead } : {}),
    ...(type ? { type } : {})
  };

  const isManagement = ["SUPER_ADMIN", "TENANT_ADMIN", "STORE_MANAGER"].includes(actor?.role);
  if (!isManagement) {
    const userRole = actor?.role;
    where.OR = [
      { role: null },
      { role: userRole },
      { role: { contains: userRole } },
      { userId: actor?.id }
    ];
  }

  return prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(Number(limit) || 30, 100)
  });
}

/**
 * Mark a single notification as read
 */
async function markNotificationAsRead(id) {
  const prisma = getPrismaClient();
  return prisma.notification.update({
    where: { id },
    data: { isRead: true }
  });
}

/**
 * Mark all notifications as read for store/role
 */
async function markAllNotificationsAsRead(actor, storeId) {
  const prisma = getPrismaClient();
  const isManagement = ["SUPER_ADMIN", "TENANT_ADMIN", "STORE_MANAGER"].includes(actor?.role);

  const where = {
    storeId,
    isRead: false
  };

  if (!isManagement) {
    const userRole = actor?.role;
    where.OR = [
      { role: null },
      { role: userRole },
      { role: { contains: userRole } },
      { userId: actor?.id }
    ];
  }

  return prisma.notification.updateMany({
    where,
    data: { isRead: true }
  });
}

/**
 * Customer notifications
 */
async function getCustomerNotifications({ customerId, sessionId, storeId, limit = 20 }) {
  const prisma = getPrismaClient();

  const where = {};
  if (storeId) where.storeId = storeId;

  if (customerId && sessionId) {
    where.OR = [{ userId: customerId }, { sessionId }];
  } else if (customerId) {
    where.userId = customerId;
  } else if (sessionId) {
    where.sessionId = sessionId;
  } else {
    return [];
  }

  return prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(Number(limit) || 20, 50)
  });
}

module.exports = {
  saveSubscription,
  removeSubscription,
  sendNotification,
  getStaffNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getCustomerNotifications
};
