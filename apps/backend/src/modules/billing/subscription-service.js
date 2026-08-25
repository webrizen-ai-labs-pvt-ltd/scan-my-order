const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const crypto = require("crypto");
const axios = require("axios");
const { env } = require("../../config/env");

// --- Plan Management (Super Admin) ---

async function createPlan(input) {
  const prisma = getPrismaClient();
  const { name, price, maxStores, interval, currency = "INR" } = input;

  if (!name || price === undefined || !maxStores || !interval) {
    throw createHttpError(400, "Missing required plan fields");
  }

  const plan = await prisma.subscriptionPlan.create({
    data: {
      name,
      price: parseInt(price),
      currency,
      maxStores: parseInt(maxStores),
      interval,
      isActive: true
    }
  });

  return plan;
}

async function getPlans() {
  const prisma = getPrismaClient();
  return prisma.subscriptionPlan.findMany({
    orderBy: { price: "asc" }
  });
}

async function updatePlan(id, input) {
  const prisma = getPrismaClient();
  
  if (input.price !== undefined) input.price = parseInt(input.price);
  if (input.maxStores !== undefined) input.maxStores = parseInt(input.maxStores);

  const plan = await prisma.subscriptionPlan.update({
    where: { id },
    data: input
  });
  
  return plan;
}

async function deletePlan(id) {
  const prisma = getPrismaClient();
  return prisma.subscriptionPlan.update({
    where: { id },
    data: { isActive: false }
  });
}

// --- Subscription Management ---

async function getTenantSubscription(tenantId) {
  const prisma = getPrismaClient();
  return prisma.tenantSubscription.findUnique({
    where: { tenantId },
    include: { plan: true }
  });
}

// Direct bypass for SUPER_ADMIN
async function assignPlanDirectly(tenantId, planId) {
  const prisma = getPrismaClient();
  
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId }
  });

  if (!plan) throw createHttpError(404, "Subscription plan not found");

  let currentPeriodEnd = new Date();
  if (plan.interval === "MONTHLY") {
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
  } else {
    currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
  }

  const subscription = await prisma.tenantSubscription.upsert({
    where: { tenantId },
    update: {
      planId,
      status: "ACTIVE",
      currentPeriodEnd,
      gracePeriodEndsAt: null,
      providerSubId: "DIRECT_ASSIGN"
    },
    create: {
      tenantId,
      planId,
      status: "ACTIVE",
      currentPeriodEnd,
      providerSubId: "DIRECT_ASSIGN"
    },
    include: { plan: true }
  });

  return subscription;
}

// Helper to generate PhonePe Link
async function generatePhonePeLink(tenantId, plan, transactionId, sourceApp = 'admin') {
  const merchantId = env.phonePe.merchantId;
  const saltKey = env.phonePe.saltKey;
  const saltIndex = env.phonePe.saltIndex;
  
  const payload = {
    merchantId: merchantId,
    merchantTransactionId: transactionId,
    merchantUserId: tenantId,
    amount: plan.price * 100, // PhonePe takes paise
    redirectUrl: `${env.apps.apiUrl}/api/billing/subscription/redirect?t=${tenantId}&p=${plan.id}&tid=${transactionId}&app=${sourceApp}`,
    redirectMode: "POST",
    callbackUrl: `${env.apps.apiUrl}/api/webhooks/phonepe?t=${tenantId}&p=${plan.id}`, // Adjust to match webhook route
    paymentInstrument: {
      type: "PAY_PAGE"
    }
  };

  const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
  const endpoint = "/pg/v1/pay";
  const checksum = crypto.createHash("sha256").update(base64Payload + endpoint + saltKey).digest("hex") + "###" + saltIndex;

  try {
    const response = await axios.post(`${env.phonePe.host}${endpoint}`, {
      request: base64Payload
    }, {
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": checksum
      }
    });

    if (response.data.success && response.data.data.instrumentResponse.redirectInfo) {
      return response.data.data.instrumentResponse.redirectInfo.url;
    }
    throw new Error(response.data.message || "Failed to generate PhonePe link");
  } catch (error) {
    console.error("PhonePe Error:", error.response?.data || error.message);
    throw createHttpError(500, "Payment gateway error");
  }
}

// SUPER_ADMIN sends link to TENANT_ADMIN
async function sendPaymentLink(tenantId, planId, sourceApp = 'admin') {
  const prisma = getPrismaClient();
  
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { users: { where: { role: "TENANT_ADMIN", status: "ACTIVE" } } }
  });

  if (!tenant) throw createHttpError(404, "Tenant not found");
  if (tenant.users.length === 0) throw createHttpError(400, "Tenant has no active admin to send the link to");

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) throw createHttpError(404, "Plan not found");

  const transactionId = `SUB_${crypto.randomBytes(8).toString('hex')}`;
  const paymentUrl = await generatePhonePeLink(tenantId, plan, transactionId, sourceApp);

  // Send Email
  const { getPaymentLinkEmailTemplate } = require("../../lib/templates/payment-link-email");
  const { sendMail } = require("../../lib/mailer");
  
  const admin = tenant.users[0];
  const html = getPaymentLinkEmailTemplate(tenant.name, plan.name, plan.price, plan.interval, paymentUrl);
  
  await sendMail({
    to: admin.email,
    subject: "Scan My Order - Subscription Payment Required",
    html
  });

  // Temporarily store the pending sub context in DB if needed, or rely on transactionId parsing in webhook
  return { success: true, message: "Payment link sent successfully" };
}

