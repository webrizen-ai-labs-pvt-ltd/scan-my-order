const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { getPrismaClient } = require("../../lib/prisma");
const { decrypt } = require("../../lib/encryption");
const { billingGuard } = require("../../middleware/billing-guard");
const { publicMenuCache } = require("../../lib/cache");
const { createOrder } = require("../orders/order-service");
const { verifyCheckoutPayment, handleRazorpayWebhook } = require("../payments/payment-service");
const { rateLimit } = require("../../lib/rate-limit");
const { createWaiterCall, getTableCallStatus, cancelWaiterCall } = require("../waiter-calls/waiter-call-service");
const { createFeedback } = require("../feedback/feedback-service");
const { createHttpError } = require("../../middleware/error-handler");
const { publicNotificationRouter } = require("../notifications/notification-routes");

const router = express.Router();

// 4-digit PINs are guessable, so cap attempts per client and per table
const pinAttemptLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  keyFn: (req) => `${req.ip}:${req.params.storeId}:${req.params.tableNumber}`,
  message: "Too many PIN attempts. Please ask your waiter for help."
});
const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyFn: (req) => `${req.ip}:${req.params.storeId}`,
  message: "Too many orders from this device. Please wait a minute."
});

function readTableToken(req) {
  return req.headers['x-table-session-token'] || req.query.sessionToken || req.query.clientToken || null;
}

router.use("/notifications", publicNotificationRouter);

// ---------------------------------------------------------
// Slug Resolution (Unprotected by billing guard so customers can see basic info)
// ---------------------------------------------------------
router.get("/resolve/:brandSlug", asyncHandler(async (req, res) => {
  const prisma = getPrismaClient();
  const tenant = await prisma.tenant.findUnique({
    where: { slug: req.params.brandSlug },
    select: { id: true, name: true, slug: true, logo: true, brandColor: true, description: true, status: true,
      stores: {
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, slug: true, address: true, banner: true }
      }
    }
  });

  if (!tenant) return res.status(404).json(createApiResponse(null, "Brand not found"));
  res.set("Cache-Control", "public, max-age=30, s-maxage=60, stale-while-revalidate=120");
  res.json(createApiResponse(tenant));
}));

router.get("/resolve/:brandSlug/:storeSlug", asyncHandler(async (req, res) => {
  const prisma = getPrismaClient();
  const store = await prisma.store.findFirst({
    where: {
      slug: req.params.storeSlug,
      tenant: { slug: req.params.brandSlug }
    },
    include: {
      tenant: {
        select: { id: true, name: true, slug: true, logo: true, brandColor: true, status: true,
          paymentGateways: {
            where: { provider: 'RAZORPAY', isActive: true },
            select: { merchantId: true, apiKey: true }
          }
        }
      },
      tables: {
        where: { isActive: true },
        select: { tableNumber: true }
      }
    }
  });

  if (!store) return res.status(404).json(createApiResponse(null, "Store not found"));
  // Suspended or disabled stores show "not taking orders" instead of their menu
  if (store.status !== "ACTIVE") {
    return res.status(403).json(createApiResponse(null, `${store.name} isn't taking orders right now. Please ask the staff.`));
  }

  const razorpayGateway = store.tenant.paymentGateways?.[0];
  const responseData = {
    ...store,
    razorpayConfigured: !!razorpayGateway,
    razorpayKeyId: razorpayGateway?.apiKey ? decrypt(razorpayGateway.apiKey) : null
  };
  delete responseData.tenant.paymentGateways; // Clean up response

  res.set("Cache-Control", "public, max-age=30, s-maxage=60, stale-while-revalidate=120");
  res.json(createApiResponse(responseData));
}));

// ---------------------------------------------------------
// SaaS Kill Switch: Protects ALL public Store interactions
// (If rent isn't paid, QR menus go offline)
// ---------------------------------------------------------
router.all("/stores/:storeId/*", billingGuard);

// GET /api/public/stores/:storeId/menu
router.get("/stores/:storeId/menu", asyncHandler(async (req, res) => {
  const { storeId } = req.params;

  const cachedMenu = publicMenuCache.get(storeId);
  if (cachedMenu) {
    res.set("Cache-Control", "public, max-age=30, s-maxage=60, stale-while-revalidate=120");
    return res.json(createApiResponse(cachedMenu));
  }

  const prisma = getPrismaClient();

  // Retrieve categories and items where BOTH isManuallyDisabled and isSystemDisabled are false
  const categories = await prisma.menuCategory.findMany({
    where: { storeId },
    orderBy: { sortOrder: 'asc' },
    include: {
      items: {
        where: {
          isManuallyDisabled: false,
          isSystemDisabled: false
        },
        include: {
          modifierGroups: {
            include: {
              options: true
            }
          }
        }
      }
    }
  });

  // Filter out categories that end up with no items after filtering
  const populatedCategories = categories.filter(category => category.items.length > 0);

  publicMenuCache.set(storeId, populatedCategories);
  res.set("Cache-Control", "public, max-age=30, s-maxage=60, stale-while-revalidate=120");
  res.json(createApiResponse(populatedCategories));
}));

