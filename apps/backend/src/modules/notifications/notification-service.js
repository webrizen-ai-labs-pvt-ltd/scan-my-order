const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { webPush } = require("./vapid-service");
const { broadcastToStoreStaff, broadcastToCustomer } = require("../orders/sse-service");
const { verifyStoreAccess } = require("../menu/menu-service");

const MANAGEMENT_ROLES = ["SUPER_ADMIN", "TENANT_ADMIN", "STORE_MANAGER"];

// Phones (the staff app) are kept in PushSubscription too: endpoint "expo:<token>", no web-push keys
const EXPO_PREFIX = "expo:";
const EXPO_TOKEN_PATTERN = /^Expo(nent)?PushToken\[.+\]$/;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100; // Expo takes at most 100 messages per request

/**
 * Save or update a Web Push subscription
 */
async function saveSubscription({ endpoint, keys, userType, storeId, userId, sessionId, role, marketingOptIn }) {
  if (!endpoint || !keys?.p256dh || !keys?.auth || String(endpoint).startsWith(EXPO_PREFIX)) {
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
      role: role || (userType === "STAFF" ? "STORE_MANAGER" : "CUSTOMER"),
      marketingOptIn: marketingOptIn === true
    },
    update: {
      p256dh: keys.p256dh,
      auth: keys.auth,
      userType: userType || undefined,
      storeId: storeId !== undefined ? storeId : undefined,
      userId: userId !== undefined ? userId : undefined,
      sessionId: sessionId !== undefined ? sessionId : undefined,
      role: role !== undefined ? role : undefined,
      // Only changed when the guest says so; a plain re-subscribe keeps their choice
      marketingOptIn: typeof marketingOptIn === "boolean" ? marketingOptIn : undefined,
      updatedAt: new Date()
    }
  });
}

/**
 * A guest turns offers from the store on or off for one device.
 * @returns {Promise<boolean>} false when the device isn't known
 */
async function setMarketingOptIn(endpoint, optIn) {
  const result = await getPrismaClient().pushSubscription.updateMany({
    where: { endpoint, userType: "CUSTOMER" },
    data: { marketingOptIn: Boolean(optIn) }
  });
  return result.count > 0;
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
 * Register a staff member's phone (an Expo push token) for one store
 */
async function saveExpoDevice(actor, storeId, token) {
  if (typeof token !== "string" || !EXPO_TOKEN_PATTERN.test(token)) {
    throw createHttpError(400, "A valid Expo push token is required");
  }
  if (!storeId) throw createHttpError(400, "storeId is required");
  await verifyStoreAccess(actor, storeId);

  const endpoint = `${EXPO_PREFIX}${token}`;
  // A phone that changed hands (or stores) now belongs to whoever registered it last
  const device = { p256dh: "", auth: "", userType: "STAFF", storeId, userId: actor.id, sessionId: null, role: actor.role, marketingOptIn: false };
  const row = await getPrismaClient().pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, ...device },
    update: device
  });
  return { id: row.id, storeId: row.storeId, role: row.role };
}

/**
 * Forget a phone; only the staff member it is registered to can remove it
 * @returns {Promise<boolean>} false when it isn't theirs (or isn't known)
 */
async function removeExpoDevice(actor, token) {
  if (typeof token !== "string" || !EXPO_TOKEN_PATTERN.test(token)) {
    throw createHttpError(400, "A valid Expo push token is required");
  }
  const result = await getPrismaClient().pushSubscription.deleteMany({
    where: { endpoint: `${EXPO_PREFIX}${token}`, userId: actor.id }
  });
  return result.count > 0;
}

/** Sends to phones through Expo's push service; devices Expo no longer knows are deleted */
async function sendExpoPushes(subscriptions, { title, body, data }) {
  const headers = { Accept: "application/json", "Content-Type": "application/json" };
  // Only needed when "enhanced push security" is turned on for the Expo project
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

  for (let i = 0; i < subscriptions.length; i += EXPO_BATCH_SIZE) {
    const batch = subscriptions.slice(i, i + EXPO_BATCH_SIZE);
    const messages = batch.map(sub => ({
      to: sub.endpoint.slice(EXPO_PREFIX.length),
      title,
      body,
      data,
      sound: "default",
      priority: "high",
      channelId: "alerts"
    }));

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(10000)
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        console.warn(`[NotificationService] Expo push rejected (${res.status}):`, JSON.stringify(result?.errors || result).slice(0, 300));
        continue;
      }
      // One ticket per message, in the same order
      const tickets = Array.isArray(result?.data) ? result.data : [];
      await Promise.all(tickets.map(async (ticket, index) => {
        if (ticket?.status !== "error") return;
        if (ticket.details?.error === "DeviceNotRegistered") {
          await removeSubscription(batch[index].endpoint);
        } else {
          console.warn(`[NotificationService] Expo push error (${batch[index].endpoint.slice(-8)}):`, ticket.message);
        }
      }));
    } catch (err) {
      console.warn("[NotificationService] Expo push delivery error:", err.message);
    }
  }
}

