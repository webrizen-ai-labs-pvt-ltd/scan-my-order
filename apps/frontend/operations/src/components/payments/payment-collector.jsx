import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@smo/ui';
import {
  Money01Icon,
  QrCodeIcon,
  SmartPhone01Icon,
  Tick02Icon,
  Cancel01Icon,
  Alert01Icon,
  Loading03Icon,
  CheckmarkCircle02Icon,
} from 'hugeicons-react';
import api from '../../lib/api';

const CHANNELS = [
  {
    id: 'RAZORPAY',
    label: 'Online',
    hint: 'Razorpay UPI QR · auto-verified',
    icon: QrCodeIcon,
    disabledHint: 'Add Razorpay keys under Subscriptions → Payment Gateway to enable.',
  },
  {
    id: 'UPI_OFFLINE',
    label: 'UPI (own QR)',
    hint: 'Your UPI ID · staff confirms receipt',
    icon: SmartPhone01Icon,
    disabledHint: 'Add a UPI ID under Brand Setup → Payments to enable.',
  },
  {
    id: 'CASH',
    label: 'Cash',
    hint: 'Counter cash',
    icon: Money01Icon,
  },
];

const CHANNEL_LABEL = { RAZORPAY: 'Online (Razorpay)', UPI_OFFLINE: 'UPI (own QR)', CASH: 'Cash' };
const STATUS_TONE = {
  PAID: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  CANCELLED: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  EXPIRED: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  FAILED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};
const POLL_MS = 3000;

const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const errorText = (err, fallback) => err?.response?.data?.error?.message || err?.message || fallback;

// Razorpay's QR image is a 674×1644 branded poster; the scannable card sits at x 107–567, y 520–1132.
const POSTER = { w: 674, h: 1644, x: 107, y: 520, cw: 460, ch: 612 };

/**
 * Shows only the "BHIM · UPI · Scan & pay" card from Razorpay's QR poster, large enough to scan.
 */
const RazorpayQrImage = ({ src, amount }) => {
  const [full, setFull] = useState(false);
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className="size-52 flex items-center justify-center text-xs text-zinc-400 text-center px-4">QR image could not be loaded. Cancel and generate again.</div>;
  }
  return (
    <div className="flex flex-col items-center gap-2">
      {full ? (
        <img src={src} alt={`Razorpay payment QR for ${rupees(amount)}`} className="h-[420px] w-auto object-contain" onError={() => setFailed(true)} />
      ) : (
        <div
          className="relative overflow-hidden w-64"
          style={{ aspectRatio: `${POSTER.cw} / ${POSTER.ch}` }}
        >
          <img
            src={src}
            alt={`Razorpay payment QR for ${rupees(amount)}`}
            onError={() => setFailed(true)}
            className="absolute max-w-none"
            style={{
              width: `${(POSTER.w / POSTER.cw) * 100}%`,
              left: `${-(POSTER.x / POSTER.cw) * 100}%`,
              top: `${-(POSTER.y / POSTER.ch) * 100}%`,
            }}
          />
        </div>
      )}
      <button type="button" onClick={() => setFull(v => !v)} className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline">
        {full ? 'Show QR only' : 'Show full Razorpay poster'}
      </button>
    </div>
  );
};

