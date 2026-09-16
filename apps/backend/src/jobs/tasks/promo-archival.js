const { getPrismaClient } = require('../../lib/prisma');

async function runPromoArchivalJob({ storeId, tenantId, params = {} }) {
  const prisma = getPrismaClient();

  const now = new Date();
  const whereClause = {
    isActive: true,
    validUntil: {
      not: null,
      lt: now
    }
  };

  if (storeId) {
    whereClause.storeId = storeId;
  } else if (tenantId) {
    whereClause.store = { tenantId };
  }

  const expiredPromos = await prisma.promoCode.findMany({
    where: whereClause,
    select: { id: true, code: true }
  });

  if (expiredPromos.length === 0) {
    return {
      deactivatedCount: 0,
      summary: 'All active promotional codes are valid.'
    };
  }

  const ids = expiredPromos.map(p => p.id);
  const result = await prisma.promoCode.updateMany({
    where: { id: { in: ids } },
    data: { isActive: false }
  });

  const codesList = expiredPromos.map(p => p.code).join(', ');
  return {
    deactivatedCount: result.count,
    codes: codesList,
    summary: `Deactivated ${result.count} expired promo code(s): ${codesList}.`
  };
}

module.exports = {
  runPromoArchivalJob
};
