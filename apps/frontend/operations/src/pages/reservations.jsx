import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Skeleton } from '@smo/ui';
import {
  Calendar01Icon, Call02Icon, PlusSignIcon, Store01Icon, Search01Icon, ArrowLeft01Icon,
  ArrowRight01Icon, Delete02Icon, UserGroupIcon, AlertCircleIcon,
} from 'hugeicons-react';
import api from '../lib/api';
import { subscribeStore } from '../lib/live-stream';
import { useAuthStore } from '../store/authStore';
import { STATUSES, localDateStr, shiftDate, formatDay, formatTime, useReservationStore } from './reservations/reservation-utils';

const FILTERS = ['ALL', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

const StatusPill = ({ status }) => {
  const s = STATUSES[status] || STATUSES.CONFIRMED;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${s.tone}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} /> {s.label}
    </span>
  );
};

/** Next steps for a booking, in the order the host usually needs them */
const ACTIONS = {
  CONFIRMED: [
    { to: 'SEATED', label: 'Seat', primary: true },
    { to: 'NO_SHOW', label: 'No show' },
    { to: 'CANCELLED', label: 'Cancel', danger: true },
  ],
  SEATED: [
    { to: 'COMPLETED', label: 'Finish', primary: true },
    { to: 'CANCELLED', label: 'Cancel', danger: true },
  ],
};

/**
 * /dashboard/reservations — the host desk: one day's bookings with seat / finish / no-show.
 * Store, date, status filter and search live in the URL.
 */
