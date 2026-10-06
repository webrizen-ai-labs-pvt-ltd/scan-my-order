import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, Button } from '@smo/ui';
import { Loading03Icon, QrCodeIcon, ArrowRight01Icon } from 'hugeicons-react';
import api from '../lib/api';

const errorText = (err, fallback) => err?.response?.data?.error?.message || fallback;

/**
 * Which mall / food court this store belongs to, and how it takes orders there.
 * Outside a venue a store always uses table service.
 */
export const StoreVenuePanel = ({ store, onChanged }) => {
  const [venues, setVenues] = useState(null);
  const [venueId, setVenueId] = useState(store.venueId || '');
  const [serviceMode, setServiceMode] = useState(store.serviceMode || 'TABLES');
  const [location, setLocation] = useState(store.venueLocation || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.get('/venues').then(res => setVenues(res.data.data)).catch(() => setVenues([]));
  }, []);

  // Picking a venue suggests counter mode (malls and food courts rarely have table service)
  const pickVenue = (id) => {
    setVenueId(id);
    if (id && !store.venueId) setServiceMode('COUNTER');
    if (!id) setServiceMode('TABLES');
  };

  const dirty = venueId !== (store.venueId || '')
    || (venueId && serviceMode !== store.serviceMode)
    || (venueId && location.trim() !== (store.venueLocation || ''));

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const details = { serviceMode, venueLocation: location.trim() };
      if (venueId !== (store.venueId || '')) {
        if (store.venueId) await api.delete(`/venues/${store.venueId}/stores/${store.id}`);
        if (venueId) await api.post(`/venues/${venueId}/stores`, { storeId: store.id, ...details });
      } else if (venueId) {
        await api.patch(`/venues/${venueId}/stores/${store.id}`, details);
      }
      setMessage({ ok: true, text: 'Saved' });
      onChanged();
    } catch (err) {
      setMessage({ ok: false, text: errorText(err, 'Could not update the venue') });
    } finally {
      setBusy(false);
    }
  };

  const current = venues?.find(v => v.id === venueId);

  return (
    <Card className="mt-6">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold"><QrCodeIcon size={18} className="text-yellow-600" /> Venue</h3>
            <p className="text-sm text-zinc-500">
              Put this store in a mall, food court or cinema so it shows on that venue's single QR code.
            </p>
          </div>
          {current && (
            <Link to={`/venues/${current.id}`} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              Open venue <ArrowRight01Icon size={14} />
            </Link>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Venue</span>
            <select
              value={venueId}
              onChange={e => pickVenue(e.target.value)}
              disabled={!venues || busy}
              className="h-9 w-full rounded-md border border-zinc-200 bg-transparent px-2 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">Not in a venue</option>
              {(venues || []).map(v => (
                <option key={v.id} value={v.id}>{v.name}{v.city ? ` · ${v.city}` : ''}{v.isActive ? '' : ' (hidden)'}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">How guests order</span>
            <select
              value={serviceMode}
              onChange={e => setServiceMode(e.target.value)}
              disabled={!venueId || busy}
              className="h-9 w-full rounded-md border border-zinc-200 bg-transparent px-2 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="COUNTER">Counter: takeaway, prepaid, pickup number</option>
              <option value="TABLES">Tables: waiter service</option>
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Where is the counter?</span>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              disabled={!venueId || busy}
              placeholder="e.g. 3rd floor, counter 12"
              maxLength={120}
              className="h-9 w-full rounded-md border border-zinc-200 bg-transparent px-3 outline-none focus:border-zinc-400 disabled:opacity-60 dark:border-zinc-800"
            />
          </label>
        </div>

        {venueId && serviceMode === 'COUNTER' && (
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">
            Counter mode: guests order takeaway from the venue QR, pay on their phone (the brand needs Razorpay keys) and collect with a pickup number. No tables or waiters.
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          {message && <span role="status" className={`text-sm ${message.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{message.text}</span>}
          <Button onClick={save} disabled={!dirty || busy}>
            {busy && <Loading03Icon size={16} className="mr-2 animate-spin" />} Save venue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
