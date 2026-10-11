import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@smo/ui';
import { ArrowUp01Icon, ArrowDown01Icon, Search01Icon, ArrowUpRight01Icon, ArrowDownRight01Icon } from 'hugeicons-react';
import api from '../lib/api';

const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const compact = (n) => (n >= 100000 ? `₹${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `₹${n}`);
const shortDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const dayAndMonth = (date) => new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const ago = (date) => {
  if (!date) return 'No sales';
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
};

const card = 'rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900';
const eyebrow = 'text-[11px] font-semibold uppercase tracking-wider text-zinc-500';
const PERIODS = [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days']];

/** Up or down against the period before, with an arrow as well as colour. Null = nothing to compare with. */
const Change = ({ value, fallback = '—', className = '' }) => {
  if (value === null || value === undefined) return <span className={`text-zinc-400 ${className}`}>{fallback}</span>;
  const up = value >= 0;
  const Icon = up ? ArrowUpRight01Icon : ArrowDownRight01Icon;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${up ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'} ${className}`}>
      <Icon size={14} aria-hidden="true" />{up ? '+' : '−'}{Math.abs(value)}%
    </span>
  );
};

const MOVEMENT = {
  GROWING: ['Growing', 'border-emerald-300 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400'],
  FALLING: ['Falling', 'border-red-300 text-red-600 dark:border-red-500/40 dark:text-red-400'],
  NEW: ['New', 'border-sky-300 text-sky-700 dark:border-sky-500/40 dark:text-sky-400'],
  STARTED: ['Started selling', 'border-sky-300 text-sky-700 dark:border-sky-500/40 dark:text-sky-400'],
  QUIET: ['No sales', 'border-zinc-200 text-zinc-500 dark:border-zinc-700'],
};

/** A brand's daily sales as a small line; flat and faint when it sold nothing */
const Sparkline = ({ values, label }) => {
  const max = Math.max(...values);
  const w = 96;
  const h = 26;
  if (max <= 0) return <svg width={w} height={h} role="img" aria-label={`${label}: no sales`}><line x1="0" y1={h - 2} x2={w} y2={h - 2} className="stroke-zinc-200 dark:stroke-zinc-700" strokeWidth="2" /></svg>;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 3 - (v / max) * (h - 6)).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} role="img" aria-label={`${label}: daily sales trend, peak ${rupees(max)}`}>
      <polyline points={points} fill="none" className="stroke-zinc-500 dark:stroke-zinc-400" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

