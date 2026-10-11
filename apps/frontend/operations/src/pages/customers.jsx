import React, { useCallback, useEffect, useState } from 'react';
import { Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@smo/ui';
import { Loading03Icon, Search01Icon, Store01Icon, UserGroupIcon, Cancel01Icon } from 'hugeicons-react';
import api from '../lib/api';
import { useStoreSelection } from '../hooks/use-store-selection';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const formatPhone = (p) => (p && p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p || '');
const day = (iso) => (iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

// Where a customer ordered from
const SOURCES = [
  { id: 'ALL', label: 'All', count: 'all' },
  { id: 'COUNTER', label: 'Counter', count: 'COUNTER' },
  { id: 'QR_MENU', label: 'QR menu', count: 'QR_MENU' },
  { id: 'WAITER', label: 'Waiter', count: 'WAITER' },
];
const SOURCE_LABEL = { COUNTER: 'Counter', QR_MENU: 'QR menu', WAITER: 'Waiter' };

// Whether the store can reach the customer's phone with a notification
const NOTIFY = {
  OFFERS: { label: 'Offers allowed', hint: 'Allowed notifications and agreed to get offers. Campaigns reach this customer.', tone: 'border-emerald-300 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400' },
  ALERTS: { label: 'Order alerts only', hint: 'Allowed notifications about their orders, but not offers. Campaigns do not reach them.', tone: 'border-zinc-300 text-zinc-600 dark:border-zinc-600 dark:text-zinc-400' },
  NONE: { label: 'Not allowed', hint: 'No phone of this customer has allowed notifications.', tone: '' },
};
const NOTIFY_FILTERS = [
  { id: 'ANY', label: 'Any notification setting' },
  { id: 'OFFERS', label: 'Offers allowed' },
  { id: 'ALERTS', label: 'Order alerts only' },
  { id: 'NONE', label: 'Not allowed' },
];

const SORTS = [
  { id: 'recent', label: 'Most recent visit' },
  { id: 'visits', label: 'Most visits' },
  { id: 'spend', label: 'Highest spend' },
];

/**
 * Customer directory: everyone this brand can recognise again, from every way of ordering:
 * a mobile number on a counter or waiter bill, a QR-menu guest's number, or a QR-menu Google sign-in.
 * The list fills itself from orders; nothing is entered here.
 */
export const Customers = () => {
  const { storeId, setStoreId, stores, canSwitch } = useStoreSelection();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState(''); // search, once typing pauses
  const [sort, setSort] = useState('recent');
  const [source, setSource] = useState('ALL');
  const [notify, setNotify] = useState('ANY');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    if (!storeId) return;
    setError('');
    try {
      const res = await api.get(`/stores/${storeId}/orders/customers/directory`, { params: { q: q || undefined, sort, source: source === 'ALL' ? undefined : source, notifications: notify === 'ANY' ? undefined : notify, page, limit: 25 } });
      setData(res.data.data);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not load the customer directory');
    }
  }, [storeId, q, sort, source, notify, page]);

  useEffect(() => { load(); }, [load]);

  const customers = data?.customers || [];
  const total = data?.pagination?.total ?? 0;

  return (
    <div className="flex flex-col gap-5 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Customers</h1>
          <p className="text-sm text-zinc-500">Everyone who ordered at the counter, through a waiter, or from the QR menu and left a mobile number or signed in. The list fills itself.</p>
        </div>
        {canSwitch && (
          <Select value={storeId || undefined} onValueChange={(id) => { setStoreId(id); setPage(1); }}>
            <SelectTrigger className="w-[200px] h-9 text-sm"><Store01Icon size={15} className="mr-1.5 text-zinc-400" /><SelectValue placeholder="Store" /></SelectTrigger>
            <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5" role="radiogroup" aria-label="Ordered from">
          {SOURCES.map(o => (
            <button key={o.id} type="button" role="radio" aria-checked={source === o.id} onClick={() => { setSource(o.id); setPage(1); }}
              className={`px-2.5 h-8 rounded-md text-xs font-medium ${source === o.id ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}>
              {o.label}{data?.counts && <span className="ml-1.5 tabular-nums opacity-70">{data.counts[o.count] ?? 0}</span>}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 h-9 w-full sm:w-80 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 focus-within:border-amber-500">
          <Search01Icon size={15} className="text-zinc-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, mobile or email" aria-label="Search customers"
            className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-zinc-400" />
          {search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"><Cancel01Icon size={14} /></button>}
        </label>
        <Select value={notify} onValueChange={(v) => { setNotify(v); setPage(1); }}>
          <SelectTrigger className="w-[210px] h-9 text-sm" aria-label="Notifications"><SelectValue /></SelectTrigger>
          <SelectContent>
            {NOTIFY_FILTERS.map(o => (
              <SelectItem key={o.id} value={o.id}>{o.label}{o.id !== 'ANY' && data?.counts?.notifications ? ` (${data.counts.notifications[o.id] ?? 0})` : ''}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
          <SelectTrigger className="w-[190px] h-9 text-sm" aria-label="Sort by"><SelectValue /></SelectTrigger>
          <SelectContent>{SORTS.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
        {data && <span className="text-xs text-zinc-500 ml-auto tabular-nums">{total} {total === 1 ? 'customer' : 'customers'}</span>}
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
        {error ? (
          <p className="p-4 text-sm text-rose-600">{error}</p>
        ) : !data ? (
          <div className="p-10 flex justify-center text-zinc-400"><Loading03Icon size={20} className="animate-spin" /></div>
        ) : customers.length === 0 ? (
          <div className="px-6 py-14 flex flex-col items-center text-center gap-2">
            <UserGroupIcon size={30} className="text-zinc-300 dark:text-zinc-600" />
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{q || source !== 'ALL' || notify !== 'ANY' ? 'No customer matches' : 'No customers yet'}</p>
            <p className="text-sm text-zinc-500 max-w-sm">
              {q ? 'Check the spelling, or search by mobile number instead.' : notify !== 'ANY' ? 'No customer has this notification setting.' : source !== 'ALL' ? 'Nobody has ordered this way yet.' : 'Enter the customer’s mobile number on a bill, or have guests order from the QR menu, and they will appear here.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-3 py-2.5 font-medium">Mobile</th>
                <th className="px-3 py-2.5 font-medium">Ordered from</th>
                <th className="px-3 py-2.5 font-medium">Notifications</th>
                <th className="px-3 py-2.5 font-medium text-right">Visits</th>
                <th className="px-3 py-2.5 font-medium text-right">Total spent</th>
                <th className="px-3 py-2.5 font-medium">Last visit</th>
                <th className="px-4 py-2.5 font-medium">First visit</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.key} className="border-b last:border-0 border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2.5">
                    <span className={c.name ? 'font-semibold text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'}>{c.name || 'No name saved'}</span>
                    {c.visits >= 5 && <span className="ml-2 rounded border border-amber-300 dark:border-amber-500/40 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">Regular</span>}
                    {c.email && <span className="block text-xs text-zinc-500 truncate max-w-[260px]" title="Signed in on the QR menu">{c.email}</span>}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                    {c.phone
                      ? <a href={`tel:+91${c.phone}`} className="text-zinc-700 dark:text-zinc-300 hover:underline">{formatPhone(c.phone)}</a>
                      : <span className="text-zinc-400" title="This customer signed in but never gave a mobile number">Not given</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex flex-wrap gap-1">
                      {c.sources.map(src => (
                        <span key={src} className="rounded border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{SOURCE_LABEL[src]}</span>
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {c.notifications === 'NONE'
                      ? <span className="text-xs text-zinc-400" title={NOTIFY.NONE.hint}>{NOTIFY.NONE.label}</span>
                      : <span title={NOTIFY[c.notifications].hint} className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${NOTIFY[c.notifications].tone}`}>{NOTIFY[c.notifications].label}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{c.visits}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">{money(c.totalSpent)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-zinc-600 dark:text-zinc-400">{day(c.lastVisitAt)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-zinc-600 dark:text-zinc-400">{day(c.firstVisitAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data?.pagination?.pages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Page {data.pagination.page} of {data.pagination.pages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= data.pagination.pages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
};
