import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@smo/ui';
import { Cancel01Icon, Loading03Icon, Alert02Icon } from 'hugeicons-react';
import api from '../../lib/api';

const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const PRESET_REASONS = ['Guests left', 'Table stuck after a mistake', 'Test order', 'End of day reset'];

/**
 * Manager frees one or many tables at once, whatever state they are stuck in. Unpaid orders on
 * those tables are cancelled with a reason (and show under Leakages); paid ones are untouched.
 *
 * @param {{ storeId: string, tables: object[], initialIds?: string[], onClose: Function, onDone: (result: object) => void }} props
 *        tables: the busy tables to choose from
 */
export const ReleaseTablesDialog = ({ storeId, tables, initialIds, onClose, onDone }) => {
  const [picked, setPicked] = useState(() => new Set(initialIds?.length ? initialIds : []));
  const [preset, setPreset] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const chosen = useMemo(() => tables.filter(t => picked.has(t.id)), [tables, picked]);
  const unpaid = chosen.reduce((sum, t) => sum + (t.unpaidTotal || 0), 0);
  const reason = [preset, details.trim()].filter(Boolean).join(' — ');
  const allPicked = tables.length > 0 && picked.size === tables.length;
  const valid = chosen.length > 0 && (unpaid === 0 || reason.length >= 3);

  const toggle = (id) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const release = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/stores/${storeId}/tables/release`, { tableIds: chosen.map(t => t.id), reason });
      onDone(res.data.data);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not release the tables');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="release-tables-title">
      <div className="w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-3xl sm:rounded-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 id="release-tables-title" className="text-base font-bold text-zinc-900 dark:text-zinc-50">Release tables</h2>
            <p className="text-xs text-zinc-500">Closes the open bill and resets the PIN, so the table can be used again straight away.</p>
          </div>
          <button type="button" aria-label="Close" disabled={busy} onClick={onClose} className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"><Cancel01Icon size={16} /></button>
        </div>

        <div className="px-5 pb-4 flex flex-col gap-4 overflow-y-auto">
          {tables.length === 0 ? (
            <p className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-4 text-sm text-zinc-500 text-center">Every table is free. There is nothing to release.</p>
          ) : (
            <fieldset>
              <legend className="w-full flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                <span>Tables in use</span>
                <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setPicked(allPicked ? new Set() : new Set(tables.map(t => t.id)))}>
                  {allPicked ? 'Clear all' : 'Select all'}
                </button>
              </legend>
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800 max-h-56 overflow-y-auto">
                {tables.map(t => (
                  <label key={t.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer">
                    <input type="checkbox" className="size-4 accent-amber-500" checked={picked.has(t.id)} onChange={() => toggle(t.id)} />
                    <span className="flex-1 font-semibold text-zinc-900 dark:text-zinc-100">Table {t.tableNumber}</span>
                    {t.unpaidTotal > 0
                      ? <span className="text-xs font-semibold tabular-nums text-rose-600 dark:text-rose-400">{rupees(t.unpaidTotal)} unpaid</span>
                      : <span className="text-xs text-zinc-500">Nothing unpaid</span>}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {unpaid > 0 && (
            <>
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 px-3 py-2.5 text-xs text-rose-800 dark:text-rose-200">
                <Alert02Icon size={16} className="shrink-0 mt-0.5" />
                <span>
                  <strong className="tabular-nums">{rupees(unpaid)}</strong> of unpaid orders on {chosen.filter(t => t.unpaidTotal > 0).length === 1 ? 'this table' : 'these tables'} will be <strong>cancelled, not collected</strong>. It is recorded under Leakages with your name. If the guest is paying, close this and collect the payment instead.
                </span>
              </div>
              <fieldset>
                <legend className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">Reason <span className="text-rose-600">*</span></legend>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_REASONS.map(r => (
                    <button key={r} type="button" aria-pressed={preset === r} onClick={() => setPreset(prev => (prev === r ? '' : r))}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${preset === r ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900' : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'}`}>
                      {r}
                    </button>
                  ))}
                </div>
                <input value={details} maxLength={120} onChange={e => setDetails(e.target.value)} aria-label="Reason details" placeholder="Details (optional if you picked one above)"
                  className="mt-2 w-full h-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 text-sm outline-none focus:border-amber-400" />
              </fieldset>
            </>
          )}

          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 grid grid-cols-2 gap-2 shrink-0">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Keep as is</Button>
          <Button type="button" disabled={!valid || busy} onClick={release} className="!bg-rose-600 hover:!bg-rose-700 !text-white">
            {busy ? <Loading03Icon size={16} className="animate-spin" /> : `Release ${chosen.length || ''} ${chosen.length === 1 ? 'table' : 'tables'}`.replace('  ', ' ')}
          </Button>
        </div>
      </div>
    </div>
  );
};