const PendingPayment = ({ payment, channels, onConfirm, onCancel, busy }) => {
  const isOnline = payment.channel === 'RAZORPAY';
  return (
    <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 p-4 flex flex-col items-center text-center gap-3">
      <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
        {isOnline ? 'Ask the guest to scan with any UPI app' : `Scan to pay ${channels?.UPI_OFFLINE?.payeeName || ''}`}
      </div>
      <div className="bg-white p-2 rounded-xl border border-zinc-200 shadow-sm">
        {payment.qrImageUrl ? (
          <RazorpayQrImage src={payment.qrImageUrl} amount={payment.amount} />
        ) : payment.qrPayload ? (
          <QRCodeSVG value={payment.qrPayload} size={208} level="M" />
        ) : (
          <div className="size-52 flex items-center justify-center text-xs text-zinc-400">QR unavailable</div>
        )}
      </div>
      <div className="text-2xl font-black tabular-nums text-zinc-900 dark:text-zinc-50">{rupees(payment.amount)}</div>
      {!isOnline && channels?.UPI_OFFLINE?.vpa && (
        <div className="text-[11px] font-mono text-zinc-500">{channels.UPI_OFFLINE.vpa}</div>
      )}

      {isOnline ? (
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300" role="status">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
          </span>
          Waiting for payment — confirms automatically
        </div>
      ) : (
        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 max-w-xs">
          Check that {rupees(payment.amount)} has arrived in your UPI app or soundbox before confirming.
        </p>
      )}

      <div className="flex gap-2 w-full">
        <Button type="button" variant="outline" className="flex-1" disabled={busy} onClick={() => onCancel(payment)}>
          <Cancel01Icon size={14} className="mr-1.5" /> Cancel
        </Button>
        {!isOnline && (
          <Button type="button" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={busy} onClick={() => onConfirm(payment)}>
            <Tick02Icon size={14} className="mr-1.5" /> Mark received
          </Button>
        )}
      </div>
    </div>
  );
};

/**
 * Collects one or more payments (online, own-UPI, cash) against an order or a table bill
 * until the bill is fully paid. All amounts and outcomes come from the server.
 *
 * @param {{ storeId: string, orderId?: string, tableSessionId?: string,
 *           subscribe?: Function, onSettled?: Function, onChange?: Function }} props
 */
