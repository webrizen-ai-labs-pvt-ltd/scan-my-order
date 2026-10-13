import React, { useState } from 'react';
import { Button } from '@smo/ui';
import { Loading03Icon } from 'hugeicons-react';
import api from '../../lib/api';
import { amount, errorText, field, lotDeadline, rupees, unit } from './inv-format';
import { Field, Modal } from './inv-shared';

/**
 * Records something thrown away. Opened for an ingredient, optionally with one of its lots
 * already chosen (e.g. from the "expired" list, where the whole lot is filled in).
 *
 * @param {{ storeId: string, material: object, lot?: object, reasons: string[], defaultReason?: string,
 *           onClose: Function, onDone: (result: object) => void }} props
 */
export const WasteDialog = ({ storeId, material, lot, reasons, defaultReason, canManage = true, onClose, onDone }) => {
  const [lotId, setLotId] = useState(lot?.id || '');
  const [quantity, setQuantity] = useState(lot ? String(lot.remaining) : '');
  const [reason, setReason] = useState(defaultReason || '');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const chosen = material.lots.find(l => l.id === lotId) || null;
  const most = chosen ? chosen.remaining : material.stock;
  const amountNumber = Number(quantity);
  const fullReason = reason === 'Other' ? details.trim() : [reason, details.trim()].filter(Boolean).join(' — ');
  const valid = amountNumber > 0 && amountNumber <= most + 1e-6 && fullReason.length >= 3;
  const value = material.costPerUnit && amountNumber > 0 ? amountNumber * (chosen?.unitCost ?? material.costPerUnit) : null;

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/stores/${storeId}/inventory/advanced/waste`, { materialId: material.id, lotId: lotId || undefined, quantity: amountNumber, reason: fullReason });
      onDone(res.data.data);
    } catch (err) {
      setError(errorText(err, 'Could not record the wastage'));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Throw away ${material.name}`}
      subtitle={`${amount(material.stock, material.unit)} in stock`}
      onClose={onClose}
      busy={busy}
      footer={(
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || busy} onClick={submit} className="!bg-none !bg-red-600 hover:!bg-red-700 !text-white !border-red-600">
            {busy ? <Loading03Icon size={15} className="animate-spin" /> : 'Record wastage'}
          </Button>
        </>
      )}
    >
      {material.lots.length > 0 && (
        <Field label="From which lot" hint="Pick the lot it came from, or leave it on “Oldest stock” if you’re not sure.">
          <select className={field} value={lotId} onChange={e => { setLotId(e.target.value); setQuantity(''); }}>
            <option value="">Oldest stock</option>
            {material.lots.map(l => (
              <option key={l.id} value={l.id}>{amount(l.remaining, material.unit)} · {lotDeadline(l)}{l.supplierName ? ` · ${l.supplierName}` : ''}</option>
            ))}
          </select>
        </Field>
      )}

      <Field label={`How much (${unit(material.unit)})`} hint={`Up to ${amount(most, material.unit)}.${canManage && value ? ` Worth about ${rupees(value)}.` : ''}`}>
        <div className="flex gap-2">
          <input className={`${field} tabular-nums`} type="number" inputMode="decimal" min="0" step="any" autoFocus={!lot} value={quantity} onChange={e => setQuantity(e.target.value)} />
          <Button type="button" variant="outline" onClick={() => setQuantity(String(most))}>All of it</Button>
        </div>
      </Field>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">Why</legend>
        <div className="flex flex-wrap gap-1.5">
          {reasons.map(r => (
            <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${reason === r ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900' : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'}`}>
              {r}
            </button>
          ))}
        </div>
        <input className={`${field} mt-2`} value={details} maxLength={100} onChange={e => setDetails(e.target.value)} placeholder={reason === 'Other' ? 'What happened?' : 'Details (optional)'} aria-label="Details" />
      </fieldset>

      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </Modal>
  );
};
