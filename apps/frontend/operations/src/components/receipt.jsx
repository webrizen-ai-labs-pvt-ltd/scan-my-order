import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

// Razorpay's QR image is a 674×1644 poster; the scannable card sits at x 107–567, y 520–1132
const POSTER = { w: 674, x: 107, y: 520, cw: 460, ch: 612 };

/**
 * "Scan to pay" block at the foot of a bill. Inline styles only: the print iframe has no Tailwind.
 * @param {{ channel: 'RAZORPAY'|'UPI_OFFLINE', amount: number, imageUrl?: string, payload?: string, vpa?: string, payeeName?: string }} qr
 */
const PayQr = ({ qr }) => {
  const width = 180;
  return (
    <div className="border-t" style={{ borderTop: '1px dashed black', paddingTop: 8, marginBottom: 8, textAlign: 'center' }}>
      <div className="font-bold" style={{ fontWeight: 'bold' }}>Scan to pay ₹{Number(qr.amount).toFixed(2)}</div>
      {qr.imageUrl ? (
        <div style={{ position: 'relative', overflow: 'hidden', width, height: Math.round(width * POSTER.ch / POSTER.cw), margin: '6px auto' }}>
          <img
            src={qr.imageUrl}
            alt=""
            style={{
              position: 'absolute',
              maxWidth: 'none',
              width: `${(POSTER.w / POSTER.cw) * 100}%`,
              left: `${-(POSTER.x / POSTER.cw) * 100}%`,
              top: `${-(POSTER.y / POSTER.ch) * 100}%`,
            }}
          />
        </div>
      ) : qr.payload ? (
        <div style={{ margin: '6px auto', width: 170 }}>
          <QRCodeSVG value={qr.payload} size={170} level="M" />
        </div>
      ) : null}
      <div className="text-xs" style={{ fontSize: '0.75rem' }}>
        {qr.channel === 'RAZORPAY'
          ? 'Any UPI app · confirms automatically'
          : [qr.payeeName, qr.vpa].filter(Boolean).join(' · ')}
      </div>
    </div>
  );
};

/**
 * @param {object} props
 * @param {object} props.order
 * @param {object} props.storeData
 * @param {object} [props.payQr] adds a "Scan to pay" QR at the bottom (printed bills)
 */
