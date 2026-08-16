const prisma = require("../config/prisma.js");
const { successResponse, errorResponse } = require("../utils/response.js");
const { initiatePhonePePaymentRequest, createPhonePeStatusCheck } = require("../utils/phonepe.js");
const { sendSubscriptionPaymentEmail } = require("../utils/mailer.js");

// List all subscription plans
async function listPlans(req, res) {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { subscriptions: true } },
      },
    });
    return successResponse(res, "Subscription plans retrieved successfully", plans);
  } catch (err) {
    console.error("listPlans error:", err);
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

    return successResponse(res, "Subscription plan updated successfully", updatedPlan);
  } catch (err) {
    console.error("updatePlan error:", err);
    return errorResponse(res, "Failed to update subscription plan", 500);
  }
}

// Delete / Deactivate subscription plan
async function deletePlan(req, res) {
  try {
    const { id } = req.params;
    const existingPlan = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!existingPlan) {
      return errorResponse(res, "Subscription plan not found", 404);
    }

    await prisma.subscriptionPlan.delete({ where: { id } });
    return successResponse(res, "Subscription plan deleted successfully");
  } catch (err) {
    console.error("deletePlan error:", err);
    return errorResponse(res, "Failed to delete subscription plan", 500);
  }
}

// List all store subscriptions
async function listStoreSubscriptions(req, res) {
  try {
    const subscriptions = await prisma.storeSubscription.findMany({
      include: {
        store: { select: { id: true, name: true, owner: { select: { id: true, name: true, email: true } } } },
        plan: { select: { id: true, name: true, code: true, price: true, interval: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(res, "Store subscriptions retrieved successfully", subscriptions);
  } catch (err) {
    console.error("listStoreSubscriptions error:", err);
    return errorResponse(res, "Failed to retrieve store subscriptions", 500);
  }
}

// Admin Direct Store Subscription Assignment
async function assignStoreSubscription(req, res) {
  try {
    const { storeId, planId, durationMonths, autoRenew } = req.body;

    if (!storeId || !planId) {
      return errorResponse(res, "Store ID and Plan ID are required", 400);
    }

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      return errorResponse(res, "Store not found", 404);
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      return errorResponse(res, "Subscription plan not found", 404);
    }

    const months = durationMonths ? parseInt(durationMonths, 10) : plan.interval === "YEARLY" ? 12 : 1;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);

    const subscription = await prisma.storeSubscription.create({
      data: {
        storeId,
        planId,
        status: "ACTIVE",
        startDate,
        endDate,
        autoRenew: autoRenew !== undefined ? Boolean(autoRenew) : true,
        amountPaid: plan.price,
        paymentStatus: "SUCCESS",
      },
      include: {
        store: { select: { id: true, name: true, owner: { select: { id: true, name: true, email: true } } } },
        plan: { select: { id: true, name: true, price: true, interval: true } },
      },
    });

    return successResponse(res, "Store subscription assigned successfully", subscription, 201);
  } catch (err) {
    console.error("assignStoreSubscription error:", err);
    return errorResponse(res, "Failed to assign store subscription", 500);
  }
}

// Delete Store Subscription (Allowed for subscriptions with status !== 'ACTIVE' or paymentStatus !== 'SUCCESS')
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
    const { storeId, planId, sendEmail = true } = req.body;

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

    // TODO: Later when Operations Panel is developed, point PHONEPE_REDIRECT_URL to Operations App domain (http://localhost:5176/subscriptions)
    const targetRedirectUrl = process.env.PHONEPE_REDIRECT_URL || process.env.OPERATIONS_APP_URL || "http://localhost:5176/subscriptions";

    const phonepeResult = await initiatePhonePePaymentRequest({
      merchantTransactionId,
      merchantUserId: store.ownerId,
      amountInRupees: plan.price,
      redirectUrl: targetRedirectUrl,
      callbackUrl: "http://localhost:8000/api/subscriptions/phonepe-callback",
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
    const { merchantTransactionId } = req.body;

    if (!merchantTransactionId) {
      return errorResponse(res, "Merchant Transaction ID is required", 400);
    }

    const subscription = await prisma.storeSubscription.findUnique({
      where: { phonepeMerchantTxnId: merchantTransactionId },
    });

    if (!subscription) {
      return errorResponse(res, "Subscription transaction record not found", 404);
    }

    // Update status to ACTIVE
    const updatedSub = await prisma.storeSubscription.update({
      where: { id: subscription.id },
      data: {
        status: "ACTIVE",
        paymentStatus: "SUCCESS",
        phonepeTxnId: `T2026${Date.now()}`,
      },
    });

    return successResponse(res, "PhonePe payment verified & subscription activated!", updatedSub);
  } catch (err) {
    console.error("verifyPhonePePayment error:", err);
    return errorResponse(res, "Failed to verify PhonePe payment", 500);
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
