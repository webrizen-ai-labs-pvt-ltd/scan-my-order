import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@smo/ui';
import { Loading03Icon, Store01Icon, Cancel01Icon, CheckmarkCircle02Icon, Alert02Icon } from 'hugeicons-react';
import api from '../lib/api';
import { useStoreSelection } from '../hooks/use-store-selection';
import { OrderActivity } from '../components/audit/order-activity';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const startOfDay = (daysAgo = 0) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
};

const RANGES = [
  { id: 'today', label: 'Today', from: () => startOfDay(0) },
  { id: 'yesterday', label: 'Yesterday', from: () => startOfDay(1), to: () => startOfDay(0) },
  { id: '7d', label: 'Last 7 days', from: () => startOfDay(6) },
  { id: '30d', label: 'Last 30 days', from: () => startOfDay(29) },
];

// One fixed colour per kind of leakage (it never changes with the filter or the ranking).
// Money-lost kinds use a colour-blind-safe set; dues and "worth a look" kinds stay neutral.
const SWATCH = {
  CANCELLED: 'bg-[#2a78d6] dark:bg-[#3987e5]',
  REJECTED: 'bg-[#eb6834] dark:bg-[#d95926]',
  COMPLIMENTARY: 'bg-[#1baf7a] dark:bg-[#199e70]',
  EDITED: 'bg-[#eda100] dark:bg-[#c98500]',
  DISCOUNT: 'bg-[#e87ba4] dark:bg-[#d55181]',
  REFUND: 'bg-[#008300]',
  DUES_REDUCED: 'bg-[#4a3aa7] dark:bg-[#9085e9]',
  DUES: 'bg-zinc-400 dark:bg-zinc-500',
  PAYMENT_WITHDRAWN: 'bg-zinc-400 dark:bg-zinc-500',
  INVOICE_CANCELLED: 'bg-zinc-400 dark:bg-zinc-500',
};

const card = 'rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900';
const eyebrow = 'text-[11px] font-semibold uppercase tracking-wider text-zinc-500';

/** What happened, in one line, from the details kept with the audit entry */
function describe(e) {
  const d = e.data || {};
  const list = (items) => (items || []).map(i => (typeof i === 'string' ? i : `${i.quantity}× ${i.name}`)).join(', ');
  switch (e.category) {
    case 'COMPLIMENTARY':
      return `Gave ${list(d.items)}${d.replaced?.length ? ` in place of ${list(d.replaced)}` : ''}`;
    case 'REJECTED':
      return `${list(d.items)}${d.wholeOrder ? ' (whole order)' : ''}`;
    case 'EDITED':
      return d.before && d.after ? `${list(d.before)} → ${list(d.after)}` : '';
    case 'CANCELLED':
      return e.afterKitchen ? 'Cancelled after it reached the kitchen' : 'Cancelled before cooking started';
    case 'DISCOUNT':
      return d.code ? `Code ${d.code}` : '';
    default:
      return '';
  }
}

const dayLabel = (iso) => {
  const d = new Date(iso);
  const today = startOfDay(0).getTime();
  const day = new Date(d).setHours(0, 0, 0, 0);
  if (day === today) return 'Today';
  if (day === today - 86400000) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
};

const Dot = ({ category, className = '' }) => <span aria-hidden="true" className={`inline-block size-2.5 rounded-sm shrink-0 ${SWATCH[category]} ${className}`} />;

/**
 * Leakage report: everything unusual that happened to orders after they were placed
 * (cancellations, edits, kitchen rejections, complimentary food, dues, refunds), with what it cost.
 */
