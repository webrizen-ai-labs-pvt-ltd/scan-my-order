import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useOutletContext, useSearchParams } from 'react-router-dom';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@smo/ui';
import {
  Store01Icon,
  ShoppingCart01Icon,
  Invoice01Icon,
  Motorbike01Icon,
  Loading03Icon,
  Alert01Icon,
} from 'hugeicons-react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { usePosCartStore } from '../../store/pos-cart-store';
import { usePosStoreData } from '../../hooks/use-pos-store-data';
import { useStoreStream } from '../../hooks/use-store-stream';
import { PosToasts, usePosToasts } from '../../components/pos/pos-toasts';
import { GuestUpiConfirmations } from '../../components/pos/guest-upi-confirmations';
import { playNotificationChime } from '@smo/shared/audio';

// Who confirms guests' UPI payments to the store's own ID (the API enforces the same)
const GUEST_UPI_CONFIRM_ROLES = ['CASHIER', 'STORE_MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'];

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
  `flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold transition-colors ${
    isActive
      ? 'bg-zinc-900 text-white dark:bg-amber-500 dark:text-zinc-950'
      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
  }`;

// Small count next to a tab label; inherits the tab's colours so it reads on both states
const TabCount = ({ children }) => (
  <span className="min-w-[18px] px-1 rounded text-[10px] font-bold tabular-nums text-center bg-current/15">{children}</span>
);

const LIVE_DOT = {
  live: ['bg-emerald-500', 'Live'],
  connecting: ['bg-amber-400', 'Connecting'],
  reconnecting: ['bg-amber-400', 'Reconnecting'],
  revoked: ['bg-red-500', 'Offline'],
};

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
      <header className="shrink-0 h-12 px-3 bg-white dark:bg-zinc-900 border-b border-stone-200 dark:border-zinc-800 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {/* Store: also the store picker for people who run more than one */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-7 rounded-md bg-amber-400 dark:bg-amber-500 text-zinc-900 flex items-center justify-center shrink-0">
            <Store01Icon size={15} />
          </span>
          {!user?.store && stores.length > 1 ? (
            <Select value={selectedStoreId || undefined} onValueChange={setSelectedStoreId}>
              <SelectTrigger aria-label="Store" className="h-8 w-auto max-w-[240px] gap-1 px-2 border-0 bg-transparent text-sm font-semibold text-stone-900 dark:text-zinc-100 hover:bg-stone-100 dark:hover:bg-zinc-800">
                <SelectValue placeholder="Select store" />
              </SelectTrigger>
              <SelectContent>
                {stores.map(s => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm font-semibold text-stone-900 dark:text-zinc-100 truncate">{store?.name || 'POS'}</span>
          )}
        </div>

        <nav aria-label="POS sections" className="flex items-center gap-1">
          <NavLink to="/dashboard/pos" end className={tabClass}>
            <ShoppingCart01Icon size={14} />
            <span>New order</span>
            {cartCount > 0 && <TabCount>{cartCount}</TabCount>}
          </NavLink>
          <NavLink to="/dashboard/pos/orders" className={tabClass}>
            <Invoice01Icon size={14} />
            <span>Active orders</span>
            {stats?.activeCount > 0 && <TabCount>{stats.activeCount}</TabCount>}
          </NavLink>
          <NavLink to="/dashboard/pos/delivery" className={tabClass} title="Zomato & Swiggy orders — coming soon">
            <Motorbike01Icon size={14} />
            <span className="hidden lg:inline">Zomato / Swiggy</span>
            <span className="text-[10px] font-medium opacity-60">soon</span>
          </NavLink>
        </nav>

        <div className="flex items-center justify-end gap-4 min-w-0 text-xs text-stone-500 dark:text-zinc-400">
          <span className="hidden md:inline whitespace-nowrap">
            <strong className="font-semibold tabular-nums text-stone-900 dark:text-zinc-100">{stats?.totalToday ?? '–'}</strong> orders today
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap" title="Live updates from the kitchen, guests and other tills">
            <span className={`size-2 rounded-full ${(LIVE_DOT[streamStatus] || LIVE_DOT.connecting)[0]}`} />
            {(LIVE_DOT[streamStatus] || LIVE_DOT.connecting)[1]}
          </span>
        </div>
      </header>
      {(streamStatus === 'reconnecting' || streamStatus === 'revoked') && (
        <div role="status" className="shrink-0 px-4 py-1.5 bg-amber-100 dark:bg-amber-950/60 border-b border-amber-300 dark:border-amber-900 text-xs font-semibold text-amber-900 dark:text-amber-200 text-center">
          {streamStatus === 'revoked' ? 'Live updates stopped: please sign in again.' : 'Connection lost — reconnecting. Orders and tables will refresh when it’s back.'}
        </div>
      )}

      {selectedStoreId && GUEST_UPI_CONFIRM_ROLES.includes(user?.role) && (
        <GuestUpiConfirmations storeId={selectedStoreId} subscribe={subscribe} toast={toast} />
      )}

      <main className="flex-1 min-h-0 overflow-hidden relative">{renderContent()}</main>
      <PosToasts toasts={toasts} dismiss={dismiss} />
    </div>
  );
};
