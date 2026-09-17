const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { promoCodesCache, invalidatePromosCache } = require("../../lib/cache");

async function createPromoCode(storeId, data) {
  const prisma = getPrismaClient();
  const existing = await prisma.promoCode.findUnique({
    where: { storeId_code: { storeId, code: data.code.toUpperCase() } }
  });
  
  if (existing) {
    throw createHttpError(400, "Promo code already exists for this store");
  }

  const promo = await prisma.promoCode.create({
    data: {
      ...data,
      storeId,
      code: data.code.toUpperCase()
    }
  });
  invalidatePromosCache(storeId);
  return promo;
}

async function getPromoCodes(storeId) {
  const cached = promoCodesCache.get(storeId);
  if (cached) return cached;

  const prisma = getPrismaClient();
  const promos = await prisma.promoCode.findMany({
    where: { storeId },
    orderBy: { createdAt: 'desc' }
  });
  promoCodesCache.set(storeId, promos);
  return promos;
}

async function updatePromoCode(storeId, promoId, data) {
  const prisma = getPrismaClient();
  const promo = await prisma.promoCode.updateMany({
    where: { id: promoId, storeId },
    data: {
      ...data,
      ...(data.code && { code: data.code.toUpperCase() })
    }
  });
  
  if (promo.count === 0) {
    throw createHttpError(404, "Promo code not found");
  }
  
  invalidatePromosCache(storeId);
  return prisma.promoCode.findUnique({ where: { id: promoId } });
}

async function deletePromoCode(storeId, promoId) {
  const prisma = getPrismaClient();
  const promo = await prisma.promoCode.deleteMany({
    where: { id: promoId, storeId }
  });
  
  if (promo.count === 0) {
    throw createHttpError(404, "Promo code not found");
  }
  invalidatePromosCache(storeId);
  return { message: "Promo code deleted" };
}

module.exports = {
  createPromoCode,
  getPromoCodes,
  updatePromoCode,
  deletePromoCode
};
