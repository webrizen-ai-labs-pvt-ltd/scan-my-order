const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { getPrismaClient } = require("../../lib/prisma");
const { decrypt } = require("../../lib/encryption");
const { billingGuard } = require("../../middleware/billing-guard");
const { createOrder, handleRazorpayWebhook } = require("../orders/order-service");
const { createWaiterCall } = require("../waiter-calls/waiter-call-service");
const { createFeedback } = require("../feedback/feedback-service");

const router = express.Router();

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
      }
    }
  });

  if (!store) return res.status(404).json(createApiResponse(null, "Store not found"));

  const razorpayGateway = store.tenant.paymentGateways?.[0];
  const responseData = {
    ...store,
    razorpayConfigured: !!razorpayGateway,
    razorpayKeyId: razorpayGateway?.apiKey ? decrypt(razorpayGateway.apiKey) : null
  };
  delete responseData.tenant.paymentGateways; // Clean up response

  res.json(createApiResponse(responseData));
}));

// ---------------------------------------------------------
// SaaS Kill Switch: Protects ALL public Store interactions
// (If rent isn't paid, QR menus go offline)
// ---------------------------------------------------------
router.all("/stores/:storeId/*", billingGuard);

// GET /api/public/stores/:storeId/menu
router.get("/stores/:storeId/menu", asyncHandler(async (req, res) => {
  const prisma = getPrismaClient();
  const { storeId } = req.params;

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

  res.json(createApiResponse(populatedCategories));
}));

// POST /api/public/stores/:storeId/orders
router.post("/stores/:storeId/orders", asyncHandler(async (req, res) => {
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
    return res.status(400).json(createApiResponse(null, "Invalid or missing table number"));
  }

  const payload = { ...req.body, tableId };
  const result = await createOrder(req.params.storeId, null, 'QR_MENU', payload);
  res.status(201).json(createApiResponse(result));
}));

// POST /api/public/stores/:storeId/calls
router.post("/stores/:storeId/calls", asyncHandler(async (req, res) => {
  const result = await createWaiterCall(req.params.storeId, req.body);
  res.status(201).json(createApiResponse(result));
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

// POST /api/public/webhooks/razorpay/:tenantId
router.post("/webhooks/razorpay/:tenantId", express.json(), asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  if (!signature) {
    return res.status(400).json(createApiResponse(null, "Missing signature"));
  }
  
  const result = await handleRazorpayWebhook(req.params.tenantId, req.body, signature, req.rawBody);
  res.json(createApiResponse(result));
}));

module.exports = router;
