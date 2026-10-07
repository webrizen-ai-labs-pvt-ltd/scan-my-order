import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@smo/ui';
import { ArrowDown01Icon, ArrowUp01Icon, Loading03Icon } from 'hugeicons-react';
import { playNotificationChime } from '@smo/shared/audio';
import api from '../../lib/api';
import { apiErrorMessage } from './pos-toasts';

const placeOf = (order) => {
  if (order?.table?.tableNumber != null) return `Table ${order.table.tableNumber}`;
  if (order?.pickupNumber != null) return `Pickup #${order.pickupNumber}`;
  return 'Takeaway';
};

const minutesAgo = (date) => Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));

/**
 * Guests' UPI payments to the store's own ID, waiting for a cashier to check their UPI app and
 * confirm (or say it never arrived). Sits under the POS header on every POS page.
 */
export const GuestUpiConfirmations = ({ storeId, subscribe, toast }) => {
  const [payments, setPayments] = useState([]);
  const [open, setOpen] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!storeId) return;
    try {
      const res = await api.get(`/stores/${storeId}/payments/guest-upi`);
      setPayments(res.data.data || []);
    } catch { /* keeps the last list */ }
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  // New guest payments, a guest saying "I've paid", or another till confirming one
  useEffect(() => subscribe((msg) => {
    if (msg.type === 'GUEST_UPI_UPDATED') {
      if (msg.data?.outcome === 'CLAIMED') {
        playNotificationChime({ haptic: true });
        setOpen(true);
      }
      load();
    } else if (msg.type === 'PAYMENT_UPDATED' || msg.type === 'STREAM_RECONNECTED') {
      load();
    }
  }), [subscribe, load]);

  // "2 min ago" keeps counting
  useEffect(() => {
    if (payments.length === 0) return undefined;
    const t = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, [payments.length]);

  const act = async (payment, action) => {
    if (action === 'cancel' && !window.confirm(`Mark ₹${payment.amount} (${payment.code}) as not received? The guest will be asked to pay at the counter.`)) return;
    setBusyId(payment.id);
    try {
      await api.post(`/stores/${storeId}/payments/${payment.id}/${action}`);
      toast(action === 'confirm' ? `₹${payment.amount} confirmed · ${placeOf(payment.order)}` : 'Marked as not received', action === 'confirm' ? 'success' : 'info');
      await load();
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not update the payment'), 'error');
      load();
    } finally {
      setBusyId(null);
    }
  };

  if (payments.length === 0) return null;
  const claimed = payments.filter(p => p.guestClaimedAt).length;

  return (
    <section aria-label="UPI payments to confirm" className="shrink-0 border-b border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left"
      >
        <span className="text-sm font-bold text-amber-900 dark:text-amber-200">
          {payments.length} UPI {payments.length === 1 ? 'payment' : 'payments'} to confirm
          {claimed > 0 && <span className="ml-2 font-medium text-amber-800 dark:text-amber-300">· {claimed} {claimed === 1 ? 'guest says' : 'guests say'} paid</span>}
        </span>
        {open ? <ArrowUp01Icon size={16} className="text-amber-800" /> : <ArrowDown01Icon size={16} className="text-amber-800" />}
      </button>
      {open && (
        <ul className="max-h-56 divide-y divide-amber-200 overflow-y-auto px-4 pb-2 dark:divide-amber-900">
          {payments.map(p => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
              <div className="min-w-0 text-sm">
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{placeOf(p.order)}</span>
                <span className="mx-1.5 text-zinc-400">·</span>
                <span className="font-bold tabular-nums text-zinc-900 dark:text-zinc-100">₹{p.amount}</span>
                <span className="mx-1.5 text-zinc-400">·</span>
                <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{p.code}</span>
                {p.guestReference && <span className="ml-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">ref …{p.guestReference.slice(-6)}</span>}
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  {p.guestClaimedAt
                    ? <span className="font-semibold text-amber-800 dark:text-amber-300">Guest says paid {minutesAgo(p.guestClaimedAt) ? `${minutesAgo(p.guestClaimedAt)} min ago` : 'just now'}</span>
                    : `Waiting for the guest to pay · ${minutesAgo(p.createdAt)} min`}
                  {(p.order?.customerName || p.order?.customerPhone) && ` · ${[p.order.customerName, p.order.customerPhone].filter(Boolean).join(' ')}`}
                  {p.order?.status === 'PROCESSING' && ' · already cooking'}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" disabled={busyId === p.id} onClick={() => act(p, 'cancel')}>Not received</Button>
                <Button size="sm" disabled={busyId === p.id} onClick={() => act(p, 'confirm')} className="bg-emerald-600 text-white hover:bg-emerald-700">
                  {busyId === p.id ? <Loading03Icon size={14} className="animate-spin" /> : `Confirm ₹${p.amount}`}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
