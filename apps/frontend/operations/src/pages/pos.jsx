import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@smo/ui';
import {
  Store01Icon,
  ShoppingCart01Icon,
  Invoice01Icon,
  Calendar01Icon,
  Clock01Icon,
  Loading03Icon,
  Alert01Icon
} from 'hugeicons-react';
import { POSTerminal } from '../components/pos-terminal';
import { POSActiveOrders } from '../components/pos-active-orders';

/* ───────────────────────── Lightweight State Helpers ───────────────────────── */

const Spinner = ({ size = 14, className = '' }) => (
  <Loading03Icon size={size} className={`animate-spin ${className}`} />
);

const LoadingState = ({ label = 'Loading…' }) => (
  <div className="h-full flex flex-col items-center justify-center gap-3 text-stone-500 dark:text-zinc-400">
    <Spinner size={30} className="text-amber-600 dark:text-amber-400" />
    <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
  </div>
);

const EmptyState = ({ icon: Icon = Store01Icon, title, message }) => (
  <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
    <div className="size-12 rounded-full bg-stone-100 dark:bg-zinc-800 flex items-center justify-center text-stone-400 dark:text-zinc-500">
      <Icon size={22} />
    </div>
    <div className="flex flex-col gap-1 max-w-xs">
      <span className="text-sm font-bold text-stone-900 dark:text-zinc-100">{title}</span>
      {message && (
        <span className="text-xs leading-relaxed text-stone-500 dark:text-zinc-400">
          {message}
        </span>
      )}
    </div>
  </div>
);

/* ────────────────────────────────── POS Page ───────────────────────────────── */

