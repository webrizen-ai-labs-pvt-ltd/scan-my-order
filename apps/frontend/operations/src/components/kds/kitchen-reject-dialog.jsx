import React, { useEffect, useMemo, useState } from 'react';
import { Cancel01Icon, Alert01Icon, Loading03Icon, CheckmarkSquare02Icon, SquareIcon } from 'hugeicons-react';
import api from '../../lib/api';

const REASONS = [
  { label: 'Out of stock', soldOut: true },
  { label: 'Ingredient missing', soldOut: true },
  { label: 'Equipment issue', soldOut: false },
  { label: 'Allergy / dietary conflict', soldOut: false },
  { label: 'Kitchen closing', soldOut: false },
  { label: 'Too busy to make in time', soldOut: false },
  { label: 'Other', soldOut: false },
];

const itemName = (item) => item.displayName || item.customName || item.menuItem?.name || 'Item';

/**
 * Kitchen marks items (or the whole ticket) as "can't make", with a reason.
 * Front-of-house and the guest are notified by the server.
 */
export const KitchenRejectDialog = ({ storeId, order, onClose, onDone }) => {
  const activeItems = useMemo(() => (order?.items || []).filter(i => i.status !== 'REJECTED'), [order]);
  const [selected, setSelected] = useState(new Set());
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [markSoldOut, setMarkSoldOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Single-item tickets start with that item picked
    setSelected(new Set(activeItems.length === 1 ? [activeItems[0].id] : []));
    setReason(null);
    setDetails('');
    setMarkSoldOut(false);
    setError('');
  }, [order?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!order) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [order, busy, onClose]);

  if (!order) return null;

  const allSelected = activeItems.length > 0 && selected.size === activeItems.length;
  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const pickReason = (r) => {
    setReason(r);
    setMarkSoldOut(r.soldOut);
  };

  const fullReason = reason?.label === 'Other' ? details.trim() : [reason?.label, details.trim()].filter(Boolean).join(' — ');
  const canSubmit = selected.size > 0 && fullReason.length >= 3 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/stores/${storeId}/orders/${order.id}/reject`, {
        all: allSelected,
        itemIds: allSelected ? undefined : [...selected],
        reason: fullReason,
        markSoldOut,
      });
      onDone?.({ wholeOrder: allSelected, count: selected.size, reason: fullReason });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error?.message || err?.message || 'Could not reject');
    } finally {
      setBusy(false);
    }
  };

  const where = order.table ? `Table ${order.table.tableNumber}` : order.type === 'TAKEAWAY' ? 'Takeaway' : 'Order';

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="kitchen-reject-title">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-zinc-900 border border-zinc-700 text-zinc-100 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 flex items-center gap-3 bg-red-700">
          <Alert01Icon size={26} />
          <div className="min-w-0 flex-1">
            <h2 id="kitchen-reject-title" className="text-xl font-black">Can’t make it</h2>
            <p className="text-sm text-red-100">{where} · #{order.id.slice(-6).toUpperCase()}</p>
          </div>
          <button type="button" aria-label="Close" disabled={busy} onClick={onClose} className="p-2 rounded-full hover:bg-red-800">
            <Cancel01Icon size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">1 · Which items?</h3>
              <button
                type="button"
                onClick={() => setSelected(allSelected ? new Set() : new Set(activeItems.map(i => i.id)))}
                className="text-sm font-bold text-red-300 hover:text-red-200 underline"
              >
                {allSelected ? 'Clear' : 'Whole order'}
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {activeItems.map(item => {
                const on = selected.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(item.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left text-lg font-semibold ${on ? 'border-red-500 bg-red-950/60' : 'border-zinc-700 hover:border-zinc-500'}`}
                  >
                    {on ? <CheckmarkSquare02Icon size={24} className="text-red-400 shrink-0" /> : <SquareIcon size={24} className="text-zinc-500 shrink-0" />}
                    <span className="size-8 rounded-md bg-zinc-100 text-zinc-950 font-black flex items-center justify-center shrink-0">{item.quantity}</span>
                    <span className="truncate">{itemName(item)}</span>
                  </button>
                );
              })}
            </div>
            {allSelected && (
              <p className="mt-2 text-sm font-semibold text-red-300">The whole order will be cancelled and the guest informed.</p>
            )}
          </section>

          <section>
            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-3">2 · Why?</h3>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map(r => (
                <button
                  key={r.label}
                  type="button"
                  aria-pressed={reason?.label === r.label}
                  onClick={() => pickReason(r)}
                  className={`px-4 py-3 rounded-xl border-2 text-base font-bold text-left ${reason?.label === r.label ? 'border-red-500 bg-red-600 text-white' : 'border-zinc-700 hover:border-zinc-500'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              maxLength={150}
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder={reason?.label === 'Other' ? 'Describe the reason (required)' : 'Extra detail for staff and guest (optional)'}
              aria-label="Reason details"
              className="mt-3 w-full rounded-xl bg-zinc-950 border border-zinc-700 px-4 py-3 text-base outline-none focus:border-red-500 resize-none"
            />
          </section>

          <label className="flex items-start gap-3 px-4 py-3 rounded-xl border border-zinc-700 cursor-pointer">
            <input
              type="checkbox"
              checked={markSoldOut}
              onChange={e => setMarkSoldOut(e.target.checked)}
              className="mt-1 size-5 accent-red-600"
            />
            <span>
              <span className="block text-base font-bold">Mark as sold out</span>
              <span className="block text-sm text-zinc-400">Hide these dishes from the QR menu and POS until a manager turns them back on.</span>
            </span>
          </label>

          {error && <div role="alert" className="rounded-xl bg-red-950 border border-red-800 px-4 py-3 text-sm font-semibold text-red-200">{error}</div>}
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-950 grid grid-cols-2 gap-3">
          <button type="button" disabled={busy} onClick={onClose} className="h-14 rounded-xl border border-zinc-600 text-lg font-bold hover:bg-zinc-800">
            Keep cooking
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            className="h-14 rounded-xl bg-red-600 hover:bg-red-500 text-white text-lg font-black disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {busy ? <Loading03Icon size={22} className="animate-spin" /> : allSelected ? 'Reject order' : `Reject ${selected.size || ''} item${selected.size === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
};
