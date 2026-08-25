const userRoles = Object.freeze({
  superAdmin: "SUPER_ADMIN",
  tenantAdmin: "TENANT_ADMIN",
  storeManager: "STORE_MANAGER",
  waiter: "WAITER",
  cashier: "CASHIER",
  kitchenStaff: "KITCHEN_STAFF",
  customer: "CUSTOMER"
});

const userStatuses = Object.freeze({
  active: "ACTIVE",
  invited: "INVITED",
  suspended: "SUSPENDED",
  disabled: "DISABLED",
  deleted: "DELETED"
});

const tenantScopedRoles = Object.freeze([
  userRoles.tenantAdmin,
  userRoles.customer
]);

const storeScopedRoles = Object.freeze([
  userRoles.storeManager,
  userRoles.waiter,
  userRoles.cashier,
  userRoles.kitchenStaff
]);

const tenantAdminManagedRoles = Object.freeze([
  userRoles.tenantAdmin,
  userRoles.storeManager,
  userRoles.waiter,
  userRoles.cashier,
  userRoles.kitchenStaff,
  userRoles.customer
]);

const storeManagerManagedRoles = Object.freeze([
  userRoles.waiter,
  userRoles.cashier,
  userRoles.kitchenStaff
]);

module.exports = {
  storeManagerManagedRoles,
  storeScopedRoles,
  tenantAdminManagedRoles,
  tenantScopedRoles,
  userRoles,
  userStatuses
};
