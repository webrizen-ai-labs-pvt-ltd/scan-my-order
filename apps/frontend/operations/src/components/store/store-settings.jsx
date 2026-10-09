import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Input, Label } from '@smo/ui';
import {
  Store01Icon, Clock01Icon, PercentIcon, SmartPhone01Icon, UserGroupIcon, ViewIcon, Loading03Icon,
  Delete02Icon, PlusSignIcon, Copy01Icon, LinkSquare02Icon, CheckmarkCircle02Icon, ShoppingBag01Icon, ComputerIcon,
} from 'hugeicons-react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Notice, Panel, Row, SectionNav, SectionLayout } from '../settings-layout';
import { menuUrlFor } from '../../lib/menu-url';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DEFAULT_HOURS = Object.fromEntries(DAYS.map(d => [d, { open: '09:00', close: d === 'friday' || d === 'saturday' ? '23:00' : '22:00', isClosed: false }]));
const STATUS = {
  ACTIVE: { label: 'Active', hint: 'Open for guests: QR menu orders and listed on your brand page.', tone: 'bg-emerald-500' },
  SUSPENDED: { label: 'Suspended', hint: 'Temporarily closed: the QR menu says it isn’t taking orders. Staff can still use the POS.', tone: 'bg-amber-500' },
  DISABLED: { label: 'Disabled', hint: 'Closed: no QR menu orders and hidden from your brand page.', tone: 'bg-zinc-400' },
};

function parseHours(value) {
  if (value && typeof value === 'object' && Object.keys(value).length > 0) return { ...DEFAULT_HOURS, ...value };
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? { ...DEFAULT_HOURS, ...parsed } : DEFAULT_HOURS;
  } catch {
    return DEFAULT_HOURS;
  }
}

/** The editable part of a store, in one comparable shape */
function editableFrom(store) {
  return {
    name: store.name || '',
    address: store.address || '',
    contactPhone: store.contactPhone || '',
    extraPhones: Array.isArray(store.extraPhones) ? [...store.extraPhones] : [],
    contactEmail: store.contactEmail || '',
    registrationNumber: store.registrationNumber || '',
    banner: store.banner || '',
    operatingHours: parseHours(store.operatingHours),
    taxRules: Array.isArray(store.taxRules) ? store.taxRules.map(r => ({ name: r.name || '', rate: Number(r.rate) || 0 })) : [],
    status: store.status || 'ACTIVE',
    offlineUpiId: store.offlineUpiId || '',
    offlineUpiPayeeName: store.offlineUpiPayeeName || '',
    startBeforeUpiConfirmed: Boolean(store.startBeforeUpiConfirmed),
    payAtCounter: Boolean(store.payAtCounter),
    posLayout: store.posLayout === 'MODERN' ? 'MODERN' : 'CLASSIC',
  };
}

