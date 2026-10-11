import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Input, Label, Skeleton } from '@smo/ui';
import {
  FlashIcon, CheckmarkCircle02Icon, AlertCircleIcon, Store01Icon,
  CreditCardIcon, LinkSquare02Icon, Calendar01Icon, Loading03Icon, Copy01Icon, ViewIcon, ViewOffIcon,
} from 'hugeicons-react';
import { PLAN_FEATURES, PLAN_FEATURE_GROUPS } from '@smo/shared/plans';
import api from '../lib/api';
import { useEntitlements } from '../lib/entitlements';
import { Notice, Panel, Row, SectionNav, SectionLayout, Stat } from '../components/settings-layout';

const formatDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const INTERVAL = { MONTHLY: 'month', YEARLY: 'year', QUARTERLY: 'quarter' };
const perInterval = (interval) => INTERVAL[interval] || String(interval || '').toLowerCase();

/** Small status line used in the gateway panel */
const Check = ({ ok, children, detail }) => (
  <li className="flex items-start gap-2 text-sm">
    {ok
      ? <CheckmarkCircle02Icon size={16} className="text-emerald-600 shrink-0 mt-0.5" />
      : <AlertCircleIcon size={16} className="text-amber-600 shrink-0 mt-0.5" />}
    <span>
      <span className="text-zinc-900 dark:text-zinc-100">{children}</span>
      {detail && <span className="block text-xs text-zinc-500">{detail}</span>}
    </span>
  </li>
);

/* ---------- Plan ---------- */

