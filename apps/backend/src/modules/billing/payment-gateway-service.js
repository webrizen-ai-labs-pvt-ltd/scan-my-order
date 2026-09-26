const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { encrypt, decrypt } = require("../../lib/encryption");

async function saveGatewayKeys(tenantId, input) {
  const prisma = getPrismaClient();
  const provider = input.provider || "RAZORPAY";
  const merchantId = input.merchantId ? String(input.merchantId).trim() : "";
  const apiKey = input.apiKey ? String(input.apiKey).trim() : "";
  const secretKey = input.secretKey ? String(input.secretKey).trim() : "";
  const webhookSecret = input.webhookSecret !== undefined ? String(input.webhookSecret || "").trim() : undefined;

  if (provider !== "RAZORPAY") {
    throw createHttpError(400, "Currently only RAZORPAY is supported for BYOAK");
  }

  const existing = await prisma.tenantPaymentGateway.findUnique({
    where: { tenantId_provider: { tenantId, provider } }
  });

  // Keys can be left blank on update to keep the stored ones
  if (!existing && (!apiKey || !secretKey)) {
    throw createHttpError(400, "Razorpay Key ID and Key Secret are required");
  }
  if (apiKey && !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(apiKey)) {
    throw createHttpError(400, "Key ID should look like rzp_live_XXXX or rzp_test_XXXX");
  }

  const data = {
    merchantId: merchantId || existing?.merchantId || "",
    isActive: input.isActive === undefined ? true : Boolean(input.isActive)
  };
  if (apiKey) data.apiKey = encrypt(apiKey);
  if (secretKey) data.secretKey = encrypt(secretKey);
  if (webhookSecret !== undefined) data.webhookSecret = webhookSecret ? encrypt(webhookSecret) : null;

  const gateway = existing
    ? await prisma.tenantPaymentGateway.update({ where: { id: existing.id }, data })
    : await prisma.tenantPaymentGateway.create({ data: { tenantId, provider, ...data } });
  require("../payments/razorpay-gateway").invalidateGatewayCache(tenantId);

  return {
    ...serializeGateway(gateway),
    message: "Keys encrypted and saved successfully"
  };
}

function serializeGateway(gw) {
  return {
    id: gw.id,
    provider: gw.provider,
    merchantId: gw.merchantId,
    isActive: gw.isActive,
    hasKeys: Boolean(gw.apiKey && gw.secretKey),
    keyMode: (() => {
      try {
        return decrypt(gw.apiKey).startsWith("rzp_live_") ? "LIVE" : "TEST";
      } catch {
        return null;
      }
    })(),
    hasWebhookSecret: Boolean(gw.webhookSecret),
    webhookPath: `/api/public/webhooks/razorpay/${gw.tenantId}`
  };
}

async function getGateways(tenantId) {
  const prisma = getPrismaClient();
  const gateways = await prisma.tenantPaymentGateway.findMany({
    where: { tenantId }
  });
  // Never return keys, only whether they are set — plus whether Razorpay QR Codes works for them
  const { getTenantRazorpay, getQrCodesStatus } = require("../payments/razorpay-gateway");
  return Promise.all(gateways.map(async (gw) => {
    const out = serializeGateway(gw);
    if (gw.provider === "RAZORPAY" && gw.isActive) {
      try {
        const rp = await getTenantRazorpay(tenantId);
        const qr = rp ? await getQrCodesStatus(tenantId, rp, { fresh: true }) : null;
        out.qrCodes = qr ? { enabled: qr.enabled, reason: qr.reason } : null;
      } catch {
        out.qrCodes = null;
      }
    }
    return out;
  }));
}

// Internal function to be used by the food ordering module to process payments
async function getDecryptedGateway(tenantId, provider) {
  const prisma = getPrismaClient();
  
  const gateway = await prisma.tenantPaymentGateway.findUnique({
    where: {
      tenantId_provider: {
        tenantId,
        provider
      }
    }
  });

  if (!gateway || !gateway.isActive) {
    throw createHttpError(404, `Active payment gateway not found for provider ${provider}`);
  }

  return {
    ...gateway,
    apiKey: decrypt(gateway.apiKey),
    secretKey: gateway.secretKey ? decrypt(gateway.secretKey) : null
  };
}

module.exports = {
  saveGatewayKeys,
  getGateways,
  getDecryptedGateway
};
