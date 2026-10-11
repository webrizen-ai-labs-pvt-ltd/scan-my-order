const { createHttpError } = require("./error-handler");
const { getEntitlements, tenantOfStore } = require("../modules/billing/entitlements-service");

// Placing an order, from the POS, a waiter or the QR menu
const NEW_ORDER = /\/stores\/[^/]+\/orders\/?$/;

/**
 * What an ended subscription stops. After the plan (or trial) and its grace period run out the
 * tenant is "locked": no new orders can be placed anywhere. Everything else keeps working, so
 * open bills can still be settled and the owner can sign in, see their data and renew.
 * Super admins are never stopped.
 */
async function billingGuard(req, _res, next) {
  try {
    if (req.user?.role === "SUPER_ADMIN") return next();
    if (req.method !== "POST" || !NEW_ORDER.test(req.originalUrl.split("?")[0])) return next();

    const tenantId = req.params.storeId ? await tenantOfStore(req.params.storeId) : req.user?.tenantId;
    if (!tenantId) return next();

    const entitlements = await getEntitlements(tenantId);
    if (entitlements.state !== "LOCKED") return next();

    const forGuest = !req.user || req.user.role === "CUSTOMER";
    throw createHttpError(
      402,
      forGuest
        ? "This restaurant isn't taking orders here right now. Please order with the staff."
        : `Your ${entitlements.isTrial ? "free trial" : "subscription"} has ended, so new orders are switched off. Ask the owner to renew it under Subscription.`,
      { code: "SUBSCRIPTION_LOCKED" }
    );
  } catch (err) {
    next(err);
  }
}

module.exports = {
  billingGuard
};