/** On/off setting with a title and an explanation */
const ToggleRow = ({ checked, onChange, title, hint, disabled }) => (
  <label className={`flex items-start justify-between gap-4 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2.5 max-w-xl ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
    <span>
      <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</span>
      <span className="block text-xs text-zinc-500">{hint}</span>
    </span>
    <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-emerald-600" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
  </label>
);

const fmtTime = (t) => {
  const [h, m] = String(t || '00:00').split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
};

/* ---------- Opening hours ---------- */

const HoursEditor = ({ hours, onChange }) => {
  const set = (day, changes) => onChange({ ...hours, [day]: { ...hours[day], ...changes } });
  const copyToAll = (from) => onChange(Object.fromEntries(DAYS.map(d => [d, { ...hours[from] }])));

  return (
    <div className="flex flex-col gap-1">
      {DAYS.map(day => {
        const h = hours[day] || DEFAULT_HOURS[day];
        const open = !h.isClosed;
        const overnight = open && h.close <= h.open;
        return (
          <div key={day} className="grid grid-cols-[96px_auto_minmax(0,1fr)] items-center gap-3 py-1.5">
            <span className="text-sm font-medium capitalize text-zinc-900 dark:text-zinc-100">{day}</span>
            <button
              type="button"
              role="switch"
              aria-checked={open}
              aria-label={`${day} ${open ? 'open' : 'closed'}`}
              onClick={() => set(day, { isClosed: open })}
              className={`relative h-6 w-10 rounded-full transition-colors ${open ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-200 dark:bg-zinc-700'}`}
            >
              <span className={`absolute top-1 size-4 rounded-full bg-white dark:bg-zinc-900 transition-transform ${open ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
            {open ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input type="time" value={h.open} onChange={e => set(day, { open: e.target.value })} aria-label={`${day} opens`} className="h-9 w-[120px] text-sm" />
                <span className="text-sm text-zinc-400">to</span>
                <Input type="time" value={h.close} onChange={e => set(day, { close: e.target.value })} aria-label={`${day} closes`} className="h-9 w-[120px] text-sm" />
                {overnight && <span className="text-xs text-zinc-500">closes next day</span>}
                {day === 'monday' && (
                  <button type="button" onClick={() => copyToAll('monday')} className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:underline ml-1">
                    Copy to all days
                  </button>
                )}
              </div>
            ) : (
              <span className="text-sm text-zinc-400">Closed</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ---------- Taxes ---------- */

const TAX_PRESETS = [
  { label: 'GST 5%', hint: 'Most restaurants', rules: [{ name: 'CGST', rate: 2.5 }, { name: 'SGST', rate: 2.5 }] },
  { label: 'GST 18%', hint: 'Hotels with rooms ≥ ₹7,500', rules: [{ name: 'CGST', rate: 9 }, { name: 'SGST', rate: 9 }] },
  { label: 'No tax', hint: 'Not GST registered', rules: [] },
];

const TaxEditor = ({ rules, onChange }) => {
  const total = rules.reduce((s, r) => s + (Number(r.rate) || 0), 0);
  const update = (idx, changes) => onChange(rules.map((r, i) => (i === idx ? { ...r, ...changes } : r)));
  return (
    <div className="flex flex-col gap-3 max-w-xl">
      <div className="flex flex-wrap gap-1.5">
        {TAX_PRESETS.map(p => (
          <button key={p.label} type="button" onClick={() => onChange(p.rules.map(r => ({ ...r })))} title={p.hint}
            className="px-3 h-8 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-zinc-400">
            {p.label}
          </button>
        ))}
      </div>
      {rules.length === 0 ? (
        <p className="text-sm text-zinc-500">No tax is added to bills.</p>
      ) : (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800">
          {rules.map((r, idx) => (
            <div key={idx} className="flex items-center gap-2 px-3 py-2">
              <Input value={r.name} onChange={e => update(idx, { name: e.target.value })} placeholder="Name, e.g. CGST" aria-label="Tax name" className="h-9 flex-1" maxLength={20} />
              <div className="relative w-28">
                <Input type="number" step="0.01" min="0" max="100" value={r.rate} onChange={e => update(idx, { rate: e.target.value === '' ? '' : Number(e.target.value) })} aria-label="Rate" className="h-9 pr-7 text-right tabular-nums" />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-zinc-400">%</span>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Remove tax" onClick={() => onChange(rules.filter((_, i) => i !== idx))} className="text-zinc-400 hover:text-red-600">
                <Delete02Icon size={16} />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => onChange([...rules, { name: '', rate: 0 }])} className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 hover:underline">
          <PlusSignIcon size={14} /> Add a tax
        </button>
        {rules.length > 0 && (
          <span className="text-xs text-zinc-500 tabular-nums">Total {total}% · a ₹100 bill becomes ₹{(100 + total).toFixed(total % 1 ? 2 : 0)}</span>
        )}
      </div>
      <p className="text-xs text-zinc-500">A single “GST” rule is shown as CGST + SGST halves on GST invoices. Changes apply to new orders only.</p>
    </div>
  );
};

/* ---------- Managers ---------- */

const EMPTY_MANAGER = { name: '', email: '', phone: '', password: '' };

const ManagersPanel = ({ storeId, canManage }) => {
  const { user } = useAuthStore();
  const [managers, setManagers] = useState(null);
  const [users, setUsers] = useState([]);
  const [mode, setMode] = useState(null); // null | 'CREATE' | 'SELECT'
  const [form, setForm] = useState(EMPTY_MANAGER);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: '', error: false });

  const load = () => api.get(`/users?role=STORE_MANAGER&storeId=${storeId}`)
    .then(res => setManagers(res.data.data.users || res.data.data || []))
    .catch(() => setManagers([]));

  useEffect(() => { load(); }, [storeId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!canManage || !user?.tenantId) return;
    api.get(`/users?tenantId=${user.tenantId}&limit=1000`)
      .then(res => setUsers(res.data.data.users || res.data.data || []))
      .catch(() => setUsers([]));
  }, [canManage, user?.tenantId]);

  // Owners keep brand-wide access, so they're not offered; neither are current managers
  const candidates = users.filter(u => u.role !== 'TENANT_ADMIN' && u.role !== 'SUPER_ADMIN' && !(managers || []).some(m => m.id === u.id));
  const picked = candidates.find(u => u.id === pick);
  const createValid = form.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) && form.password.length >= 8;

  const submit = async () => {
    setBusy(true);
    setMsg({ text: '', error: false });
    try {
      await api.patch(`/stores/${storeId}`, mode === 'CREATE'
        ? { adminUser: { ...form, name: form.name.trim(), email: form.email.trim() } }
        : { adminUserId: pick });
      setMsg({ text: mode === 'CREATE' ? `${form.name.trim()} added. A welcome email has been sent.` : `${picked?.name} now manages this store.`, error: false });
      setMode(null);
      setForm(EMPTY_MANAGER);
      setPick('');
      load();
    } catch (err) {
      setMsg({ text: err.response?.data?.error?.message || 'Could not add the manager', error: true });
    } finally {
      setBusy(false);
    }
  };

  const generate = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    setForm(prev => ({ ...prev, password: Array.from(bytes, b => chars[b % chars.length]).join('') }));
  };

  return (
    <Panel title="Managers" description="People who run this store day to day.">
      {msg.text && <div className="px-6 py-3"><Notice msg={msg} /></div>}
      <Row label="Current managers">
        {managers === null ? (
          <Loading03Icon size={16} className="animate-spin text-zinc-400" />
        ) : managers.length === 0 ? (
          <p className="text-sm text-zinc-500">No manager yet.</p>
        ) : (
          <ul className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {managers.map(m => (
              <li key={m.id} className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2.5">
                <span className="size-9 shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  {(m.name || m.email || '?').charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{m.name || 'Unnamed'}</span>
                  <span className="block text-xs text-zinc-500 truncate">{m.email}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Row>
      {canManage && (
        <Row label="Add a manager" hint="Create a new login, or move someone already on your team to manage this store.">
          {!mode ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setMode('CREATE')}><PlusSignIcon size={14} className="mr-1.5" /> New person</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setMode('SELECT')} disabled={candidates.length === 0}>From my team</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 max-w-xl">
              {mode === 'CREATE' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5"><Label htmlFor="m-name">Name</Label><Input id="m-name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoComplete="off" /></div>
                  <div className="flex flex-col gap-1.5"><Label htmlFor="m-email">Email</Label><Input id="m-email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} autoComplete="off" /></div>
                  <div className="flex flex-col gap-1.5"><Label htmlFor="m-phone">Phone <span className="font-normal text-zinc-500">(optional)</span></Label><Input id="m-phone" type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} autoComplete="off" /></div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="m-pass">First password</Label>
                    <div className="flex gap-1.5">
                      <Input id="m-pass" type="text" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="At least 8 characters" autoComplete="new-password" className="font-mono" />
                      <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={generate}>Generate</Button>
                    </div>
                  </div>
                  <p className="sm:col-span-2 text-xs text-zinc-500">They get a welcome email with these sign-in details.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="m-pick">Team member</Label>
                  <select id="m-pick" value={pick} onChange={e => setPick(e.target.value)} className="h-10 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm">
                    <option value="">Choose a person…</option>
                    {candidates.map(u => <option key={u.id} value={u.id}>{u.name} · {u.email} · {String(u.role).replace('_', ' ').toLowerCase()}</option>)}
                  </select>
                  {picked && picked.role !== 'STORE_MANAGER' && (
                    <p className="text-xs text-amber-700 dark:text-amber-400">{picked.name} is a {String(picked.role).replace('_', ' ').toLowerCase()} today and will become a store manager of this store.</p>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => { setMode(null); setMsg({ text: '', error: false }); }} disabled={busy}>Cancel</Button>
                <Button type="button" size="sm" onClick={submit} disabled={busy || (mode === 'CREATE' ? !createValid : !pick)}>
                  {busy ? <Loading03Icon size={14} className="animate-spin" /> : 'Add manager'}
                </Button>
              </div>
            </div>
          )}
        </Row>
      )}
    </Panel>
  );
};

/* ---------- Page ---------- */

/**
 * Store details editor: profile, opening hours, taxes, payment and visibility share one save bar;
 * managers are added on their own.
 */
export const StoreSettings = ({ store, onSaved }) => {
  const { user } = useAuthStore();
  const [params, setParams] = useSearchParams();
  const isOwner = user?.role === 'SUPER_ADMIN' || user?.role === 'TENANT_ADMIN';
  const [saved, setSaved] = useState(() => editableFrom(store));
  const [form, setForm] = useState(() => editableFrom(store));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', error: false });
  const [copied, setCopied] = useState(false);
  const [bannerBroken, setBannerBroken] = useState(false);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);
  const set = (field) => (value) => setForm(prev => ({ ...prev, [field]: value?.target ? value.target.value : value }));

  // Warn before leaving the page with unsaved changes
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => { setBannerBroken(false); }, [form.banner]);

  const taxProblem = form.taxRules.some(r => !String(r.name).trim() || r.rate === '' || Number(r.rate) < 0 || Number(r.rate) > 100);
  const valid = form.name.trim().length >= 2 && !taxProblem;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setMsg({ text: '', error: false });
    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      contactPhone: form.contactPhone.trim(),
      extraPhones: form.extraPhones.map(p => p.trim()).filter(Boolean),
      contactEmail: form.contactEmail.trim(),
      registrationNumber: form.registrationNumber.trim(),
      banner: form.banner.trim(),
      operatingHours: form.operatingHours,
      taxRules: form.taxRules.map(r => ({ name: String(r.name).trim(), rate: Number(r.rate) })),
      status: form.status,
      startBeforeUpiConfirmed: form.startBeforeUpiConfirmed,
      payAtCounter: form.payAtCounter,
      posLayout: form.posLayout,
      // Only brand owners decide where UPI money goes; the API refuses it for others
      ...(isOwner ? { offlineUpiId: form.offlineUpiId.trim(), offlineUpiPayeeName: form.offlineUpiPayeeName.trim() } : {}),
    };
    try {
      const res = await api.patch(`/stores/${store.id}`, payload);
      const next = editableFrom({ ...store, ...res.data.data });
      setSaved(next);
      setForm(next);
      setMsg({ text: 'Store saved.', error: false });
      onSaved?.(res.data.data);
    } catch (err) {
      setMsg({ text: err.response?.data?.error?.message || 'Could not save the store', error: true });
    } finally {
      setSaving(false);
    }
  };

  const menuUrl = store.tenant?.slug ? menuUrlFor(store.tenant.slug, store.slug) : null;
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(menuUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  const sections = [
    { id: 'profile', label: 'Profile', hint: 'Name, address, contact', icon: Store01Icon },
    { id: 'hours', label: 'Opening hours', hint: 'Weekly timings', icon: Clock01Icon },
    { id: 'taxes', label: 'Taxes', hint: 'GST on bills', icon: PercentIcon },
    ...(isOwner ? [{ id: 'payments', label: 'Payments', hint: 'Store UPI ID', icon: SmartPhone01Icon }] : []),
    { id: 'pos', label: 'POS', hint: 'Billing screen', icon: ComputerIcon },
    { id: 'ordering', label: 'Guest ordering', hint: 'UPI & pay at counter', icon: ShoppingBag01Icon },
    { id: 'managers', label: 'Managers', hint: 'Who runs it', icon: UserGroupIcon },
    { id: 'visibility', label: 'Visibility', hint: 'Status', icon: ViewIcon },
  ];
  const active = sections.some(s => s.id === params.get('section')) ? params.get('section') : 'profile';
  const setSection = (id) => setParams(prev => {
    const next = new URLSearchParams(prev);
    if (id === 'profile') next.delete('section'); else next.set('section', id);
    return next;
  }, { replace: true });

  // Sections with unsaved edits get a dot in the nav
  const changed = {
    profile: ['name', 'address', 'contactPhone', 'contactEmail', 'registrationNumber', 'banner'].some(k => form[k] !== saved[k])
      || JSON.stringify(form.extraPhones) !== JSON.stringify(saved.extraPhones),
    hours: JSON.stringify(form.operatingHours) !== JSON.stringify(saved.operatingHours),
    taxes: JSON.stringify(form.taxRules) !== JSON.stringify(saved.taxRules),
    payments: form.offlineUpiId !== saved.offlineUpiId || form.offlineUpiPayeeName !== saved.offlineUpiPayeeName,
    visibility: form.status !== saved.status,
    pos: form.posLayout !== saved.posLayout,
    ordering: form.startBeforeUpiConfirmed !== saved.startBeforeUpiConfirmed || form.payAtCounter !== saved.payAtCounter,
  };
  const navTabs = sections.map(s => ({ ...s, label: changed[s.id] ? `${s.label} •` : s.label }));

  return (
    <div className="flex flex-col gap-5 pb-24">
      {msg.text && <Notice msg={msg} />}
      <SectionLayout nav={<SectionNav tabs={navTabs} active={active} onChange={setSection} label="Store sections" />}>
        {active === 'profile' && (
          <Panel title="Profile" description="How this store appears to guests and on bills.">
            <Row label="Store name" hint="Printed on bills and shown on the QR menu.">
              <Input value={form.name} onChange={set('name')} maxLength={80} className="max-w-md" />
              {form.name.trim().length < 2 && <p className="mt-1 text-xs text-red-600">Enter a name.</p>}
            </Row>
            <Row label="Menu address" hint="Where table QR codes point. It can’t be changed here, because printed QR codes would stop working.">
              {menuUrl ? (
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 h-9 flex items-center text-xs font-mono text-zinc-700 dark:text-zinc-300 max-w-full truncate">{menuUrl}</code>
                  <Button type="button" variant="outline" size="sm" onClick={copyLink}>{copied ? <CheckmarkCircle02Icon size={14} /> : <Copy01Icon size={14} />}<span className="ml-1.5">{copied ? 'Copied' : 'Copy'}</span></Button>
                  <a href={menuUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <LinkSquare02Icon size={14} /> Open menu
                  </a>
                </div>
              ) : <span className="text-sm font-mono text-zinc-600">{store.slug}</span>}
            </Row>
            <Row label="Address">
              <textarea value={form.address} onChange={set('address')} rows={2} maxLength={300} className="w-full max-w-xl rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400/40" />
            </Row>
            <Row label="Phone numbers" hint="All of them are printed on bills. The first one is the main number.">
              <div className="flex flex-col gap-2 max-w-md">
                <div className="flex items-center gap-2">
                  <Input id="s-phone" type="tel" value={form.contactPhone} onChange={set('contactPhone')} maxLength={20} placeholder="Main number" aria-label="Main phone number" />
                  <span className="shrink-0 w-16 text-[11px] font-semibold text-zinc-500">Main</span>
                </div>
                {form.extraPhones.map((phone, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      type="tel"
                      value={phone}
                      maxLength={20}
                      placeholder="Another number"
                      aria-label={`Phone number ${i + 2}`}
                      onChange={e => setForm(f => ({ ...f, extraPhones: f.extraPhones.map((p, j) => (j === i ? e.target.value : p)) }))}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 w-16 text-zinc-500 hover:text-red-600"
                      aria-label={`Remove phone number ${i + 2}`}
                      onClick={() => setForm(f => ({ ...f, extraPhones: f.extraPhones.filter((_, j) => j !== i) }))}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                {form.extraPhones.length < 4 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() => setForm(f => ({ ...f, extraPhones: [...f.extraPhones, ''] }))}
                  >
                    + Add another number
                  </Button>
                )}
              </div>
            </Row>
            <Row label="Email" hint="Shown on receipts.">
              <Input id="s-email" type="email" value={form.contactEmail} onChange={set('contactEmail')} maxLength={120} className="max-w-md" />
            </Row>
            <Row label="Registration number" hint="Optional. For example your FSSAI licence or shop registration number. Printed on bills.">
              <Input value={form.registrationNumber} onChange={set('registrationNumber')} maxLength={50} placeholder="e.g. 12823999000123" className="max-w-md" />
            </Row>
            <Row label="Banner" hint="The wide picture at the top of the QR menu. Paste an image link.">
              <div className="flex flex-col gap-2 max-w-xl">
                <Input value={form.banner} onChange={set('banner')} placeholder="https://…/banner.jpg" />
                {form.banner.trim() && (bannerBroken ? (
                  <p className="text-xs text-red-600">That link doesn’t load as an image.</p>
                ) : (
                  <img src={form.banner.trim()} alt="Banner preview" onError={() => setBannerBroken(true)} className="h-28 w-full rounded-lg object-cover border border-zinc-200 dark:border-zinc-800" />
                ))}
              </div>
            </Row>
          </Panel>
        )}

        {active === 'hours' && (
          <Panel title="Opening hours" description="When this store is open during the week.">
            <Row label="Weekly timings" hint="Switch a day off to mark it closed. A closing time before the opening time runs past midnight.">
              <HoursEditor hours={form.operatingHours} onChange={set('operatingHours')} />
            </Row>
          </Panel>
        )}

        {active === 'taxes' && (
          <Panel title="Taxes" description="Added on top of menu prices on every bill.">
            <Row label="Tax rules" hint="Pick a preset or add your own. Each rule needs a name and a rate.">
              <TaxEditor rules={form.taxRules} onChange={set('taxRules')} />
              {taxProblem && <p className="mt-2 text-xs text-red-600">Every tax needs a name and a rate between 0 and 100%.</p>}
            </Row>
          </Panel>
        )}

        {active === 'payments' && isOwner && (
          <Panel title="Payments" description="Where “UPI (own QR)” payments at this store are paid.">
            <Row label="Store UPI ID" hint="Leave empty to use the brand’s UPI ID. Use this when this branch has its own bank account.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
                <div className="flex flex-col gap-1.5"><Label htmlFor="s-upi">UPI ID</Label><Input id="s-upi" value={form.offlineUpiId} onChange={e => set('offlineUpiId')(e.target.value.trim())} placeholder="branch@okicici" className="font-mono" autoComplete="off" /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor="s-payee">Name shown to payer</Label><Input id="s-payee" value={form.offlineUpiPayeeName} onChange={set('offlineUpiPayeeName')} maxLength={50} /></div>
              </div>
            </Row>
          </Panel>
        )}

        {active === 'managers' && <ManagersPanel storeId={store.id} canManage={isOwner} />}

        {active === 'pos' && (
          <Panel title="POS" description="How the counter takes orders on this store's POS.">
            <Row label="Billing screen" hint="What staff see when they start a new order. Both use the same orders, payments and printing.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl" role="radiogroup" aria-label="Billing screen">
                {[
                  ['CLASSIC', 'Classic', 'Everything on one screen: categories, item names, the bill, and Save / KOT buttons. Fastest for counter staff; type short codes to add items.'],
                  ['MODERN', 'Modern', 'A picture menu with a cart and a separate checkout page. Good for tablets and when photos help.'],
                ].map(([id, label, hint]) => (
                  <button key={id} type="button" role="radio" aria-checked={form.posLayout === id} onClick={() => set('posLayout')(id)}
                    className={`rounded-lg border px-3 py-2.5 text-left ${form.posLayout === id ? 'border-zinc-900 dark:border-zinc-100' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'}`}>
                    <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</span>
                    <span className="block text-xs text-zinc-500">{hint}</span>
                  </button>
                ))}
              </div>
            </Row>
          </Panel>
        )}

        {active === 'ordering' && (
          <Panel title="Guest ordering" description="How guests pay when they order from the QR menu.">
            <Row label="UPI to your own ID" hint="When the brand has no Razorpay keys, guests pay the store's UPI ID from their phone, then a cashier or manager confirms it on the POS.">
              <div className="flex flex-col gap-2">
                <ToggleRow
                  checked={form.startBeforeUpiConfirmed}
                  onChange={set('startBeforeUpiConfirmed')}
                  title="Start cooking before the payment is confirmed"
                  hint="Faster for guests, but the kitchen may cook an order that was never paid. Off: the kitchen gets it once a cashier confirms the money arrived."
                />
                {!store.offlineUpiId && !store.tenant?.offlineUpiId && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 max-w-xl">No UPI ID is set yet, so guests can't pay this way. {isOwner ? 'Add one under Payments.' : 'Ask the brand owner to add one.'}</p>
                )}
                <p className="text-xs text-zinc-500 max-w-xl">Tip: use a business UPI ID (GPay for Business, PhonePe Business). Payment apps limit or warn on pre-filled payments to personal IDs.</p>
              </div>
            </Row>
            <Row label="Pay at counter" hint="For counter stores (malls, food courts): guests can place the order on their phone and pay when they collect.">
              <ToggleRow
                checked={form.payAtCounter}
                onChange={set('payAtCounter')}
                title="Allow pay at counter"
                hint={store.serviceMode === 'COUNTER'
                  ? 'Guests choose it at checkout. The kitchen gets the order once the cashier collects the payment. Off: online or UPI payment only.'
                  : 'Only used by counter stores. This store takes orders at tables, where guests can already pay at the table.'}
                disabled={store.serviceMode !== 'COUNTER'}
              />
            </Row>
          </Panel>
        )}

        {active === 'visibility' && (
          <Panel title="Visibility" description="Whether guests can find this store and order from its QR menu.">
            <Row label="Status">
              <div className="flex flex-col gap-2 max-w-md" role="radiogroup" aria-label="Store status">
                {Object.entries(STATUS).map(([id, s]) => (
                  <button key={id} type="button" role="radio" aria-checked={form.status === id} onClick={() => set('status')(id)}
                    className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left ${form.status === id ? 'border-zinc-900 dark:border-zinc-100' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'}`}>
                    <span className={`mt-1.5 size-2 rounded-full ${s.tone}`} />
                    <span>
                      <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{s.label}</span>
                      <span className="block text-xs text-zinc-500">{s.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Row>
          </Panel>
        )}
      </SectionLayout>

      {/* Save bar: appears when something changed */}
      {dirty && (
        <div className="sticky bottom-4 z-20 flex justify-end">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Unsaved changes</span>
            <Button type="button" variant="outline" size="sm" onClick={() => { setForm(saved); setMsg({ text: '', error: false }); }} disabled={saving}>Discard</Button>
            <Button type="button" size="sm" onClick={save} disabled={!valid || saving}>
              {saving ? <Loading03Icon size={14} className="animate-spin" /> : 'Save changes'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
