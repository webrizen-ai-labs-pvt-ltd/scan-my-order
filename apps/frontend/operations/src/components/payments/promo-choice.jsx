import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@smo/ui';
import { CheckmarkCircle02Icon, Loading03Icon } from 'hugeicons-react';
import api from '../../lib/api';
import { apiErrorMessage } from '../pos/pos-toasts';
import { promoStateOf } from '../../lib/promo';

/**
 * Promo code on a bill: shows the code, or lets staff add one when the bill has none.
 * Codes can only change before any payment starts (a QR already shows the amount).
 *
 * @param {object} props
 * @param {string|null} props.applied     code on the bill (removable)
 * @param {string|null} [props.locked]    why the code can't be changed here, if it can't
 * @param {string[]} [props.otherCodes]   codes guests used on their own orders (table bills)
 * @param {boolean} props.paymentStarted
 */
export const PromoChoice = ({ applied, locked, otherCodes = [], paymentStarted, discount, busy, error, onApply, onRemove }) => {
  const [code, setCode] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    if (await onApply(clean)) setCode('');
  };

  const canEdit = !paymentStarted && !locked;

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Promo code</div>
      {applied ? (
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm min-w-0">
            <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-400">
              <CheckmarkCircle02Icon size={14} /> {applied}
            </span>
            {discount > 0 && <span className="text-zinc-500"> · saves ₹{discount}</span>}
          </div>
          {canEdit && (
            <Button variant="outline" size="sm" disabled={busy} onClick={onRemove}>Remove</Button>
          )}
        </div>
      ) : otherCodes.length > 0 ? (
        <div className="text-sm text-zinc-700 dark:text-zinc-300">
          Already used on this table: <span className="font-semibold">{otherCodes.join(', ')}</span>
        </div>
      ) : canEdit ? (
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter code"
            aria-label="Promo code"
            autoComplete="off"
            autoCapitalize="characters"
            className="min-w-0 flex-1 h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 text-sm uppercase tracking-wide outline-none focus:border-amber-400"
          />
          <Button type="submit" size="sm" disabled={busy || !code.trim()} className="bg-amber-400 text-amber-950 hover:bg-amber-500">
            {busy ? <Loading03Icon size={14} className="animate-spin" /> : 'Apply'}
          </Button>
        </form>
      ) : (
        <div className="text-sm text-zinc-500">No promo code on this bill.</div>
      )}
      {(locked || (paymentStarted && !otherCodes.length)) && (
        <p className="text-[11px] text-zinc-500">{locked || 'Promo codes can only be changed before payment starts.'}</p>
      )}
      {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
    </div>
  );
};

/**
 * Self-contained promo card for a placed order or a table bill: loads the bill, applies and
 * removes codes, then calls `onChanged` so the payment panel can reload the new total.
 */
export const BillPromo = ({ storeId, orderId, tableSessionId, paymentStarted, onChanged }) => {
  const isTable = Boolean(tableSessionId);
  const [bill, setBill] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = isTable
        ? await api.get(`/stores/${storeId}/orders/sessions/${tableSessionId}`)
        : await api.get(`/stores/${storeId}/orders/${orderId}`);
      setBill(res.data.data);
    } catch { /* the payment panel shows load errors */ }
  }, [storeId, orderId, tableSessionId, isTable]);

  useEffect(() => { load(); }, [load]);

  const ref = isTable ? { tableSessionId } : { orderId };
  const run = async (path, body) => {
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/stores/${storeId}/orders/${path}`, body);
      await load();
      onChanged?.();
      return res.data.data;
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not change the promo code'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  if (!bill) return null;
  return (
    <PromoChoice
      {...promoStateOf(bill, isTable)}
      paymentStarted={paymentStarted}
      busy={busy}
      error={error}
      onApply={async (code) => Boolean(await run('promo', { ...ref, code }))}
      onRemove={() => run('promo/remove', ref)}
    />
  );
};