export const Leakages = () => {
  const { storeId, setStoreId, stores, canSwitch } = useStoreSelection();
  const [range, setRange] = useState('today');
  const [category, setCategory] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [openOrderId, setOpenOrderId] = useState(null);

  const params = useMemo(() => {
    const r = RANGES.find(x => x.id === range);
    return { from: r.from().toISOString(), to: r.to ? r.to().toISOString() : undefined };
  }, [range]);

  const load = useCallback(async () => {
    if (!storeId) return;
    setError('');
    try {
      const res = await api.get(`/stores/${storeId}/audit/leakages`, { params });
      setData(res.data.data);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not load the leakage report');
    }
  }, [storeId, params]);

  useEffect(() => { load(); }, [load]);

  const all = useMemo(() => data?.categories || [], [data]);
  const lost = all.filter(c => c.kind === 'lost' && c.count > 0);
  const other = all.filter(c => c.kind !== 'lost' && c.count > 0);
  const lostTotal = data?.summary.lostAmount || 0;
  const labelOf = useMemo(() => Object.fromEntries(all.map(c => [c.key, c.label])), [all]);
  const maxPersonLost = Math.max(1, ...(data?.byPerson || []).map(p => p.lostAmount));

  // Incidents, newest first, grouped by day
  const days = useMemo(() => {
    const groups = [];
    for (const e of data?.events || []) {
      if (category && e.category !== category) continue;
      const label = dayLabel(e.createdAt);
      if (groups.at(-1)?.label !== label) groups.push({ label, events: [], amount: 0 });
      groups.at(-1).events.push(e);
      if (e.kind === 'lost') groups.at(-1).amount += e.leakAmount;
    }
    return groups;
  }, [data, category]);

  const toggle = (key) => setCategory(prev => (prev === key ? null : key));
  const biggest = [...lost].sort((a, b) => b.amount - a.amount)[0];

  return (
    <div className="flex flex-col gap-5 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Leakages</h1>
          <p className="text-sm text-zinc-500">What went wrong with orders after they were placed, who did it, and what it cost.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5">
            {RANGES.map(r => (
              <button key={r.id} type="button" aria-pressed={range === r.id} onClick={() => setRange(r.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium ${range === r.id ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}>
                {r.label}
              </button>
            ))}
          </div>
          {canSwitch && (
            <Select value={storeId || undefined} onValueChange={setStoreId}>
              <SelectTrigger className="w-[200px] h-8 text-xs"><Store01Icon size={14} className="mr-1.5 text-zinc-400" /><SelectValue placeholder="Store" /></SelectTrigger>
              <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
      </div>

      {error ? (
        <p className={`${card} p-4 text-sm text-rose-600`}>{error}</p>
      ) : !data ? (
        <div className="p-12 flex justify-center text-zinc-400"><Loading03Icon size={22} className="animate-spin" /></div>
      ) : data.summary.count === 0 ? (
        <div className={`${card} px-6 py-14 flex flex-col items-center text-center gap-2`}>
          <CheckmarkCircle02Icon size={32} className="text-emerald-600 dark:text-emerald-400" />
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Nothing unusual in this period</p>
          <p className="text-sm text-zinc-500 max-w-sm">Every order went through as it was placed: no cancellations, edits, rejections, free food, dues or refunds.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Money lost: the headline, and what it is made of */}
            <section aria-label="Money lost" className={`${card} lg:col-span-2 p-5 flex flex-col gap-4`}>
              <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                  <p className={eyebrow}>Money lost</p>
                  <p className="text-4xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">{money(lostTotal)}</p>
                </div>
                {biggest && lostTotal > 0 && (
                  <p className="text-sm text-zinc-500 text-right">
                    Biggest cause: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{biggest.label}</span>
                    <span className="block text-xs">{Math.round((biggest.amount / lostTotal) * 100)}% of the money lost</span>
                  </p>
                )}
              </div>

              {lostTotal > 0 && (
                <div className="flex h-3 gap-0.5" role="img" aria-label={`Money lost by kind: ${lost.map(c => `${c.label} ${money(c.amount)}`).join(', ')}`}>
                  {lost.filter(c => c.amount > 0).map(c => (
                    <button key={c.key} type="button" onClick={() => toggle(c.key)}
                      title={`${c.label}: ${money(c.amount)} (${Math.round((c.amount / lostTotal) * 100)}%)`}
                      style={{ flexGrow: c.amount, flexBasis: 0 }}
                      className={`min-w-1.5 first:rounded-l last:rounded-r ${SWATCH[c.key]} ${category && category !== c.key ? 'opacity-30' : ''}`}
                      aria-label={`Show only ${c.label}`} />
                  ))}
                </div>
              )}

              {lost.length === 0 ? (
                <p className="text-sm text-zinc-500">No money was lost in this period.</p>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  {lost.map(c => (
                    <li key={c.key}>
                      <button type="button" aria-pressed={category === c.key} onClick={() => toggle(c.key)} title={c.hint}
                        className={`w-full flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-md text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 ${category === c.key ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}>
                        <Dot category={c.key} />
                        <span className="flex-1 min-w-0 truncate text-zinc-700 dark:text-zinc-300">{c.label}</span>
                        <span className="text-xs text-zinc-400 tabular-nums">{c.count}×</span>
                        <span className="w-20 text-right font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{money(c.amount)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Not lost, but worth knowing */}
            <div className="flex flex-col gap-4">
              <section className={`${card} p-5 flex-1`}>
                <p className={eyebrow}>Not collected yet</p>
                <p className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{money(data.summary.riskAmount)}</p>
                <p className="text-xs text-zinc-500">
                  {data.summary.riskAmount > 0 ? 'Bills put on dues. Not lost unless they are never paid.' : 'No bills were put on dues.'}
                </p>
              </section>
              <section className={`${card} p-5 flex-1`}>
                <p className={eyebrow}>Incidents</p>
                <p className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{data.summary.count}</p>
                {other.length > 0 ? (
                  <ul className="mt-1 flex flex-col">
                    {other.map(c => (
                      <li key={c.key}>
                        <button type="button" aria-pressed={category === c.key} onClick={() => toggle(c.key)} title={c.hint}
                          className={`w-full flex items-center justify-between gap-2 py-1 px-2 -mx-2 rounded-md text-xs text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 ${category === c.key ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}>
                          <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400"><Alert02Icon size={12} /> {c.label}</span>
                          <span className="tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">{c.count}×</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-zinc-500">Times something unusual happened.</p>
                )}
              </section>
            </div>
          </div>

          {/* Who */}
          <section aria-label="By person" className={`${card} p-5`}>
            <p className={`${eyebrow} mb-3`}>By person</p>
            <ul className="flex flex-col gap-3">
              {data.byPerson.map(p => (
                <li key={p.actorId || p.actorName} className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)_90px] md:items-center gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{p.actorName}</span>
                    {p.actorRole && <span className="block text-[11px] text-zinc-500 capitalize">{p.actorRole.replaceAll('_', ' ').toLowerCase()}</span>}
                  </div>
                  <div className="min-w-0">
                    <div className="h-2 rounded bg-zinc-100 dark:bg-zinc-800" title={`${p.actorName}: ${money(p.lostAmount)} lost`}>
                      <div className="h-2 rounded bg-zinc-700 dark:bg-zinc-300" style={{ width: `${(p.lostAmount / maxPersonLost) * 100}%` }} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      {all.filter(c => p.counts[c.key]).map(c => (
                        <span key={c.key} className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                          <Dot category={c.key} className="size-2" /> {p.counts[c.key]}× {c.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="md:text-right text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{money(p.lostAmount)}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Each incident */}
          <section aria-label="What happened" className={card}>
            <div className="px-5 py-3 flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800">
              <p className={eyebrow}>What happened</p>
              {category && (
                <button type="button" onClick={() => setCategory(null)} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 pl-2 pr-1.5 py-0.5 text-xs text-zinc-700 dark:text-zinc-300 hover:border-zinc-400">
                  <Dot category={category} className="size-2" /> {labelOf[category]} <Cancel01Icon size={12} aria-label="Clear filter" />
                </button>
              )}
            </div>
            {days.length === 0 ? (
              <p className="p-8 text-center text-sm text-zinc-500">Nothing of this kind in this period.</p>
            ) : days.map(day => (
              <div key={day.label}>
                <div className="px-5 py-1.5 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-100 dark:border-zinc-800 text-[11px] font-semibold text-zinc-500">
                  <span>{day.label}</span>
                  {day.amount > 0 && <span className="tabular-nums">{money(day.amount)} lost</span>}
                </div>
                <ul>
                  {day.events.map(e => (
                    <li key={e.id} className="px-5 py-3 grid grid-cols-[64px_minmax(0,1fr)_auto] gap-x-3 border-b last:border-b-0 border-zinc-100 dark:border-zinc-800">
                      <span className="text-xs tabular-nums text-zinc-500 pt-0.5 whitespace-nowrap">
                        {new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          <Dot category={e.category} /> {labelOf[e.category]}
                        </p>
                        {describe(e) && <p className="text-xs text-zinc-600 dark:text-zinc-400 break-words">{describe(e)}</p>}
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
                          <span>by <span className="text-zinc-700 dark:text-zinc-300">{e.actorName}</span></span>
                          {e.reason && <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-zinc-700 dark:text-zinc-300 break-words">{e.reason}</span>}
                          {e.data?.table != null && <span>Table {e.data.table}</span>}
                          {e.orderId ? (
                            <button type="button" onClick={() => setOpenOrderId(e.orderId)} className="font-mono underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100" title="Show this order's full history">
                              #{e.orderId.slice(-6).toUpperCase()}
                            </button>
                          ) : <span>Table bill</span>}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{e.leakAmount ? money(e.leakAmount) : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {data.truncated && <p className="px-5 py-2 text-[11px] text-zinc-400 border-t border-zinc-100 dark:border-zinc-800">Showing the most recent entries only. Pick a shorter period for full totals.</p>}
          </section>
        </>
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
