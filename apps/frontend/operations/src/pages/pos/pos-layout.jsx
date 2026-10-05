import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useOutletContext, useSearchParams } from 'react-router-dom';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@smo/ui';
import {
  Store01Icon,
  ShoppingCart01Icon,
  Invoice01Icon,
  Motorbike01Icon,
  Calendar01Icon,
  Clock01Icon,
  Loading03Icon,
  Alert01Icon,
} from 'hugeicons-react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { usePosCartStore } from '../../store/pos-cart-store';
import { usePosStoreData } from '../../hooks/use-pos-store-data';
import { useStoreStream } from '../../hooks/use-store-stream';
import { PosToasts, usePosToasts } from '../../components/pos/pos-toasts';
import { playNotificationChime } from '@smo/shared/audio';

const Spinner = ({ size = 14, className = '' }) => (
  <Loading03Icon size={size} className={`animate-spin ${className}`} />
);

const CenteredState = ({ icon: Icon = Store01Icon, title, message, loading }) => (
  <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
    {loading ? (
      <Spinner size={30} className="text-amber-600 dark:text-amber-400" />
    ) : (
      <div className="size-12 rounded-full bg-stone-100 dark:bg-zinc-800 flex items-center justify-center text-stone-400 dark:text-zinc-500">
        <Icon size={22} />
      </div>
    )}
    <div className="flex flex-col gap-1 max-w-xs">
      <span className="text-sm font-bold text-stone-900 dark:text-zinc-100">{title}</span>
      {message && <span className="text-xs leading-relaxed text-stone-500 dark:text-zinc-400">{message}</span>}
    </div>
  </div>
);

// Table events change table occupancy; payment/settle events change running bills
const TABLE_EVENTS = new Set([
  'ORDER_PENDING_VERIFICATION', 'ORDER_PENDING_PAYMENT', 'ORDER_PROCESSING', 'ORDER_READY', 'ORDER_SERVED',
  'ORDER_SETTLED', 'ORDER_CANCELLED', 'ORDER_UPDATED', 'TABLE_UPDATED', 'TABLE_SESSION_SETTLED',
  'PAYMENT_UPDATED', 'RESERVATION_CREATED', 'RESERVATION_UPDATED', 'RESERVATION_DELETED',
]);

const tabClass = ({ isActive }) =>
  `flex items-center gap-2 h-9 px-4 text-[11px] font-bold uppercase tracking-wider transition-colors ${
    isActive
      ? 'bg-amber-400 text-zinc-900 dark:bg-amber-500 dark:text-zinc-950'
      : 'bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100'
  }`;

/**
 * Store-scoped data and helpers for every POS child page.
 * @returns {{ storeId: string, store: object, data: ReturnType<typeof usePosStoreData>, subscribe: Function, toast: Function, token: string }}
 */
export const usePos = () => useOutletContext();

/**
 * Frame shared by the POS child pages: store switcher, tabs and live store data.
 */