const STATE = {
  ACTIVE: { label: 'Active', tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  TRIAL: { label: 'Free trial', tone: 'bg-sky-500/10 text-sky-700 dark:text-sky-400' },
  GRACE: { label: 'Grace period', tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  LOCKED: { label: 'Ended', tone: 'bg-red-500/10 text-red-600 dark:text-red-400' },
};
const StatePill = ({ state }) => (
  <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${STATE[state]?.tone || STATE.LOCKED.tone}`}>{STATE[state]?.label || state}</span>
);
const daysText = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** One sentence on where the subscription stands and what happens next */
function standing(ent) {
  if (ent.state === 'TRIAL') return `Every feature is unlocked for ${daysText(ent.daysLeft)} more, until ${formatDate(ent.periodEnd)}. Choose a plan before then to keep taking orders.`;
  if (ent.state === 'GRACE') return `This ended on ${formatDate(ent.periodEnd)}. Everything still works for ${daysText(ent.daysLeft)}; after that new orders are switched off.`;
  if (ent.state === 'LOCKED') return `This ended on ${formatDate(ent.periodEnd)}. New orders are switched off. Your menu, bills and reports are all still here; pay for a plan below to carry on.`;
  return `Paid until ${formatDate(ent.periodEnd)} (${daysText(ent.daysLeft)} left). Renewing early adds the new period after this one.`;
}

const Tick = ({ on }) => (on
  ? <CheckmarkCircle02Icon size={16} className="text-emerald-600 dark:text-emerald-400 mx-auto" aria-label="Included" />
  : <span className="block text-center text-zinc-300 dark:text-zinc-700" aria-label="Not included">–</span>);

const PlanTab = ({ subscription, plans, onUpgrade, busyPlanId }) => {
  const ent = subscription?.entitlements;
  const storesUsed = subscription?.storesUsed ?? 0;
  const included = new Set(ent?.features || []);
  const payments = subscription?.payments || [];

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Your plan" description="What your brand has now and when it ends.">
        {ent?.plan ? (
          <>
            <Row label="Plan" hint={standing(ent)}>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
                  <FlashIcon size={20} className="text-amber-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{ent.isTrial ? `Free trial (${ent.plan.name})` : ent.plan.name}</span>
                    <StatePill state={ent.state} />
                  </div>
                  <div className="text-sm text-zinc-500">{ent.isTrial ? 'Nothing to pay yet' : `${rupees(ent.plan.price)} / ${perInterval(ent.plan.interval)}`}</div>
                </div>
              </div>
            </Row>
            <Row label="Stores" hint="How many stores this plan lets you run.">
              <UsageBar used={storesUsed} max={ent.maxStores} />
            </Row>
            <Row label="What’s included" hint={`${included.size} of ${PLAN_FEATURES.length} extras, on top of the POS, QR menu, kitchen screen and GST bills that every plan has.`}>
              {included.size === 0 ? (
                <p className="text-sm text-zinc-500">The essentials only. See the plans below for what an upgrade adds.</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {PLAN_FEATURES.filter(f => included.has(f.key)).map(f => (
                    <li key={f.key} title={f.description} className="rounded-md border border-zinc-200 dark:border-zinc-800 px-2 py-1 text-xs text-zinc-700 dark:text-zinc-300">{f.label}</li>
                  ))}
                </ul>
              )}
            </Row>
          </>
        ) : (
          <p className="px-6 py-6 text-sm text-zinc-500">No plans have been set up yet. Everything is switched on for now.</p>
        )}
      </Panel>

      <Panel title="Compare plans" description="Payment is taken securely by PhonePe. A plan starts the moment it’s paid.">
        {plans.length === 0 ? (
          <p className="px-6 py-6 text-sm text-zinc-500">No plans are available right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="align-top border-b border-zinc-200 dark:border-zinc-800">
                  <th className="w-[34%] px-6 py-4" />
                  {plans.map(plan => {
                    const isCurrent = ent?.plan?.id === plan.id && !ent.isTrial;
                    const tooSmall = storesUsed > plan.maxStores;
                    return (
                      <th key={plan.id} className={`px-4 py-4 text-left font-normal ${isCurrent ? 'bg-zinc-50 dark:bg-zinc-900' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{plan.name}</span>
                          {isCurrent && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">Yours</span>}
                        </div>
                        <div className="mt-1">
                          <span className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{rupees(plan.price)}</span>
                          <span className="text-xs text-zinc-500"> / {perInterval(plan.interval)}</span>
                        </div>
                        {plan.description && <p className="mt-1 text-xs text-zinc-500 min-h-8">{plan.description}</p>}
                        <Button
                          size="sm"
                          className={`mt-3 w-full ${isCurrent ? '' : '!bg-amber-400 hover:!bg-amber-500 !text-zinc-950'}`}
                          variant={isCurrent ? 'outline' : 'default'}
                          disabled={Boolean(busyPlanId) || tooSmall}
                          onClick={() => onUpgrade(plan.id)}
                        >
                          {busyPlanId === plan.id ? <Loading03Icon size={15} className="animate-spin" /> : isCurrent ? 'Renew' : `Choose ${plan.name.replace(/ plan$/i, '')}`}
                        </Button>
                        {tooSmall && <p className="mt-1.5 text-[11px] text-zinc-500">You run {storesUsed} stores; this allows {plan.maxStores}.</p>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="px-6 py-2.5 text-zinc-700 dark:text-zinc-300">Stores</td>
                  {plans.map(plan => <td key={plan.id} className="px-4 py-2.5 text-center font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{plan.maxStores}</td>)}
                </tr>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="px-6 py-2.5 text-zinc-700 dark:text-zinc-300">POS, QR menu, kitchen screen, GST bills</td>
                  {plans.map(plan => <td key={plan.id} className="px-4 py-2.5"><Tick on /></td>)}
                </tr>
                {PLAN_FEATURE_GROUPS.map(group => (
                  <React.Fragment key={group}>
                    <tr><td colSpan={plans.length + 1} className="px-6 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{group}</td></tr>
                    {PLAN_FEATURES.filter(f => f.group === group).map(f => (
                      <tr key={f.key} className="border-b border-zinc-100 dark:border-zinc-800">
                        <td className="px-6 py-2.5">
                          <span className="block text-zinc-900 dark:text-zinc-100">{f.label}</span>
                          <span className="block text-xs text-zinc-500">{f.description}</span>
                        </td>
                        {plans.map(plan => <td key={plan.id} className="px-4 py-2.5"><Tick on={(plan.features || []).includes(f.key)} /></td>)}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Payments" description="What you have paid for your subscription.">
        {payments.length === 0 ? (
          <p className="px-6 py-6 text-sm text-zinc-500">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-6 py-2 font-medium">Paid on</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 font-medium">Covers</th>
                  <th className="px-3 py-2 font-medium text-right">Amount</th>
                  <th className="px-6 py-2 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-b last:border-0 border-zinc-100 dark:border-zinc-800">
                    <td className="px-6 py-2.5 whitespace-nowrap text-zinc-900 dark:text-zinc-100">{formatDate(p.paidAt)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{p.planName}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-zinc-500">{formatDate(p.periodStart)} to {formatDate(p.periodEnd)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">{rupees(p.amount)}</td>
                    <td className="px-6 py-2.5"><code className="text-xs font-mono text-zinc-500">{p.transactionId}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
};

const UsageBar = ({ used, max }) => {
  if (!max) return <span className="text-sm text-zinc-900 dark:text-zinc-100"><strong className="tabular-nums">{used}</strong> in use</span>;
  const pct = Math.min(100, Math.round((used / max) * 100));
  const full = used >= max;
  return (
    <div className="max-w-sm">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-zinc-900 dark:text-zinc-100"><strong className="tabular-nums">{used}</strong> of {max} used</span>
        {full && <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Limit reached</span>}
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={max}>
        <div className={`h-full ${full ? 'bg-amber-500' : 'bg-zinc-900 dark:bg-zinc-100'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

/* ---------- Gateway ---------- */

const EMPTY_FORM = { merchantId: '', apiKey: '', secretKey: '', webhookSecret: '' };

const GatewayTab = ({ gateway, onSaved, inPlan }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [showSecrets, setShowSecrets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', error: false });
  const [copied, setCopied] = useState(false);
  const hasKeys = Boolean(gateway?.hasKeys);
  const set = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));
  const dirty = Object.values(form).some(v => v.trim());
  const webhookUrl = gateway?.webhookPath
    ? `${(import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api$/, '')}${gateway.webhookPath}`
    : null;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg({ text: '', error: false });
    try {
      // Blank fields keep what's saved
      const payload = { provider: 'RAZORPAY' };
      for (const [k, v] of Object.entries(form)) if (v.trim()) payload[k] = v.trim();
      await api.post('/billing/gateways', payload);
      setForm(EMPTY_FORM);
      setMsg({ text: 'Razorpay settings saved.', error: false });
      onSaved();
    } catch (err) {
      setMsg({ text: err.response?.data?.error?.message || 'Could not save the Razorpay settings', error: true });
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked; the URL is still selectable */ }
  };

  const secretType = showSecrets ? 'text' : 'password';

  return (
    <form onSubmit={save}>
      <Panel
        title="Razorpay"
        description="Guests pay straight into your own Razorpay account. Keys are encrypted before they're stored."
        actions={hasKeys && gateway?.isActive
          ? <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Connected</span>
          : <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">Not connected</span>}
        footer={(
          <>
            {hasKeys && <span className="text-xs text-zinc-500 mr-auto">Leave a field blank to keep the saved value.</span>}
            <Button type="button" variant="outline" size="sm" disabled={!dirty || saving} onClick={() => setForm(EMPTY_FORM)}>Discard</Button>
            <Button type="submit" size="sm" disabled={saving || (!hasKeys && (!form.apiKey.trim() || !form.secretKey.trim())) || (hasKeys && !dirty)}>
              {saving ? <Loading03Icon size={14} className="animate-spin" /> : hasKeys ? 'Update settings' : 'Connect Razorpay'}
            </Button>
          </>
        )}
      >
        {!inPlan && (
          <div className="px-6 py-3">
            <Notice msg={{ text: 'Online payments aren’t part of your plan, so guests can’t pay online and these keys can’t be changed. Upgrade under Plan to switch them on.', error: true }} />
          </div>
        )}
        {msg.text && <div className="px-6 py-3"><Notice msg={msg} /></div>}

        <Row label="Status" hint="Online POS payments use single-use UPI QR codes, confirmed automatically.">
          <ul className="flex flex-col gap-2">
            <Check ok={hasKeys} detail={hasKeys ? `${gateway.keyMode === 'LIVE' ? 'Live' : gateway.keyMode === 'TEST' ? 'Test' : 'Unknown'} mode keys` : 'Add your Key ID and Key Secret below.'}>
              API keys {hasKeys ? 'saved' : 'missing'}
            </Check>
            {gateway?.qrCodes && (
              <Check ok={gateway.qrCodes.enabled} detail={gateway.qrCodes.enabled ? null : (gateway.qrCodes.reason || 'Ask Razorpay support to activate QR Codes (Dashboard → Payment Products).')}>
                UPI QR Codes {gateway.qrCodes.enabled ? 'enabled' : 'not available'}
              </Check>
            )}
            <Check ok={Boolean(gateway?.hasWebhookSecret)} detail={gateway?.hasWebhookSecret ? null : 'Optional. Payments are still confirmed by checking with Razorpay.'}>
              Webhook {gateway?.hasWebhookSecret ? 'configured' : 'not set'}
            </Check>
          </ul>
        </Row>

        <Row label="API keys" hint="Razorpay Dashboard → Account & Settings → API Keys.">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apiKey">Key ID{!hasKeys && ' *'}</Label>
              <Input id="apiKey" value={form.apiKey} onChange={set('apiKey')} placeholder={hasKeys ? 'Saved — type to replace' : 'rzp_live_…'} className="font-mono" autoComplete="off" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="secretKey">Key Secret{!hasKeys && ' *'}</Label>
              <Input id="secretKey" type={secretType} value={form.secretKey} onChange={set('secretKey')} placeholder={hasKeys ? 'Saved — type to replace' : 'Your Razorpay secret'} autoComplete="new-password" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="merchantId">Merchant ID <span className="font-normal text-zinc-500">(optional)</span></Label>
              <Input id="merchantId" value={form.merchantId} onChange={set('merchantId')} placeholder="e.g. M1234567890" autoComplete="off" />
            </div>
          </div>
          <button type="button" onClick={() => setShowSecrets(v => !v)} className="mt-3 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1.5">
            {showSecrets ? <ViewOffIcon size={14} /> : <ViewIcon size={14} />} {showSecrets ? 'Hide' : 'Show'} secrets
          </button>
        </Row>

        <Row label="Webhook" hint="Optional. Makes online payments confirm a few seconds faster.">
          <div className="flex flex-col gap-3">
            {webhookUrl && (
              <div className="flex flex-col gap-1.5">
                <Label>Webhook URL</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 truncate rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 h-10 flex items-center text-xs font-mono text-zinc-700 dark:text-zinc-300" title={webhookUrl}>{webhookUrl}</code>
                  <Button type="button" variant="outline" size="sm" onClick={copy}>
                    {copied ? <CheckmarkCircle02Icon size={14} /> : <Copy01Icon size={14} />}
                    <span className="ml-1.5">{copied ? 'Copied' : 'Copy'}</span>
                  </Button>
                </div>
                <span className="text-xs text-zinc-500">Events: <code>qr_code.credited</code>, <code>payment_link.paid</code>, <code>payment.captured</code></span>
              </div>
            )}
            <div className="flex flex-col gap-1.5 max-w-md">
              <Label htmlFor="webhookSecret">Webhook secret</Label>
              <Input id="webhookSecret" type={secretType} value={form.webhookSecret} onChange={set('webhookSecret')} placeholder={gateway?.hasWebhookSecret ? 'Saved — type to replace' : 'The secret you set in Razorpay → Webhooks'} autoComplete="new-password" />
            </div>
          </div>
        </Row>
      </Panel>
    </form>
  );
};

/* ---------- Page ---------- */

export const Subscriptions = () => {
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState({ text: '', error: false });
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [gateways, setGateways] = useState([]);
  const [busyPlanId, setBusyPlanId] = useState(null);
  const refreshEntitlements = useEntitlements(st => st.load);

  // Result of the PhonePe checkout redirect
  useEffect(() => {
    const payment = params.get('payment');
    if (!payment) return;
    if (payment === 'success') setStatusMsg({ text: 'Payment successful. Your subscription has been updated.', error: false });
    else if (payment === 'failed') setStatusMsg({ text: `Payment failed (code ${params.get('code') || 'UNKNOWN'}). Please try again.`, error: true });
    else setStatusMsg({ text: 'Something went wrong while verifying the payment.', error: true });
    setParams({}, { replace: true });
  }, [params, setParams]);

  const load = useCallback(async () => {
    setError('');
    try {
      const [plansRes, subRes, gatewaysRes] = await Promise.all([
        api.get('/billing/plans'),
        api.get('/billing/subscription'),
        api.get('/billing/gateways'),
      ]);
      // The sidebar locks and the banner follow the same plan
      refreshEntitlements();
      setPlans(Array.isArray(plansRes.data.data) ? plansRes.data.data : []);
      setSubscription(subRes.data.data || null);
      setGateways(Array.isArray(gatewaysRes.data.data) ? gatewaysRes.data.data : []);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not load billing details');
    } finally {
      setLoading(false);
    }
  }, [refreshEntitlements]);

  useEffect(() => { load(); }, [load]);

  const upgrade = async (planId) => {
    setBusyPlanId(planId);
    setStatusMsg({ text: '', error: false });
    try {
      const res = await api.post('/billing/subscription/initiate', { planId, sourceApp: 'operations' });
      if (!res.data.data?.paymentUrl) throw new Error('No payment link was returned');
      window.location.href = res.data.data.paymentUrl;
    } catch (err) {
      setStatusMsg({ text: err.response?.data?.error?.message || err.message || 'Could not start checkout', error: true });
      setBusyPlanId(null);
    }
  };

  const gateway = gateways.find(g => g.provider === 'RAZORPAY');
  const ent = subscription?.entitlements;
  const storeCount = subscription?.storesUsed ?? 0;
  const tabs = [
    { id: 'plan', label: 'Plan', hint: 'Your plan, upgrades, payments', icon: CreditCardIcon },
    { id: 'gateway', label: 'Payment gateway', hint: 'Razorpay keys and QR', icon: LinkSquare02Icon },
  ];
  const active = tabs.some(t => t.id === params.get('tab')) ? params.get('tab') : 'plan';
  const setTab = (id) => setParams(id === 'plan' ? {} : { tab: id }, { replace: true });

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-6">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-6 py-5">
        <div className="size-12 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shrink-0">
          <FlashIcon size={22} className="text-amber-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Subscription</h1>
            {ent?.plan && <StatePill state={ent.state} />}
          </div>
          <p className="text-sm text-zinc-500">
            {!ent?.plan ? 'No plan yet' : ent.isTrial ? `Free trial · ${daysText(ent.daysLeft)} left` : `${ent.plan.name} · ${rupees(ent.plan.price)} / ${perInterval(ent.plan.interval)}`}
          </p>
        </div>
        <dl className="grid grid-cols-3 sm:flex gap-x-8 gap-y-2 text-sm">
          <Stat icon={Store01Icon} label="Stores">{ent?.maxStores ? `${storeCount} / ${ent.maxStores}` : storeCount}</Stat>
          <Stat icon={Calendar01Icon} label={ent?.state === 'ACTIVE' ? 'Paid until' : ent?.state === 'TRIAL' ? 'Trial ends' : 'Ended'}>{ent?.periodEnd ? formatDate(ent.periodEnd) : '—'}</Stat>
          <Stat icon={LinkSquare02Icon} label="Razorpay">{gateway?.hasKeys && gateway?.isActive ? 'Connected' : 'Not connected'}</Stat>
        </dl>
      </div>

      {error && <Notice msg={{ text: error, error: true }} />}
      {statusMsg.text && <Notice msg={statusMsg} />}

      <SectionLayout nav={<SectionNav tabs={tabs} active={active} onChange={setTab} label="Billing sections" />}>
        {active === 'plan' && (
          <PlanTab subscription={subscription} plans={plans} onUpgrade={upgrade} busyPlanId={busyPlanId} />
        )}
        {active === 'gateway' && <GatewayTab gateway={gateway} onSaved={load} inPlan={!ent || ent.features.includes('ONLINE_PAYMENTS')} />}
      </SectionLayout>
    </div>
  );
};
