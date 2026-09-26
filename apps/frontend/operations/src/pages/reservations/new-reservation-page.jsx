import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input, Label } from '@smo/ui';
import {
  ArrowLeft01Icon, Loading03Icon, MinusSignIcon, PlusSignIcon, AlertCircleIcon, InformationCircleIcon,
  UserGroupIcon, Calendar01Icon, Clock01Icon,
} from 'hugeicons-react';
import api from '../../lib/api';
import { localDateStr, formatDay, formatTime, useReservationStore } from './reservation-utils';

const DURATIONS = [
  { value: 45, label: '45 min' },
  { value: 60, label: '1 h' },
  { value: 90, label: '1.5 h' },
  { value: 120, label: '2 h' },
  { value: 150, label: '2.5 h' },
];

/** Next quarter hour from now, as HH:MM */
const nextSlot = () => {
  const d = new Date();
  d.setMinutes(Math.ceil((d.getMinutes() + 1) / 15) * 15, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const Section = ({ title, children }) => (
  <div className="px-6 py-5 flex flex-col gap-4">
    <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</h2>
    {children}
  </div>
);

/**
 * /dashboard/reservations/new?store=&date=&tableId= — book a table. Availability is checked
 * live for the chosen time, so a booked table can't be picked.
 */
export const NewReservationPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { storeId, stores } = useReservationStore();

  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState(params.get('date') || localDateStr());
  const [time, setTime] = useState(nextSlot);
  const [duration, setDuration] = useState(90);
  const [notes, setNotes] = useState('');
  const [tableId, setTableId] = useState(params.get('tableId') || '');

  const [tables, setTables] = useState(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const listPath = `/dashboard/reservations?${new URLSearchParams({ ...(storeId ? { store: storeId } : {}), ...(date !== localDateStr() ? { date } : {}) })}`;
  const back = () => (location.key !== 'default' ? navigate(-1) : navigate(listPath));

  const startsAt = useMemo(() => {
    const d = new Date(`${date}T${time}:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [date, time]);
  const inPast = startsAt && startsAt.getTime() < Date.now() - 5 * 60 * 1000;

  // Live availability for the chosen slot
  useEffect(() => {
    if (!storeId || !startsAt) return undefined;
    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/stores/${storeId}/reservations/availability`, {
          params: { startsAt: startsAt.toISOString(), durationMinutes: duration, partySize },
        });
        setTables(Array.isArray(res.data.data) ? res.data.data : []);
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Could not check table availability');
      } finally {
        setChecking(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [storeId, startsAt, duration, partySize]);

  const selected = tables?.find(t => t.tableId === tableId) || null;
  const selectedUnavailable = selected && !selected.isAvailable;
  const availableCount = tables?.filter(t => t.isAvailable).length ?? 0;
  const valid = guestName.trim().length >= 2 && guestPhone.trim().length >= 6 && selected?.isAvailable && startsAt && !inPast;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError('');
    try {
      await api.post(`/stores/${storeId}/reservations`, {
        tableId,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        partySize,
        startsAt: startsAt.toISOString(),
        durationMinutes: duration,
        notes: notes.trim() || null,
      });
      // Back to the booked day; replace so Back doesn't reopen a finished form
      navigate(listPath, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not create the reservation');
      setSaving(false);
    }
  };

  const storeName = stores.find(s => s.id === storeId)?.name;
  const endsAt = startsAt ? new Date(startsAt.getTime() + duration * 60000) : null;

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 pb-12">
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={back} aria-label="Back to reservations"><ArrowLeft01Icon size={16} /></Button>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">New reservation</h1>
          <p className="text-sm text-zinc-500">{storeName ? `${storeName} · ` : ''}Tables already booked for this time can't be picked.</p>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircleIcon size={16} /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-5 items-start">
        {/* Booking details */}
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 divide-y divide-zinc-200 dark:divide-zinc-800">
          <Section title="Guest">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="guest-name">Name *</Label>
              <Input id="guest-name" value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="e.g. Priya Sharma" autoFocus maxLength={80} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="guest-phone">Phone *</Label>
              <Input id="guest-phone" type="tel" inputMode="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="e.g. 98765 43210" maxLength={20} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Party size *</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon" aria-label="Fewer guests" disabled={partySize <= 1} onClick={() => setPartySize(n => Math.max(1, n - 1))}><MinusSignIcon size={14} /></Button>
                <input
                  type="number" min={1} max={40} value={partySize} aria-label="Party size"
                  onChange={e => setPartySize(Math.max(1, Math.min(40, parseInt(e.target.value, 10) || 1)))}
                  className="h-9 w-16 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent text-center text-sm font-semibold tabular-nums outline-none"
                />
                <Button type="button" variant="outline" size="icon" aria-label="More guests" disabled={partySize >= 40} onClick={() => setPartySize(n => Math.min(40, n + 1))}><PlusSignIcon size={14} /></Button>
                <span className="text-sm text-zinc-500">guest{partySize === 1 ? '' : 's'}</span>
              </div>
            </div>
          </Section>

          <Section title="When">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="res-date">Date *</Label>
                <Input id="res-date" type="date" value={date} min={localDateStr()} onChange={e => e.target.value && setDate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="res-time">Time *</Label>
                <Input id="res-time" type="time" step={900} value={time} onChange={e => e.target.value && setTime(e.target.value)} />
              </div>
            </div>
            {inPast && <p className="text-xs text-red-600">That time has already passed.</p>}
            <div className="flex flex-col gap-1.5">
              <Label>Duration</Label>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Duration">
                {DURATIONS.map(d => (
                  <button
                    key={d.value}
                    type="button"
                    role="radio"
                    aria-checked={duration === d.value}
                    onClick={() => setDuration(d.value)}
                    className={`px-3 h-8 rounded-md text-sm border ${duration === d.value
                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Notes">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              maxLength={300}
              aria-label="Notes"
              placeholder="e.g. Birthday, window seat, high chair needed"
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400/40 resize-none"
            />
          </Section>
        </section>

        {/* Table picker + summary */}
        <div className="flex flex-col gap-5 min-w-0">
          <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <header className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Choose a table</h2>
                <p className="text-sm text-zinc-500">
                  {tables ? `${availableCount} of ${tables.length} free for ${partySize} guest${partySize === 1 ? '' : 's'}` : 'Checking…'}
                </p>
              </div>
              {checking && <Loading03Icon size={16} className="animate-spin text-zinc-400" />}
            </header>

            <div className="p-4">
              {selectedUnavailable && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                  <InformationCircleIcon size={16} className="shrink-0 mt-0.5" />
                  Table {selected.tableNumber} isn't free for this booking. Pick another table or change the time.
                </div>
              )}
              {!tables ? (
                <div className="h-40 flex items-center justify-center text-zinc-400"><Loading03Icon size={20} className="animate-spin" /></div>
              ) : tables.length === 0 ? (
                <p className="py-10 text-center text-sm text-zinc-500">This store has no active tables.</p>
              ) : (
                <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(128px,1fr))]" role="radiogroup" aria-label="Table">
                  {tables.map(t => {
                    const on = t.tableId === tableId;
                    const tooSmall = !t.conflictingReservation && !t.isAvailable;
                    return (
                      <button
                        key={t.tableId}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={!t.isAvailable}
                        onClick={() => setTableId(t.tableId)}
                        className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${on
                          ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                          : t.isAvailable
                            ? 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
                            : 'border-dashed border-zinc-200 dark:border-zinc-800 opacity-60 cursor-not-allowed'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">Table {t.tableNumber}</span>
                          <span className={`text-xs flex items-center gap-0.5 ${on ? 'opacity-80' : 'text-zinc-500'}`}><UserGroupIcon size={12} /> {t.capacity}</span>
                        </div>
                        <div className={`mt-1 text-[11px] truncate ${on ? 'opacity-80' : t.isAvailable ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-500'}`}>
                          {t.isAvailable
                            ? 'Free'
                            : tooSmall
                              ? `Seats ${t.capacity}`
                              : `Booked · ${t.conflictingReservation.guestName} ${formatTime(t.conflictingReservation.startsAt)}`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Summary */}
          <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <dl className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-zinc-500 flex items-center gap-1"><Calendar01Icon size={12} /> Date</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100">{formatDay(date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 flex items-center gap-1"><Clock01Icon size={12} /> Time</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100">{startsAt ? `${formatTime(startsAt)} – ${formatTime(endsAt)}` : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 flex items-center gap-1"><UserGroupIcon size={12} /> Table</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100">{selected?.isAvailable ? `Table ${selected.tableNumber} · ${partySize} guest${partySize === 1 ? '' : 's'}` : 'Not chosen'}</dd>
              </div>
            </dl>
            <div className="flex gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={back} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={!valid || saving}>
                {saving ? <Loading03Icon size={16} className="animate-spin" /> : 'Confirm reservation'}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </form>
  );
};
