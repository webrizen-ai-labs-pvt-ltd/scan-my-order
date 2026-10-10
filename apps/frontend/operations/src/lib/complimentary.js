export const COMPLIMENTARY_ROLES = ['CASHIER', 'STORE_MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'];

/** Orders that can get complimentary food: they reached the kitchen and aren't complimentary themselves */
export const canGiveComplimentary = (user, order) =>
  COMPLIMENTARY_ROLES.includes(user?.role)
  && !order.complimentaryOfId
  && !['DRAFT', 'PENDING_VERIFICATION', 'PENDING_PAYMENT'].includes(order.status);