// POST /api/public/stores/:storeId/orders
router.post("/stores/:storeId/orders", orderLimiter, asyncHandler(async (req, res) => {
  const prisma = getPrismaClient();
  let tableId = req.body.tableId;
  
  if (!tableId && req.body.tableNumber) {
    const table = await prisma.table.findUnique({
      where: { 
        storeId_tableNumber: { 
          storeId: req.params.storeId, 
          tableNumber: parseInt(req.body.tableNumber) 
        } 
      }
    });
    if (table) {
      tableId = table.id;
    }
  }

  if (!tableId) {
    throw createHttpError(400, "Invalid or missing table number. Please re-scan your table QR code.");
  }

  // Attempt to decode Authorization header for pre-paid authenticated orders
  let actor = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const { verifyJwt } = require("../../lib/jwt");
      const token = authHeader.split(' ')[1];
      const decoded = verifyJwt(token);
      if (decoded && decoded.sub) {
        actor = await prisma.user.findUnique({ where: { id: decoded.sub } });
      }
    } catch (err) {
      console.error("Failed to decode optional public auth token:", err.message);
    }
  }

  const payload = { ...req.body, tableId };
  const result = await createOrder(req.params.storeId, actor, 'QR_MENU', payload);
  res.status(201).json(createApiResponse(result));
}));

// GET /api/public/stores/:storeId/orders/me
router.get("/stores/:storeId/orders/me", asyncHandler(async (req, res) => {
  let actor = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const { verifyJwt } = require("../../lib/jwt");
      const token = authHeader.split(' ')[1];
      const decoded = verifyJwt(token);
      if (decoded && decoded.sub) {
        const prisma = getPrismaClient();
        actor = await prisma.user.findUnique({ where: { id: decoded.sub } });
      }
    } catch (err) {}
  }
  
  const sessionId = req.query.sessionId;
  
  if ((!actor || actor.role !== 'CUSTOMER') && !sessionId) {
    return res.status(401).json(createApiResponse(null, "Unauthorized"));
  }
  
  const prisma = getPrismaClient();
  const whereClause = {
    storeId: req.params.storeId,
    status: { in: ['PENDING_VERIFICATION', 'PROCESSING', 'READY', 'SERVED'] }
  };
  
  if (actor) {
    whereClause.customerId = actor.id;
  } else {
    whereClause.sessionId = sessionId;
  }
  
  const orders = await prisma.order.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' }
  });
  
  res.json(createApiResponse(orders));
}));

// GET /api/public/customer/stream
router.get("/customer/stream", (req, res) => {
  const token = req.query.token;
  const sessionId = req.query.sessionId;
  
  if (!token && !sessionId) {
    return res.status(401).json(createApiResponse(null, "Missing token or sessionId"));
  }
  
  const { subscribeToCustomer } = require("../orders/sse-service");
  
  if (token) {
    try {
      const { verifyJwt } = require("../../lib/jwt");
      const decoded = verifyJwt(token);
      if (!decoded || !decoded.sub) {
        return res.status(401).json(createApiResponse(null, "Invalid token"));
      }
      subscribeToCustomer(decoded.sub, req, res);
    } catch (err) {
      return res.status(401).json(createApiResponse(null, "Invalid token"));
    }
  } else if (sessionId) {
    subscribeToCustomer(sessionId, req, res);
  }
});

// POST /api/public/stores/:storeId/orders/:id/verify-payment
router.post("/stores/:storeId/orders/:id/verify-payment", asyncHandler(async (req, res) => {
  // The server checks the Razorpay signature / order status itself; nothing from the client is trusted
  const result = await verifyCheckoutPayment(req.params.storeId, req.params.id, req.body || {});
  res.json(createApiResponse(result));
}));

// GET /api/public/stores/:storeId/orders/:id
router.get("/stores/:storeId/orders/:id", asyncHandler(async (req, res) => {
  // We can fetch order details publicly if they know the ID, but no sensitive data is returned
  const { getOrderById } = require("../orders/order-service");
  const result = await getOrderById(req.params.storeId, req.params.id);
  res.json(createApiResponse(result));
}));

// POST /api/public/stores/:storeId/calls
router.post("/stores/:storeId/calls", asyncHandler(async (req, res) => {
  const result = await createWaiterCall(req.params.storeId, req.body);
  res.status(201).json(createApiResponse(result));
}));

// GET /api/public/stores/:storeId/tables/:tableNum/calls/status
router.get("/stores/:storeId/tables/:tableNum/calls/status", asyncHandler(async (req, res) => {
  const result = await getTableCallStatus(req.params.storeId, req.params.tableNum);
  res.json(createApiResponse(result));
}));

// POST /api/public/stores/:storeId/calls/:id/cancel
router.post("/stores/:storeId/calls/:id/cancel", asyncHandler(async (req, res) => {
  const result = await cancelWaiterCall(req.params.storeId, req.params.id);
  res.json(createApiResponse(result));
}));

