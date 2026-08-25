const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { encrypt, decrypt } = require("../../lib/encryption");

async function saveGatewayKeys(tenantId, input) {
  const prisma = getPrismaClient();
  const { provider, merchantId, apiKey, secretKey } = input;

  if (provider !== "RAZORPAY") {
    throw createHttpError(400, "Currently only RAZORPAY is supported for BYOAK");
  }

  if (!merchantId || !apiKey || !secretKey) {
    throw createHttpError(400, "merchantId, apiKey, and secretKey are required");
  }

  // Encrypt the sensitive keys
  const encryptedApiKey = encrypt(apiKey);
  const encryptedSecretKey = encrypt(secretKey);

  const gateway = await prisma.tenantPaymentGateway.upsert({
    where: {
      tenantId_provider: {
        tenantId,
        provider
      }
    },
    update: {
      merchantId,
      apiKey: encryptedApiKey,
      secretKey: encryptedSecretKey,
      isActive: true
    },
    create: {
      tenantId,
      provider,
      merchantId,
      apiKey: encryptedApiKey,
      secretKey: encryptedSecretKey,
      isActive: true
    }
  });

  return {
    id: gateway.id,
    provider: gateway.provider,
    merchantId: gateway.merchantId,
    isActive: gateway.isActive,
    message: "Keys encrypted and saved successfully"
  };
}

async function getGateways(tenantId) {
  const prisma = getPrismaClient();
  
  const gateways = await prisma.tenantPaymentGateway.findMany({
    where: { tenantId }
  });

  // Return masked versions of the keys
  return gateways.map(gw => ({
    id: gw.id,
    provider: gw.provider,
    merchantId: gw.merchantId,
    isActive: gw.isActive,
    hasKeys: true // Indicating keys are set, without returning them
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
