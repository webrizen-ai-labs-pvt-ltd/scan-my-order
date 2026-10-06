import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, Input, Label, Button, Badge } from '@smo/ui';
import {
  ArrowLeft01Icon, Loading03Icon, Delete02Icon, Search01Icon, PlusSignIcon, Download01Icon,
  Copy01Icon, AlertCircleIcon, Store01Icon, LinkSquare02Icon
} from 'hugeicons-react';
import api from '../lib/api';
import { venueUrlFor, venueUrlIsLocalOnly } from '../lib/venue-links';
import { renderVenueQrCard } from '../lib/venue-qr-card';

const errorText = (err, fallback) => err?.response?.data?.error?.message || fallback;
const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const EMPTY = { name: '', slug: '', city: '', address: '', description: '', coverImage: '', isActive: true };

/* ---------- details ---------- */

const VenueDetails = ({ venue, onSaved }) => {
  const isNew = !venue;
  const [form, setForm] = useState(() => (venue ? { ...EMPTY, ...Object.fromEntries(Object.entries(venue).map(([k, v]) => [k, v ?? ''])), isActive: venue.isActive } : EMPTY));
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const set = (key, value) => setForm(f => ({
    ...f,
    [key]: value,
    ...(key === 'name' && !slugTouched ? { slug: slugify(value) } : {})
  }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const payload = { ...form, slug: form.slug.trim().toLowerCase() };
      const res = isNew ? await api.post('/venues', payload) : await api.put(`/venues/${venue.id}`, payload);
      setMessage({ ok: true, text: isNew ? 'Venue created' : 'Saved' });
      onSaved(res.data.data);
    } catch (err) {
      setMessage({ ok: false, text: errorText(err, 'Could not save the venue') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-5">
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="v-name">Name *</Label>
              <Input id="v-name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Phoenix Mall Food Court" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-slug">Link name *</Label>
              <div className="flex items-center rounded-md border border-zinc-200 pl-3 text-sm dark:border-zinc-800">
                <span className="shrink-0 text-zinc-400">/v/</span>
                <input
                  id="v-slug"
                  value={form.slug}
                  onChange={e => { setSlugTouched(true); set('slug', e.target.value.toLowerCase()); }}
                  className="h-9 min-w-0 flex-1 bg-transparent px-1 outline-none"
                  placeholder="phoenix-food-court"
                  required
                />
              </div>
              {!isNew && <p className="text-[11px] text-amber-700 dark:text-amber-400">Changing it breaks QR codes already printed.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-city">City</Label>
              <Input id="v-city" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Kolkata" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-address">Address</Label>
              <Input id="v-address" value={form.address} onChange={e => set('address', e.target.value)} placeholder="3rd floor, Phoenix Mall" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="v-desc">Short description</Label>
              <Input id="v-desc" value={form.description} onChange={e => set('description', e.target.value)} placeholder="20+ counters, open 11 am – 10 pm" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="v-cover">Cover image URL</Label>
              <Input id="v-cover" value={form.coverImage} onChange={e => set('coverImage', e.target.value)} placeholder="https://…" />
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
            <span>
              <span className="block text-sm font-medium">Live</span>
              <span className="block text-xs text-zinc-500">When off, the venue page says it isn't available. Counters keep their own menus.</span>
            </span>
            <input type="checkbox" className="size-5 accent-emerald-600" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} />
          </label>
          <div className="flex items-center justify-end gap-3">
            {message && <span role="status" className={`text-sm ${message.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{message.text}</span>}
            <Button type="submit" disabled={busy}>
              {busy && <Loading03Icon size={16} className="mr-2 animate-spin" />} {isNew ? 'Create venue' : 'Save changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

/* ---------- QR ---------- */

const VenueQr = ({ venue }) => {
  const url = venueUrlFor(venue.slug);
  const svgRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const png = await renderVenueQrCard(svgRef.current, { venueName: venue.name, city: venue.city });
      if (!png) return;
      const a = document.createElement('a');
      a.download = `${venue.slug}-qr.png`;
      a.href = png;
      a.click();
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <h3 className="font-semibold">Venue QR code</h3>
          <p className="text-sm text-zinc-500">Print it once and put it on tables, pillars and entrances. It opens every counter.</p>
        </div>
        {venueUrlIsLocalOnly() && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertCircleIcon size={14} className="mt-0.5 shrink-0" />
            This code points to localhost, so phones can't open it. Open the admin panel with your computer's network address, or set VITE_MENU_URL.
          </p>
        )}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800">
            <QRCodeSVG
              ref={svgRef}
              value={url}
              size={150}
              level="H"
              marginSize={0}
              imageSettings={{ src: '/logo.png', width: 32, height: 32 * (500 / 512), excavate: true }}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{url}</span>
              <button type="button" onClick={copy} className="shrink-0 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" aria-label="Copy link">
                {copied ? <span className="text-xs text-emerald-600">Copied</span> : <Copy01Icon size={15} />}
              </button>
              <a href={url} target="_blank" rel="noreferrer" className="shrink-0 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" aria-label="Open the venue page">
                <LinkSquare02Icon size={15} />
              </a>
            </div>
            <Button onClick={download} disabled={busy} className="w-full sm:w-auto">
              {busy ? <Loading03Icon size={16} className="mr-2 animate-spin" /> : <Download01Icon size={16} className="mr-2" />}
              Download print-ready QR
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/* ---------- counters ---------- */

const CounterRow = ({ venueId, store, onChanged }) => {
  const [location, setLocation] = useState(store.venueLocation || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const patch = async (data) => {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/venues/${venueId}/stores/${store.id}`, data);
      onChanged();
    } catch (err) {
      setError(errorText(err, 'Could not update'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Remove ${store.tenant.name} · ${store.name} from this venue? It goes back to table service.`)) return;
    setBusy(true);
    try {
      await api.delete(`/venues/${venueId}/stores/${store.id}`);
      onChanged();
    } catch (err) {
      setError(errorText(err, 'Could not remove'));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
          {store.tenant.logo ? <img src={store.tenant.logo} alt="" className="h-full w-full object-cover" /> : <Store01Icon size={16} className="text-zinc-400" />}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium">{store.tenant.name}</p>
          <p className="truncate text-xs text-zinc-500">{store.name}{store.status !== 'ACTIVE' ? ` · ${store.status.toLowerCase()}` : ''}</p>
        </div>
      </div>
      <input
        value={location}
        onChange={e => setLocation(e.target.value)}
        onBlur={() => location !== (store.venueLocation || '') && patch({ venueLocation: location })}
        placeholder="Where is it? e.g. Counter 12"
        aria-label={`Location of ${store.tenant.name}`}
        className="h-9 w-full rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none focus:border-zinc-400 sm:w-52 dark:border-zinc-800"
      />
      <select
        value={store.serviceMode}
        onChange={e => patch({ serviceMode: e.target.value })}
        disabled={busy}
        aria-label={`How ${store.tenant.name} takes orders`}
        className="h-9 rounded-md border border-zinc-200 bg-transparent px-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <option value="COUNTER">Counter: takeaway, prepaid</option>
        <option value="TABLES">Tables: waiter service</option>
      </select>
      <Button variant="ghost" size="sm" onClick={remove} disabled={busy} className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30" aria-label="Remove from venue">
        {busy ? <Loading03Icon size={16} className="animate-spin" /> : <Delete02Icon size={16} />}
      </Button>
      {error && <p className="text-xs text-rose-600 sm:basis-full">{error}</p>}
    </div>
  );
};

const AddCounter = ({ venueId, onAdded }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      api.get('/venues/store-search', { params: { q: query } })
        .then(res => setResults(res.data.data))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const add = async (store) => {
    setBusyId(store.id);
    setError('');
    try {
      await api.post(`/venues/${venueId}/stores`, { storeId: store.id });
      setResults(r => r.map(s => (s.id === store.id ? { ...s, venueId } : s)));
      onAdded();
    } catch (err) {
      setError(errorText(err, 'Could not add the store'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 dark:border-zinc-800">
        <Search01Icon size={15} className="text-zinc-400" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search stores or brands to add"
          aria-label="Search stores to add"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="max-h-64 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
        {results.map(store => {
          const here = store.venueId === venueId;
          const elsewhere = store.venueId && !here;
          return (
            <div key={store.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{store.tenant.name} · {store.name}</p>
                {elsewhere && <p className="truncate text-xs text-zinc-500">In {store.venue?.name}</p>}
              </div>
              {here ? (
                <Badge variant="secondary">Added</Badge>
              ) : (
                <Button size="sm" variant="outline" disabled={Boolean(elsewhere) || busyId === store.id} onClick={() => add(store)}>
                  {busyId === store.id ? <Loading03Icon size={14} className="animate-spin" /> : <><PlusSignIcon size={14} className="mr-1" /> Add</>}
                </Button>
              )}
            </div>
          );
        })}
        {results.length === 0 && <p className="py-3 text-center text-sm text-zinc-500">No stores found</p>}
      </div>
    </div>
  );
};

/* ---------- page ---------- */

/** /venues/new and /venues/:id */
export const VenueEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const [venue, setVenue] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (isNew) return;
    try {
      const res = await api.get(`/venues/${id}`);
      setVenue(res.data.data);
    } catch (err) {
      setError(errorText(err, 'Could not load the venue'));
    }
  }, [id, isNew]);

  useEffect(() => { load(); }, [load]);

  const deleteVenue = async () => {
    if (!window.confirm(`Delete ${venue.name}? Its QR code stops working. The stores stay as they are.`)) return;
    try {
      await api.delete(`/venues/${venue.id}`);
      navigate('/venues');
    } catch (err) {
      setError(errorText(err, 'Could not delete the venue'));
    }
  };

  if (!isNew && !venue && !error) {
    return <div className="flex justify-center p-8"><Loading03Icon className="animate-spin text-zinc-500" /></div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/venues')} aria-label="Back to venues">
            <ArrowLeft01Icon size={16} />
          </Button>
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold tracking-tight">{isNew ? 'New venue' : venue?.name}</h2>
            <p className="text-sm text-zinc-500">{isNew ? 'A mall, food court or cinema with counters from different brands.' : `${venue?.stores?.length || 0} counters`}</p>
          </div>
        </div>
        {!isNew && venue && (
          <Button variant="ghost" size="sm" onClick={deleteVenue} className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">
            <Delete02Icon size={16} className="mr-1.5" /> Delete
          </Button>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

      <VenueDetails
        key={venue?.updatedAt || 'new'}
        venue={venue}
        onSaved={(saved) => (isNew ? navigate(`/venues/${saved.id}`, { replace: true }) : load())}
      />

      {venue && (
        <>
          <VenueQr venue={venue} />

          <Card>
            <CardContent className="space-y-4 p-5">
              <div>
                <h3 className="font-semibold">Counters</h3>
                <p className="text-sm text-zinc-500">
                  Each store keeps its own menu, kitchen screen and payments. <b>Counter</b> mode means takeaway, paid on the phone, with a pickup number and no tables or waiters.
                </p>
              </div>
              {venue.stores.length > 0 ? (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {venue.stores.map(store => <CounterRow key={store.id} venueId={venue.id} store={store} onChanged={load} />)}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700">No counters yet. Add stores below.</p>
              )}
              <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <AddCounter venueId={venue.id} onAdded={load} />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