export const PaymentCollector = ({ storeId, orderId, tableSessionId, subscribe, onSettled, onChange }) => {
  const [summary, setSummary] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [channel, setChannel] = useState(null);
  const [amount, setAmount] = useState('');
  const [tendered, setTendered] = useState('');
  const settledRef = useRef(false);

  const targetId = orderId || tableSessionId;
  const query = orderId ? { orderId } : { tableSessionId };

  const applySummary = useCallback((next) => {
    if (!next) return;
    setSummary(next);
    onChange?.(next);
    if (next.isSettled && !settledRef.current) {
      settledRef.current = true;
      onSettled?.(next);
    }
  }, [onChange, onSettled]);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/stores/${storeId}/payments/summary`, { params: query });
      applySummary(res.data.data);
      setLoadError('');
    } catch (err) {
      setLoadError(errorText(err, 'Could not load the bill'));
    }
  }, [storeId, targetId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    settledRef.current = false;
    setSummary(null);
    load();
  }, [load]);

  // Live updates from the store stream (webhooks, other terminals)
  useEffect(() => {
    if (!subscribe) return undefined;
    return subscribe((msg) => {
      if (msg.type === 'PAYMENT_UPDATED' && msg.data?.id === targetId) {
        // Stream payload has no channel config; keep what we have
        setSummary(prev => {
          const next = { ...msg.data, channels: prev?.channels };
          onChange?.(next);
          if (next.isSettled && !settledRef.current) {
            settledRef.current = true;
            onSettled?.(next);
          }
          return next;
        });
      }
    });
  }, [subscribe, targetId, onChange, onSettled]);

  const pending = useMemo(() => (summary?.payments || []).filter(p => p.status === 'PENDING'), [summary]);
  const pendingOnline = pending.filter(p => p.channel === 'RAZORPAY');

  // While a Razorpay QR is open, ask the server to check with Razorpay every few seconds
  useEffect(() => {
    if (pendingOnline.length === 0) return undefined;
    const id = pendingOnline[0].id;
    const timer = setInterval(async () => {
      try {
        const res = await api.get(`/stores/${storeId}/payments/${id}`);
        applySummary({ ...res.data.data.summary, channels: summary?.channels });
      } catch { /* transient; next tick retries */ }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [pendingOnline.map(p => p.id).join(','), storeId, applySummary]); // eslint-disable-line react-hooks/exhaustive-deps

  const channels = summary?.channels;
  const dueAfterPending = Math.max(0, (summary?.dueAmount || 0) - (summary?.pendingAmount || 0));

  // Default channel: first enabled; default amount: what's left
  useEffect(() => {
    if (!channels) return;
    setChannel(prev => (prev && channels[prev]?.enabled ? prev : CHANNELS.find(c => channels[c.id]?.enabled)?.id || 'CASH'));
  }, [channels]);
  useEffect(() => {
    setAmount(dueAfterPending > 0 ? String(dueAfterPending) : '');
    setTendered('');
  }, [dueAfterPending]);

  const amountNum = parseInt(amount, 10) || 0;
  const tenderedNum = parseInt(tendered, 10) || 0;
  const change = channel === 'CASH' && tenderedNum > amountNum ? tenderedNum - amountNum : 0;
  const amountInvalid = amountNum <= 0 || amountNum > (summary?.dueAmount || 0);
  const tenderShort = channel === 'CASH' && tendered !== '' && tenderedNum < amountNum;

  const run = async (fn) => {
    setBusy(true);
    setActionError('');
    try {
      await fn();
    } catch (err) {
      setActionError(errorText(err, 'Payment action failed'));
      load();
    } finally {
      setBusy(false);
    }
  };

  const createPayment = () => run(async () => {
    const res = await api.post(`/stores/${storeId}/payments`, {
      ...query,
      channel,
      amount: amountNum,
      cashTendered: channel === 'CASH' && tendered !== '' ? tenderedNum : undefined,
    });
    applySummary({ ...res.data.data.summary, channels });
  });

  const confirmOffline = (payment) => {
    if (!window.confirm(`Confirm ${rupees(payment.amount)} has been received in ${channels?.UPI_OFFLINE?.vpa || 'your UPI account'}?`)) return;
    run(async () => {
      const res = await api.post(`/stores/${storeId}/payments/${payment.id}/confirm`);
      applySummary({ ...res.data.data.summary, channels });
    });
  };

  const cancelPayment = (payment) => run(async () => {
    const res = await api.post(`/stores/${storeId}/payments/${payment.id}/cancel`);
    applySummary({ ...res.data.data.summary, channels });
  });

  if (loadError && !summary) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 p-4 text-sm text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
        <span>{loadError}</span>
        <Button size="sm" variant="outline" onClick={load}>Retry</Button>
      </div>
    );
  }
  if (!summary) {
    return (
      <div className="h-48 flex items-center justify-center text-zinc-400">
        <Loading03Icon size={24} className="animate-spin" />
      </div>
    );
  }

  const paidPct = summary.totalAmount > 0 ? Math.min(100, Math.round((summary.paidAmount / summary.totalAmount) * 100)) : 100;
  const history = (summary.payments || []).filter(p => p.status !== 'PENDING');

  return (
    <div className="flex flex-col gap-4">
      {/* Totals */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Bill</div>
            <div className="text-lg font-black tabular-nums">{rupees(summary.totalAmount)}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Paid</div>
            <div className="text-lg font-black tabular-nums text-emerald-600 dark:text-emerald-400">{rupees(summary.paidAmount)}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Due</div>
            <div className="text-lg font-black tabular-nums text-amber-600 dark:text-amber-400">{rupees(summary.dueAmount)}</div>
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden" role="progressbar" aria-valuenow={paidPct} aria-valuemin={0} aria-valuemax={100} aria-label="Amount paid">
          <div className="h-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${paidPct}%` }} />
        </div>
      </div>

      {summary.isSettled && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 p-4 flex items-center gap-3 text-emerald-800 dark:text-emerald-300">
          <CheckmarkCircle02Icon size={22} />
          <div className="text-sm font-bold">Bill fully paid</div>
        </div>
      )}

      {summary.isCancelled && (
        <div className="rounded-2xl border border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 p-4 text-sm font-semibold text-zinc-600">This bill was cancelled.</div>
      )}

      {summary.blockers?.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
          <Alert01Icon size={16} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-bold mb-0.5">Resolve before taking payment</div>
            {summary.blockers.map(b => <div key={b.id}>{b.reason}</div>)}
          </div>
        </div>
      )}

      {actionError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
          {actionError}
        </div>
      )}

      {pending.map(p => (
        <PendingPayment key={p.id} payment={p} channels={channels} onConfirm={confirmOffline} onCancel={cancelPayment} busy={busy} />
      ))}

      {/* New payment */}
      {!summary.isSettled && !summary.isCancelled && summary.blockers?.length === 0 && dueAfterPending > 0 && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900 flex flex-col gap-3">
          <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
            {summary.paidAmount > 0 || pending.length > 0 ? 'Collect the remaining amount' : 'Collect payment'}
          </div>

          <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-2xl" role="radiogroup" aria-label="Payment method">
            {CHANNELS.map(c => {
              const enabled = channels?.[c.id]?.enabled;
              const active = channel === c.id;
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={!enabled}
                  title={enabled ? c.hint : (channels?.[c.id]?.reason || c.disabledHint)}
                  onClick={() => setChannel(c.id)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${active
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-sm ring-1 ring-amber-500/40'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
                >
                  <Icon size={16} />
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
          {channel && !channels?.[channel]?.enabled && (
            <p className="text-[11px] text-zinc-500">{channels?.[channel]?.reason || CHANNELS.find(c => c.id === channel)?.disabledHint}</p>
          )}
          <p className="text-[11px] text-zinc-500 -mt-1">{CHANNELS.find(c => c.id === channel)?.hint}</p>
          {channels?.RAZORPAY && !channels.RAZORPAY.enabled && channels.RAZORPAY.reason && channel !== 'RAZORPAY' && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 -mt-1">Online QR unavailable: {channels.RAZORPAY.reason}</p>
          )}

          <label className="flex items-center justify-between gap-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Amount for this payment
            <span className="relative w-36">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">₹</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={summary.dueAmount}
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ''))}
                className="w-full h-9 pl-7 pr-3 text-right text-sm font-bold bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </span>
          </label>
          <div className="flex gap-1.5 flex-wrap -mt-1">
            <button type="button" onClick={() => setAmount(String(dueAfterPending))} className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-amber-500">
              Full {rupees(dueAfterPending)}
            </button>
            {dueAfterPending > 1 && (
              <button type="button" onClick={() => setAmount(String(Math.ceil(dueAfterPending / 2)))} className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-amber-500">
                Half {rupees(Math.ceil(dueAfterPending / 2))}
              </button>
            )}
            <span className="text-[11px] text-zinc-400 self-center">Pay part now, the rest another way.</span>
          </div>

          {channel === 'CASH' && (
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 p-3 flex flex-col gap-2">
              <label className="flex items-center justify-between gap-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Cash received
                <span className="relative w-36">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">₹</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder={String(amountNum || '')}
                    value={tendered}
                    onChange={e => setTendered(e.target.value.replace(/[^\d]/g, ''))}
                    className="w-full h-9 pl-7 pr-3 text-right text-sm font-bold bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </span>
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {[100, 200, 500, 2000].filter(n => n >= amountNum).slice(0, 3).map(n => (
                  <button key={n} type="button" onClick={() => setTendered(String(n))} className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500">
                    ₹{n} note
                  </button>
                ))}
              </div>
              {change > 0 && (
                <div className="flex justify-between text-sm font-black text-emerald-700 dark:text-emerald-400">
                  <span>Change to return</span><span className="tabular-nums">{rupees(change)}</span>
                </div>
              )}
              {tenderShort && <div className="text-[11px] font-bold text-rose-600">Cash received is less than the amount.</div>}
            </div>
          )}

          <Button
            type="button"
            size="lg"
            disabled={busy || amountInvalid || tenderShort || !channels?.[channel]?.enabled}
            onClick={createPayment}
            className={channel === 'CASH' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
          >
            {busy ? 'Working…'
              : channel === 'CASH' ? `Record cash ${rupees(amountNum)}`
                : channel === 'UPI_OFFLINE' ? `Show UPI QR for ${rupees(amountNum)}`
                  : `Generate QR for ${rupees(amountNum)}`}
          </Button>
        </div>
      )}

      {history.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
          {history.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-xs">
              <div className="min-w-0">
                <div className="font-bold text-zinc-800 dark:text-zinc-200">{CHANNEL_LABEL[p.channel]}</div>
                <div className="text-[10px] text-zinc-400">
                  {new Date(p.paidAt || p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {p.collectedBy?.name ? ` · ${p.collectedBy.name}` : ''}
                  {p.channel === 'CASH' && p.changeDue > 0 ? ` · change ${rupees(p.changeDue)}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-black tabular-nums">{rupees(p.amount)}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${STATUS_TONE[p.status]}`}>{p.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
