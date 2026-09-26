import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@smo/ui';
import { Cancel01Icon, Loading03Icon, Money01Icon, QrCodeIcon, SmartPhone01Icon, CheckmarkCircle02Icon } from 'hugeicons-react';
import api from '../../lib/api';

const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const errorText = (err, fallback) => err?.response?.data?.error?.message || err?.message || fallback;

const METHOD_LABEL = { RAZORPAY: 'Razorpay', CASH: 'Cash', UPI_OFFLINE: 'UPI' };
const STATUS_TEXT = {
  PENDING: 'On its way (Razorpay, usually 5–7 working days)',
  PROCESSED: 'Refunded',
  FAILED: 'Failed',
};
const STATUS_TONE = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  PROCESSED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  FAILED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

/**
 * Returns money owed to a guest: back through Razorpay (managers), or cash/UPI handed back by staff.
 *
 * @param {{ storeId: string, orderId: string|null, label?: string, onClose: Function, onChanged?: Function }} props
 */
export const RefundDialog = ({ storeId, orderId, label, onClose, onChanged, asPage = false }) => {
  const [options, setOptions] = useState(null);
  const [method, setMethod] = useState(null);
  const [paymentId, setPaymentId] = useState(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/stores/${storeId}/orders/${orderId}/refunds`);
      const data = res.data.data;
      setOptions(data);
      const gateway = data.canRefundViaGateway && data.gatewayPayments.length > 0;
      setMethod(prev => prev || (gateway ? 'RAZORPAY' : 'CASH'));
      setPaymentId(prev => prev || data.gatewayPayments[0]?.id || null);
      setAmount(data.refundDue > 0 ? String(data.refundDue) : '');
      setError('');
    } catch (err) {
      setError(errorText(err, 'Could not load refund details'));
    }
  }, [storeId, orderId]);

  useEffect(() => {
    if (!orderId) return;
    setOptions(null);
    setMethod(null);
    setPaymentId(null);
    setNote('');
    load();
  }, [orderId, load]);

  if (!orderId) return null;

  const source = options?.gatewayPayments.find(p => p.id === paymentId);
  const max = method === 'RAZORPAY' && source ? Math.min(options.refundDue, source.refundable) : options?.refundDue || 0;
  const amountNum = parseInt(amount, 10) || 0;
  const valid = amountNum > 0 && amountNum <= max && (method !== 'RAZORPAY' || source);

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    const how = method === 'RAZORPAY' ? 'back to the guest’s UPI/card via Razorpay' : method === 'CASH' ? 'handed back in cash' : 'sent back by UPI';
    if (!window.confirm(`Refund ${rupees(amountNum)} ${how}?`)) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/stores/${storeId}/orders/${orderId}/refunds`, {
        method,
        amount: amountNum,
        paymentId: method === 'RAZORPAY' ? paymentId : undefined,
        note: note.trim() || undefined,
      });
      setOptions(res.data.data);
      setAmount(res.data.data.refundDue > 0 ? String(res.data.data.refundDue) : '');
      setNote('');
      onChanged?.(res.data.data);
    } catch (err) {
      setError(errorText(err, 'Refund failed'));
      load();
    } finally {
      setBusy(false);
    }
  };

  const methods = [
    {
      id: 'RAZORPAY',
      label: 'Razorpay',
      hint: 'Back to the guest’s UPI/card',
      icon: QrCodeIcon,
      disabled: !options?.canRefundViaGateway || !options?.gatewayPayments.length,
      why: !options?.canRefundViaGateway ? 'Managers only' : 'No Razorpay payment on this order',
    },
    { id: 'CASH', label: 'Cash', hint: 'Handed back at the counter', icon: Money01Icon },
    { id: 'UPI_OFFLINE', label: 'UPI', hint: 'Sent from your UPI app', icon: SmartPhone01Icon },
  ];

  return (
    <div className={asPage ? "w-full max-w-md" : "fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"} {...(asPage ? {} : { role: "dialog", "aria-modal": "true" })} aria-labelledby="refund-title">
      <div className={`w-full flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden ${asPage ? "rounded-2xl" : "sm:max-w-md max-h-[92vh] rounded-t-3xl sm:rounded-2xl shadow-2xl"}`}>
        <div className="px-5 pt-5 pb-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="refund-title" className="text-base font-black">Refund guest</h2>
            <p className="text-xs text-zinc-500">{label || `Order #${orderId.slice(-6).toUpperCase()}`}</p>
          </div>
          <button type="button" aria-label="Close" disabled={busy} onClick={onClose} className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400">
            <Cancel01Icon size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col gap-4">
          {!options && !error && <div className="h-32 flex items-center justify-center text-zinc-400"><Loading03Icon size={22} className="animate-spin" /></div>}

          {options && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Still owed to guest</span>
              <span className={`text-xl font-black tabular-nums ${options.refundDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{rupees(options.refundDue)}</span>
            </div>
          )}

          {options && options.refundDue === 0 && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3 text-sm font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <CheckmarkCircle02Icon size={18} /> Nothing left to refund.
            </div>
          )}

          {options && options.refundDue > 0 && (
            <form id="refund-form" onSubmit={submit} className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-2xl" role="radiogroup" aria-label="Refund method">
                {methods.map(m => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={method === m.id}
                      disabled={m.disabled}
                      title={m.disabled ? m.why : m.hint}
                      onClick={() => setMethod(m.id)}
                      className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed ${method === m.id ? 'bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-rose-500/40' : 'text-zinc-600 dark:text-zinc-400'}`}
                    >
                      <Icon size={16} /> {m.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-zinc-500 -mt-1">{methods.find(m => m.id === method)?.hint}</p>

              {method === 'RAZORPAY' && options.gatewayPayments.length > 1 && (
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Refund against payment
                  <select
                    value={paymentId || ''}
                    onChange={e => setPaymentId(e.target.value)}
                    className="mt-1 w-full h-9 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 text-sm"
                  >
                    {options.gatewayPayments.map(p => (
                      <option key={p.id} value={p.id}>
                        {rupees(p.amount)} paid {p.paidAt ? new Date(p.paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''} · {rupees(p.refundable)} refundable
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="flex items-center justify-between gap-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Amount
                <span className="relative w-36">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">₹</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={max}
                    value={amount}
                    onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ''))}
                    className="w-full h-9 pl-7 pr-3 text-right text-sm font-bold bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </span>
              </label>
              {amountNum > max && <p className="text-[11px] font-bold text-rose-600 -mt-2">Up to {rupees(max)} can be refunded this way.</p>}

              <input
                type="text"
                maxLength={200}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Note (optional)"
                aria-label="Refund note"
                className="h-9 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 text-sm outline-none"
              />
            </form>
          )}

          {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">{error}</div>}

          {options?.refunds.length > 0 && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
              {options.refunds.map(r => (
                <div key={r.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-bold">{METHOD_LABEL[r.method]} · {rupees(r.amount)}</div>
                    <div className="text-[10px] text-zinc-400 truncate">
                      {new Date(r.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      {r.processedBy?.name ? ` · ${r.processedBy.name}` : ''}
                      {r.failureReason ? ` · ${r.failureReason}` : ''}
                    </div>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${STATUS_TONE[r.status]}`} title={STATUS_TEXT[r.status]}>
                    {r.status === 'PENDING' ? 'On its way' : r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-2 bg-zinc-50 dark:bg-zinc-950/40">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Close</Button>
          <Button type="submit" form="refund-form" disabled={!valid || busy || !options || options.refundDue === 0} className="bg-rose-600 hover:bg-rose-700 text-white">
            {busy ? <Loading03Icon size={16} className="animate-spin" /> : `Refund ${amountNum > 0 ? rupees(amountNum) : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
};
