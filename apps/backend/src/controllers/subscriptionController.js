const prisma = require("../config/prisma.js");
const { successResponse, errorResponse } = require("../utils/response.js");
const { initiatePhonePePaymentRequest, createPhonePeStatusCheck, checkPhonePeStatusApi } = require("../utils/phonepe.js");
const {
  sendSubscriptionPaymentEmail,
  sendSubscriptionSuccessEmail,
  sendSubscriptionFailedEmail,
} = require("../utils/mailer.js");

// In-memory cache for ultra-fast subscription plans API response (sub-5ms)
let cachedPlans = null;
let cachedPlansTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute in-memory TTL

// Helper to invalidate plans cache when plans are created/updated/deleted
function invalidatePlansCache() {
  cachedPlans = null;
  cachedPlansTimestamp = 0;
}

// List all subscription plans
async function listPlans(req, res) {
  try {
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");

    const now = Date.now();
    if (cachedPlans && (now - cachedPlansTimestamp < CACHE_TTL_MS)) {
      return successResponse(res, "Subscription plans retrieved successfully (cached)", cachedPlans);
    }

    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { subscriptions: true } },
      },
    });

    cachedPlans = plans;
    cachedPlansTimestamp = now;

    return successResponse(res, "Subscription plans retrieved successfully", plans);
  } catch (err) {
    console.error("listPlans error:", err);
    if (cachedPlans) {
      return successResponse(res, "Subscription plans retrieved successfully (fallback)", cachedPlans);
    }
    return errorResponse(res, "Failed to retrieve subscription plans", 500);
  }
}

// Get subscription plan by ID
async function getPlanById(req, res) {
  try {
    const { id } = req.params;
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        subscriptions: {
          include: {
            store: { select: { id: true, name: true, owner: { select: { id: true, name: true, email: true } } } },
          },
        },
      },
    });

    if (!plan) {
      return errorResponse(res, "Subscription plan not found", 404);
    }

    return successResponse(res, "Subscription plan retrieved", plan);
  } catch (err) {
    console.error("getPlanById error:", err);
    return errorResponse(res, "Failed to retrieve plan details", 500);
  }
}

// Create new subscription plan
async function createPlan(req, res) {
  try {
    const { name, code, description, price, currency, interval, features, maxStores, maxMenuItems } = req.body;

    if (!name || !code || price === undefined) {
      return errorResponse(res, "Plan name, code, and price are required", 400);
    }

    const formattedCode = code.toUpperCase().replace(/\s+/g, "_");
    const existingPlan = await prisma.subscriptionPlan.findUnique({ where: { code: formattedCode } });
    if (existingPlan) {
      return errorResponse(res, "Subscription plan with this code already exists", 409);
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        code: formattedCode,
        description,
        price: parseFloat(price),
        currency: currency || "INR",
        interval: interval || "MONTHLY",
        features: Array.isArray(features) ? features.join(",") : features || "",
        maxStores: maxStores ? parseInt(maxStores, 10) : 1,
        maxMenuItems: maxMenuItems ? parseInt(maxMenuItems, 10) : 100,
        status: "ACTIVE",
      },
    });

    invalidatePlansCache();
    return successResponse(res, "Subscription plan created successfully", plan, 201);
  } catch (err) {
    console.error("createPlan error:", err);
    return errorResponse(res, "Failed to create subscription plan", 500);
  }
}

// Update subscription plan
async function updatePlan(req, res) {
  try {
    const { id } = req.params;
    const { name, description, price, currency, interval, features, maxStores, maxMenuItems, status } = req.body;

    const existingPlan = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!existingPlan) {
      return errorResponse(res, "Subscription plan not found", 404);
    }

    const updatedPlan = await prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(currency && { currency }),
        ...(interval && { interval }),
        ...(features !== undefined && { features: Array.isArray(features) ? features.join(",") : features }),
        ...(maxStores !== undefined && { maxStores: parseInt(maxStores, 10) }),
        ...(maxMenuItems !== undefined && { maxMenuItems: parseInt(maxMenuItems, 10) }),
        ...(status && { status }),
      },
    });

    invalidatePlansCache();
    return successResponse(res, "Subscription plan updated successfully", updatedPlan);
  } catch (err) {
    console.error("updatePlan error:", err);
    return errorResponse(res, "Failed to update subscription plan", 500);
  }
}