export const PosLayout = () => {
  const { user, token } = useAuthStore();
  const bindStore = usePosCartStore(s => s.bindStore);
  const cartCount = usePosCartStore(s => s.lines.reduce((n, l) => n + l.quantity, 0));

  const [stores, setStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(!user?.store);
  const [storesError, setStoresError] = useState(null);
  const [searchParams] = useSearchParams();
  // ?store=<id> lets other pages (e.g. Orders history) open the POS on a specific store
  const [selectedStoreId, setSelectedStoreId] = useState(user?.store?.id || searchParams.get('store') || null);
  const [stats, setStats] = useState(null);

  const { toasts, push: toast, dismiss } = usePosToasts();
  const data = usePosStoreData(selectedStoreId);
  const { subscribe, status: streamStatus } = useStoreStream(selectedStoreId, token);

  useEffect(() => { if (selectedStoreId) bindStore(selectedStoreId); }, [selectedStoreId, bindStore]);

  /* Store list (multi-store users only) */
  useEffect(() => {
    if (user?.store) return undefined;
    let cancelled = false;
    setStoresLoading(true);
    api.get('/stores')
      .then(res => {
        if (cancelled) return;
        const list = Array.isArray(res.data.data) ? res.data.data : [];
        setStores(list);
        setSelectedStoreId(prev => prev || list[0]?.id || null);
      })
      .catch(() => { if (!cancelled) setStoresError('Could not load your stores.'); })
      .finally(() => { if (!cancelled) setStoresLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  /* Header counters */
  useEffect(() => {
    if (!selectedStoreId) return undefined;
    let cancelled = false;
    const fetchStats = () => api.get(`/stores/${selectedStoreId}/orders/stats`)
      .then(res => { if (!cancelled && res.data.success) setStats(res.data.data); })
      .catch(() => {});
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    const unsubscribe = subscribe((msg) => { if (msg.type?.startsWith('ORDER_') || msg.type === 'STREAM_RECONNECTED') fetchStats(); });
    return () => { cancelled = true; clearInterval(interval); unsubscribe(); };
  }, [selectedStoreId, subscribe]);

  /* Kitchen couldn't make something: front-of-house must tell the guest */
  useEffect(() => subscribe((msg) => {
    if (msg.type !== 'ORDER_ITEMS_REJECTED') return;
    const e = msg.data || {};
    const where = e.tableNumber ? `Table ${e.tableNumber}` : `Order #${String(e.orderId || '').slice(-6).toUpperCase()}`;
    const money = e.refundDue > 0 ? ` Refund due ₹${e.refundDue}.` : e.wholeOrder ? ' Order cancelled.' : ' Bill updated.';
    playNotificationChime({ haptic: true }).catch(() => {});
    toast(`Kitchen: ${where} — ${(e.items || []).join(', ')} not available (${e.reason}).${money} Please inform the guest.`, 'error');
  }), [subscribe, toast]);

  /* Kitchen timing notices */
  useEffect(() => subscribe((msg) => {
    const e = msg.data || {};
    const where = e.tableNumber ? `Table ${e.tableNumber}` : `Order #${String(e.orderId || '').slice(-6).toUpperCase()}`;
    if (msg.type === 'ORDER_RECALLED') toast(`Kitchen recalled ${where} — don't serve it yet`, 'error');
    if (msg.type === 'ORDER_DELAYED') toast(`${where}: kitchen running ${e.minutes} min late (guest notified)`, 'info');
  }), [subscribe, toast]);

  /* Keep table occupancy live for every child page */
  const { refreshTables } = data;
  useEffect(() => subscribe((msg) => {
    // After a dropped connection, re-read tables in case updates were missed
    if (TABLE_EVENTS.has(msg.type) || msg.type === 'STREAM_RECONNECTED') refreshTables();
  }), [subscribe, refreshTables]);

  const formattedDate = useMemo(
    () => new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }),
    []
  );

  const store = data.store || user?.store || null;
  const outletContext = useMemo(
    () => ({ storeId: selectedStoreId, store, data, subscribe, toast, token }),
    [selectedStoreId, store, data, subscribe, toast, token]
  );

  const renderContent = () => {
    if (storesLoading) return <CenteredState loading title="Loading stores…" />;
    if (storesError) return <CenteredState icon={Alert01Icon} title="Unable to load stores" message={storesError} />;
    if (!user?.store && stores.length === 0) {
      return <CenteredState title="No stores assigned" message="You don't have access to any stores yet. Please contact your administrator." />;
    }
    if (!selectedStoreId) return <CenteredState title="Select a store" message="Choose a store from the header to start taking orders." />;
    if (data.isLoading) return <CenteredState loading title="Loading POS…" />;
    if (data.error && data.menu.length === 0) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-4">
          <CenteredState icon={Alert01Icon} title="Unable to load the POS" message={data.error} />
          <button
            type="button"
            onClick={data.reload}
            className="py-2 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs"
          >
            Retry
          </button>
        </div>
      );
    }
    return <Outlet context={outletContext} />;
  };

  return (
    <div className="flex flex-col h-full w-full bg-stone-100/50 dark:bg-zinc-950 overflow-hidden">
      <header className="shrink-0 h-14 px-4 bg-white dark:bg-zinc-900 border-b-2 border-stone-300 dark:border-zinc-700 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-sm bg-amber-400 dark:bg-amber-500 text-zinc-900 flex items-center justify-center border border-amber-500/70 shadow-sm shrink-0">
            <Store01Icon size={17} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-[13px] tracking-wide uppercase text-stone-900 dark:text-zinc-100 truncate">
              {store?.name || 'POS Terminal'}
            </span>
            <span className="text-[10px] font-medium text-stone-500 dark:text-zinc-400 truncate flex items-center gap-1 tracking-wide">
              <Calendar01Icon size={11} className="text-amber-600 dark:text-amber-400" />
              {formattedDate}
            </span>
          </div>
        </div>

        <nav aria-label="POS sections" className="flex items-stretch rounded-full overflow-hidden border border-stone-300 dark:border-zinc-700 divide-x divide-stone-300 dark:divide-zinc-700 shadow-sm">
          <NavLink to="/dashboard/pos" end className={tabClass}>
            <ShoppingCart01Icon size={13} />
            <span>New Order</span>
            {cartCount > 0 && (
              <span className="ml-0.5 min-w-[18px] px-1 rounded-sm text-[10px] font-bold tabular-nums bg-zinc-900 text-amber-400 text-center">
                {cartCount}
              </span>
            )}
          </NavLink>
          <NavLink to="/dashboard/pos/orders" className={tabClass}>
            <Invoice01Icon size={13} />
            <span>Active Orders</span>
            {stats?.activeCount > 0 && (
              <span className="ml-0.5 min-w-[18px] px-1 rounded-sm text-[10px] font-bold tabular-nums bg-zinc-900 text-amber-400 text-center">
                {stats.activeCount}
              </span>
            )}
          </NavLink>
          <NavLink to="/dashboard/pos/delivery" className={tabClass} title="Zomato & Swiggy orders — coming soon">
            <Motorbike01Icon size={13} />
            <span>Zomato / Swiggy</span>
            <span className="ml-0.5 px-1 rounded-sm text-[9px] font-black bg-zinc-900 text-amber-400">SOON</span>
          </NavLink>
        </nav>

        <div className="flex items-center gap-1 shrink-0">
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-l-full bg-stone-50 dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 text-[11px] font-medium text-stone-600 dark:text-zinc-300">
            <Clock01Icon size={13} className="text-amber-600 dark:text-amber-400" />
            <span>
              <strong className="text-stone-900 dark:text-zinc-100 font-bold tabular-nums">{stats?.totalToday ?? '–'}</strong> Orders today
            </span>
          </div>
          {!user?.store && stores.length > 0 && (
            <Select value={selectedStoreId || undefined} onValueChange={setSelectedStoreId}>
              <SelectTrigger className="w-[170px] h-8.5 text-xs rounded-r-full bg-white dark:bg-zinc-800 border-stone-300 dark:border-zinc-700">
                <Store01Icon size={14} className="mr-1 text-stone-400" />
                <SelectValue placeholder="Select store" />
              </SelectTrigger>
              <SelectContent>
                {stores.map(s => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </header>
      {(streamStatus === 'reconnecting' || streamStatus === 'revoked') && (
        <div role="status" className="shrink-0 px-4 py-1.5 bg-amber-100 dark:bg-amber-950/60 border-b border-amber-300 dark:border-amber-900 text-xs font-semibold text-amber-900 dark:text-amber-200 text-center">
          {streamStatus === 'revoked' ? 'Live updates stopped: please sign in again.' : 'Connection lost — reconnecting. Orders and tables will refresh when it’s back.'}
        </div>
      )}

      <main className="flex-1 min-h-0 overflow-hidden relative">{renderContent()}</main>
      <PosToasts toasts={toasts} dismiss={dismiss} />
    </div>
  );
};
