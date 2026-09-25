import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@smo/ui';
import { Cancel01Icon, Alert01Icon, Loading03Icon } from 'hugeicons-react';
import api from '../../lib/api';

const PRESET_REASONS = [
  'Customer changed their mind',
  'Wrong item punched',
  'Item unavailable',
  'Duplicate order',
  'Customer left',
  'Kitchen issue',
];

const errorText = (err) => err?.response?.data?.error?.message || err?.message || 'Could not cancel the order';

/**
 * Cancels an order after staff pick or type a reason (the API rejects cancellations without one).
 *
 * @param {{ storeId: string, order: { id: string, table?: { tableNumber: number }, totalAmount?: number } | null,
 *           onClose: Function, onCancelled?: Function }} props
 */
export const CancelOrderDialog = ({ storeId, order, onClose, onCancelled }) => {
  const [preset, setPreset] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const detailsRef = useRef(null);

  useEffect(() => {
    setPreset('');
    setDetails('');
    setError('');
  }, [order?.id]);

  useEffect(() => {
    if (!order) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [order, busy, onClose]);

  if (!order) return null;

  const isOther = preset === 'Other';
  const reason = isOther ? details.trim() : [preset, details.trim()].filter(Boolean).join(' — ');
  const valid = reason.length >= 3;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.patch(`/stores/${storeId}/orders/${order.id}/status`, { status: 'CANCELLED', reason });
      onCancelled?.(res.data.data, reason);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const label = `Order #${order.id.slice(-6).toUpperCase()}${order.table ? ` · Table ${order.table.tableNumber}` : ''}`;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-order-title">
      <form onSubmit={submit} className="w-full sm:max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-start gap-3">
          <div className="size-10 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0">
            <Alert01Icon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="cancel-order-title" className="text-base font-black text-zinc-900 dark:text-zinc-50">Cancel order?</h2>
            <p className="text-xs text-zinc-500">{label}{order.totalAmount ? ` · ₹${order.totalAmount}` : ''}</p>
          </div>
          <button type="button" aria-label="Close" disabled={busy} onClick={onClose} className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400">
            <Cancel01Icon size={16} />
          </button>
        </div>

        <div className="px-5 pb-4 flex flex-col gap-3">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            The kitchen is notified, used ingredients go back to inventory, and any QR shown to the guest is withdrawn. Paid orders can’t be cancelled here.
          </p>

          <fieldset>
            <legend className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">Reason <span className="text-rose-600">*</span></legend>
            <div className="flex flex-wrap gap-1.5">
              {[...PRESET_REASONS, 'Other'].map(r => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={preset === r}
                  onClick={() => { setPreset(r); if (r === 'Other') setTimeout(() => detailsRef.current?.focus(), 0); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${preset === r
                    ? 'bg-rose-600 border-rose-600 text-white'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-rose-400'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
            {isOther ? 'Describe the reason' : 'Details (optional)'}
            <textarea
              ref={detailsRef}
              rows={2}
              maxLength={150}
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder={isOther ? 'Why is this order being cancelled?' : 'e.g. Guest waited too long'}
              className="mt-1 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-rose-400/40 resize-none"
            />
          </label>

          {error && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-2 bg-zinc-50 dark:bg-zinc-950/40">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Keep order</Button>
          <Button type="submit" disabled={!valid || busy} className="bg-rose-600 hover:bg-rose-700 text-white">
            {busy ? <Loading03Icon size={16} className="animate-spin" /> : 'Cancel order'}
          </Button>
        </div>
      </form>
    </div>
  );
};
