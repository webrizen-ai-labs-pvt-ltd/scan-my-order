import React, { useEffect, useState } from 'react';
import { Loading03Icon } from 'hugeicons-react';
import api from '../../lib/api';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// Colour marks the kind of change; everything else stays neutral
const TONE = {
  ORDER_CANCELLED: 'bg-rose-500',
  ITEMS_REJECTED: 'bg-rose-500',
  REFUND_ISSUED: 'bg-rose-500',
  REFUND_FAILED: 'bg-rose-500',
  INVOICE_CANCELLED: 'bg-rose-500',
  ITEMS_EDITED: 'bg-amber-500',
  ORDER_RECALLED: 'bg-amber-500',
  DELAY_ANNOUNCED: 'bg-amber-500',
  PAYMENT_RECEIVED: 'bg-emerald-500',
  PAYMENT_CONFIRMED: 'bg-emerald-500',
  BILL_SETTLED: 'bg-emerald-500',
  BILL_ON_DUES: 'bg-amber-500',
  OVERPAID: 'bg-rose-500',
  PROMO_APPLIED: 'bg-amber-500',
  PROMO_REMOVED: 'bg-amber-500',
  DUES_REPAID: 'bg-emerald-500',
};

const STATUS_WORDS = {
  PENDING_VERIFICATION: 'awaiting approval', PENDING_PAYMENT: 'awaiting payment', PROCESSING: 'cooking',
  READY: 'ready', SERVED: 'served', SETTLED: 'settled', CANCELLED: 'cancelled', DRAFT: 'draft',
};

/** One-line description of what changed */
function describe(e) {
  const d = e.data || {};
  switch (e.type) {
    case 'ORDER_CREATED':
      return `${(d.items || []).map(i => `${i.quantity}× ${i.name}`).join(', ')}${d.table != null ? ` · Table ${d.table}` : ''} · ${money(e.amountAfter)}`;
    case 'STATUS_CHANGED':
    case 'ORDER_RECALLED':
      return `${STATUS_WORDS[d.from] || d.from} → ${STATUS_WORDS[d.to] || d.to}`;
    case 'ITEMS_EDITED': {
      const fmt = (list) => (list || []).map(i => `${i.quantity}× ${i.name}`).join(', ') || '—';
      return `Before: ${fmt(d.before)}\nAfter: ${fmt(d.after)}\nTotal ${money(e.amountBefore)} → ${money(e.amountAfter)}`;
    }
    case 'ITEMS_REJECTED':
      return `${(d.items || []).join(', ')}${d.markedSoldOut ? ' · marked sold out' : ''}${d.refundDue ? ` · refund due ${money(d.refundDue)}` : ''}`;
    case 'PAYMENT_STARTED':
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_WITHDRAWN':
      return `${d.label || d.channel} ${money(e.amountAfter)}${d.changeDue ? ` · change ${money(d.changeDue)}` : ''}`;
    case 'OVERPAID':
      return `${money(e.amountAfter)} extra received (bill ${money(d.billed)}, received ${money(d.received)}) · refund due`;
    case 'PROMO_APPLIED':
    case 'PROMO_REMOVED':
      if (e.amountBefore == null) return d.code || '';
      return `${d.code || 'Code'} · total ${money(e.amountBefore)} → ${money(e.amountAfter)}`;
    case 'BILL_ON_DUES':
      return `${money(e.amountAfter)} owed by ${d.account}${d.guest ? ` · guest ${d.guest}` : ''}`;
    case 'DUES_REPAID':
      return `${money(e.amountAfter)} from ${d.account} · ${d.method}${d.reference ? ` (${d.reference})` : ''}${d.cleared ? ' · cleared' : ''}`;
    case 'BILL_SETTLED':
      return `${money(e.amountAfter)} · ${d.paymentMethod?.toLowerCase()}`;
    case 'REFUND_ISSUED':
    case 'REFUND_FAILED':
      return `${d.method} ${money(d.amount)}`;
    case 'DELAY_ANNOUNCED':
      return `+${d.minutes} min (total +${d.totalDelay})`;
    case 'ITEM_READY':
    case 'ITEM_UNREADY':
      return d.item;
    case 'INVOICE_ISSUED':
      return `${d.number}${d.company ? ` · ${d.company}` : ''}`;
    case 'INVOICE_CANCELLED':
    case 'INVOICE_EMAILED':
      return `${d.number}${d.to ? ` → ${d.to}` : ''}`;
    case 'INVOICE_DETAILS_SET':
      return `${d.company}${d.gstin ? ` · ${d.gstin}` : ''}`;
    case 'CREDIT_NOTE_ISSUED':
      return `${d.number} against ${d.reverses || d.against}`;
    default:
      return '';
  }
}

/**
 * Full change history of an order (and its table bill), for managers and owners.
 */
export const OrderActivity = ({ storeId, orderId }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) return;
    setData(null);
    setError('');
    api.get(`/stores/${storeId}/orders/${orderId}/audit`)
      .then(res => setData(res.data.data))
      .catch(err => setError(err?.response?.data?.error?.message || 'Could not load activity'));
  }, [storeId, orderId]);

  if (error) return <p className="text-xs text-zinc-500">{error}</p>;
  if (!data) return <div className="py-4 flex justify-center text-zinc-400"><Loading03Icon size={18} className="animate-spin" /></div>;
  if (data.events.length === 0) return <p className="text-xs text-zinc-500">No recorded activity for this order yet.</p>;

  const editors = Object.entries(data.summary.editsBy || {});

  return (
    <div className="flex flex-col gap-3">
      {data.summary.editCount > 0 && (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Edited <strong>{data.summary.editCount}</strong> time{data.summary.editCount === 1 ? '' : 's'}:{' '}
          {editors.map(([name, n]) => `${n} by ${name}`).join(', ')}
        </p>
      )}
      <ol className="relative border-l border-zinc-200 dark:border-zinc-800 ml-1.5 flex flex-col gap-3">
        {data.events.map(e => (
          <li key={e.id} className="pl-4 relative">
            <span className={`absolute -left-[5px] top-1.5 size-2.5 rounded-full ${TONE[e.type] || 'bg-zinc-400'}`} />
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{e.label}</span>
              <span className="text-[10px] tabular-nums text-zinc-400">
                {new Date(e.createdAt).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="text-[11px] text-zinc-500">
              {e.actorName}{e.actorRole ? ` · ${e.actorRole.replace('_', ' ').toLowerCase()}` : ''} · {e.source.toLowerCase().replace('_', ' ')}
            </div>
            {describe(e) && <div className="mt-0.5 text-[11px] text-zinc-700 dark:text-zinc-300 whitespace-pre-line">{describe(e)}</div>}
            {e.reason && <div className="mt-0.5 text-[11px] italic text-zinc-600 dark:text-zinc-400">“{e.reason}”</div>}
          </li>
        ))}
      </ol>
    </div>
  );
};
