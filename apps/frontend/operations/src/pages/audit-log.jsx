import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@smo/ui';
import { Download04Icon, Loading03Icon, Search01Icon, Store01Icon, Cancel01Icon } from 'hugeicons-react';
import api from '../lib/api';
import { useStoreSelection, downloadCsv } from '../hooks/use-store-selection';
import { OrderActivity } from '../components/audit/order-activity';

const money = (n) => (n == null ? '' : `₹${Number(n).toLocaleString('en-IN')}`);
const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const RANGES = [
  { id: 'today', label: 'Today', from: () => todayIso() },
  { id: '7d', label: 'Last 7 days', from: () => daysAgoIso(6) },
  { id: '30d', label: 'Last 30 days', from: () => daysAgoIso(29) },
];

const COUNT_COLUMNS = [
  { type: 'ITEMS_EDITED', label: 'Edits' },
  { type: 'ORDER_CANCELLED', label: 'Cancels' },
  { type: 'ITEMS_REJECTED', label: 'Kitchen rejections' },
  { type: 'REFUND_ISSUED', label: 'Refunds' },
  { type: 'PAYMENT_CONFIRMED', label: 'UPI confirmed' },
  { type: 'INVOICE_CANCELLED', label: 'Invoices cancelled' },
];

const TONE = {
  ORDER_CANCELLED: 'text-rose-600 dark:text-rose-400',
  ITEMS_REJECTED: 'text-rose-600 dark:text-rose-400',
  REFUND_ISSUED: 'text-rose-600 dark:text-rose-400',
  INVOICE_CANCELLED: 'text-rose-600 dark:text-rose-400',
  ITEMS_EDITED: 'text-amber-600 dark:text-amber-400',
};

/**
 * Store-wide audit log: who changed what on which order, and why.
 */
export const AuditLog = () => {
  const { storeId, setStoreId, stores, canSwitch } = useStoreSelection();
  const [range, setRange] = useState('today');
  const [type, setType] = useState('ALL');
  const [actorId, setActorId] = useState('ALL');
  const [orderSearch, setOrderSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [openOrderId, setOpenOrderId] = useState(null);

  const params = useMemo(() => ({
    from: `${RANGES.find(r => r.id === range).from()}T00:00:00`,
    type: type === 'ALL' ? undefined : type,
    actorId: actorId === 'ALL' ? undefined : actorId,
    orderId: orderSearch.trim() || undefined,
  }), [range, type, actorId, orderSearch]);

  const load = useCallback(async () => {
    if (!storeId) return;
    setError('');
    try {
      const res = await api.get(`/stores/${storeId}/audit`, { params: { ...params, page, limit: 50 } });
      setData(res.data.data);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not load the audit log');
    }
  }, [storeId, params, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [params, storeId]);

  const people = data?.byPerson || [];

  return (
    <div className="flex flex-col gap-5 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Audit log</h1>
          <p className="text-sm text-zinc-500">Every change to orders, payments, refunds and invoices — who did it, when and why. Entries can’t be edited or deleted.</p>
        </div>
        <div className="flex items-center gap-2">
          {canSwitch && (
            <Select value={storeId || undefined} onValueChange={setStoreId}>
              <SelectTrigger className="w-[200px] h-9 text-sm"><Store01Icon size={15} className="mr-1.5 text-zinc-400" /><SelectValue placeholder="Store" /></SelectTrigger>
              <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" disabled={!storeId} onClick={() => downloadCsv(`/stores/${storeId}/audit/export.csv`, params, `audit-${todayIso()}.csv`)}>
            <Download04Icon size={15} className="mr-1.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5">
          {RANGES.map(r => (
            <button key={r.id} type="button" onClick={() => setRange(r.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium ${range === r.id ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900'}`}>
              {r.label}
            </button>
          ))}
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[190px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All actions</SelectItem>
            {Object.entries(data?.eventTypes || {}).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={actorId} onValueChange={setActorId}>
          <SelectTrigger className="w-[170px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Everyone</SelectItem>
            {people.filter(p => p.actorId).map(p => <SelectItem key={p.actorId} value={p.actorId}>{p.actorName}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search01Icon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={orderSearch}
            onChange={e => setOrderSearch(e.target.value)}
            placeholder="Order ID"
            aria-label="Search by order ID"
            className="h-8 w-40 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-7 pr-2 text-xs outline-none"
          />
        </div>
      </div>

      {/* Per-person counts */}
      {people.length > 0 && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-2 font-medium">Person</th>
                {COUNT_COLUMNS.map(c => <th key={c.type} className="px-3 py-2 font-medium text-right">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {people.map(p => (
                <tr key={p.actorId || p.actorName} className="border-b last:border-0 border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{p.actorName}</span>
                    {p.actorRole && <span className="ml-1.5 text-zinc-400">{p.actorRole.replace('_', ' ').toLowerCase()}</span>}
                  </td>
                  {COUNT_COLUMNS.map(c => (
                    <td key={c.type} className={`px-3 py-2 text-right tabular-nums ${p.counts[c.type] ? 'text-zinc-900 dark:text-zinc-100 font-semibold' : 'text-zinc-300 dark:text-zinc-700'}`}>
                      {p.counts[c.type] || 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Events */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
        {error ? (
          <p className="p-4 text-sm text-rose-600">{error}</p>
        ) : !data ? (
          <div className="p-8 flex justify-center text-zinc-400"><Loading03Icon size={20} className="animate-spin" /></div>
        ) : data.events.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">No activity for these filters.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">By</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map(e => (
                <tr key={e.id} className="border-b last:border-0 border-zinc-100 dark:border-zinc-800 align-top">
                  <td className="px-4 py-2 whitespace-nowrap tabular-nums text-zinc-500">
                    {new Date(e.createdAt).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className={`px-3 py-2 font-semibold ${TONE[e.type] || 'text-zinc-900 dark:text-zinc-100'}`}>{e.label}</td>
                  <td className="px-3 py-2">
                    {e.orderId ? (
                      <button type="button" onClick={() => setOpenOrderId(e.orderId)} className="font-mono underline text-zinc-700 dark:text-zinc-300" title="Show this order's full history">
                        #{e.orderId.slice(-6).toUpperCase()}
                      </button>
                    ) : e.tableSessionId ? <span className="text-zinc-500">Table bill</span> : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-zinc-900 dark:text-zinc-100">{e.actorName}</span>
                    <span className="block text-[10px] text-zinc-400">{e.source.toLowerCase().replace('_', ' ')}</span>
                  </td>
                  <td className="px-3 py-2 max-w-[280px] text-zinc-600 dark:text-zinc-400">{e.reason || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {e.amountBefore != null && e.amountAfter != null && e.amountBefore !== e.amountAfter
                      ? <>{money(e.amountBefore)} → {money(e.amountAfter)}</>
                      : money(e.amountAfter)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data?.pagination?.pages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{data.pagination.total} entries</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= data.pagination.pages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {openOrderId && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Order history">
          <div className="w-full sm:max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-base font-semibold">Order #{openOrderId.slice(-6).toUpperCase()} history</h2>
              <button type="button" aria-label="Close" onClick={() => setOpenOrderId(null)} className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"><Cancel01Icon size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5"><OrderActivity storeId={storeId} orderId={openOrderId} /></div>
          </div>
        </div>
      )}
    </div>
  );
};
