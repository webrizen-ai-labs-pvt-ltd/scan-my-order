import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@smo/ui';
import { Loading03Icon, Store01Icon, Alert02Icon } from 'hugeicons-react';
import api from '../lib/api';
import { useStoreSelection } from '../hooks/use-store-selection';

const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const formatPhone = (p) => (p && p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p || '');
const when = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const card = 'rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900';
const eyebrow = 'text-[11px] font-semibold uppercase tracking-wider text-zinc-500';
const PERIODS = [[7, '7 days'], [30, '30 days'], [90, '90 days'], [365, '1 year']];
const FILTERS = [['all', 'All'], ['low', '1–2 stars'], ['comments', 'With a comment']];

/** Read-only stars. Colour never carries the number alone: it always sits next to the figure. */
const Stars = ({ value, size = 14 }) => (
  <span className="inline-flex align-middle" role="img" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map(n => (
      <svg key={n} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9L12 2.6z"
          className={n <= Math.round(value) ? 'fill-amber-400 stroke-amber-500' : 'fill-transparent stroke-zinc-300 dark:stroke-zinc-600'}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ))}
  </span>
);

/**
 * Reviews: what guests said after their food was served. Overall score and spread, how each
 * dish is rated, and every review with its comment (comments are private to the store).
 */
export const Reviews = () => {
  const { storeId, setStoreId, stores, canSwitch } = useStoreSelection();
  const [days, setDays] = useState(30);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!storeId) return;
    setError('');
    try {
      const res = await api.get(`/stores/${storeId}/reviews`, { params: { days, filter: filter === 'all' ? undefined : filter, page } });
      setData(res.data.data);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not load reviews');
    }
  }, [storeId, days, filter, page]);
  useEffect(() => { load(); }, [load]);

  const summary = data?.summary;
  const most = summary ? Math.max(1, ...Object.values(summary.distribution)) : 1;
  const dishes = data?.dishes || [];
  const settings = data?.settings;

  return (
    <div className="flex flex-col gap-5 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Reviews</h1>
          <p className="text-sm text-zinc-500">What guests said after their food was served. Comments are only visible to you.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5" role="radiogroup" aria-label="Period">
            {PERIODS.map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={days === value} onClick={() => { setDays(value); setPage(1); }}
                className={`px-2.5 h-8 rounded-md text-xs font-medium ${days === value ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}>
                {label}
              </button>
            ))}
          </div>
          {canSwitch && (
            <Select value={storeId || undefined} onValueChange={(id) => { setStoreId(id); setPage(1); }}>
              <SelectTrigger className="w-[200px] h-9 text-sm"><Store01Icon size={15} className="mr-1.5 text-zinc-400" /><SelectValue placeholder="Store" /></SelectTrigger>
              <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
      </div>

      {error ? (
        <p role="alert" className={`${card} px-4 py-3 text-sm text-rose-600`}>{error}</p>
      ) : !data ? (
        <div className="p-12 flex justify-center text-zinc-400"><Loading03Icon size={22} className="animate-spin" /></div>
      ) : (
        <>
          {!settings.googleReviewUrl && (
            <p className={`${card} px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 flex flex-wrap items-center gap-x-3 gap-y-1`}>
              <Alert02Icon size={16} className="text-amber-600 shrink-0" />
              <span className="flex-1 min-w-0">No Google review link is set, so guests aren’t asked to review you on Google after rating.</span>
              <Link to={`/dashboard/stores/${storeId}/edit?section=reviews`} className="font-semibold underline underline-offset-2 whitespace-nowrap">Add the link</Link>
            </p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Score */}
            <section aria-label="Overall rating" className={`${card} p-5 flex flex-col gap-3`}>
              <p className={eyebrow}>Overall, last {data.days} days</p>
              {summary.count === 0 ? (
                <p className="text-sm text-zinc-500">No ratings in this period yet. Guests are invited to rate once their food is served.</p>
              ) : (
                <>
                  <div className="flex items-end gap-3">
                    <span className="text-5xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">{summary.average.toFixed(1)}</span>
                    <span className="pb-1.5">
                      <Stars value={summary.average} size={18} />
                      <span className="block text-xs text-zinc-500">{summary.count} {summary.count === 1 ? 'rating' : 'ratings'}</span>
                    </span>
                  </div>
                  <ul className="flex flex-col gap-1.5" aria-label="How many guests gave each score">
                    {[5, 4, 3, 2, 1].map(n => (
                      <li key={n} className="grid grid-cols-[28px_minmax(0,1fr)_28px] items-center gap-2 text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                        <span>{n}★</span>
                        <span className="h-2 rounded bg-zinc-100 dark:bg-zinc-800" title={`${summary.distribution[n]} guests gave ${n} stars`}>
                          <span className="block h-2 rounded bg-zinc-700 dark:bg-zinc-300" style={{ width: `${(summary.distribution[n] / most) * 100}%` }} />
                        </span>
                        <span className="text-right">{summary.distribution[n]}</span>
                      </li>
                    ))}
                  </ul>
                  {summary.low > 0 && (
                    <button type="button" onClick={() => { setFilter('low'); setPage(1); }} className="self-start text-xs font-semibold text-rose-600 dark:text-rose-400 underline underline-offset-2">
                      {summary.low} unhappy {summary.low === 1 ? 'guest' : 'guests'} (1–2 stars): read what they said
                    </button>
                  )}
                </>
              )}
            </section>

            {/* Dishes */}
            <section aria-label="Dishes" className={`${card} lg:col-span-2 overflow-hidden flex flex-col`}>
              <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-baseline justify-between gap-2">
                <p className={eyebrow}>Dish ratings, all time</p>
                <span className="text-xs text-zinc-500">
                  {settings.showRatings ? `Guests see a dish’s rating once it has ${settings.minRatingsToShow} or more.` : 'Ratings are hidden from guests.'}{' '}
                  <Link to={`/dashboard/stores/${storeId}/edit?section=reviews`} className="underline underline-offset-2">Change</Link>
                </span>
              </div>
              {dishes.length === 0 ? (
                <p className="p-8 text-center text-sm text-zinc-500">No dish has been rated yet.</p>
              ) : (
                <div className="overflow-y-auto max-h-80">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                        <th className="px-5 py-2 font-medium">Dish</th>
                        <th className="px-3 py-2 font-medium">Rating</th>
                        <th className="px-3 py-2 font-medium text-right">Ratings</th>
                        <th className="px-5 py-2 font-medium">On the menu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dishes.map(d => (
                        <tr key={d.menuItemId} className="border-b last:border-0 border-zinc-100 dark:border-zinc-800">
                          <td className="px-5 py-2">
                            <span className="block font-medium text-zinc-900 dark:text-zinc-100">{d.name}</span>
                            {d.category && <span className="block text-xs text-zinc-500">{d.category}</span>}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`font-semibold tabular-nums mr-1.5 ${d.average < 3 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-900 dark:text-zinc-100'}`}>{d.average.toFixed(1)}</span>
                            <Stars value={d.average} />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{d.count}</td>
                          <td className="px-5 py-2 text-xs text-zinc-500 whitespace-nowrap">{!settings.showRatings ? 'Hidden' : d.shownToGuests ? 'Shown' : `Needs ${settings.minRatingsToShow - d.count} more`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {/* Reviews */}
          <section aria-label="Reviews" className={card}>
            <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800">
              <p className={eyebrow}>What guests said</p>
              <div className="flex items-center gap-1" role="radiogroup" aria-label="Show">
                {FILTERS.map(([id, label]) => (
                  <button key={id} type="button" role="radio" aria-checked={filter === id} onClick={() => { setFilter(id); setPage(1); }}
                    className={`px-2.5 h-7 rounded-md border text-xs font-medium ${filter === id ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100' : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-400'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {data.reviews.length === 0 ? (
              <p className="p-8 text-center text-sm text-zinc-500">{filter === 'all' ? 'No reviews in this period.' : 'No reviews match this filter.'}</p>
            ) : (
              <ul>
                {data.reviews.map(r => (
                  <li key={r.id} className="px-5 py-4 border-b last:border-b-0 border-zinc-100 dark:border-zinc-800">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <span className="flex items-center gap-2">
                        <Stars value={r.rating} size={16} />
                        <span className={`text-sm font-semibold tabular-nums ${r.rating <= 2 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-900 dark:text-zinc-100'}`}>{r.rating} of 5</span>
                      </span>
                      <span className="text-xs text-zinc-500 tabular-nums">{when(r.createdAt)}</span>
                    </div>
                    {r.comment
                      ? <p className="mt-1.5 text-sm text-zinc-800 dark:text-zinc-200 break-words">“{r.comment}”</p>
                      : <p className="mt-1.5 text-sm text-zinc-400">No comment.</p>}
                    {r.items.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {r.items.map((i, idx) => (
                          <li key={idx} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-800 px-2 py-0.5 text-xs text-zinc-700 dark:text-zinc-300">
                            {i.name} <span className={`font-semibold tabular-nums ${i.rating <= 2 ? 'text-rose-600 dark:text-rose-400' : ''}`}>{i.rating}★</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
                      <span>{r.customerName || 'Guest'}</span>
                      {r.customerPhone && <a href={`tel:+91${r.customerPhone}`} className="tabular-nums hover:underline">{formatPhone(r.customerPhone)}</a>}
                      {r.tableNumber != null && <span>Table {r.tableNumber}</span>}
                      <span className="tabular-nums">Bill {rupees(r.orderTotal)}</span>
                      {r.orderIds.map(id => (
                        <Link key={id} to={`/dashboard/orders/${id}?store=${storeId}`} className="font-mono underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100">#{id.slice(-6).toUpperCase()}</Link>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.pagination.pages > 1 && (
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Page {data.pagination.page} of {data.pagination.pages} · {data.pagination.total} reviews</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= data.pagination.pages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
