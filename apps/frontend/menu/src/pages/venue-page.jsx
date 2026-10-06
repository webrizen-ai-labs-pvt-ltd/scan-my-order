import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Skeleton, AnimatedThemeToggler } from '@smo/ui';
import { Location01Icon, Search01Icon, Store01Icon, ArrowRight01Icon } from 'hugeicons-react';
import api from '../lib/api';

const TAILWIND_COLORS = {
  red: '#ef4444', orange: '#f97316', amber: '#f59e0b', yellow: '#eab308',
  lime: '#84cc16', green: '#22c55e', emerald: '#10b981', teal: '#14b8a6',
  cyan: '#06b6d4', sky: '#0ea5e9', blue: '#3b82f6', indigo: '#6366f1',
  violet: '#8b5cf6', purple: '#a855f7', fuchsia: '#d946ef', pink: '#ec4899',
  rose: '#f43f5e', slate: '#64748b', zinc: '#71717a',
};
const colorOf = (c) => TAILWIND_COLORS[c] || (typeof c === 'string' && c.startsWith('#') ? c : '#f59e0b');

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/** One counter: tapping it opens that counter's own menu */
const CounterCard = ({ counter, venueSlug }) => {
  const accent = colorOf(counter.brandColor);
  const showStoreName = counter.name && counter.name.toLowerCase() !== counter.brandName.toLowerCase();
  return (
    <Link
      to={`/${counter.brandSlug}/${counter.storeSlug}?venue=${venueSlug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <div className="relative h-28 w-full" style={{ backgroundColor: `${accent}22` }}>
        {counter.banner && (
          <img src={counter.banner} alt="" className="h-full w-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        )}
        <div className="absolute -bottom-6 left-4 flex size-14 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white dark:border-zinc-900 dark:bg-zinc-800">
          {counter.logo ? (
            <img src={counter.logo} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-base font-black" style={{ color: accent }}>{initials(counter.brandName)}</span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 px-4 pb-4 pt-8">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-zinc-900 dark:text-zinc-50">{counter.brandName}</h3>
            {showStoreName && <p className="truncate text-xs text-zinc-500">{counter.name}</p>}
          </div>
          <ArrowRight01Icon size={18} className="mt-0.5 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5" />
        </div>
        {counter.location && (
          <p className="flex items-center gap-1 text-xs text-zinc-500">
            <Location01Icon size={13} className="shrink-0" /> <span className="truncate">{counter.location}</span>
          </p>
        )}
        <div className="mt-2">
          {counter.serviceMode === 'TABLES' && !counter.closedReason ? (
            <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
              Dine-in · order from your table
            </span>
          ) : counter.takingOrders ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-500" /> Order &amp; pay here
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {counter.closedReason || 'Menu only'}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

/**
 * /v/:venueSlug — a mall, food court or cinema: every counter in one place.
 * Each card opens the counter's own menu page, where ordering and payment happen.
 */
export const VenuePage = () => {
  const { venueSlug } = useParams();
  const [venue, setVenue] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setVenue(null);
    setError('');
    api.get(`/public/venues/${venueSlug}`)
      .then(res => { if (!cancelled) setVenue(res.data.data); })
      .catch(err => { if (!cancelled) setError(err?.response?.data?.error?.message || "We couldn't load this place. Check your connection and try again."); });
    return () => { cancelled = true; };
  }, [venueSlug]);

  useEffect(() => {
    if (venue?.name) document.title = `${venue.name} · Order from any counter`;
  }, [venue?.name]);

  const counters = useMemo(() => {
    const list = venue?.counters || [];
    const q = query.trim().toLowerCase();
    const matched = q
      ? list.filter(c => [c.brandName, c.name, c.location].some(v => v && v.toLowerCase().includes(q)))
      : list;
    // Counters taking orders first, then dine-in, keeping the venue's order otherwise
    const rank = (c) => (c.takingOrders ? 0 : c.serviceMode === 'TABLES' && !c.closedReason ? 1 : 2);
    return [...matched].sort((a, b) => rank(a) - rank(b));
  }, [venue, query]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-900">
            <Store01Icon size={28} className="text-zinc-400" />
          </div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Place not found</h1>
          <p className="mt-1 text-sm text-zinc-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="relative border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {venue?.coverImage && (
          <img src={venue.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15" />
        )}
        <div className="relative mx-auto max-w-5xl px-4 pb-5 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {venue ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Order from any counter</p>
                  <h1 className="mt-1 text-2xl font-black leading-tight text-zinc-900 dark:text-zinc-50">{venue.name}</h1>
                  {(venue.address || venue.city) && (
                    <p className="mt-1 flex items-center gap-1 text-sm text-zinc-500">
                      <Location01Icon size={14} className="shrink-0" />
                      <span className="truncate">{[venue.address, venue.city].filter(Boolean).join(', ')}</span>
                    </p>
                  )}
                  {venue.description && <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">{venue.description}</p>}
                </>
              ) : (
                <div className="space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-7 w-56" />
                  <Skeleton className="h-4 w-40" />
                </div>
              )}
            </div>
            <AnimatedThemeToggler className="shrink-0" />
          </div>

          <label className="mt-4 flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 focus-within:border-amber-400 dark:border-zinc-700 dark:bg-zinc-950">
            <Search01Icon size={16} className="shrink-0 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search counters or brands"
              aria-label="Search counters"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
            />
          </label>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        {!venue ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-56 rounded-2xl" />)}
          </div>
        ) : counters.length === 0 ? (
          <p className="py-16 text-center text-sm text-zinc-500">
            {query ? `No counters match “${query}”.` : 'No counters here yet.'}
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-zinc-500">
              {counters.length} {counters.length === 1 ? 'counter' : 'counters'} · pay on your phone, collect at the counter
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {counters.map(c => <CounterCard key={c.id} counter={c} venueSlug={venue.slug} />)}
            </div>
          </>
        )}
      </main>
    </div>
  );
};
