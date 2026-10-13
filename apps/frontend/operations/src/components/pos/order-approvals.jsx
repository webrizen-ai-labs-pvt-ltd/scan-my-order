import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@smo/ui';
import { ArrowDown01Icon, ArrowUp01Icon, Loading03Icon } from 'hugeicons-react';
import { playNotificationChime } from '@smo/shared/audio';
import api from '../../lib/api';
import { orderGuestLabel, orderPlaceLabel } from '../../lib/order-place';
import { apiErrorMessage } from './pos-toasts';
import { CallCustomer } from '../call-customer';

// Live updates can be missed (a dropped connection, a busy network): the list also re-checks itself
const RECHECK_MS = 20000;
const REFRESH_ON = new Set(['ORDER_PENDING_VERIFICATION', 'ORDER_PROCESSING', 'ORDER_CANCELLED', 'ORDER_UPDATED', 'STREAM_RECONNECTED']);

const minutesAgo = (date) => Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
const itemsOf = (order) => (order.items || []).map(i => `${i.quantity} × ${i.menuItem?.name || 'Item'}`).join(', ');

/**
 * Orders guests placed from the QR menu to pay later, waiting for staff to accept them before
 * they go to the kitchen. The same orders waiters see under "Verify"; here the counter can
 * accept or refuse them too. Sits under the POS header on every POS page.
 */
export const OrderApprovals = ({ storeId, subscribe, toast }) => {
  const [orders, setOrders] = useState([]);
  const [open, setOpen] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [, setTick] = useState(0);
  // Orders already shown, so a re-check only rings for ones nobody has seen yet
  const seen = useRef(null);

  const load = useCallback(async () => {
    if (!storeId) return;
    try {
      const res = await api.get(`/stores/${storeId}/orders`, { params: { statuses: 'PENDING_VERIFICATION' } });
      const list = (res.data.data || []).filter(o => o.status === 'PENDING_VERIFICATION')
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const fresh = seen.current !== null && list.some(o => !seen.current.has(o.id));
      seen.current = new Set(list.map(o => o.id));
      setOrders(list);
      if (fresh) {
        playNotificationChime({ haptic: true });
        setOpen(true);
      }
    } catch { /* keeps the last list */ }
  }, [storeId]);

  useEffect(() => {
    seen.current = null;
    load();
    const timer = setInterval(load, RECHECK_MS);
    return () => clearInterval(timer);
  }, [load]);

  // A new order to accept, or a waiter or another till dealing with one
  useEffect(() => subscribe((msg) => { if (REFRESH_ON.has(msg.type)) load(); }), [subscribe, load]);

  // "2 min" keeps counting
  useEffect(() => {
    if (orders.length === 0) return undefined;
    const t = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, [orders.length]);

  const accept = async (order) => {
    setBusyId(order.id);
    try {
      await api.patch(`/stores/${storeId}/orders/${order.id}/verify`);
      toast(`${orderPlaceLabel(order)} accepted · sent to the kitchen`, 'success');
      await load();
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not accept the order'), 'error');
      load();
    } finally {
      setBusyId(null);
    }
  };

  const refuse = async (order) => {
    const reason = window.prompt(`Refuse the order from ${orderPlaceLabel(order)}? The guest is told it was cancelled.\n\nReason:`, 'Not accepted at the counter');
    if (reason === null) return;
    if (reason.trim().length < 3) { toast('Give a short reason for refusing the order', 'error'); return; }
    setBusyId(order.id);
    try {
      await api.patch(`/stores/${storeId}/orders/${order.id}/status`, { status: 'CANCELLED', reason: reason.trim() });
      toast(`${orderPlaceLabel(order)} order refused`, 'info');
      await load();
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not refuse the order'), 'error');
      load();
    } finally {
      setBusyId(null);
    }
  };

  if (orders.length === 0) return null;

  return (
    <section aria-label="Orders to accept" className="shrink-0 border-b border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left"
      >
        <span className="text-sm font-bold text-amber-900 dark:text-amber-200">
          {orders.length} {orders.length === 1 ? 'order' : 'orders'} to accept
          <span className="ml-2 font-medium text-amber-800 dark:text-amber-300">· from the QR menu, paying later</span>
        </span>
        {open ? <ArrowUp01Icon size={16} className="text-amber-800" /> : <ArrowDown01Icon size={16} className="text-amber-800" />}
      </button>
      {open && (
        <ul className="max-h-56 divide-y divide-amber-200 overflow-y-auto px-4 pb-2 dark:divide-amber-900">
          {orders.map(o => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
              <div className="min-w-0 flex-1 text-sm">
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{orderPlaceLabel(o)}</span>
                <span className="mx-1.5 text-zinc-400">·</span>
                <span className="font-bold tabular-nums text-zinc-900 dark:text-zinc-100">₹{o.totalAmount}</span>
                <span className="mx-1.5 text-zinc-400">·</span>
                <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">#{o.id.slice(-6).toUpperCase()}</span>
                <div className="text-xs text-zinc-700 dark:text-zinc-300 truncate" title={itemsOf(o)}>{itemsOf(o)}</div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  Waiting {minutesAgo(o.createdAt) ? `${minutesAgo(o.createdAt)} min` : 'since just now'}
                  {orderGuestLabel(o) && !o.customerPhone && ` · ${orderGuestLabel(o)}`}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <CallCustomer phone={o.customerPhone} name={o.customerName} />
                <Button size="sm" variant="outline" disabled={busyId === o.id} onClick={() => refuse(o)}>Refuse</Button>
                <Button size="sm" disabled={busyId === o.id} onClick={() => accept(o)} className="!bg-none !bg-emerald-600 hover:!bg-emerald-700 !text-white !border-emerald-600">
                  {busyId === o.id ? <Loading03Icon size={14} className="animate-spin" /> : 'Accept order'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
