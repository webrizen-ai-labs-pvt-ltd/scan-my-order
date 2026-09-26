import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@smo/ui';
import { Download04Icon, Loading03Icon, Search01Icon, Store01Icon } from 'hugeicons-react';
import api from '../lib/api';
import { useStoreSelection, downloadCsv } from '../hooks/use-store-selection';
import { InvoiceDialog } from '../components/invoices/invoice-dialog';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const monthStartIso = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };

const RANGES = [
  { id: 'today', label: 'Today', from: todayIso },
  { id: '7d', label: 'Last 7 days', from: () => daysAgoIso(6) },
  { id: 'month', label: 'This month', from: monthStartIso },
];
const KINDS = [
  { id: 'ALL', label: 'All documents' },
  { id: 'STANDARD', label: 'Regular bills' },
  { id: 'CORPORATE', label: 'Corporate invoices' },
  { id: 'CREDIT_NOTE', label: 'Credit notes' },
];
const KIND_LABEL = { STANDARD: 'Regular', CORPORATE: 'Corporate', CREDIT_NOTE: 'Credit note' };

/**
 * All GST invoices and credit notes issued by a store, for accounts and GST filing.
 */
export const Invoices = () => {
  const { storeId, setStoreId, stores, canSwitch } = useStoreSelection();
  const [range, setRange] = useState('today');
  const [kind, setKind] = useState('ALL');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  const params = useMemo(() => ({
    from: `${RANGES.find(r => r.id === range).from()}T00:00:00`,
    kind: kind === 'ALL' ? undefined : kind,
    q: q.trim() || undefined,
  }), [range, kind, q]);

  const load = useCallback(async () => {
    if (!storeId) return;
    setError('');
    try {
      const res = await api.get(`/stores/${storeId}/invoices`, { params: { ...params, page } });
      setData(res.data.data);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not load invoices');
    }
  }, [storeId, params, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [params, storeId]);

  const totals = data?.totals || [];
  const issued = totals.filter(t => t.kind !== 'CREDIT_NOTE');
  const credits = totals.find(t => t.kind === 'CREDIT_NOTE');
  const net = issued.reduce((s, t) => s + t.amount, 0) - (credits?.amount || 0);
  const netTax = issued.reduce((s, t) => s + t.tax, 0) - (credits?.tax || 0);

  return (
    <div className="flex flex-col gap-5 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Invoices</h1>
          <p className="text-sm text-zinc-500">GST bills, corporate invoices and credit notes. Numbers run in one series per store per financial year.</p>
        </div>
        <div className="flex items-center gap-2">
          {canSwitch && (
            <Select value={storeId || undefined} onValueChange={setStoreId}>
              <SelectTrigger className="w-[200px] h-9 text-sm"><Store01Icon size={15} className="mr-1.5 text-zinc-400" /><SelectValue placeholder="Store" /></SelectTrigger>
              <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" disabled={!storeId} onClick={() => downloadCsv(`/stores/${storeId}/invoices/export.csv`, params, `invoices-${todayIso()}.csv`)}>
            <Download04Icon size={15} className="mr-1.5" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5">
          {RANGES.map(r => (
            <button key={r.id} type="button" onClick={() => setRange(r.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium ${range === r.id ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900'}`}>
              {r.label}
            </button>
          ))}
        </div>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{KINDS.map(k => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}</SelectContent>
        </Select>
        <div className="relative">
          <Search01Icon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Number, company or GSTIN" aria-label="Search invoices"
            className="h-8 w-56 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-7 pr-2 text-xs outline-none" />
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-zinc-200 dark:divide-zinc-800 lg:divide-x overflow-hidden">
          {[
            { label: 'Invoiced', value: money(issued.reduce((s, t) => s + t.amount, 0)), detail: `${issued.reduce((s, t) => s + t.count, 0)} documents` },
            { label: 'Credit notes', value: money(credits?.amount || 0), detail: `${credits?.count || 0} issued` },
            { label: 'Net sales', value: money(net), detail: 'after credit notes' },
            { label: 'Net GST', value: money(netTax), detail: 'collected' },
          ].map((c, i) => (
            <div key={c.label} className={`p-4 ${i % 2 === 1 ? 'border-l lg:border-l-0' : ''} ${i >= 2 ? 'border-t lg:border-t-0' : ''} border-zinc-200 dark:border-zinc-800`}>
              <div className="text-xs text-zinc-500">{c.label}</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{c.value}</div>
              <div className="text-xs text-zinc-400">{c.detail}</div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
        {error ? (
          <p className="p-4 text-sm text-rose-600">{error}</p>
        ) : !data ? (
          <div className="p-8 flex justify-center text-zinc-400"><Loading03Icon size={20} className="animate-spin" /></div>
        ) : data.invoices.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">No invoices for these filters.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-2 font-medium">Number</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Bill to</th>
                <th className="px-3 py-2 font-medium text-right">Tax</th>
                <th className="px-3 py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map(inv => (
                <tr key={inv.id} onClick={() => setOpenId(inv.id)} className="border-b last:border-0 border-zinc-100 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="px-4 py-2 font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                    {inv.number}
                    {inv.status === 'CANCELLED' && <span className="ml-2 font-sans text-[10px] font-bold text-rose-600">CANCELLED</span>}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-zinc-500">{new Date(inv.issuedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                  <td className="px-3 py-2">
                    {KIND_LABEL[inv.kind]}
                    {inv.relatedNumber && <span className="block text-[10px] text-zinc-400">{inv.kind === 'CREDIT_NOTE' ? 'against' : 'replaces'} {inv.relatedNumber}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {inv.billTo?.name || <span className="text-zinc-400">Walk-in</span>}
                    {inv.billTo?.gstin && <span className="block font-mono text-[10px] text-zinc-400">{inv.billTo.gstin}</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{inv.kind === 'CREDIT_NOTE' ? '−' : ''}{money(inv.taxAmount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{inv.kind === 'CREDIT_NOTE' ? '−' : ''}{money(inv.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data?.pagination?.pages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{data.pagination.total} documents</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= data.pagination.pages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <InvoiceDialog storeId={storeId} invoiceId={openId} onClose={() => setOpenId(null)} onChanged={load} />
    </div>
  );
};