// TENANT_ADMIN self-initiates payment
async function initiateSubscription(tenantId, planId, sourceApp = 'admin') {
  const prisma = getPrismaClient();
  
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) throw createHttpError(404, "Plan not found");

  const transactionId = `SUB_${crypto.randomBytes(8).toString('hex')}`;
  const paymentUrl = await generatePhonePeLink(tenantId, plan, transactionId, sourceApp);

  return {
    success: true,
    paymentUrl
  };
}

// Webhook handler for PhonePe
async function handleSubscriptionWebhook(payload, queryParams = {}) {
  const prisma = getPrismaClient();
  
  if (!payload.response) {
    throw createHttpError(400, "Invalid payload format");
  }

  const decodedStr = Buffer.from(payload.response, 'base64').toString('utf-8');
  const decodedData = JSON.parse(decodedStr);

  const { data: { merchantTransactionId, code, amount } } = decodedData;
  
  if (!merchantTransactionId) {
    throw createHttpError(400, "Missing merchantTransactionId");
  }

  const tenantId = queryParams.t;
  const planId = queryParams.p;

  if (!tenantId || !planId) {
    throw createHttpError(400, "Missing tenant or plan context in webhook URL");
  }

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) throw createHttpError(404, "Plan not found");

  if (code === "PAYMENT_SUCCESS") {
    let currentPeriodEnd = new Date();
    if (plan.interval === "MONTHLY") {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    } else {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    }

    await prisma.tenantSubscription.upsert({
      where: { tenantId },
      update: {
        planId,
        status: "ACTIVE",
        currentPeriodEnd,
        gracePeriodEndsAt: null,
        providerSubId: merchantTransactionId
      },
      create: {
        tenantId,
        planId,
        status: "ACTIVE",
        currentPeriodEnd,
        providerSubId: merchantTransactionId
      }
    });
  } else {
    // Payment failed, we don't necessarily update the existing sub if it's just a failed attempt
    // But we could log it
  }

  return { success: true };
}

// Check status directly with PhonePe
async function verifyPhonePeTransaction(merchantTransactionId) {
  const merchantId = env.phonePe.merchantId;
  const saltKey = env.phonePe.saltKey;
  const saltIndex = env.phonePe.saltIndex;

  const endpoint = `/pg/v1/status/${merchantId}/${merchantTransactionId}`;
  const checksum = crypto.createHash("sha256").update(endpoint + saltKey).digest("hex") + "###" + saltIndex;

  try {
    const response = await axios.get(`${env.phonePe.host}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": checksum,
        "X-MERCHANT-ID": merchantId
      }
    });

    return response.data;
  } catch (error) {
    console.error("PhonePe Verify Error:", error.response?.data || error.message);
    throw createHttpError(500, "Failed to verify transaction status with PhonePe");
  }
}

// Redirect handler for local dev / synchronous confirmation
async function handleSubscriptionRedirect(queryParams) {
  const { t: tenantId, p: planId, tid: transactionId, app: sourceApp = 'admin' } = queryParams;

  const getTargetUrl = (status, code) => {
    if (sourceApp === 'operations') {
      const baseUrl = env.apps.operationsUrl || env.apps.adminUrl;
      const path = '/dashboard/subscriptions';
      if (status === 'success') return `${baseUrl}${path}?payment=success`;
      if (status === 'failed') return `${baseUrl}${path}?payment=failed&code=${code || 'UNKNOWN'}`;
      return `${baseUrl}${path}?payment=error`;
    } else {
      const baseUrl = env.apps.adminUrl;
      const path = '/billing';
      if (status === 'success') return `${baseUrl}${path}?payment=success`;
      if (status === 'failed') return `${baseUrl}${path}?payment=failed&code=${code || 'UNKNOWN'}`;
      return `${baseUrl}${path}?payment=error`;
    }
  };

  if (!tenantId || !planId || !transactionId) {
    return { success: false, redirectPath: getTargetUrl('error') };
  }

  try {
    const statusRes = await verifyPhonePeTransaction(transactionId);
    
    if (statusRes.success && statusRes.code === "PAYMENT_SUCCESS") {
      const prisma = getPrismaClient();
      const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
      if (plan) {
        let currentPeriodEnd = new Date();
        if (plan.interval === "MONTHLY") {
          currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
        } else {
          currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
        }
        await prisma.tenantSubscription.upsert({
          where: { tenantId },
          update: {
            planId,
            status: "ACTIVE",
            currentPeriodEnd,
            gracePeriodEndsAt: null,
            providerSubId: transactionId
          },
          create: {
            tenantId,
            planId,
            status: "ACTIVE",
            currentPeriodEnd,
            providerSubId: transactionId
          }
        });
      }
      return { success: true, redirectPath: getTargetUrl('success') };
    } else {
      return { success: false, redirectPath: getTargetUrl('failed', statusRes.code) };
    }
  } catch (err) {
    console.error("Handle Redirect Error:", err);
    return { success: false, redirectPath: getTargetUrl('error') };
  }
}

module.exports = {
  createPlan,
  getPlans,
  updatePlan,
  deletePlan,
  getTenantSubscription,
  assignPlanDirectly,
  sendPaymentLink,
  initiateSubscription,
  handleSubscriptionWebhook,
  handleSubscriptionRedirect
};