export const Reservations = () => {
  const { token } = useAuthStore();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { storeId, setStoreId, stores, canSwitch } = useReservationStore();

  const date = params.get('date') || localDateStr();
  const status = FILTERS.includes(params.get('status')) ? params.get('status') : 'ALL';
  const [search, setSearch] = useState(params.get('q') || '');

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const setParam = useCallback((key, value) => setParams(prev => {
    const next = new URLSearchParams(prev);
    if (value === null || value === '' || value === 'ALL') next.delete(key);
    else next.set(key, value);
    return next;
  }, { replace: true }), [setParams]);

  const load = useCallback(async (silent = false) => {
    if (!storeId) return;
    if (!silent) setLoading(true);
    try {
      const res = await api.get(`/stores/${storeId}/reservations`, { params: { date } });
      setReservations(Array.isArray(res.data.data) ? res.data.data : []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not load reservations');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [storeId, date]);

  useEffect(() => { load(); }, [load]);

  // Live updates from other devices
  useEffect(() => {
    if (!storeId || !token) return undefined;
    return subscribeStore(storeId, ({ type }) => {
      if (type === 'RESERVATION_CREATED' || type === 'RESERVATION_UPDATED' || type === 'RESERVATION_DELETED' || type === 'STREAM_RECONNECTED') load(true);
    });
  }, [storeId, token, load]);

  // Search is applied as you type; the URL is updated after a pause
  useEffect(() => {
    const t = setTimeout(() => setParam('q', search.trim()), 300);
    return () => clearTimeout(t);
  }, [search, setParam]);

  const updateStatus = async (id, next) => {
    setBusyId(id);
    try {
      await api.patch(`/stores/${storeId}/reservations/${id}`, { status: next });
      await load(true);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not update the booking');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this reservation record? Use Cancel instead if the guest cancelled.')) return;
    setBusyId(id);
    try {
      await api.delete(`/stores/${storeId}/reservations/${id}`);
      await load(true);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not delete the booking');
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => {
    const c = { ALL: reservations.length };
    for (const r of reservations) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [reservations]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reservations
      .filter(r => status === 'ALL' || r.status === status)
      .filter(r => !q || r.guestName?.toLowerCase().includes(q) || r.guestPhone?.includes(q) || String(r.table?.tableNumber).includes(q))
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  }, [reservations, status, search]);

  const covers = reservations.filter(r => r.status === 'CONFIRMED' || r.status === 'SEATED').reduce((s, r) => s + (r.partySize || 0), 0);
  const today = localDateStr();
  const newLink = `/dashboard/reservations/new?${new URLSearchParams({ ...(storeId ? { store: storeId } : {}), date })}`;

  return (
    <div className="flex flex-col gap-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Table reservations</h1>
          <p className="text-sm text-zinc-500">Pre-book tables without double-booking, and seat guests as they arrive.</p>
        </div>
        <div className="flex items-center gap-2">
          {canSwitch && (
            <Select value={storeId || undefined} onValueChange={setStoreId}>
              <SelectTrigger className="w-[190px] h-9 text-sm"><Store01Icon size={15} className="mr-1.5 text-zinc-400" /><SelectValue placeholder="Store" /></SelectTrigger>
              <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Button onClick={() => navigate(newLink)} disabled={!storeId}>
            <PlusSignIcon size={16} className="mr-1.5" /> New reservation
          </Button>
        </div>
      </div>

      {/* Day summary */}
      <dl className="grid grid-cols-2 lg:grid-cols-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
        {[
          { label: 'Bookings', value: counts.ALL || 0, detail: date === today ? 'today' : formatDay(date) },
          { label: 'Awaiting arrival', value: counts.CONFIRMED || 0, detail: 'confirmed' },
          { label: 'Seated', value: counts.SEATED || 0, detail: 'dining now' },
          { label: 'Expected covers', value: covers, detail: 'confirmed + seated guests' },
        ].map((s, i) => (
          <div key={s.label} className={`px-5 py-4 border-zinc-200 dark:border-zinc-800 ${i % 2 === 1 ? 'border-l' : ''} ${i >= 2 ? 'border-t lg:border-t-0 lg:border-l' : ''}`}>
            <dt className="text-xs text-zinc-500">{s.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{s.value}</dd>
            <dd className="text-xs text-zinc-400 truncate">{s.detail}</dd>
          </div>
        ))}
      </dl>

      {/* Bookings */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800">
              <button type="button" aria-label="Previous day" onClick={() => setParam('date', shiftDate(date, -1))} className="h-8 w-8 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                <ArrowLeft01Icon size={15} />
              </button>
              <label className="h-8 px-2 flex items-center gap-1.5 border-x border-zinc-200 dark:border-zinc-800 text-sm">
                <Calendar01Icon size={14} className="text-zinc-400" />
                <input type="date" value={date} onChange={e => e.target.value && setParam('date', e.target.value)} aria-label="Date" className="bg-transparent outline-none text-zinc-800 dark:text-zinc-200" />
              </label>
              <button type="button" aria-label="Next day" onClick={() => setParam('date', shiftDate(date, 1))} className="h-8 w-8 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                <ArrowRight01Icon size={15} />
              </button>
            </div>
            <Button variant="outline" size="sm" disabled={date === today} onClick={() => setParam('date', null)}>Today</Button>
          </div>

          <div className="flex items-center gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5 overflow-x-auto" role="tablist" aria-label="Filter by status">
            {FILTERS.map(f => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={status === f}
                onClick={() => setParam('status', f)}
                className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 ${status === f
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
              >
                {f === 'ALL' ? 'All' : STATUSES[f].label}
                <span className="tabular-nums text-zinc-400">{counts[f] || 0}</span>
              </button>
            ))}
          </div>

          <div className="relative xl:ml-auto xl:w-64">
            <Search01Icon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, phone or table" aria-label="Search reservations" className="h-8 pl-8 text-sm" />
          </div>
        </div>

        {error && (
          <div role="alert" className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircleIcon size={16} /> {error}
          </div>
        )}

        {/* Column headings (wide screens) */}
        {!loading && visible.length > 0 && (
          <div className="hidden md:grid grid-cols-[120px_minmax(0,1fr)_90px_110px_110px_auto] gap-4 px-4 py-2 text-xs font-medium text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
            <span>Time</span><span>Guest</span><span>Party</span><span>Table</span><span>Status</span><span className="text-right">Actions</span>
          </div>
        )}

        {loading ? (
          <div className="p-4 flex flex-col gap-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
        ) : visible.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Calendar01Icon size={32} className="mx-auto text-zinc-300 dark:text-zinc-600" />
            <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {search.trim() ? `No bookings match “${search.trim()}”` : status === 'ALL' ? `No reservations for ${date === today ? 'today' : formatDay(date)}` : `No ${STATUSES[status].label.toLowerCase()} bookings`}
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate(newLink)} disabled={!storeId}>
              <PlusSignIcon size={14} className="mr-1.5" /> Add a reservation
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {visible.map(r => {
              const mins = Math.round((new Date(r.endsAt) - new Date(r.startsAt)) / 60000);
              const actions = ACTIONS[r.status] || [];
              const busy = busyId === r.id;
              return (
                <li key={r.id} className="px-4 py-3 grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[120px_minmax(0,1fr)_90px_110px_110px_auto] gap-x-4 gap-y-2 items-center">
                  <div className="col-span-2 md:col-span-1 flex md:block items-baseline gap-2">
                    <div className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatTime(r.startsAt)}</div>
                    <div className="text-xs text-zinc-500">until {formatTime(r.endsAt)} · {mins} min</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{r.guestName}</div>
                    <a href={`tel:${r.guestPhone}`} className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1">
                      <Call02Icon size={12} /> {r.guestPhone}
                    </a>
                    {r.notes && <p className="text-xs italic text-zinc-500 truncate" title={r.notes}>“{r.notes}”</p>}
                  </div>
                  <div className="hidden md:flex items-center gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                    <UserGroupIcon size={14} className="text-zinc-400" /> {r.partySize}
                  </div>
                  <div className="hidden md:block text-sm text-zinc-700 dark:text-zinc-300">
                    Table {r.table?.tableNumber ?? '?'}
                    <span className="block text-xs text-zinc-400">{r.table?.capacity} seats</span>
                  </div>
                  <div className="hidden md:block"><StatusPill status={r.status} /></div>
                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                    <span className="md:hidden text-xs text-zinc-500 mr-auto">T{r.table?.tableNumber} · {r.partySize} guests · <StatusPill status={r.status} /></span>
                    {actions.map(a => (
                      <Button
                        key={a.to}
                        size="sm"
                        variant={a.primary ? 'default' : 'outline'}
                        disabled={busy}
                        onClick={() => updateStatus(r.id, a.to)}
                        className={`h-7 px-2.5 text-xs ${a.danger ? 'text-red-600 hover:text-red-700 border-red-200 dark:border-red-900/50' : ''}`}
                      >
                        {a.label}
                      </Button>
                    ))}
                    <button type="button" aria-label="Delete record" title="Delete record" disabled={busy} onClick={() => remove(r.id)} className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-red-600 disabled:opacity-50">
                      <Delete02Icon size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

export default Reservations;
