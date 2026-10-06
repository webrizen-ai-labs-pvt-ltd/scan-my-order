import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Loading03Icon, Settings01Icon, Menu01Icon, QrCodeIcon, Tag01Icon, ZapIcon, Coins01Icon,
  ArrowLeft01Icon, LinkSquare02Icon,
} from 'hugeicons-react';
import api from '../lib/api';
import { StoreSettings } from '../components/store/store-settings';
import { StoreMenuManager } from '../components/store-menu-manager';
import { StoreMenuBuilder } from '../components/store-menu-builder';
import { StoreTablesManager } from '../components/store-tables-manager';
import { StorePromoManager } from '../components/store-promo-manager';
import { StoreLoyaltyManager } from '../components/store-loyalty-manager';
import { menuUrlFor } from '../lib/menu-url';

const TABS = [
  { id: 'details', label: 'Details', icon: Settings01Icon },
  { id: 'menu', label: 'Menu', icon: Menu01Icon },
  { id: 'smart', label: 'Smart builder', icon: ZapIcon },
  { id: 'tables', label: 'Tables & QR', icon: QrCodeIcon },
  { id: 'promos', label: 'Promo codes', icon: Tag01Icon },
  { id: 'rewards', label: 'Rewards & wallet', icon: Coins01Icon },
];

const STATUS_PILL = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  SUSPENDED: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  DISABLED: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
};

/**
 * /dashboard/stores/:id/edit — one store: details, menu, tables, promos and rewards.
 * The open tab is kept in the URL (?tab=).
 */
export const StoreEdit = () => {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const [store, setStore] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stale = false;
    setStore(null);
    setError('');
    api.get(`/stores/${id}`)
      .then(res => { if (!stale) setStore(res.data.data); })
      .catch(err => { if (!stale) setError(err.response?.data?.error?.message || 'Could not load this store'); });
    return () => { stale = true; };
  }, [id]);

  const active = TABS.some(t => t.id === params.get('tab')) ? params.get('tab') : 'details';
  const setTab = (tab) => setParams(tab === 'details' ? {} : { tab }, { replace: true });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-red-600">{error}</p>
        <Link to="/dashboard/stores" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:underline">Back to stores</Link>
      </div>
    );
  }
  if (!store) {
    return <div className="flex items-center justify-center h-64 text-zinc-400"><Loading03Icon className="animate-spin" size={28} /></div>;
  }

  const menuUrl = store.tenant?.slug ? menuUrlFor(store.tenant.slug, store.slug) : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Link to="/dashboard/stores" className="self-start inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          <ArrowLeft01Icon size={14} /> All stores
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 truncate">{store.name}</h1>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${STATUS_PILL[store.status] || STATUS_PILL.DISABLED}`}>
                {String(store.status || '').charAt(0) + String(store.status || '').slice(1).toLowerCase()}
              </span>
              {store.serviceMode === 'COUNTER' && (
                <span
                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30"
                  title="Guests order from the venue's QR: takeaway, paid on their phone, collected with a pickup number. Set by Scan My Order."
                >
                  Counter{store.venueLocation ? ` · ${store.venueLocation}` : ''}
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-500 truncate">{store.address || 'No address yet'}</p>
          </div>
          {menuUrl && (
            <a href={menuUrl} target="_blank" rel="noreferrer" className="self-start sm:self-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <LinkSquare02Icon size={15} /> Open QR menu
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <nav aria-label="Store sections" className="border-b border-zinc-200 dark:border-zinc-800 -mt-1">
        <ul className="flex gap-1 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon;
            const on = active === t.id;
            return (
              <li key={t.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-current={on ? 'page' : undefined}
                  className={`relative flex items-center gap-2 px-3 py-2.5 text-sm font-medium ${on
                    ? 'text-zinc-900 dark:text-zinc-50'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                >
                  <Icon size={16} className={on ? '' : 'text-zinc-400'} />
                  {t.label}
                  {on && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-zinc-900 dark:bg-zinc-100" />}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Content */}
      {active === 'details' && (
        <StoreSettings key={store.id} store={store} onSaved={(updated) => setStore(prev => ({ ...prev, ...updated, tenant: updated.tenant || prev.tenant }))} />
      )}
      {active !== 'details' && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden min-h-[480px]">
          {active === 'menu' && <StoreMenuManager storeId={store.id} />}
          {active === 'smart' && <div className="p-6"><StoreMenuBuilder storeId={store.id} /></div>}
          {active === 'tables' && <StoreTablesManager storeId={store.id} storeSlug={store.slug} brandSlug={store.tenant?.slug} storeName={store.name} brandLogo={store.tenant?.logo} />}
          {active === 'promos' && <StorePromoManager storeId={store.id} />}
          {active === 'rewards' && <StoreLoyaltyManager storeId={store.id} />}
        </div>
      )}
    </div>
  );
};
