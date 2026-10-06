const TYPE_LABEL = { DINE_IN: 'Dine-in', TAKEAWAY: 'Takeaway', DELIVERY: 'Delivery' };

/**
 * Where an order goes: "Table 4", "Pickup #23" (counter orders at malls / food courts),
 * or the order type.
 */
export function orderPlaceLabel(order) {
  if (order?.table?.tableNumber != null) return `Table ${order.table.tableNumber}`;
  if (order?.pickupNumber != null) return `Pickup #${order.pickupNumber}`;
  return TYPE_LABEL[order?.type] || 'No table';
}

/** "Asha · 98300 12345" for counter guests (who to call when it's ready) */
export function orderGuestLabel(order) {
  const phone = order?.customerPhone ? `${order.customerPhone.slice(0, 5)} ${order.customerPhone.slice(5)}` : '';
  return [order?.customerName, phone].filter(Boolean).join(' · ');
}
