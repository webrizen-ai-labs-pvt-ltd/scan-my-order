import React from 'react';

export const Receipt = React.forwardRef(({ order, storeData }, ref) => {
  if (!order || !storeData) return null;

  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(order.createdAt));

  return (
    <div ref={ref} className="bg-white p-6 max-w-sm mx-auto text-black font-mono text-sm print:p-0 print:m-0 print:w-full print:max-w-none">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold uppercase">{storeData.tenant?.name || storeData.name}</h2>
        {storeData.tenant?.name && storeData.tenant.name !== storeData.name && (
          <div className="font-bold">{storeData.name}</div>
        )}
        {storeData.address && <div>{storeData.address}</div>}
        {storeData.contactPhone && <div>Tel: {storeData.contactPhone}</div>}
        {storeData.tenant?.gstin && <div>GSTIN: {storeData.tenant.gstin}</div>}
      </div>

      <div className="border-b border-dashed border-black pb-2 mb-2">
        <div className="flex justify-between">
          <span>Order #{order.id.slice(-6).toUpperCase()}</span>
          <span>{formattedDate}</span>
        </div>
        <div className="flex justify-between">
          <span>Type: {order.type === 'DINE_IN' ? 'Dine-In' : 'Takeaway'}</span>
          {order.table && <span className="font-bold text-lg">Table: {order.table.tableNumber}</span>}
        </div>
        <div className="flex justify-between">
          <span>Payment: {order.paymentModel === 'PREPAID' ? 'Prepaid (Paid)' : 'Postpaid'}</span>
        </div>
      </div>

      <div className="border-b border-dashed border-black pb-2 mb-2">
        <div className="flex justify-between font-bold mb-1">
          <span className="flex-1">Item</span>
          <span className="w-10 text-center">Qty</span>
          <span className="w-16 text-right">Amt</span>
        </div>
        {order.items.map((item, idx) => {
           const itemTotal = item.priceAtOrder + item.modifiers.reduce((sum, m) => sum + m.priceAtOrder, 0);
           return (
            <div key={idx} className="mb-1">
              <div className="flex justify-between">
                <span className="flex-1 pr-2">{item.menuItem.name}</span>
                <span className="w-10 text-center">{item.quantity}</span>
                <span className="w-16 text-right">{(itemTotal * item.quantity).toFixed(2)}</span>
              </div>
              {item.modifiers.length > 0 && (
                <div className="text-xs pl-2 text-zinc-600">
                  {item.modifiers.map(m => (
                    <div key={m.id}>+ {m.modifierOption.name} ({(m.priceAtOrder).toFixed(2)})</div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="border-b border-dashed border-black pb-2 mb-2">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>₹{order.subTotal.toFixed(2)}</span>
        </div>
        {order.discountAmount > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>-₹{order.discountAmount.toFixed(2)}</span>
          </div>
        )}
        {order.taxAmount > 0 && (
          <div className="flex justify-between">
            <span>Taxes</span>
            <span>₹{order.taxAmount.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="flex justify-between font-bold text-base mb-4">
        <span>Total</span>
        <span>₹{order.totalAmount.toFixed(2)}</span>
      </div>

      <div className="text-center">
        <p>Thank you for visiting!</p>
        <p>Have a great day.</p>
      </div>
    </div>
  );
});
