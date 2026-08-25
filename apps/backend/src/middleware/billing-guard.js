const { createHttpError } = require("./error-handler");
const { getPrismaClient } = require("../lib/prisma");

/**
 * Middleware that intercepts requests if a Tenant's SaaS subscription is PAST_DUE
 * and the 3-day grace period has expired (The "Kill Switch").
 * Bypassed for SUPER_ADMIN.
 */
async function billingGuard(req, res, next) {
  try {
    // If user is SUPER_ADMIN, bypass
    if (req.user && req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    // Determine the Tenant ID
    // 1. If it's a Staff request, Tenant ID is on `req.user.tenantId`
    // 2. If it's a Public QR request, `storeId` is in `req.params`. We must lookup tenantId.
    let tenantId = req.user?.tenantId;
    const prisma = getPrismaClient();

    if (!tenantId && req.params.storeId) {
      const store = await prisma.store.findUnique({
        where: { id: req.params.storeId },
        select: { tenantId: true }
      });
      if (!store) {
        throw createHttpError(404, "Store not found");
      }
      tenantId = store.tenantId;
    }

    if (!tenantId) {
      // If no tenant context is found, it's either an invalid route or super admin
      return next();
    }

    const subscription = await prisma.tenantSubscription.findUnique({
      where: { tenantId }
    });

    // If no subscription, technically they shouldn't exist, but we let them pass 
    // or fail downstream if they have no active plan.
    if (!subscription) {
      return next();
    }

    const { status, gracePeriodEndsAt } = subscription;

    if (status === 'PAST_DUE') {
      if (!gracePeriodEndsAt) {
        // Should logically have a grace period if past due. Let's assume passed grace if null here, 
        // but typically gracePeriodEndsAt is set instantly. 
        throw createHttpError(402, "Payment Required to Resume Service");
      }
      
      const now = new Date();
      if (now > gracePeriodEndsAt) {
        // Kill switch activated
        throw createHttpError(402, "Payment Required to Resume Service");
      }
    } else if (status !== 'ACTIVE' && status !== 'TRIALING') {
       // CANCELED or other statuses
       throw createHttpError(402, "Payment Required to Resume Service");
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  billingGuard
};
