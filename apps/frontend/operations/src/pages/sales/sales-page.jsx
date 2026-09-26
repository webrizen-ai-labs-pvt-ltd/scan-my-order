import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Skeleton } from '@smo/ui';
import {
  Store01Icon, Download04Icon, Loading03Icon, ArrowUp01Icon, ArrowDown01Icon, InformationCircleIcon,
} from 'hugeicons-react';
import api from '../../lib/api';
import { Notice } from '../../components/settings-layout';
import { useDuesScope as useReportScope } from '../dues/use-dues-scope';

/* ---------- formatting ---------- */

const rupees = (n) => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;
/** ₹1.2L / ₹12.5k for chart axes and tight spaces */
const compact = (n) => {
  const v = Math.abs(n);
  if (v >= 10000000) return `₹${(n / 10000000).toFixed(v >= 100000000 ? 0 : 1)}Cr`;
  if (v >= 100000) return `₹${(n / 100000).toFixed(v >= 1000000 ? 0 : 1)}L`;
  if (v >= 1000) return `₹${(n / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return `₹${Math.round(n)}`;
};
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const TYPE_LABEL = { DINE_IN: 'Dine-in', TAKEAWAY: 'Takeaway', DELIVERY: 'Delivery' };
const SOURCE_LABEL = { POS: 'Counter (POS)', QR_MENU: 'QR menu' };

/* ---------- dates (local calendar days) ---------- */

const dayStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const niceDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const PRESETS = [
  { id: 'today', label: 'Today', range: (t) => [t, t] },
  { id: 'yesterday', label: 'Yesterday', range: (t) => [addDays(t, -1), addDays(t, -1)] },
  { id: '7d', label: '7 days', range: (t) => [addDays(t, -6), t] },
  { id: '30d', label: '30 days', range: (t) => [addDays(t, -29), t] },
  { id: 'month', label: 'This month', range: (t) => [new Date(t.getFullYear(), t.getMonth(), 1), t] },
  { id: 'lastmonth', label: 'Last month', range: (t) => [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)] },
];

function resolveRange(params) {
  const today = new Date();
  const preset = PRESETS.find(p => p.id === params.get('range'));
  if (params.get('range') === 'custom' && params.get('from') && params.get('to')) {
    return { id: 'custom', from: params.get('from'), to: params.get('to') };
  }
  const [a, b] = (preset || PRESETS[0]).range(today);
  return { id: (preset || PRESETS[0]).id, from: dayStr(a), to: dayStr(b) };
}

/* ---------- small pieces ---------- */

const Card = ({ title, action, children, className = '' }) => (
  <section className={`rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col ${className}`}>
    {(title || action) && (
      <header className="px-5 pt-4 pb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        {action}
      </header>
    )}
    <div className="px-5 pb-5 flex-1 min-h-0">{children}</div>
  </section>
);

/** ▲ 12% / ▼ 8% against the previous period; "new" when there was nothing before */
const Delta = ({ now, before, invert = false }) => {
  if (before === null || before === undefined) return null;
  if (!before) return now > 0 ? <span className="text-xs font-medium text-zinc-400">new</span> : null;
  const change = Math.round(((now - before) / before) * 100);
  if (change === 0) return <span className="text-xs font-medium text-zinc-400">no change</span>;
  const up = change > 0;
  const good = invert ? !up : up;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${good ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
      {up ? <ArrowUp01Icon size={12} /> : <ArrowDown01Icon size={12} />}{Math.abs(change)}%
    </span>
  );
};

/** A thin horizontal share bar */
const Bar = ({ value, max, tone = 'bg-zinc-900 dark:bg-zinc-100' }) => (
  <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
    <div className={`h-full rounded-full ${tone}`} style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%` }} />
  </div>
);

/* ---------- trend chart ---------- */