/** Platform sales per day. Hovering (or focusing) a bar shows that day's figures above the chart. */
const DailySales = ({ trend }) => {
  const [active, setActive] = useState(null);
  const max = Math.max(1, ...trend.map(d => d.sales));
  const shown = active !== null ? trend[active] : null;
  const best = trend.reduce((top, d) => (d.sales > top.sales ? d : top), trend[0]);
  // Enough date labels to read the axis, never one per bar
  const labelEvery = Math.ceil(trend.length / 6);

  return (
    <section aria-label="Sales per day" className={`${card} p-5`}>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className={eyebrow}>Sales per day, all brands</p>
          <p className="text-sm text-zinc-500 h-5">
            {shown
              ? <><span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">{rupees(shown.sales)}</span> on {shortDay(shown.date)} · {shown.orders} {shown.orders === 1 ? 'order' : 'orders'}</>
              : best.sales > 0 ? <>Best day: <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">{rupees(best.sales)}</span> on {shortDay(best.date)}</> : 'No sales in this period'}
          </p>
        </div>
        <span className="text-xs text-zinc-400 tabular-nums">Peak {compact(max)}</span>
      </div>
      <div className="mt-3 flex items-end gap-0.5 h-40 border-b border-zinc-200 dark:border-zinc-800" onMouseLeave={() => setActive(null)}>
        {trend.map((d, i) => (
          <button
            key={d.date}
            type="button"
            aria-label={`${shortDay(d.date)}: ${rupees(d.sales)}, ${d.orders} orders`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className="group flex-1 h-full flex items-end min-w-0 outline-none"
          >
            <span
              style={{ height: d.sales > 0 ? `${Math.max(2, (d.sales / max) * 100)}%` : '0%' }}
              className={`w-full rounded-t-[4px] ${active === i ? 'bg-[#1c5cab] dark:bg-[#6da7ec]' : 'bg-[#2a78d6] dark:bg-[#3987e5]'} group-focus-visible:ring-2 group-focus-visible:ring-amber-400`}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5 text-[10px] text-zinc-400 tabular-nums" aria-hidden="true">
        {trend.map((d, i) => (
          <span key={d.date} className="flex-1 min-w-0 text-center whitespace-nowrap overflow-visible">{i % labelEvery === 0 ? shortDay(d.date) : ''}</span>
        ))}
      </div>
    </section>
  );
};

const COLUMNS = [
  { key: 'name', label: 'Brand', align: 'left' },
  { key: 'sales', label: 'Sales' },
  { key: 'salesGrowth', label: 'Growth' },
  { key: 'orders', label: 'Orders' },
  { key: 'averageBill', label: 'Avg bill' },
  { key: 'qrShare', label: 'QR orders' },
  { key: 'customers', label: 'Customers' },
  { key: 'lastSaleAt', label: 'Last sale' },
];

/**
 * How every brand on the platform is doing: sales, growth against the period before, orders,
 * average bill, how much comes through the QR menu, and a day-by-day trend.
 */
export const Performance = () => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'sales', dir: 'desc' });

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get('/analytics/brands', { params: { days } });
      setData(res.data.data);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not load brand performance');
    }
  }, [days]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = (data?.brands || []).filter(b => !term || b.name.toLowerCase().includes(term));
    const value = (b) => {
      const v = b[sort.key];
      if (sort.key === 'name') return v.toLowerCase();
      if (sort.key === 'lastSaleAt') return v ? new Date(v).getTime() : 0;
      return v ?? -Infinity; // brands with nothing to compare go last
    };
    return list.sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const order = x < y ? -1 : x > y ? 1 : 0;
      return sort.dir === 'asc' ? order : -order;
    });
  }, [data, search, sort]);

  const sortBy = (key) => setSort(prev => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));
  const t = data?.totals;

  return (
    <div className="flex flex-col gap-5 w-full pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Performance</h1>
          <p className="text-sm text-zinc-500">
            How each brand is selling{data ? `, ${dayAndMonth(data.from)} to ${dayAndMonth(data.to)}, against the ${data.days} days before` : ''}.
          </p>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5 self-start" role="radiogroup" aria-label="Period">
          {PERIODS.map(([value, label]) => (
            <button key={value} type="button" role="radio" aria-checked={days === value} onClick={() => setDays(value)}
              className={`px-2.5 h-8 rounded-md text-xs font-medium ${days === value ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p role="alert" className={`${card} px-4 py-3 text-sm text-red-600 dark:text-red-400`}>{error}</p>
      ) : !data ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={`${card} px-4 py-3`}>
              <dt className="text-xs text-zinc-500">Sales</dt>
              <dd className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{rupees(t.sales)}</dd>
              <dd className="text-xs text-zinc-500"><Change value={t.salesGrowth} fallback="Nothing before to compare" /> {t.salesGrowth !== null && <>from {rupees(t.prevSales)}</>}</dd>
            </div>
            <div className={`${card} px-4 py-3`}>
              <dt className="text-xs text-zinc-500">Orders</dt>
              <dd className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{t.orders.toLocaleString('en-IN')}</dd>
              <dd className="text-xs text-zinc-500"><Change value={t.ordersGrowth} fallback="Nothing before to compare" /> {t.ordersGrowth !== null && <>from {t.prevOrders.toLocaleString('en-IN')}</>}</dd>
            </div>
            <div className={`${card} px-4 py-3`}>
              <dt className="text-xs text-zinc-500">Average bill</dt>
              <dd className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{rupees(t.averageBill)}</dd>
              <dd className="text-xs text-zinc-500">{t.prevAverageBill > 0 ? `${rupees(t.prevAverageBill)} in the period before` : 'Nothing before to compare'}</dd>
            </div>
            <div className={`${card} px-4 py-3`}>
              <dt className="text-xs text-zinc-500">Brands selling</dt>
              <dd className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{t.sellingBrands} <span className="text-sm font-normal text-zinc-500">of {t.brands}</span></dd>
              <dd className="text-xs text-zinc-500">{t.growingBrands} growing · {t.fallingBrands} falling</dd>
            </div>
          </dl>

          <DailySales trend={data.trend} />

          <section aria-label="Brands" className={card}>
            <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800">
              <p className={eyebrow}>Brand by brand</p>
              <label className="flex items-center gap-2 h-8 w-full sm:w-64 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 focus-within:border-amber-500">
                <Search01Icon size={14} className="text-zinc-400 shrink-0" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search brands" aria-label="Search brands" className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-zinc-400" />
              </label>
            </div>
            <div className="overflow-x-auto">
              {rows.length === 0 ? (
                <p className="p-8 text-center text-sm text-zinc-500">No brand matches.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                      {COLUMNS.map(col => {
                        const sorted = sort.key === col.key;
                        const Arrow = sort.dir === 'asc' ? ArrowUp01Icon : ArrowDown01Icon;
                        return (
                          <th key={col.key} aria-sort={sorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={`px-3 first:pl-5 py-2.5 font-medium ${col.align === 'left' ? 'text-left' : 'text-right'}`}>
                            <button type="button" onClick={() => sortBy(col.key)} className={`inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100 ${sorted ? 'text-zinc-900 dark:text-zinc-100' : ''}`}>
                              {col.label}{sorted && <Arrow size={12} />}
                            </button>
                          </th>
                        );
                      })}
                      <th className="px-5 py-2.5 font-medium text-right">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(b => {
                      const [moveLabel, moveTone] = MOVEMENT[b.movement] || MOVEMENT.QUIET;
                      return (
                        <tr key={b.id} className="border-b last:border-0 border-zinc-100 dark:border-zinc-800">
                          <td className="pl-5 pr-3 py-3">
                            <span className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{b.name}</span>
                              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${moveTone}`}>{moveLabel}</span>
                            </span>
                            <span className="block text-xs text-zinc-500">{b.plan || 'No plan'} · {b.stores} {b.stores === 1 ? 'store' : 'stores'}</span>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            <span className="block font-semibold text-zinc-900 dark:text-zinc-100">{rupees(b.sales)}</span>
                            <span className="block text-xs text-zinc-400">was {rupees(b.prevSales)}</span>
                          </td>
                          <td className="px-3 py-3 text-right"><Change value={b.salesGrowth} /></td>
                          <td className="px-3 py-3 text-right tabular-nums text-zinc-900 dark:text-zinc-100">{b.orders.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-zinc-900 dark:text-zinc-100">{b.orders > 0 ? rupees(b.averageBill) : '—'}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{b.orders > 0 ? `${b.qrShare}%` : '—'}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{b.customers || '—'}</td>
                          <td className="px-3 py-3 text-right whitespace-nowrap text-zinc-600 dark:text-zinc-400">{ago(b.lastSaleAt)}</td>
                          <td className="pl-3 pr-5 py-3"><span className="flex justify-end"><Sparkline values={b.trend} label={b.name} /></span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <p className="px-5 py-2.5 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-400">
              Sales are paid, non-cancelled bills. Growth compares with the {data.days} days before; a dash means there was nothing then to compare with. Customers are people identified by a mobile number or a sign-in.
            </p>
          </section>
        </>
      )}
    </div>
  );
};