export const Receipt = React.forwardRef(({ order, storeData, payQr }, ref) => {
  if (!order || !storeData) return null;
  const isPaid = Boolean(order.paidAt) || order.status === 'SETTLED';
  const paidSoFar = (order.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
  const amountDue = Math.max(0, order.totalAmount - paidSoFar);

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
        {storeData.registrationNumber && <div>Reg. No: {storeData.registrationNumber}</div>}
        {storeData.address && <div>{storeData.address}</div>}
        {(storeData.contactPhone || storeData.extraPhones?.length > 0) && (
          <div>Tel: {[storeData.contactPhone, ...(storeData.extraPhones || [])].filter(Boolean).join(', ')}</div>
        )}
        {storeData.tenant?.gstin && <div>GSTIN: {storeData.tenant.gstin}</div>}
      </div>

      {order.invoice && (
        <div className="border-b border-dashed border-black pb-2 mb-2 text-center">
          <div className="font-bold uppercase tracking-wider">{order.invoice.isTaxInvoice ? 'Tax Invoice' : 'Bill'}</div>
          <div>{order.invoice.isTaxInvoice ? 'Invoice' : 'Bill'} No: <span className="font-bold">{order.invoice.number}</span></div>
          {order.invoice.company && (
            <div className="text-xs mt-1">
              Billed to: {order.invoice.company}
              {order.invoice.companyGstin && <div>GSTIN: {order.invoice.companyGstin}</div>}
            </div>
          )}
        </div>
      )}

      <div className="border-b border-dashed border-black pb-2 mb-2">
        <div className="flex justify-between">
          <span>Order #{order.id.slice(-6).toUpperCase()}</span>
          <span>{formattedDate}</span>
        </div>
        <div className="flex justify-between">
          <span>Type: {order.type === 'DINE_IN' ? 'Dine-In' : 'Takeaway'}</span>
          {order.table && <span className="font-bold text-lg">Table: {order.table.tableNumber}</span>}
          {!order.table && order.pickupNumber != null && <span className="font-bold text-lg">Pickup #{order.pickupNumber}</span>}
        </div>
        {/* A bill printed with a payment QR is for the guest to pay: no status line on it */}
        {!payQr && (
          <div className="flex justify-between">
            <span>Status: {isPaid ? 'Paid' : 'Unpaid'}</span>
          </div>
        )}
      </div>

      <div className="border-b border-dashed border-black pb-2 mb-2">
        <div className="flex justify-between font-bold mb-1">
          <span className="flex-1">Item</span>
          <span className="w-10 text-center">Qty</span>
          <span className="w-16 text-right">Amt</span>
        </div>
        {order.items.filter(item => item.status !== 'REJECTED').map((item, idx) => {
           // priceAtOrder already includes modifiers and priced ingredients
           const itemTotal = item.priceAtOrder;
           return (
            <div key={idx} className="mb-1">
              <div className="flex justify-between">
                <span className="flex-1 pr-2">
                  {item.customName || item.menuItem?.name}
                  {item.isCustom && ' *'}
                </span>
                <span className="w-10 text-center">{item.quantity}</span>
                <span className="w-16 text-right">{(itemTotal * item.quantity).toFixed(2)}</span>
              </div>
              {item.modifiers?.length > 0 && (
                <div className="text-xs pl-2 text-zinc-600">
                  {item.modifiers.map(m => (
                    <div key={m.id}>+ {m.modifierOption?.name} ({(m.priceAtOrder || 0).toFixed(2)})</div>
                  ))}
                </div>
              )}
              {item.customIngredients && item.customIngredients.length > 0 && (
                <div className="text-xs pl-2 text-zinc-600">
                  {item.customIngredients.map((ing, iIdx) => (
                    <div key={iIdx}>
                      + {ing.name} ({ing.quantity}{ing.unit})
                      {Number(ing.price) > 0 ? ` (${Number(ing.price).toFixed(2)})` : ''}
                    </div>
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
        {order.walletDiscount > 0 && (
          <div className="flex justify-between">
            <span>Store credits</span>
            <span>-₹{order.walletDiscount.toFixed(2)}</span>
          </div>
        )}
        {order.discountAmount > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>-₹{order.discountAmount.toFixed(2)}</span>
          </div>
        )}
        {order.taxAmount > 0 && order.invoice?.taxes?.length > 0 ? order.invoice.taxes.map(t => (
          <div key={t.name} className="flex justify-between">
            <span>{t.name} @ {t.rate}%</span>
            <span>₹{Number(t.amount).toFixed(2)}</span>
          </div>
        )) : order.taxAmount > 0 && (
          <div className="flex justify-between">
            <span>Taxes</span>
            <span>₹{order.taxAmount.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="flex justify-between font-bold text-base mb-2">
        <span>Total</span>
        <span>₹{order.totalAmount.toFixed(2)}</span>
      </div>
      {!isPaid && paidSoFar > 0 && (
        <div className="flex justify-between font-bold mb-2">
          <span>Amount due</span>
          <span>₹{amountDue.toFixed(2)}</span>
        </div>
      )}


      {order.payments?.length > 0 ? (
        <div className="border-b border-dashed border-black pb-2 mb-2 text-xs">
          <div className="font-bold mb-1 uppercase tracking-wider">Paid by</div>
          {order.payments.map((p) => (
            <div key={p.id}>
              <div className="flex justify-between">
                <span>{p.channel === 'CASH' ? 'Cash' : p.channel === 'UPI_OFFLINE' ? 'UPI' : p.channel === 'DUES' ? `Dues (${p.duesAccount?.name || 'account'})` : 'Online (UPI/Card)'}</span>
                <span>₹{p.amount.toFixed(2)}</span>
              </div>
              {p.channel === 'CASH' && p.cashTendered > p.amount && (
                <div className="flex justify-between pl-2 text-zinc-600">
                  <span>Tendered ₹{p.cashTendered.toFixed(2)}</span>
                  <span>Change ₹{(p.changeDue || 0).toFixed(2)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : order.paymentMethod === 'SPLIT' ? (
        <div className="border-t border-dashed border-black pt-2 pb-2 mb-2 text-xs">
          <div className="font-bold mb-1 uppercase tracking-wider">Payment Breakdown:</div>
          <div className="flex justify-between">
            <span>Cash Tendered:</span>
            <span>₹{(order.cashAmount || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Online (UPI):</span>
            <span>₹{(order.onlineAmount || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold pt-1 border-t border-dotted border-zinc-400">
            <span>Total Settled:</span>
            <span>₹{((order.cashAmount || 0) + (order.onlineAmount || 0)).toFixed(2)}</span>
          </div>
        </div>
      ) : order.paymentMethod === 'CASH' ? (
        <div className="flex justify-between text-xs mb-2 pb-2 border-b border-dashed border-black">
          <span>Payment Method:</span>
          <span className="font-semibold">Cash (₹{(order.cashAmount || order.totalAmount).toFixed(2)})</span>
        </div>
      ) : order.paymentMethod === 'ONLINE' ? (
        <div className="flex justify-between text-xs mb-2 pb-2 border-b border-dashed border-black">
          <span>Payment Method:</span>
          <span className="font-semibold">Online / UPI (₹{(order.onlineAmount || order.totalAmount).toFixed(2)})</span>
        </div>
      ) : null}

      {order.refunds?.length > 0 && (
        <div className="border-b border-dashed border-black pb-2 mb-2 text-xs">
          <div className="font-bold mb-1 uppercase tracking-wider">Refunded</div>
          {order.refunds.map((r) => (
            <div key={r.id} className="flex justify-between">
              <span>{r.method === 'CASH' ? 'Cash' : r.method === 'UPI_OFFLINE' ? 'UPI' : r.method === 'DUES' ? 'Taken off dues' : 'Online (UPI/Card)'}{r.status === 'PENDING' ? ' (in progress)' : ''}</span>
              <span>-₹{r.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
      {order.refundDue > 0 && (
        <div className="flex justify-between text-xs mb-2 pb-2 border-b border-dashed border-black">
          <span>Refund due (items not served):</span>
          <span className="font-semibold">₹{order.refundDue.toFixed(2)}</span>
        </div>
      )}

      {payQr && !isPaid && <PayQr qr={payQr} />}

      <div className="text-center">
        <p>Thank you for visiting!</p>
        <p>Have a great day.</p>
      </div>
    </div>
  );
});