function TrendChart({ trend, previous, groupBy }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...trend.map(t => t.sales), ...previous);
  // A few round gridlines
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const lines = [0, 0.25, 0.5, 0.75, 1].map(f => f * top);
  const labelEvery = trend.length <= 12 ? 1 : trend.length <= 31 ? Math.ceil(trend.length / 10) : Math.ceil(trend.length / 12);
  const H = 220;
  const active = hover !== null ? trend[hover] : null;

  return (
    <div className="relative">
      <div className="flex gap-3">
        {/* y axis */}
        <div className="flex flex-col justify-between text-[10px] tabular-nums text-zinc-400 text-right w-10 shrink-0" style={{ height: H }}>
          {[...lines].reverse().map(v => <span key={v} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">{compact(v)}</span>)}
        </div>
        <div className="relative flex-1 min-w-0" style={{ height: H }} onMouseLeave={() => setHover(null)}>
          {lines.map(v => (
            <div key={v} className="absolute inset-x-0 border-t border-dashed border-zinc-200 dark:border-zinc-800" style={{ bottom: `${(v / top) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[3px]">
            {trend.map((t, i) => {
              const h = (t.sales / top) * 100;
              const prevH = ((previous[i] || 0) / top) * 100;
              return (
                <div
                  key={t.key}
                  className="relative flex-1 h-full flex items-end cursor-default"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  tabIndex={0}
                  aria-label={`${t.label}: ${rupees(t.sales)}, ${t.bills} bills`}
                >
                  {/* previous period marker */}
                  {previous[i] > 0 && (
                    <div className="absolute inset-x-0 border-t-2 border-zinc-300 dark:border-zinc-600" style={{ bottom: `${prevH}%` }} />
                  )}
                  <div
                    className={`w-full rounded-t-[3px] transition-colors ${hover === i ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-700/80 dark:bg-zinc-300/80'}`}
                    style={{ height: `${h}%`, minHeight: t.sales > 0 ? 2 : 0 }}
                  />
                </div>
              );
            })}
          </div>
          {active && (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs whitespace-nowrap"
              style={{ left: `${((hover + 0.5) / trend.length) * 100}%` }}
            >
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">{active.label}</div>
              <div className="tabular-nums text-zinc-700 dark:text-zinc-300">{rupees(active.sales)} · {active.bills} bill{active.bills === 1 ? '' : 's'}</div>
              {previous[hover] > 0 && <div className="tabular-nums text-zinc-400">before: {rupees(previous[hover])}</div>}
            </div>
          )}
        </div>
      </div>
      {/* x axis */}
      <div className="flex gap-[3px] pl-[52px] mt-1.5">
        {trend.map((t, i) => (
          <div key={t.key} className="flex-1 min-w-0 text-center text-[10px] text-zinc-400 truncate">
            {i % labelEvery === 0 ? (groupBy === 'hour' ? t.label.replace(' ', '') : t.label) : ''}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-zinc-700 dark:bg-zinc-300" /> This period</span>
        <span className="flex items-center gap-1.5"><span className="w-3 border-t-2 border-zinc-300 dark:border-zinc-600" /> Previous period</span>
      </div>
    </div>
  );
}

/* ---------- export ---------- */

async function downloadExcel(report, bills, scopeLabel) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const t = report.totals;
  const p = report.payments;
  const summary = [
    ['Sales report', scopeLabel],
    ['Period', `${niceDate(report.range.from)} to ${niceDate(report.range.to)}`],
    [],
    ['Gross sales (menu prices)', t.grossSales],
    ['Discounts & store credits', -t.discounts],
    ['Net sales (before GST)', t.netSales],
    ['GST', t.tax],
    ['Total sales', t.totalSales],
    ['Bills', t.bills],
    ['Average bill', t.avgBill],
    ['Items sold', t.itemsSold],
    [],
    ['Paid in cash', p.cash],
    ['Paid online (UPI / card)', p.online],
    ['Put on dues', p.dues],
    ['Payment not recorded (older bills)', p.unrecorded],
    ['Refunded to guests', -p.refunds],
    [],
    ['Cancelled bills', report.losses.cancelledBills, report.losses.cancelledValue],
    ['Items the kitchen couldn’t make', report.losses.rejectedItems, report.losses.rejectedValue],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.trend.map(r => ({
    [report.range.groupBy === 'hour' ? 'Hour' : 'Date']: r.label, Bills: r.bills, Sales: r.sales,
  }))), report.range.groupBy === 'hour' ? 'By hour' : 'By day');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.items.map(i => ({
    Item: i.name, Category: i.category, Quantity: i.quantity, 'Sales (menu price)': i.sales,
  }))), 'Items');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.categories.map(c => ({
    Category: c.name, Items: c.items, Quantity: c.quantity, 'Sales (menu price)': c.sales,
  }))), 'Categories');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bills.map(b => ({
    Date: b.date, Time: b.time, Store: b.store, Order: b.order, Invoice: b.invoice, Table: b.table,
    Type: TYPE_LABEL[b.type] || b.type, Source: SOURCE_LABEL[b.source] || b.source,
    Gross: b.gross, Discount: b.discount, GST: b.tax, Total: b.total,
    Cash: b.cash, Online: b.online, Dues: b.dues, 'Not recorded': b.notRecorded,
  }))), 'Bills');
  XLSX.writeFile(wb, `sales-${report.range.from}-to-${report.range.to}.xlsx`);
}