export const POS = () => {
  const { user, token } = useAuthStore();

  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(user?.store?.id || null);
  const [activeTab, setActiveTab] = useState('terminal');
  const [storeData, setStoreData] = useState(user?.store || null);
  const [stats, setStats] = useState({ totalToday: 0, activeCount: 0 });

  // Loading states — kept separate per concern so the UI can react independently
  const [storesLoading, setStoresLoading] = useState(!user?.store);
  const [storeLoading, setStoreLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  // Null / error states — kept separate from loading
  const [storesError, setStoresError] = useState(null);
  const [storeError, setStoreError] = useState(null);

  // Keep a ref to storeData so effects can read it without adding it as a dep
  const storeDataRef = useRef(storeData);
  useEffect(() => {
    storeDataRef.current = storeData;
  }, [storeData]);

  /* ─── Load store list (multi-store users only) ─── */
  useEffect(() => {
    if (user?.store) {
      setStoresLoading(false);
      return;
    }

    let cancelled = false;
    setStoresLoading(true);
    setStoresError(null);

    api
      .get('/stores')
      .then(res => {
        if (cancelled) return;
        if (res.data.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
          setStores(res.data.data);
          setSelectedStoreId(prev => prev || res.data.data[0].id);
        } else if (res.data.success) {
          setStores([]);
        } else {
          setStoresError('Could not load your stores.');
        }
      })
      .catch(() => {
        if (!cancelled) setStoresError('Could not load your stores.');
      })
      .finally(() => {
        if (!cancelled) setStoresLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  /* ─── Load store details when selection changes ─── */
  useEffect(() => {
    if (!selectedStoreId) return;

    let cancelled = false;
    const hasCached = storeDataRef.current?.id === selectedStoreId;

    if (!hasCached) setStoreLoading(true);
    setStoreError(null);

    api
      .get(`/stores/${selectedStoreId}`)
      .then(res => {
        if (cancelled) return;
        if (res.data.success && res.data.data) {
          setStoreData(res.data.data);
        } else if (!hasCached) {
          setStoreData(null);
          setStoreError('This store could not be found.');
        }
      })
      .catch(() => {
        if (cancelled || hasCached) return;
        setStoreData(null);
        setStoreError("We couldn't reach this store.");
      })
      .finally(() => {
        if (!cancelled) setStoreLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStoreId]);

  /* ─── Poll active-order counts ─── */
  useEffect(() => {
    if (!selectedStoreId) return;

    let cancelled = false;
    let isFirstLoad = true;

    const fetchCounts = () => {
      if (isFirstLoad) setStatsLoading(true);
      api
        .get(`/stores/${selectedStoreId}/orders`)
        .then(res => {
          if (cancelled) return;
          if (res.data.success) {
            const orders = res.data.data || [];
            const active = orders.filter(o => !['SETTLED', 'CANCELLED'].includes(o.status));
            setStats({ totalToday: orders.length, activeCount: active.length });
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled && isFirstLoad) {
            setStatsLoading(false);
            isFirstLoad = false;
          }
        });
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedStoreId]);

  const formattedDate = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      }),
    []
  );

  /* ─── Main content resolution: loading / error / empty / ready ─── */
  const renderContent = () => {
    // 1. Store list is still being fetched
    if (storesLoading) return <LoadingState label="Loading stores…" />;

    // 2. Store list failed
    if (storesError) {
      return (
        <EmptyState
          icon={Alert01Icon}
          title="Unable to load stores"
          message={storesError}
        />
      );
    }

    // 3. User has no assigned store and none are available
    if (!user?.store && stores.length === 0) {
      return (
        <EmptyState
          icon={Store01Icon}
          title="No stores assigned"
          message="You don't have access to any stores yet. Please contact your administrator."
        />
      );
    }

    // 4. No store is currently selected
    if (!selectedStoreId) {
      return (
        <EmptyState
          icon={Store01Icon}
          title="Select a store"
          message="Choose a store from the header to start taking orders."
        />
      );
    }

    // 5. Store details still loading (no cached fallback)
    if (storeLoading && !storeData) return <LoadingState label="Loading store…" />;

    // 6. Store details failed / unavailable
    if (storeError || !storeData) {
      return (
        <EmptyState
          icon={Alert01Icon}
          title="Store unavailable"
          message={storeError || "We couldn't load this store's details."}
        />
      );
    }

    // 7. Ready — render both tabs, keeping mounted state across switches
    return (
      <>
        <div className={`h-full w-full ${activeTab === 'terminal' ? 'block' : 'hidden'}`}>
          <POSTerminal selectedStoreId={selectedStoreId} token={token} />
        </div>
        <div className={`h-full w-full ${activeTab === 'active_orders' ? 'block' : 'hidden'}`}>
          <POSActiveOrders selectedStoreId={selectedStoreId} token={token} />
        </div>
      </>
    );
  };

  const headerStoreName = storeData?.name || user?.store?.name;
  const showHeaderStoreLoader = storeLoading && !headerStoreName;

  return (
    <div className="flex flex-col h-full w-full bg-stone-100/50 dark:bg-zinc-950 overflow-hidden select-none">
      {/* ─── ULTRA-COMPACT POS MASTER HEADER (~56px) ─── */}
      <header className="shrink-0 h-14 px-4 bg-white dark:bg-zinc-900 border-b-2 border-stone-300 dark:border-zinc-700 flex items-center justify-between gap-4 shadow-sm">

        {/* Left: Brand / Store Name & Date */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-sm bg-amber-400 dark:bg-amber-500 text-zinc-900 flex items-center justify-center border border-amber-500/70 dark:border-amber-600/70 shadow-sm shrink-0">
            <Store01Icon size={17} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-[13px] tracking-wide uppercase text-stone-900 dark:text-zinc-100 truncate flex items-center gap-1.5">
              {showHeaderStoreLoader ? (
                <>
                  <Spinner size={11} className="text-amber-600 dark:text-amber-400" />
                  <span className="text-stone-400 dark:text-zinc-500 normal-case font-medium text-[11px] tracking-normal">
                    Loading store…
                  </span>
                </>
              ) : (
                headerStoreName || 'POS Terminal'
              )}
            </span>
            <span className="text-[10px] font-medium text-stone-500 dark:text-zinc-400 truncate flex items-center gap-1 tracking-wide">
              <Calendar01Icon size={11} className="text-amber-600 dark:text-amber-400" />
              {formattedDate}
            </span>
          </div>
        </div>

        {/* Center: Segmented Tab Group */}
        <div className="flex items-center">
          <div className="flex items-stretch rounded-full overflow-hidden border border-stone-300 dark:border-zinc-700 divide-x divide-stone-300 dark:divide-zinc-700 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab('terminal')}
              className={`flex items-center gap-2 h-9 px-4 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'terminal'
                  ? 'bg-amber-400 text-zinc-900 dark:bg-amber-500 dark:text-zinc-950'
                  : 'bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100'
              }`}
            >
              <ShoppingCart01Icon size={13} />
              <span>New Order</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('active_orders')}
              className={`flex items-center gap-2 h-9 px-4 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'active_orders'
                  ? 'bg-amber-400 text-zinc-900 dark:bg-amber-500 dark:text-zinc-950'
                  : 'bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100'
              }`}
            >
              <Invoice01Icon size={13} />
              <span>Active Orders</span>
              {!statsLoading && stats.activeCount > 0 && (
                <span
                  className={`ml-0.5 min-w-[18px] px-1 py-px rounded-sm text-[10px] font-bold tabular-nums border text-center leading-tight ${
                    activeTab === 'active_orders'
                      ? 'bg-zinc-900 text-amber-400 border-zinc-900'
                      : 'bg-amber-400 text-zinc-900 border-amber-500 dark:bg-amber-500 dark:text-zinc-950'
                  }`}
                >
                  {stats.activeCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Right: Stats & Store Selector */}
        <div className="flex items-center gap-1 shrink-0">

          {/* Total Orders Counter */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-l-full bg-stone-50 dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 text-[11px] font-medium text-stone-600 dark:text-zinc-300 tracking-wide">
            <Clock01Icon size={13} className="text-amber-600 dark:text-amber-400" />
            {statsLoading ? (
              <Spinner size={12} className="text-stone-400 dark:text-zinc-500" />
            ) : (
              <span>
                <strong className="text-stone-900 dark:text-zinc-100 font-bold tabular-nums">
                  {stats.totalToday}
                </strong>{' '}
                Orders
              </span>
            )}
          </div>

          {/* Store Switcher for Multi-store users */}
          {!user?.store &&
            (storesLoading ? (
              <div className="h-8.5 px-3 py-2 rounded-r-full bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 flex items-center gap-2 text-[11px] text-stone-500 dark:text-zinc-400">
                <Spinner size={12} className="text-amber-600 dark:text-amber-400" />
                <span>Loading…</span>
              </div>
            ) : stores.length > 0 ? (
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger className="w-[170px] h-8.5 text-xs rounded-r-full bg-white dark:bg-zinc-800 border-stone-300 dark:border-zinc-700">
                  <Store01Icon size={14} className="mr-1 text-stone-400" />
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="h-8.5 px-3 rounded-r-full bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 flex items-center gap-2 text-[11px] text-stone-500 dark:text-zinc-400">
                <Alert01Icon size={12} />
                <span>No stores</span>
              </div>
            ))}
        </div>
      </header>

      {/* ─── POS CONTENT AREA ─── */}
      <main className="flex-1 min-h-0 overflow-hidden relative">{renderContent()}</main>
    </div>
  );
};