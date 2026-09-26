import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Input, Label, Skeleton } from '@smo/ui';
import {
  FlashIcon, CheckmarkCircle02Icon, AlertCircleIcon, Store01Icon, QrCodeIcon, ComputerIcon,
  CreditCardIcon, LinkSquare02Icon, Calendar01Icon, Loading03Icon, Copy01Icon, ViewIcon, ViewOffIcon,
} from 'hugeicons-react';
import api from '../lib/api';
import { Notice, Panel, Row, SectionNav, SectionLayout, Stat } from '../components/settings-layout';

const formatDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const INTERVAL = { MONTHLY: 'month', YEARLY: 'year', QUARTERLY: 'quarter' };
const perInterval = (interval) => INTERVAL[interval] || String(interval || '').toLowerCase();

const STATUS_TONE = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  TRIALING: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  PAST_DUE: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
};
const StatusPill = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${STATUS_TONE[status] || 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
    {String(status || 'NONE').replace('_', ' ')}
  </span>
);

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

const PlanTab = ({ subscription, plans, storeCount, onUpgrade, busyPlanId }) => {
  const active = plans.filter(p => p.isActive);
  const current = subscription?.plan;

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Current plan" description="What your brand is subscribed to and when it renews.">
        {subscription ? (
          <>
            <Row label="Plan" hint="Includes the POS, QR menu ordering and the kitchen display.">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
                  <FlashIcon size={20} className="text-amber-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{current.name}</span>
                    <StatusPill status={subscription.status} />
                  </div>
                  <div className="text-sm text-zinc-500">{rupees(current.price)} / {perInterval(current.interval)}</div>
                </div>
              </div>
            </Row>
            <Row label="Stores" hint="Stores you can run on this plan.">
              <UsageBar used={storeCount} max={current.maxStores} />
            </Row>
            <Row label="Billing period" hint="The plan renews at the end of each period.">
              <div className="text-sm text-zinc-900 dark:text-zinc-100">Current period ends <strong>{formatDate(subscription.currentPeriodEnd)}</strong></div>
              {subscription.gracePeriodEndsAt && (
                <div className="mt-1 text-sm text-amber-700 dark:text-amber-400">Grace period until {formatDate(subscription.gracePeriodEndsAt)}. Renew to avoid interruption.</div>
              )}
            </Row>
            {subscription.providerSubId && (
              <Row label="Payment reference" hint="Quote this if you contact support about a payment.">
                <code className="text-xs font-mono text-zinc-600 dark:text-zinc-400 break-all">{subscription.providerSubId}</code>
              </Row>
            )}
          </>
        ) : (
          <div className="px-6 py-8 flex items-center gap-4">
            <div className="size-10 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center">
              <CreditCardIcon size={18} className="text-zinc-400" />
            </div>
            <div>
              <div className="font-medium text-zinc-900 dark:text-zinc-100">No active subscription</div>
              <p className="text-sm text-zinc-500">Pick a plan below to unlock the full platform.</p>
            </div>
          </div>
        )}
      </Panel>

      <Panel title={subscription ? 'Change plan' : 'Choose a plan'} description="Payment is taken securely by PhonePe. Your new plan starts as soon as it's paid.">
        {active.length === 0 ? (
          <p className="px-6 py-6 text-sm text-zinc-500">No plans are available right now.</p>
        ) : (
          <div className="p-6 grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {active.map(plan => {
              const isCurrent = subscription?.planId === plan.id;
              const tooSmall = storeCount > plan.maxStores;
              return (
                <div key={plan.id} className={`rounded-xl border p-5 flex flex-col gap-4 ${isCurrent
                  ? 'border-zinc-900 dark:border-zinc-100'
                  : 'border-zinc-200 dark:border-zinc-800'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">{plan.name}</div>
                      <div className="mt-1">
                        <span className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{rupees(plan.price)}</span>
                        <span className="text-sm text-zinc-500"> / {perInterval(plan.interval)}</span>
                      </div>
                    </div>
                    {isCurrent && <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">Current</span>}
                  </div>
                  <ul className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <li className="flex items-center gap-2"><Store01Icon size={15} className="text-zinc-400" /> Up to {plan.maxStores} store{plan.maxStores === 1 ? '' : 's'}</li>
                    <li className="flex items-center gap-2"><ComputerIcon size={15} className="text-zinc-400" /> POS and kitchen display</li>
                    <li className="flex items-center gap-2"><QrCodeIcon size={15} className="text-zinc-400" /> QR menu ordering</li>
                  </ul>
                  <div className="mt-auto">
                    {isCurrent ? (
                      <Button variant="outline" className="w-full" disabled>Your plan</Button>
                    ) : (
                      <Button className="w-full" variant={subscription ? 'outline' : 'default'} disabled={Boolean(busyPlanId) || tooSmall} onClick={() => onUpgrade(plan.id)}>
                        {busyPlanId === plan.id ? <Loading03Icon size={15} className="animate-spin" /> : subscription ? `Switch to ${plan.name}` : 'Choose plan'}
                      </Button>
                    )}
                    {tooSmall && !isCurrent && <p className="mt-2 text-xs text-zinc-500">You have {storeCount} stores; this plan allows {plan.maxStores}.</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
};

const UsageBar = ({ used, max }) => {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
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

const GatewayTab = ({ gateway, onSaved }) => {
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
  const [storeCount, setStoreCount] = useState(0);
  const [busyPlanId, setBusyPlanId] = useState(null);

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
      const [plansRes, subRes, gatewaysRes, storesRes] = await Promise.all([
        api.get('/billing/plans'),
        api.get('/billing/subscription'),
        api.get('/billing/gateways'),
        api.get('/stores').catch(() => ({ data: { data: [] } })),
      ]);
      setPlans(Array.isArray(plansRes.data.data) ? plansRes.data.data : []);
      setSubscription(subRes.data.data || null);
      setGateways(Array.isArray(gatewaysRes.data.data) ? gatewaysRes.data.data : []);
      setStoreCount(Array.isArray(storesRes.data.data) ? storesRes.data.data.length : 0);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not load billing details');
    } finally {
      setLoading(false);
    }
  }, []);

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
  const tabs = [
    { id: 'plan', label: 'Plan', hint: 'Subscription and upgrades', icon: CreditCardIcon },
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
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Billing & Subscriptions</h1>
            {subscription && <StatusPill status={subscription.status} />}
          </div>
          <p className="text-sm text-zinc-500">
            {subscription ? `${subscription.plan.name} · ${rupees(subscription.plan.price)} / ${perInterval(subscription.plan.interval)}` : 'No active plan'}
          </p>
        </div>
        <dl className="grid grid-cols-3 sm:flex gap-x-8 gap-y-2 text-sm">
          <Stat icon={Store01Icon} label="Stores">{subscription ? `${storeCount} / ${subscription.plan.maxStores}` : storeCount}</Stat>
          <Stat icon={Calendar01Icon} label="Renews">{subscription ? formatDate(subscription.currentPeriodEnd) : '—'}</Stat>
          <Stat icon={LinkSquare02Icon} label="Razorpay">{gateway?.hasKeys && gateway?.isActive ? 'Connected' : 'Not connected'}</Stat>
        </dl>
      </div>

      {error && <Notice msg={{ text: error, error: true }} />}
      {statusMsg.text && <Notice msg={statusMsg} />}

      <SectionLayout nav={<SectionNav tabs={tabs} active={active} onChange={setTab} label="Billing sections" />}>
        {active === 'plan' && (
          <PlanTab subscription={subscription} plans={plans} storeCount={storeCount} onUpgrade={upgrade} busyPlanId={busyPlanId} />
        )}
        {active === 'gateway' && <GatewayTab gateway={gateway} onSaved={load} />}
      </SectionLayout>
    </div>
  );
};
