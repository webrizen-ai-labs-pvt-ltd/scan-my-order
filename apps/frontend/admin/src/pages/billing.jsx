import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Skeleton } from '@smo/ui';
import {
  PlusSignIcon, CheckmarkCircle02Icon, Search01Icon, Cancel01Icon, Loading03Icon, Store01Icon, Edit02Icon,
} from 'hugeicons-react';
import { PLAN_FEATURES, PLAN_FEATURE_GROUPS, TRIAL_DAYS } from '@smo/shared/plans';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';

/* ---------- small pieces ---------- */

const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const formatDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const per = (interval) => (interval === 'YEARLY' ? 'year' : 'month');
const daysText = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;
const errorText = (err, fallback) => err?.response?.data?.error?.message || fallback;

const card = 'rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900';
const eyebrow = 'text-[11px] font-semibold uppercase tracking-wider text-zinc-500';

const STATE = {
  ACTIVE: { label: 'Active', tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  TRIAL: { label: 'Free trial', tone: 'bg-sky-500/10 text-sky-700 dark:text-sky-400' },
  GRACE: { label: 'Grace period', tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  LOCKED: { label: 'Ended', tone: 'bg-red-500/10 text-red-600 dark:text-red-400' },
};
const StatePill = ({ state }) => (
  <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${STATE[state]?.tone || STATE.LOCKED.tone}`}>{STATE[state]?.label || state}</span>
);
const SOURCE = { PAID: 'Paid', ASSIGNED: 'Assigned by you', TRIAL: 'Trial' };

/** What happens next for a brand, in a few words */
function endsText(ent) {
  if (!ent?.periodEnd) return '—';
  if (ent.state === 'LOCKED') return `Ended ${formatDate(ent.periodEnd)}`;
  if (ent.state === 'GRACE') return `Ended ${formatDate(ent.periodEnd)} · orders stop in ${daysText(ent.daysLeft)}`;
  return `${formatDate(ent.periodEnd)} · ${daysText(ent.daysLeft)} left`;
}

const Notice = ({ msg }) => (msg?.text ? (
  <p role={msg.error ? 'alert' : 'status'} className={`${card} px-4 py-3 text-sm ${msg.error ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{msg.text}</p>
) : null);

const Modal = ({ title, subtitle, onClose, children, footer }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full sm:max-w-2xl max-h-[92vh] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-2xl sm:rounded-2xl overflow-hidden">
        <div className="px-6 py-4 flex items-start justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
            {subtitle && <p className="text-sm text-zinc-500">{subtitle}</p>}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"><Cancel01Icon size={16} /></button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex flex-col gap-5">{children}</div>
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-end gap-2 shrink-0">{footer}</div>
      </div>
    </div>
  );
};

/** Feature checklist, grouped. `locked` keys are shown ticked and can't be changed (already in the plan). */
const FeaturePicker = ({ value, onChange, locked = [] }) => {
  const chosen = new Set(value);
  const fixed = new Set(locked);
  const toggle = (key) => {
    const next = new Set(chosen);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange(PLAN_FEATURES.map(f => f.key).filter(k => next.has(k)));
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
      {PLAN_FEATURE_GROUPS.map(group => (
        <fieldset key={group}>
          <legend className={`${eyebrow} mb-1.5`}>{group}</legend>
          <div className="flex flex-col gap-1">
            {PLAN_FEATURES.filter(f => f.group === group).map(f => {
              const isFixed = fixed.has(f.key);
              return (
                <label key={f.key} title={f.description} className={`flex items-center gap-2 text-sm ${isFixed ? 'text-zinc-400' : 'text-zinc-800 dark:text-zinc-200 cursor-pointer'}`}>
                  <input type="checkbox" className="size-4 accent-amber-500" checked={isFixed || chosen.has(f.key)} disabled={isFixed} onChange={() => toggle(f.key)} />
                  {f.label}{isFixed && <span className="text-xs">(in plan)</span>}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
};

/* ---------- Manage one brand ---------- */

const ManageBrand = ({ brand, plans, onClose, onDone }) => {
  const ent = brand.entitlements;
  const onSale = plans.filter(p => p.isActive || p.id === ent?.plan?.id);
  const [planId, setPlanId] = useState(ent?.plan?.id || onSale[0]?.id || '');
  const [mode, setMode] = useState('PAID'); // PAID = full plan, TRIAL = free trial
  const [endDate, setEndDate] = useState('');
  const [extras, setExtras] = useState(brand.extraFeatures || []);
  const [storeLimit, setStoreLimit] = useState(brand.maxStoresOverride ?? '');
  const [note, setNote] = useState(brand.adminNote || '');
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const plan = plans.find(p => p.id === planId);
  const today = new Date().toISOString().slice(0, 10);

  const assign = async () => {
    setBusy('assign');
    setMsg(null);
    try {
      await api.post('/billing/subscription/assign', {
        tenantId: brand.id,
        planId,
        trial: mode === 'TRIAL',
        periodEnd: endDate || undefined,
        extraFeatures: extras.filter(k => !(plan?.features || []).includes(k)),
        maxStoresOverride: storeLimit === '' ? null : Number(storeLimit),
        adminNote: note,
      });
      onDone(`${plan.name} ${mode === 'TRIAL' ? 'trial started' : 'assigned'} for ${brand.name}.`);
    } catch (err) {
      setMsg({ text: errorText(err, 'Could not assign the plan'), error: true });
      setBusy(null);
    }
  };

  const sendLink = async () => {
    setBusy('link');
    setMsg(null);
    try {
      const res = await api.post('/billing/subscription/send-link', { tenantId: brand.id, planId });
      onDone(res.data.data?.message || `Payment link sent to ${brand.name}.`);
    } catch (err) {
      setMsg({ text: errorText(err, 'Could not send the payment link'), error: true });
      setBusy(null);
    }
  };

  return (
    <Modal
      title={brand.name}
      subtitle={ent?.plan ? `Now: ${ent.plan.name} · ${STATE[ent.state]?.label} · ${endsText(ent)}` : 'No plan yet'}
      onClose={onClose}
      footer={(
        <>
          <Button variant="outline" disabled={Boolean(busy) || !planId} onClick={sendLink} className="mr-auto" title="The owner pays through PhonePe; the plan starts when the payment is confirmed">
            {busy === 'link' ? <Loading03Icon size={15} className="animate-spin" /> : 'Email a payment link instead'}
          </Button>
          <Button variant="outline" disabled={Boolean(busy)} onClick={onClose}>Cancel</Button>
          <Button disabled={Boolean(busy) || !planId} onClick={assign} className="!bg-amber-400 hover:!bg-amber-500 !text-zinc-950">
            {busy === 'assign' ? <Loading03Icon size={15} className="animate-spin" /> : mode === 'TRIAL' ? 'Start trial' : 'Assign plan, no payment'}
          </Button>
        </>
      )}
    >
      <Notice msg={msg} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Plan</Label>
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Choose a plan" /></SelectTrigger>
            <SelectContent className="z-[70]">
              {onSale.map(p => <SelectItem key={p.id} value={p.id}>{p.name} · {rupees(p.price)}/{per(p.interval)} · {p.maxStores} {p.maxStores === 1 ? 'store' : 'stores'}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="end-date">Ends on <span className="font-normal text-zinc-500">(optional)</span></Label>
          <Input id="end-date" type="date" min={today} value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10" />
          <span className="text-xs text-zinc-500">Empty means {mode === 'TRIAL' ? `${TRIAL_DAYS} days from today` : `one ${per(plan?.interval)} from today`}.</span>
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">Give it as</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup">
          {[
            ['PAID', 'Full plan', 'Active straight away, with no payment taken. Use for deals you closed yourself.'],
            ['TRIAL', 'Free trial', 'Shown to the brand as a trial that is counting down.'],
          ].map(([id, label, hint]) => (
            <button key={id} type="button" role="radio" aria-checked={mode === id} onClick={() => setMode(id)}
              className={`rounded-lg border px-3 py-2.5 text-left ${mode === id ? 'border-zinc-900 dark:border-zinc-100' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'}`}>
              <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">{label}</span>
              <span className="block text-xs text-zinc-500">{hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Extras for this brand only</p>
        <p className="text-xs text-zinc-500 mb-3">Features on top of the plan, for deals where you promised something the plan doesn’t include.</p>
        <FeaturePicker value={extras} onChange={setExtras} locked={plan?.features || []} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="store-limit">Store limit <span className="font-normal text-zinc-500">(optional)</span></Label>
          <Input id="store-limit" type="number" min={1} value={storeLimit} onChange={e => setStoreLimit(e.target.value)} placeholder={plan ? `Plan allows ${plan.maxStores}` : ''} className="h-10" />
          <span className="text-xs text-zinc-500">This brand has {brand.storesUsed} {brand.storesUsed === 1 ? 'store' : 'stores'} now.</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note">Note <span className="font-normal text-zinc-500">(only you see this)</span></Label>
          <Input id="note" value={note} maxLength={300} onChange={e => setNote(e.target.value)} placeholder="e.g. 3 months free, agreed with Dilip" className="h-10" />
        </div>
      </div>
    </Modal>
  );
};

/* ---------- Create or edit a plan ---------- */

const EMPTY_PLAN = { name: '', price: '', interval: 'MONTHLY', maxStores: 1, description: '', sortOrder: 0, features: [], isActive: true };

const PlanEditor = ({ plan, onClose, onDone }) => {
  const [form, setForm] = useState(plan ? { ...EMPTY_PLAN, ...plan, description: plan.description || '' } : EMPTY_PLAN);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e?.target ? e.target.value : e }));
  const onPlan = plan?._count?.subscriptions || 0;

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const payload = {
      name: form.name, price: Number(form.price), interval: form.interval, maxStores: Number(form.maxStores),
      description: form.description, sortOrder: Number(form.sortOrder) || 0, features: form.features, isActive: form.isActive,
    };
    try {
      if (plan) await api.put(`/billing/plans/${plan.id}`, payload);
      else await api.post('/billing/plans', payload);
      onDone(plan ? `${form.name} updated.` : `${form.name} created.`);
    } catch (err) {
      setMsg({ text: errorText(err, 'Could not save the plan'), error: true });
      setBusy(false);
    }
  };

  return (
    <Modal
      title={plan ? `Edit ${plan.name}` : 'New plan'}
      subtitle={plan && onPlan > 0 ? `${onPlan} ${onPlan === 1 ? 'brand is' : 'brands are'} on this plan. Changes to features and limits apply to them straight away.` : 'Everything not ticked below stays locked for brands on this plan.'}
      onClose={onClose}
      footer={(
        <>
          <label className="mr-auto flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
            <input type="checkbox" className="size-4 accent-amber-500" checked={form.isActive} onChange={e => setForm(prev => ({ ...prev, isActive: e.target.checked }))} />
            On sale (brands can choose it)
          </label>
          <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button disabled={busy || !String(form.name).trim() || form.price === ''} onClick={save} className="!bg-amber-400 hover:!bg-amber-500 !text-zinc-950">
            {busy ? <Loading03Icon size={15} className="animate-spin" /> : plan ? 'Save changes' : 'Create plan'}
          </Button>
        </>
      )}
    >
      <Notice msg={msg} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="plan-name">Name</Label>
          <Input id="plan-name" value={form.name} maxLength={60} onChange={set('name')} placeholder="e.g. Growth Plan" className="h-10" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plan-price">Price (₹)</Label>
          <Input id="plan-price" type="number" min={0} value={form.price} onChange={set('price')} className="h-10" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Billed</Label>
          <Select value={form.interval} onValueChange={set('interval')}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent className="z-[70]">
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="YEARLY">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="plan-desc">One-line description</Label>
          <Input id="plan-desc" value={form.description} maxLength={140} onChange={set('description')} placeholder="Shown under the plan name" className="h-10" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plan-stores">Stores</Label>
          <Input id="plan-stores" type="number" min={1} value={form.maxStores} onChange={set('maxStores')} className="h-10" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plan-order">Order</Label>
          <Input id="plan-order" type="number" value={form.sortOrder} onChange={set('sortOrder')} className="h-10" title="Lower numbers are listed first" />
        </div>
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Features in this plan <span className="font-normal text-zinc-500 tabular-nums">({form.features.length} of {PLAN_FEATURES.length})</span></p>
          <span className="flex gap-3 text-xs">
            <button type="button" className="underline text-zinc-600 dark:text-zinc-400" onClick={() => setForm(prev => ({ ...prev, features: PLAN_FEATURES.map(f => f.key) }))}>Tick all</button>
            <button type="button" className="underline text-zinc-600 dark:text-zinc-400" onClick={() => setForm(prev => ({ ...prev, features: [] }))}>Clear</button>
          </span>
        </div>
        <FeaturePicker value={form.features} onChange={(features) => setForm(prev => ({ ...prev, features }))} />
        <p className="mt-3 text-xs text-zinc-500">The POS, QR menu, kitchen screen, tables, cash and own-UPI payments, order history, sales report and GST bills are in every plan.</p>
      </div>
    </Modal>
  );
};

/* ---------- Super admin ---------- */

const TABS = [['brands', 'Brands'], ['plans', 'Plans'], ['payments', 'Payments']];
const FILTERS = [['ALL', 'All'], ['ACTIVE', 'Active'], ['TRIAL', 'On trial'], ['GRACE', 'Grace period'], ['LOCKED', 'Ended']];

const SuperAdminBilling = () => {
  const [tab, setTab] = useState('brands');
  const [plans, setPlans] = useState(null);
  const [brands, setBrands] = useState(null);
  const [payments, setPayments] = useState(null);
  const [msg, setMsg] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [managing, setManaging] = useState(null);
  const [editing, setEditing] = useState(undefined); // undefined closed · null new plan · plan object

  const load = useCallback(async () => {
    try {
      const [p, b, pay] = await Promise.all([api.get('/billing/plans'), api.get('/billing/subscriptions'), api.get('/billing/payments')]);
      setPlans(p.data.data || []);
      setBrands(b.data.data || []);
      setPayments(pay.data.data || []);
    } catch (err) {
      setMsg({ text: errorText(err, 'Could not load billing'), error: true });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const done = (text) => { setManaging(null); setEditing(undefined); setMsg({ text, error: false }); load(); };

  const counts = useMemo(() => {
    const c = { ALL: 0, ACTIVE: 0, TRIAL: 0, GRACE: 0, LOCKED: 0 };
    for (const b of brands || []) { c.ALL += 1; c[b.entitlements.state] = (c[b.entitlements.state] || 0) + 1; }
    return c;
  }, [brands]);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const collected = (payments || []).filter(p => new Date(p.paidAt) >= monthStart).reduce((sum, p) => sum + p.amount, 0);
  const shown = (brands || []).filter(b => (filter === 'ALL' || b.entitlements.state === filter)
    && (!search.trim() || `${b.name} ${b.slug}`.toLowerCase().includes(search.trim().toLowerCase())));

  if (!plans || !brands) {
    return msg?.error ? <Notice msg={msg} /> : (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 w-full pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Plans & billing</h1>
          <p className="text-sm text-zinc-500">What each brand is on, what each plan includes, and what has been paid.</p>
        </div>
        {tab === 'plans' && (
          <Button size="sm" onClick={() => setEditing(null)} className="!bg-amber-400 hover:!bg-amber-500 !text-zinc-950"><PlusSignIcon size={14} className="mr-1.5" /> New plan</Button>
        )}
      </div>

      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Brands', counts.ALL, `${counts.ACTIVE} active`],
          ['On trial', counts.TRIAL, 'Not paying yet'],
          ['Need attention', counts.GRACE + counts.LOCKED, `${counts.GRACE} in grace · ${counts.LOCKED} ended`],
          ['Collected this month', rupees(collected), 'Through PhonePe'],
        ].map(([label, value, hint]) => (
          <div key={label} className={`${card} px-4 py-3`}>
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</dd>
            <dd className="text-[11px] text-zinc-400">{hint}</dd>
          </div>
        ))}
      </dl>

      <Notice msg={msg} />

      <div className="flex items-center gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5 self-start" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`px-3 h-8 rounded-md text-sm font-medium ${tab === id ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'brands' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 h-9 w-full sm:w-72 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 focus-within:border-amber-500">
              <Search01Icon size={15} className="text-zinc-400 shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search brands" aria-label="Search brands" className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-zinc-400" />
            </label>
            <div className="flex flex-wrap items-center gap-1">
              {FILTERS.map(([id, label]) => (
                <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}
                  className={`px-2.5 h-8 rounded-md border text-xs font-medium ${filter === id ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100' : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-400'}`}>
                  {label} <span className="tabular-nums opacity-70">{counts[id] || 0}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={`${card} overflow-x-auto`}>
            {shown.length === 0 ? (
              <p className="p-8 text-center text-sm text-zinc-500">No brand matches.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                    <th className="px-4 py-2.5 font-medium">Brand</th>
                    <th className="px-3 py-2.5 font-medium">Plan</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Ends</th>
                    <th className="px-3 py-2.5 font-medium text-right">Stores</th>
                    <th className="px-3 py-2.5 font-medium">Last payment</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map(b => {
                    const ent = b.entitlements;
                    const over = ent.maxStores && b.storesUsed > ent.maxStores;
                    return (
                      <tr key={b.id} className="border-b last:border-0 border-zinc-100 dark:border-zinc-800 align-top">
                        <td className="px-4 py-3">
                          <span className="block font-semibold text-zinc-900 dark:text-zinc-100">{b.name}</span>
                          {b.adminNote && <span className="block text-xs text-zinc-500 max-w-[220px] truncate" title={b.adminNote}>{b.adminNote}</span>}
                        </td>
                        <td className="px-3 py-3">
                          <span className="block text-zinc-900 dark:text-zinc-100">{ent.plan?.name || '—'}</span>
                          <span className="block text-xs text-zinc-500">
                            {SOURCE[b.source] || ''}{b.extraFeatures.length > 0 ? ` · +${b.extraFeatures.length} ${b.extraFeatures.length === 1 ? 'extra' : 'extras'}` : ''}
                          </span>
                        </td>
                        <td className="px-3 py-3"><StatePill state={ent.state} /></td>
                        <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{endsText(ent)}</td>
                        <td className={`px-3 py-3 text-right tabular-nums whitespace-nowrap ${over ? 'text-amber-700 dark:text-amber-400 font-semibold' : 'text-zinc-900 dark:text-zinc-100'}`} title={over ? 'More stores than the plan allows' : undefined}>
                          {b.storesUsed}{ent.maxStores ? ` / ${ent.maxStores}` : ''}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                          {b.lastPayment ? <>{rupees(b.lastPayment.amount)} <span className="text-xs text-zinc-400">· {formatDate(b.lastPayment.paidAt)}</span></> : <span className="text-zinc-400">Never</span>}
                        </td>
                        <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => setManaging(b)}>Manage</Button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div key={plan.id} className={`${card} p-5 flex flex-col gap-3 ${plan.isActive ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{plan.name}</span>
                    {!plan.isActive && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500">Off sale</span>}
                  </div>
                  <div className="mt-1">
                    <span className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{rupees(plan.price)}</span>
                    <span className="text-xs text-zinc-500"> / {per(plan.interval)}</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditing(plan)}><Edit02Icon size={13} className="mr-1.5" /> Edit</Button>
              </div>
              {plan.description && <p className="text-sm text-zinc-500">{plan.description}</p>}
              <div className="flex items-center gap-4 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="flex items-center gap-1.5"><Store01Icon size={15} className="text-zinc-400" /> {plan.maxStores} {plan.maxStores === 1 ? 'store' : 'stores'}</span>
                <span className="tabular-nums">{plan._count?.subscriptions || 0} {plan._count?.subscriptions === 1 ? 'brand' : 'brands'}</span>
              </div>
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3">
                <p className={`${eyebrow} mb-1.5`}>{plan.features.length} of {PLAN_FEATURES.length} extras</p>
                {plan.features.length === 0 ? (
                  <p className="text-sm text-zinc-500">Essentials only.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {PLAN_FEATURES.filter(f => plan.features.includes(f.key)).map(f => (
                      <li key={f.key} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <CheckmarkCircle02Icon size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" /> {f.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
          {plans.length === 0 && <p className={`${card} p-8 text-center text-sm text-zinc-500 col-span-full`}>No plans yet. Create one to start holding brands to it.</p>}
        </div>
      )}

      {tab === 'payments' && (
        <div className={`${card} overflow-x-auto`}>
          {(payments || []).length === 0 ? (
            <p className="p-8 text-center text-sm text-zinc-500">No payments yet. Plans you assign by hand don’t appear here.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-4 py-2.5 font-medium">Paid on</th>
                  <th className="px-3 py-2.5 font-medium">Brand</th>
                  <th className="px-3 py-2.5 font-medium">Plan</th>
                  <th className="px-3 py-2.5 font-medium">Covers</th>
                  <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-b last:border-0 border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-2.5 whitespace-nowrap text-zinc-900 dark:text-zinc-100">{formatDate(p.paidAt)}</td>
                    <td className="px-3 py-2.5">{p.tenant?.name || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{p.planName}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-zinc-500">{formatDate(p.periodStart)} to {formatDate(p.periodEnd)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">{rupees(p.amount)}</td>
                    <td className="px-4 py-2.5"><code className="text-xs font-mono text-zinc-500">{p.transactionId}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {managing && <ManageBrand brand={managing} plans={plans} onClose={() => setManaging(null)} onDone={done} />}
      {editing !== undefined && <PlanEditor plan={editing} onClose={() => setEditing(undefined)} onDone={done} />}
    </div>
  );
};

/* ---------- A brand owner signed in to this app ---------- */

const OwnerBilling = () => {
  const [params, setParams] = useSearchParams();
  const [plans, setPlans] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busyPlanId, setBusyPlanId] = useState(null);

  useEffect(() => {
    const payment = params.get('payment');
    if (!payment) return;
    setMsg(payment === 'success'
      ? { text: 'Payment successful. Your plan is active.', error: false }
      : { text: payment === 'failed' ? `Payment failed (code ${params.get('code') || 'UNKNOWN'}). Please try again.` : 'Something went wrong while checking the payment.', error: true });
    setParams({}, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    Promise.all([api.get('/billing/plans'), api.get('/billing/subscription')])
      .then(([p, s]) => { setPlans(p.data.data || []); setSubscription(s.data.data || null); })
      .catch(err => setMsg({ text: errorText(err, 'Could not load your subscription'), error: true }));
  }, []);

  const choose = async (planId) => {
    setBusyPlanId(planId);
    setMsg(null);
    try {
      const res = await api.post('/billing/subscription/initiate', { planId, sourceApp: 'admin' });
      window.location.href = res.data.data.paymentUrl;
    } catch (err) {
      setMsg({ text: errorText(err, 'Could not open the payment page'), error: true });
      setBusyPlanId(null);
    }
  };

  const ent = subscription?.entitlements;
  if (!plans) return msg?.error ? <Notice msg={msg} /> : <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <div className="flex flex-col gap-5 w-full pb-12">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Subscription</h1>
        <p className="text-sm text-zinc-500">Your plan and what it includes.</p>
      </div>
      <Notice msg={msg} />
      {ent?.plan && (
        <div className={`${card} px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-2`}>
          <div className="mr-auto">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{ent.isTrial ? `Free trial (${ent.plan.name})` : ent.plan.name}</span>
              <StatePill state={ent.state} />
            </div>
            <p className="text-sm text-zinc-500">{endsText(ent)}</p>
          </div>
          <span className="text-sm text-zinc-700 dark:text-zinc-300 tabular-nums">{subscription.storesUsed} of {ent.maxStores} stores</span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {plans.map(plan => {
          const isCurrent = ent?.plan?.id === plan.id && !ent.isTrial;
          return (
            <div key={plan.id} className={`${card} p-5 flex flex-col gap-3 ${isCurrent ? 'border-zinc-900 dark:border-zinc-100' : ''}`}>
              <div>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{plan.name}</span>
                <div className="mt-1">
                  <span className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{rupees(plan.price)}</span>
                  <span className="text-xs text-zinc-500"> / {per(plan.interval)}</span>
                </div>
                {plan.description && <p className="mt-1 text-sm text-zinc-500">{plan.description}</p>}
              </div>
              <ul className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                <li className="flex items-center gap-2"><Store01Icon size={14} className="text-zinc-400" /> {plan.maxStores} {plan.maxStores === 1 ? 'store' : 'stores'}</li>
                <li className="flex items-center gap-2"><CheckmarkCircle02Icon size={14} className="text-emerald-600 shrink-0" /> POS, QR menu, kitchen screen, GST bills</li>
                {PLAN_FEATURES.filter(f => plan.features.includes(f.key)).map(f => (
                  <li key={f.key} className="flex items-center gap-2"><CheckmarkCircle02Icon size={14} className="text-emerald-600 shrink-0" /> {f.label}</li>
                ))}
              </ul>
              <Button className={`mt-auto ${isCurrent ? '' : '!bg-amber-400 hover:!bg-amber-500 !text-zinc-950'}`} variant={isCurrent ? 'outline' : 'default'} disabled={Boolean(busyPlanId)} onClick={() => choose(plan.id)}>
                {busyPlanId === plan.id ? <Loading03Icon size={15} className="animate-spin" /> : isCurrent ? 'Renew' : 'Choose plan'}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const Billing = () => {
  const { user } = useAuthStore();
  return user?.role === 'SUPER_ADMIN' ? <SuperAdminBilling /> : <OwnerBilling />;
};
