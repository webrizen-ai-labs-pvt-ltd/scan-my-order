/** Roles that can add or remove a promo code on an unpaid bill (matches the backend) */
export const PROMO_ROLES = ['WAITER', 'CASHIER', 'STORE_MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'];

/** What the bill's promo looks like, from an order bill or a table-session bill */
export function promoStateOf(bill, isTable) {
  if (!bill) return { applied: null };
  if (isTable) {
    return {
      applied: bill.tablePromo?.code || null,
      otherCodes: bill.tablePromo ? [] : (bill.orderPromoCodes || []),
      discount: bill.promoDiscount,
    };
  }
  return {
    applied: bill.promoCode?.code || null,
    locked: bill.tableSession?.promoCodeId ? "This order is part of a table bill with a promo code. Change it from the table's bill." : null,
    discount: bill.discountAmount,
  };
}