/**
 * Centralized Quantum Notification Dispatcher
 * Dispatches:
 * 1. Database record persistence (first, so live events carry the row's id)
 * 2. In-app SSE event stream (only the staff it targets / customer session)
 * 3. Background push: W3C Web Push and Expo (staff phones), with automatic cleanup of expired endpoints
 *
 * Targets with customerId or sessionId are guest-facing: they never go to the staff stream or staff lists.
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
  const isGuestTarget = Boolean(target.customerId || target.sessionId);
  const roles = target.roles || (target.role ? [target.role] : null);

  // 1. Persist to Database
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

  // 2. In-App SSE Broadcasts
  const livePayload = {
    id: savedNotification?.id || null,
    createdAt: savedNotification?.createdAt || new Date(),
    isRead: false,
    type,
    title,
    body,
    data: enrichedData,
    target
  };
  try {
    // Staff stream: one user, or the target roles; no target means all staff
    if (storeId && !isGuestTarget) {
      broadcastToStoreStaff(storeId, "NOTIFICATION", livePayload, { userId: target.userId, roles });
    }

    if (target.customerId) {
      broadcastToCustomer(target.customerId, "NOTIFICATION", livePayload);
    }

    if (target.sessionId) {
      broadcastToCustomer(target.sessionId, "NOTIFICATION", livePayload);
    }
  } catch (sseErr) {
    console.warn("[NotificationService] SSE broadcast warning:", sseErr.message);
  }

  // 3. Push Subscriptions Match & Background Dispatch
  try {
    const whereConditions = [];

    if (target.customerId) {
      whereConditions.push({ userId: target.customerId });
    }

    if (target.sessionId) {
      whereConditions.push({ sessionId: target.sessionId });
    }

    if (target.userId) {
      // Aimed at one staff member: only their devices, not everyone with the role
      whereConditions.push({ userId: target.userId });
    } else if (storeId && roles) {
      whereConditions.push({
        storeId,
        role: { in: roles }
      });
    } else if (storeId && !isGuestTarget) {
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

      const pushData = {
        ...enrichedData,
        type,
        notificationId: savedNotification?.id || null,
        url: data.url || (target.sessionId ? `/m/${storeId}` : `/orders`)
      };
      const phones = subscriptions.filter(sub => sub.endpoint.startsWith(EXPO_PREFIX));
      const browsers = subscriptions.filter(sub => !sub.endpoint.startsWith(EXPO_PREFIX));

      if (browsers.length > 0) {
        const payloadString = JSON.stringify({
          title,
          body,
          icon: "/pwa-192x192.png",
          badge: "/favicon.ico",
          data: pushData
        });

        const pushPromises = browsers.map(async (sub) => {
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

      if (phones.length > 0) {
        sendExpoPushes(phones, { title, body, data: pushData }).catch(err => {
          console.error("[NotificationService] Expo push batch error:", err.message);
        });
      }
    }
  } catch (pushLookupErr) {
    console.error("[NotificationService] Error querying push subscriptions:", pushLookupErr.message);
  }

  return savedNotification;
}

/**
 * The store's notifications a staff member may see. Guest-facing rows (a table session, or a
 * customer account) are never shown to staff. Managers see the rest; others see store-wide ones,
 * their role's, and those addressed to them (not ones addressed to a colleague with the same role).
 */
function staffNotificationWhere(actor, storeId) {
  const conditions = [
    { storeId },
    { sessionId: null },
    { OR: [{ userId: null }, { user: { is: { role: { not: "CUSTOMER" } } } }] }
  ];

  if (!MANAGEMENT_ROLES.includes(actor?.role)) {
    const userRole = actor?.role;
    conditions.push({
      OR: [
        { userId: actor?.id },
        {
          userId: null,
          OR: [
            { role: null },
            { role: userRole },
            { role: { contains: userRole } }
          ]
        }
      ]
    });
  }

  return { AND: conditions };
}

/**
 * Get Staff notifications for Store
 */
async function getStaffNotifications(actor, storeId, { limit = 30, isRead, type } = {}) {
  const prisma = getPrismaClient();

  const where = {
    ...staffNotificationWhere(actor, storeId),
    ...(isRead !== undefined ? { isRead } : {}),
    ...(type ? { type } : {})
  };

  return prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(Number(limit) || 30, 100)
  });
}

/**
 * Mark a single notification as read (only one in a store the actor works at, and that they can see)
 */
async function markNotificationAsRead(actor, id) {
  const prisma = getPrismaClient();
  const found = await prisma.notification.findUnique({ where: { id }, select: { storeId: true } });
  if (!found?.storeId) throw createHttpError(404, "Notification not found");
  await verifyStoreAccess(actor, found.storeId);

  const result = await prisma.notification.updateMany({
    where: { id, ...staffNotificationWhere(actor, found.storeId) },
    data: { isRead: true }
  });
  if (result.count === 0) throw createHttpError(404, "Notification not found");
  return prisma.notification.findUnique({ where: { id } });
}

/**
 * Mark all notifications as read for store/role
 */
async function markAllNotificationsAsRead(actor, storeId) {
  const prisma = getPrismaClient();
  return prisma.notification.updateMany({
    where: { ...staffNotificationWhere(actor, storeId), isRead: false },
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
  setMarketingOptIn,
  saveExpoDevice,
  removeExpoDevice,
  sendNotification,
  getStaffNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getCustomerNotifications
};
