import React, { useCallback, useEffect, useState } from 'react';
import { Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@smo/ui';
import { Loading03Icon, Search01Icon, Store01Icon, UserGroupIcon, Cancel01Icon } from 'hugeicons-react';
import api from '../lib/api';
import { useStoreSelection } from '../hooks/use-store-selection';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const formatPhone = (p) => (p && p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p || '');
const day = (iso) => (iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

const SORTS = [
  { id: 'recent', label: 'Most recent visit' },
  { id: 'visits', label: 'Most visits' },
  { id: 'spend', label: 'Highest spend' },
];

/**
 * Customer directory: everyone who gave a mobile number on a bill at this brand's stores.
 * The list fills itself from orders; nothing is entered here.
 */
export const Customers = () => {
  const { storeId, setStoreId, stores, canSwitch } = useStoreSelection();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState(''); // search, once typing pauses
  const [sort, setSort] = useState('recent');
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
      const res = await api.get(`/stores/${storeId}/orders/customers/directory`, { params: { q: q || undefined, sort, page, limit: 25 } });
      setData(res.data.data);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not load the customer directory');
    }
  }, [storeId, q, sort, page]);

  useEffect(() => { load(); }, [load]);

  const customers = data?.customers || [];
  const total = data?.pagination?.total ?? 0;

  return (
    <div className="flex flex-col gap-5 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Customers</h1>
          <p className="text-sm text-zinc-500">Everyone who gave a mobile number on a bill. The list fills itself as bills are saved.</p>
        </div>
        {canSwitch && (
          <Select value={storeId || undefined} onValueChange={(id) => { setStoreId(id); setPage(1); }}>
            <SelectTrigger className="w-[200px] h-9 text-sm"><Store01Icon size={15} className="mr-1.5 text-zinc-400" /><SelectValue placeholder="Store" /></SelectTrigger>
            <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 h-9 w-full sm:w-80 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 focus-within:border-amber-500">
          <Search01Icon size={15} className="text-zinc-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or mobile number" aria-label="Search customers"
            className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-zinc-400" />
          {search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"><Cancel01Icon size={14} /></button>}
        </label>
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
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{q ? 'No customer matches' : 'No customers yet'}</p>
            <p className="text-sm text-zinc-500 max-w-sm">
              {q ? 'Check the spelling, or search by mobile number instead.' : 'Enter the customer’s mobile number on a bill in the POS and they will appear here.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-3 py-2.5 font-medium">Mobile</th>
                <th className="px-3 py-2.5 font-medium text-right">Visits</th>
                <th className="px-3 py-2.5 font-medium text-right">Total spent</th>
                <th className="px-3 py-2.5 font-medium">Last visit</th>
                <th className="px-4 py-2.5 font-medium">First visit</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.phone} className="border-b last:border-0 border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2.5">
                    <span className={c.name ? 'font-semibold text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'}>{c.name || 'No name saved'}</span>
                    {c.visits >= 5 && <span className="ml-2 rounded border border-amber-300 dark:border-amber-500/40 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">Regular</span>}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                    <a href={`tel:+91${c.phone}`} className="text-zinc-700 dark:text-zinc-300 hover:underline">{formatPhone(c.phone)}</a>
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