/* ---------- page ---------- */

/**
 * /dashboard/sales — what was sold, how it was paid and how it compares with the period before.
 */
export const Sales = () => {
  const [params, setParams] = useSearchParams();
  const scope = useReportScope();
  const range = resolveRange(params);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [itemSort, setItemSort] = useState('sales');
  const [showAllItems, setShowAllItems] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [customFrom, setCustomFrom] = useState(range.from);
  const [customTo, setCustomTo] = useState(range.to);

  const storeId = scope.apiParams.storeId;
  useEffect(() => {
    if (!scope.ready) return undefined;
    let stale = false;
    setLoading(true);
    api.get('/reports/sales', { params: { ...(storeId ? { storeId } : {}), from: range.from, to: range.to } })
      .then(res => { if (!stale) { setReport(res.data.data); setError(''); } })
      .catch(err => { if (!stale) setError(err?.response?.data?.error?.message || 'Could not load sales'); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [storeId, range.from, range.to, scope.ready]);

  const setRange = (id, from, to) => setParams(prev => {
    const next = new URLSearchParams(prev);
    next.set('range', id);
    if (id === 'custom') { next.set('from', from); next.set('to', to); } else { next.delete('from'); next.delete('to'); }
    return next;
  }, { replace: true });

  const scopeLabel = storeId ? (scope.stores.find(s => s.id === storeId)?.name || report?.stores?.[0]?.name || 'Store') : 'All stores';

  const exportExcel = async () => {
    setExporting(true);
    try {
      const res = await api.get('/reports/sales/bills', { params: { ...(storeId ? { storeId } : {}), from: range.from, to: range.to } });
      await downloadExcel(report, res.data.data, scopeLabel);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not export the report');
    } finally {
      setExporting(false);
    }
  };

  const t = report?.totals;
  const prev = report?.previous;
  const pay = report?.payments;
  const items = useMemo(() => {
    const list = [...(report?.items || [])].sort((a, b) => (itemSort === 'sales' ? b.sales - a.sales : b.quantity - a.quantity));
    return showAllItems ? list : list.slice(0, 10);
  }, [report, itemSort, showAllItems]);
  const itemMax = Math.max(1, ...items.map(i => (itemSort === 'sales' ? i.sales : i.quantity)));
  const prevRangeLabel = report ? `vs previous ${report.range.days === 1 ? 'day' : `${report.range.days} days`}` : '';
  const empty = report && t.bills === 0;

  return (
    <div className="flex flex-col gap-5 pb-12">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Sales</h1>
          <p className="text-sm text-zinc-500">
            {niceDate(range.from)}{range.from !== range.to ? ` – ${niceDate(range.to)}` : ''} · {scopeLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5 overflow-x-auto" role="tablist" aria-label="Period">
            {[...PRESETS, { id: 'custom', label: 'Custom' }].map(p => (
              <button key={p.id} type="button" role="tab" aria-selected={range.id === p.id}
                onClick={() => (p.id === 'custom' ? setRange('custom', customFrom, customTo) : setRange(p.id))}
                className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium ${range.id === p.id ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}>
                {p.label}
              </button>
            ))}
          </div>
          {scope.canPickStore && (
            <Select value={storeId || 'ALL'} onValueChange={v => scope.setStoreId(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-[180px] h-8 text-xs"><Store01Icon size={14} className="mr-1.5 text-zinc-400" /><SelectValue /></SelectTrigger>
              <SelectContent>
                {scope.allowAllStores && <SelectItem value="ALL">All stores</SelectItem>}
                {scope.stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={!report || empty || exporting}>
            {exporting ? <Loading03Icon size={15} className="animate-spin" /> : <Download04Icon size={15} />}
            <span className="ml-1.5">Excel</span>
          </Button>
        </div>
      </div>

      {range.id === 'custom' && (
        <div className="flex flex-wrap items-end gap-2 -mt-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-500">From
            <input type="date" value={customFrom} max={customTo} onChange={e => setCustomFrom(e.target.value)} className="h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent px-2 text-sm text-zinc-900 dark:text-zinc-100" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">To
            <input type="date" value={customTo} min={customFrom} max={dayStr(new Date())} onChange={e => setCustomTo(e.target.value)} className="h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent px-2 text-sm text-zinc-900 dark:text-zinc-100" />
          </label>
          <Button size="sm" onClick={() => setRange('custom', customFrom, customTo)} disabled={!customFrom || !customTo || customFrom > customTo}>Show</Button>
        </div>
      )}

      {error && <Notice msg={{ text: error, error: true }} />}

      {!report ? (
        <div className="flex flex-col gap-5">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      ) : (
        <div className={`flex flex-col gap-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {/* Headline figures */}
          <dl className="grid grid-cols-2 lg:grid-cols-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
            {[
              { label: 'Total sales', value: rupees(t.totalSales), now: t.totalSales, before: prev.totalSales, hint: 'incl. GST', strong: true },
              { label: 'Bills', value: t.bills.toLocaleString('en-IN'), now: t.bills, before: prev.bills, hint: `${t.itemsSold.toLocaleString('en-IN')} items sold` },
              { label: 'Average bill', value: rupees(t.avgBill), now: t.avgBill, before: prev.avgBill, hint: 'per paid bill' },
              { label: 'Net sales', value: rupees(t.netSales), now: t.netSales, before: prev.netSales, hint: 'after discounts, before GST' },
              { label: 'GST collected', value: rupees(t.tax), now: t.tax, before: prev.tax, hint: 'to be paid to the government' },
            ].map((s, i) => (
              <div key={s.label} className={`px-5 py-4 border-zinc-200 dark:border-zinc-800 ${i > 0 ? 'lg:border-l' : ''} ${i % 2 === 1 ? 'border-l' : ''} ${i >= 2 ? 'border-t lg:border-t-0' : ''} ${i === 4 ? 'col-span-2 lg:col-span-1' : ''}`}>
                <dt className="text-xs text-zinc-500">{s.label}</dt>
                <dd className={`mt-1 tabular-nums text-zinc-900 dark:text-zinc-50 ${s.strong ? 'text-2xl font-semibold' : 'text-xl font-semibold'}`}>{s.value}</dd>
                <dd className="mt-0.5 flex items-center gap-2 text-xs text-zinc-400">
                  <Delta now={s.now} before={s.before} /> <span className="truncate">{s.hint}</span>
                </dd>
              </div>
            ))}
          </dl>

          {empty ? (
            <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 px-6 py-16 text-center">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No sales in this period</p>
              <p className="mt-1 text-sm text-zinc-500">Pick another period{scope.canPickStore ? ' or store' : ''}.{report.open.bills > 0 ? ` ${report.open.bills} bill${report.open.bills === 1 ? ' is' : 's are'} still open (${rupees(report.open.value)}).` : ''}</p>
            </div>
          ) : (
            <>
              {/* Trend */}
              <Card title={report.range.groupBy === 'hour' ? 'Sales by hour' : 'Sales by day'} action={<span className="text-xs text-zinc-500">{prevRangeLabel}</span>}>
                <TrendChart trend={report.trend} previous={report.previousTrend} groupBy={report.range.groupBy} />
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Sales summary, like a statement */}
                <Card title="Sales summary">
                  <dl className="flex flex-col text-sm">
                    {[
                      ['Gross sales', t.grossSales, 'menu prices'],
                      ['Discounts & credits', -t.discounts, null],
                      ['Net sales', t.netSales, 'before GST', true],
                      ['GST', t.tax, null],
                    ].map(([label, value, hint, rule]) => (
                      <div key={label} className={`flex items-baseline justify-between gap-3 py-2 ${rule ? 'border-t border-zinc-200 dark:border-zinc-800 font-medium' : ''}`}>
                        <dt className="text-zinc-600 dark:text-zinc-400">{label}{hint && <span className="ml-1 text-xs text-zinc-400">({hint})</span>}</dt>
                        <dd className={`tabular-nums ${value < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-900 dark:text-zinc-100'}`}>{value < 0 ? `−${rupees(-value)}` : rupees(value)}</dd>
                      </div>
                    ))}
                    <div className="flex items-baseline justify-between gap-3 pt-3 mt-1 border-t-2 border-zinc-900 dark:border-zinc-100">
                      <dt className="font-semibold text-zinc-900 dark:text-zinc-100">Total sales</dt>
                      <dd className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{rupees(t.totalSales)}</dd>
                    </div>
                  </dl>
                </Card>

                {/* Payments */}
                <Card title="How it was paid">
                  {(() => {
                    const rows = [
                      { label: 'Cash', value: pay.cash, tone: 'bg-emerald-500' },
                      { label: 'Online (UPI / card)', value: pay.online, tone: 'bg-sky-500' },
                      { label: 'Dues (owed)', value: pay.dues, tone: 'bg-amber-500' },
                      { label: 'Not recorded', value: pay.unrecorded, tone: 'bg-zinc-300 dark:bg-zinc-600', hint: 'older bills' },
                    ].filter(r => r.value > 0);
                    const total = rows.reduce((s, r) => s + r.value, 0);
                    return (
                      <div className="flex flex-col gap-4">
                        <div className="flex h-2.5 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                          {rows.map(r => <div key={r.label} className={r.tone} style={{ width: `${(r.value / Math.max(1, total)) * 100}%` }} title={`${r.label}: ${rupees(r.value)}`} />)}
                        </div>
                        <dl className="flex flex-col gap-2.5 text-sm">
                          {rows.map(r => (
                            <div key={r.label} className="flex items-center justify-between gap-3">
                              <dt className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                                <span className={`size-2.5 rounded-sm ${r.tone}`} />{r.label}
                                {r.hint && <span className="text-xs text-zinc-400">({r.hint})</span>}
                              </dt>
                              <dd className="tabular-nums text-zinc-900 dark:text-zinc-100">{rupees(r.value)} <span className="ml-1 text-xs text-zinc-400">{pct(r.value, total)}%</span></dd>
                            </div>
                          ))}
                          {pay.refunds > 0 && (
                            <div className="flex items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-800 pt-2.5">
                              <dt className="text-zinc-600 dark:text-zinc-400">Refunded to guests</dt>
                              <dd className="tabular-nums text-rose-600 dark:text-rose-400">−{rupees(pay.refunds)}</dd>
                            </div>
                          )}
                        </dl>
                        {pay.refundsPending > 0 && (
                          <p className="text-xs text-amber-700 dark:text-amber-400">{rupees(pay.refundsPending)} still to be refunded for items the kitchen couldn’t make.</p>
                        )}
                        {pay.dues > 0 && <p className="text-xs text-zinc-500">Dues count as sales now and are collected later on the Dues page.</p>}
                      </div>
                    );
                  })()}
                </Card>

                {/* Channels */}
                <Card title="Where it came from">
                  <div className="flex flex-col gap-5">
                    {[['Order type', report.byType, TYPE_LABEL], ['Placed from', report.bySource, SOURCE_LABEL]].map(([heading, rows, labels]) => (
                      <div key={heading}>
                        <div className="mb-2 text-xs font-medium text-zinc-500">{heading}</div>
                        <div className="flex flex-col gap-2.5">
                          {rows.map(r => (
                            <div key={r.key}>
                              <div className="flex items-baseline justify-between gap-3 text-sm">
                                <span className="text-zinc-700 dark:text-zinc-300">{labels[r.key] || r.key}</span>
                                <span className="tabular-nums text-zinc-900 dark:text-zinc-100">{rupees(r.sales)} <span className="ml-1 text-xs text-zinc-400">{r.bills} bills</span></span>
                              </div>
                              <div className="mt-1"><Bar value={r.sales} max={t.totalSales} /></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-5">
                {/* Items */}
                <Card
                  title="Top items"
                  action={(
                    <div className="flex items-center gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5" role="tablist" aria-label="Sort items">
                      {[['sales', 'By sales'], ['quantity', 'By quantity']].map(([id, label]) => (
                        <button key={id} type="button" role="tab" aria-selected={itemSort === id} onClick={() => setItemSort(id)}
                          className={`px-2 py-0.5 rounded-md text-xs font-medium ${itemSort === id ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'}`}>{label}</button>
                      ))}
                    </div>
                  )}
                >
                  {items.length === 0 ? (
                    <p className="py-6 text-sm text-zinc-500">No items recorded.</p>
                  ) : (
                    <>
                      <ol className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                        {items.map((i, idx) => (
                          <li key={i.id} className="py-2.5 grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-x-3">
                            <span className="text-xs tabular-nums text-zinc-400">{idx + 1}</span>
                            <div className="min-w-0">
                              <div className="flex items-baseline justify-between gap-3">
                                <span className="truncate text-sm text-zinc-900 dark:text-zinc-100">{i.name}<span className="ml-2 text-xs text-zinc-400">{i.category}</span></span>
                              </div>
                              <div className="mt-1"><Bar value={itemSort === 'sales' ? i.sales : i.quantity} max={itemMax} /></div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm tabular-nums text-zinc-900 dark:text-zinc-100">{itemSort === 'sales' ? rupees(i.sales) : `${i.quantity} sold`}</div>
                              <div className="text-xs tabular-nums text-zinc-400">{itemSort === 'sales' ? `${i.quantity} sold` : rupees(i.sales)}</div>
                            </div>
                          </li>
                        ))}
                      </ol>
                      {report.items.length > 10 && (
                        <button type="button" onClick={() => setShowAllItems(v => !v)} className="mt-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:underline">
                          {showAllItems ? 'Show top 10' : `Show all ${report.items.length} items`}
                        </button>
                      )}
                      <p className="mt-3 text-xs text-zinc-400 flex items-start gap-1.5"><InformationCircleIcon size={13} className="shrink-0 mt-px" /> Item sales are at menu price, before bill discounts and GST.</p>
                    </>
                  )}
                </Card>

                <div className="flex flex-col gap-5">
                  {/* Categories */}
                  <Card title="Categories">
                    <div className="flex flex-col gap-3">
                      {report.categories.map(c => {
                        const catTotal = report.categories.reduce((s, x) => s + x.sales, 0);
                        return (
                          <div key={c.name}>
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                              <span className="truncate text-zinc-700 dark:text-zinc-300">{c.name}</span>
                              <span className="tabular-nums text-zinc-900 dark:text-zinc-100">{rupees(c.sales)} <span className="ml-1 text-xs text-zinc-400">{pct(c.sales, catTotal)}%</span></span>
                            </div>
                            <div className="mt-1"><Bar value={c.sales} max={report.categories[0]?.sales || 1} /></div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>

                  {/* Busiest hours */}
                  <Card title="Busiest hours">
                    {(() => {
                      const max = Math.max(1, ...report.hours.map(h => h.sales));
                      const peak = report.hours.reduce((a, b) => (b.sales > a.sales ? b : a), report.hours[0]);
                      return (
                        <>
                          <div className="flex items-end gap-[2px] h-24">
                            {report.hours.map(h => (
                              <div key={h.hour} className="flex-1 h-full flex items-end" title={`${h.label}: ${rupees(h.sales)} · ${h.bills} bills`}>
                                <div className={`w-full rounded-t-[2px] ${h.hour === peak.hour && peak.sales > 0 ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-300 dark:bg-zinc-700'}`} style={{ height: `${(h.sales / max) * 100}%`, minHeight: h.sales > 0 ? 2 : 0 }} />
                              </div>
                            ))}
                          </div>
                          <div className="mt-1 flex justify-between text-[10px] text-zinc-400"><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span></div>
                          {peak.sales > 0 && <p className="mt-2 text-xs text-zinc-500">Busiest at <strong className="text-zinc-900 dark:text-zinc-100">{peak.label}</strong> · {rupees(peak.sales)} from {peak.bills} bills</p>}
                        </>
                      );
                    })()}
                  </Card>
                </div>
              </div>

              {/* Stores */}
              {report.byStore.length > 1 && (
                <Card title="By store">
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                    {report.byStore.map(s => (
                      <div key={s.storeId}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate text-zinc-700 dark:text-zinc-300">{s.name}</span>
                          <span className="tabular-nums text-zinc-900 dark:text-zinc-100">{rupees(s.sales)} <span className="ml-1 text-xs text-zinc-400">{s.bills} bills</span></span>
                        </div>
                        <div className="mt-1"><Bar value={s.sales} max={report.byStore[0].sales || 1} /></div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Watch list */}
          <dl className="grid grid-cols-2 lg:grid-cols-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
            {[
              { label: 'Cancelled bills', value: report.losses.cancelledBills, detail: `${rupees(report.losses.cancelledValue)} not sold` },
              { label: 'Kitchen couldn’t make', value: report.losses.rejectedItems, detail: `${rupees(report.losses.rejectedValue)} of items` },
              { label: 'Discounts given', value: rupees(report.losses.discounts), detail: `${pct(report.losses.discounts, t.grossSales)}% of gross sales` },
              { label: 'Still open', value: report.open.bills, detail: `${rupees(report.open.value)} not yet paid` },
            ].map((s, i) => (
              <div key={s.label} className={`px-5 py-3.5 border-zinc-200 dark:border-zinc-800 ${i % 2 === 1 ? 'border-l' : ''} ${i >= 2 ? 'border-t lg:border-t-0 lg:border-l' : ''}`}>
                <dt className="text-xs text-zinc-500">{s.label}</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{s.value}</dd>
                <dd className="text-xs text-zinc-400">{s.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
};