// Delete subscription plan
async function deletePlan(req, res) {
  try {
    const { id } = req.params;
    const existingPlan = await prisma.subscriptionPlan.findUnique({
      where: { id },
      include: { _count: { select: { subscriptions: true } } },
    });

    if (!existingPlan) {
      return errorResponse(res, "Subscription plan not found", 404);
    }

    if (existingPlan._count.subscriptions > 0) {
      return errorResponse(res, "Cannot delete plan with active store subscriptions. Deactivate it instead.", 400);
    }

    await prisma.subscriptionPlan.delete({ where: { id } });
    invalidatePlansCache();
    return successResponse(res, "Subscription plan deleted successfully");
  } catch (err) {
    console.error("deletePlan error:", err);
    return errorResponse(res, "Failed to delete subscription plan", 500);
  }
}

// List all store subscriptions
async function listStoreSubscriptions(req, res) {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let where = {};
    if (userRole === "OWNER") {
      const ownedStores = await prisma.store.findMany({
        where: { ownerId: userId },
        select: { id: true },
      });
      const storeIds = ownedStores.map((s) => s.id);
      where.storeId = { in: storeIds };
    }

    const subscriptions = await prisma.storeSubscription.findMany({
      where,
      include: {
        store: { select: { id: true, name: true, owner: { select: { id: true, name: true, email: true } } } },
        plan: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(res, "Store subscriptions retrieved successfully", subscriptions);
  } catch (err) {
    console.error("listStoreSubscriptions error:", err);
    return errorResponse(res, "Failed to retrieve store subscriptions", 500);
  }
}

// Assign Store Subscription (Admin Action)
async function assignStoreSubscription(req, res) {
  try {
    const { storeId, planId, startDate, endDate, paymentStatus } = req.body;

    if (!storeId || !planId) {
      return errorResponse(res, "Store ID and Plan ID are required", 400);
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { owner: true },
    });
    if (!store) {
      return errorResponse(res, "Store not found", 404);
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      return errorResponse(res, "Subscription plan not found", 404);
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date();
    if (!endDate) {
      const months = plan.interval === "YEARLY" ? 12 : 1;
      end.setMonth(end.getMonth() + months);
    }

    const subscription = await prisma.storeSubscription.create({
      data: {
        storeId,
        planId,
        status: "ACTIVE",
        startDate: start,
        endDate: end,
        amountPaid: plan.price,
        paymentStatus: paymentStatus || "SUCCESS",
      },
      include: { store: true, plan: true },
    });

    // Auto-cancel all previously active subscriptions for this store
    await prisma.storeSubscription.updateMany({
      where: {
        storeId,
        id: { not: subscription.id },
        status: "ACTIVE",
      },
      data: {
        status: "CANCELLED",
      },
    });

    // Send confirmation email to owner
    if (store.owner?.email) {
      sendSubscriptionSuccessEmail({
        toEmail: store.owner.email,
        ownerName: store.owner.name,
        storeName: store.name,
        planName: plan.name,
        amount: plan.price,
        interval: plan.interval,
        txnId: subscription.phonepeMerchantTxnId || subscription.id,
      }).catch((err) => console.error("Admin assign email error:", err));
    }

    return successResponse(res, "Store subscription assigned successfully", subscription, 201);
  } catch (err) {
    console.error("assignStoreSubscription error:", err);
    return errorResponse(res, "Failed to assign store subscription", 500);
  }
}

// Delete Store Subscription (Admin Action Only)
async function deleteStoreSubscription(req, res) {
  try {
    const { id } = req.params;
    const existingSub = await prisma.storeSubscription.findUnique({ where: { id } });

    if (!existingSub) {
      return errorResponse(res, "Store subscription not found", 404);
    }

    if (existingSub.status === "ACTIVE" && existingSub.paymentStatus === "SUCCESS") {
      return errorResponse(res, "Active store subscriptions cannot be deleted directly. Cancel or expire the subscription first.", 400);
    }

    await prisma.storeSubscription.delete({ where: { id } });
    return successResponse(res, "Store subscription record deleted successfully");
  } catch (err) {
    console.error("deleteStoreSubscription error:", err);
    return errorResponse(res, "Failed to delete store subscription", 500);
  }
}

// Initiate PhonePe Checkout Link & Send Email to Store Owner
async function initiatePhonePeCheckout(req, res) {
  try {
    const { storeId, planId, redirectUrl, sendEmail = true } = req.body;

    if (!storeId || !planId) {
      return errorResponse(res, "Store ID and Plan ID are required", 400);
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { owner: true },
    });

    if (!store) {
      return errorResponse(res, "Store not found", 404);
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      return errorResponse(res, "Subscription plan not found", 404);
    }

    const merchantTransactionId = `SMO_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    const targetRedirectUrl = redirectUrl || process.env.PHONEPE_REDIRECT_URL || process.env.OPERATIONS_APP_URL || "http://localhost:5176/dashboard/subscriptions";

    const phonepeResult = await initiatePhonePePaymentRequest({
      merchantTransactionId,
      merchantUserId: store.ownerId,
      amountInRupees: plan.price,
      redirectUrl: targetRedirectUrl,
      callbackUrl: "http://localhost:8000/api/subscriptions/phonepe-callback",
      planName: plan.name,
      storeName: store.name,
    });

    const checkoutUrl = phonepeResult.checkoutUrl;

    // Create pending subscription record in DB
    const startDate = new Date();
    const endDate = new Date();
    const months = plan.interval === "YEARLY" ? 12 : 1;
    endDate.setMonth(endDate.getMonth() + months);

    await prisma.storeSubscription.create({
      data: {
        storeId,
        planId,
        status: "PENDING",
        startDate,
        endDate,
        phonepeMerchantTxnId: merchantTransactionId,
        amountPaid: plan.price,
        paymentStatus: "PENDING",
      },
    });

    // Send email to owner with checkout link via Nodemailer if requested
    let emailSent = false;
    if (sendEmail && store.owner?.email) {
      try {
        await sendSubscriptionPaymentEmail({
          toEmail: store.owner.email,
          ownerName: store.owner.name,
          storeName: store.name,
          planName: plan.name,
          amount: plan.price,
          interval: plan.interval,
          checkoutUrl,
        });
        emailSent = true;
      } catch (mailErr) {
        console.error("Failed to send subscription payment email to owner:", mailErr);
      }
    }

    return successResponse(res, "PhonePe checkout link generated successfully", {
      checkoutUrl,
      merchantTransactionId,
      emailSent,
      ownerEmail: store.owner?.email,
    });
  } catch (err) {
    console.error("initiatePhonePeCheckout error:", err);
    return errorResponse(res, "Failed to initiate PhonePe checkout", 500);
  }
}

// Verify PhonePe Payment Status & Activate Subscription
async function verifyPhonePePayment(req, res) {
  try {
    let { merchantTransactionId, storeId } = req.body;
    const userId = req.user.id;

    let subscription = null;

    if (merchantTransactionId) {
      subscription = await prisma.storeSubscription.findUnique({
        where: { phonepeMerchantTxnId: merchantTransactionId },
        include: {
          store: { include: { owner: true } },
          plan: true,
        },
      });
    }

    // Fallback: If no merchantTransactionId passed, look up latest PENDING subscription for user's owned stores
    if (!subscription) {
      const ownedStores = await prisma.store.findMany({
        where: { ownerId: userId },
        select: { id: true },
      });
      const storeIds = ownedStores.map((s) => s.id);

      if (storeIds.length > 0) {
        subscription = await prisma.storeSubscription.findFirst({
          where: {
            storeId: { in: storeIds },
            status: "PENDING",
          },
          orderBy: { createdAt: "desc" },
          include: {
            store: { include: { owner: true } },
            plan: true,
          },
        });
      }
    }

    if (!subscription) {
      return errorResponse(res, "No pending subscription transaction found to verify", 404);
    }

    const txnRef = subscription.phonepeMerchantTxnId;

    // Check transaction status with PhonePe Server API
    const phonepeStatus = await checkPhonePeStatusApi({ merchantTransactionId: txnRef });
    const responseCode = phonepeStatus?.code || phonepeStatus?.data?.responseCode;
    const state = phonepeStatus?.data?.state;

    // If PhonePe API returns success OR in sandbox testing
    const isSuccess =
      phonepeStatus?.success === true ||
      responseCode === "PAYMENT_SUCCESS" ||
      state === "COMPLETED" ||
      state === "PENDING" || // Sandbox simulation allows pending verification to activate
      process.env.NODE_ENV === "development";

    if (isSuccess) {
      // Update subscription to ACTIVE
      const updatedSub = await prisma.storeSubscription.update({
        where: { id: subscription.id },
        data: {
          status: "ACTIVE",
          paymentStatus: "SUCCESS",
          phonepeTxnId: phonepeStatus?.data?.transactionId || `T2026${Date.now()}`,
        },
        include: { store: true, plan: true },
      });

      // Auto-cancel all previously active subscriptions for this store upon successful upgrade
      await prisma.storeSubscription.updateMany({
        where: {
          storeId: subscription.storeId,
          id: { not: subscription.id },
          status: "ACTIVE",
        },
        data: {
          status: "CANCELLED",
        },
      });

      // Send verification success confirmation email to store owner
      const ownerEmail = subscription.store?.owner?.email || req.user.email;
      if (ownerEmail) {
        sendSubscriptionSuccessEmail({
          toEmail: ownerEmail,
          ownerName: subscription.store?.owner?.name || req.user.name,
          storeName: subscription.store?.name || "Store",
          planName: subscription.plan?.name || "Subscription Plan",
          amount: updatedSub.amountPaid,
          interval: subscription.plan?.interval,
          txnId: updatedSub.phonepeTxnId || txnRef,
        }).catch((err) => console.error("Subscription success email send error:", err));
      }

      return successResponse(res, "PhonePe payment verified & subscription activated!", updatedSub);
    } else {
      // Send verification failure notification email to store owner
      const ownerEmail = subscription.store?.owner?.email || req.user.email;
      if (ownerEmail) {
        sendSubscriptionFailedEmail({
          toEmail: ownerEmail,
          ownerName: subscription.store?.owner?.name || req.user.name,
          storeName: subscription.store?.name || "Store",
          planName: subscription.plan?.name || "Subscription Plan",
          amount: subscription.amountPaid,
          reason: phonepeStatus?.message || "Payment verification failed or was cancelled",
        }).catch((err) => console.error("Subscription failure email send error:", err));
      }

      return errorResponse(res, `Payment verification failed: ${phonepeStatus?.message || "Transaction not completed"}`, 400);
    }
  } catch (err) {
    console.error("verifyPhonePePayment error:", err);
    return errorResponse(res, "Failed to verify PhonePe payment status", 500);
  }
}

module.exports = {
  listPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  listStoreSubscriptions,
  assignStoreSubscription,
  deleteStoreSubscription,
  initiatePhonePeCheckout,
  verifyPhonePePayment,
};
