/**
 * Shapes a table-session bill (GET /orders/sessions/:id) like an order so <Receipt> can print it.
 * @param {object} bill
 * @param {Array} [payments] Payment rows from the payment summary
 */
export function sessionBillToReceipt(bill, payments) {
  return {
    id: bill.session.id,
    createdAt: bill.session.createdAt,
    type: 'DINE_IN',
    status: bill.session.status,
    paidAt: bill.session.status === 'SETTLED' ? new Date().toISOString() : null,
    table: { tableNumber: bill.session.tableNumber },
    subTotal: bill.subTotal,
    discountAmount: bill.discountAmount,
    walletDiscount: 0,
    taxAmount: bill.taxAmount,
    totalAmount: bill.totalAmount,
    payments: (payments || []).filter(p => p.status === 'PAID'),
    invoice: bill.invoice || null,
    items: bill.aggregatedItems.map(i => ({
      quantity: i.quantity,
      priceAtOrder: i.price,
      customName: i.name,
      complimentary: Boolean(i.complimentary),
      modifiers: (i.modifiers || []).map(m => ({ id: m, modifierOption: { name: m } })),
    })),
  };
}