// POST /api/public/stores/:storeId/feedback
router.post("/stores/:storeId/feedback", asyncHandler(async (req, res) => {
  const result = await createFeedback(req.params.storeId, req.body);
  res.status(201).json(createApiResponse(result));
}));

// POST /api/public/stores/:storeId/validate-promo
router.post("/stores/:storeId/validate-promo", asyncHandler(async (req, res) => {
  const prisma = getPrismaClient();
  const { code, subTotal } = req.body;
  if (!code) return res.status(400).json(createApiResponse(null, "Promo code is required"));
  
  const promo = await prisma.promoCode.findUnique({
     where: { storeId_code: { storeId: req.params.storeId, code: code.toUpperCase() } }
  });
  
  if (!promo || !promo.isActive || (promo.validUntil && promo.validUntil < new Date())) {
     return res.status(400).json(createApiResponse(null, "Invalid or expired promo code"));
  }
  if (subTotal < promo.minOrderValue) {
     return res.status(400).json(createApiResponse(null, `Minimum order value is ₹${promo.minOrderValue}`));
  }
  
  res.json(createApiResponse({
    id: promo.id,
    code: promo.code,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    maxDiscount: promo.maxDiscount
  }));
}));

// GET /api/public/stores/:storeId/tables/:tableNumber/session
router.get("/stores/:storeId/tables/:tableNumber/session", asyncHandler(async (req, res) => {
  const { getTableSessionStatus } = require("../orders/order-service");
  const result = await getTableSessionStatus(req.params.storeId, req.params.tableNumber, readTableToken(req));
  res.json(createApiResponse(result));
}));

// POST /api/public/stores/:storeId/tables/:tableNumber/join-session
router.post("/stores/:storeId/tables/:tableNumber/join-session", pinAttemptLimiter, asyncHandler(async (req, res) => {
  const { joinTableSession } = require("../orders/order-service");
  const { pin } = req.body || {};
  const result = await joinTableSession(req.params.storeId, req.params.tableNumber, pin);
  res.json(createApiResponse(result));
}));

// GET /api/public/stores/:storeId/sessions/:sessionId/bill
router.get("/stores/:storeId/sessions/:sessionId/bill", asyncHandler(async (req, res) => {
  const token = readTableToken(req);
  const session = await getPrismaClient().tableSession.findUnique({
    where: { id: req.params.sessionId },
    select: { storeId: true, sessionToken: true }
  });
  // Only guests holding this table's session token may see the bill (it includes the PIN)
  if (!session || session.storeId !== req.params.storeId || !token || token !== session.sessionToken) {
    throw createHttpError(404, "Table session not found");
  }
  const { getTableSessionBill } = require("../orders/order-service");
  const result = await getTableSessionBill(req.params.storeId, req.params.sessionId, { includePin: true });
  res.json(createApiResponse(result));
}));

// POST /api/public/webhooks/razorpay/:tenantId
router.post("/webhooks/razorpay/:tenantId", asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  if (!signature) throw createHttpError(400, "Missing signature");
  // Signature must be checked against the exact bytes Razorpay sent (captured in app.js)
  const result = await handleRazorpayWebhook(req.params.tenantId, req.rawBody, signature);
  res.json(createApiResponse(result));
}));

// GET /api/public/stores/:storeId/wallet/me
router.get("/stores/:storeId/wallet/me", asyncHandler(async (req, res) => {
  const { getCustomerWallet, getStoreLoyaltySettings } = require("../loyalty/loyalty-service");
  
  let customerId = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const { verifyJwt } = require("../../lib/jwt");
      const token = authHeader.split(' ')[1];
      const decoded = verifyJwt(token);
      if (decoded && decoded.sub) {
        customerId = decoded.sub;
      }
    } catch (err) {}
  }

  if (!customerId) {
    // Return store loyalty rules even for unauthenticated users so UI can show promotions/benefits
    const { settings } = await getStoreLoyaltySettings(req.params.storeId);
    return res.json(createApiResponse({
      wallet: null,
      settings,
      isAuthenticated: false
    }));
  }

  const walletData = await getCustomerWallet(customerId, req.params.storeId);
  res.json(createApiResponse({
    ...walletData,
    isAuthenticated: true
  }));
}));

// POST /api/public/stores/:storeId/wallet/preview-redemption
router.post("/stores/:storeId/wallet/preview-redemption", asyncHandler(async (req, res) => {
  const { previewWalletRedemption } = require("../loyalty/loyalty-service");
  const { subTotal, requestedCredits } = req.body;

  let customerId = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const { verifyJwt } = require("../../lib/jwt");
      const token = authHeader.split(' ')[1];
      const decoded = verifyJwt(token);
      if (decoded && decoded.sub) {
        customerId = decoded.sub;
      }
    } catch (err) {}
  }

  if (!customerId) {
    return res.status(401).json(createApiResponse(null, "Please log in to redeem wallet credits"));
  }

  const preview = await previewWalletRedemption(customerId, req.params.storeId, Number(subTotal) || 0, Number(requestedCredits) || 0);
  res.json(createApiResponse(preview));
}));

module.exports = router;
