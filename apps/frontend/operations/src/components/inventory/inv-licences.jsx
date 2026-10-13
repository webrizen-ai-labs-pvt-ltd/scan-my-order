import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@smo/ui';
import { Loading03Icon, PlusSignIcon } from 'hugeicons-react';
import api from '../../lib/api';
import { card, errorText, field, fullDay, primary } from './inv-format';
import { Empty, Field, Modal, Tag } from './inv-shared';

/** Where a licence stands, in words */
export function licenceDeadline(licence) {
  if (licence.daysLeft === null || licence.daysLeft === undefined) return 'No expiry date';
  if (licence.daysLeft < -1) return `Expired ${Math.abs(licence.daysLeft)} days ago`;
  if (licence.daysLeft === -1) return 'Expired yesterday';
  if (licence.daysLeft === 0) return 'Expires today';
  if (licence.daysLeft === 1) return 'Expires tomorrow';
  if (licence.daysLeft <= 30) return `Expires in ${licence.daysLeft} days`;
  return `Valid until ${fullDay(licence.expiresOn)}`;
}
const toDateInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const LicenceDialog = ({ storeId, licence, kinds, onClose, onDone }) => {
  const [form, setForm] = useState({
    kind: licence?.kind || kinds[0]?.id || 'OTHER',
    name: licence?.name || '',
    number: licence?.number || '',
    issuedBy: licence?.issuedBy || '',
    expiresOn: toDateInput(licence?.expiresOn),
    notes: licence?.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));
  const kindLabel = kinds.find(k => k.id === form.kind)?.label || '';
  const valid = form.kind !== 'OTHER' || form.name.trim().length >= 2;

  const send = async (request, message) => {
    setBusy(true);
    setError('');
    try {
      await request();
      onDone(message);
    } catch (err) {
      setError(errorText(err, 'Could not save the licence'));
      setBusy(false);
    }
  };
  const submit = () => {
    const payload = { ...form, name: form.name.trim() || kindLabel, expiresOn: form.expiresOn || null };
    send(() => (licence
      ? api.patch(`/stores/${storeId}/inventory/advanced/licences/${licence.id}`, payload)
      : api.post(`/stores/${storeId}/inventory/advanced/licences`, payload)), `${payload.name} saved.`);
  };

  return (
    <Modal
      title={licence ? `Change ${licence.name}` : 'Add a licence'}
      onClose={onClose}
      busy={busy}
      footer={removing ? (
        <>
          <span className="mr-auto text-sm text-zinc-600 dark:text-zinc-300">Remove this licence from the record?</span>
          <Button variant="outline" disabled={busy} onClick={() => setRemoving(false)}>Keep</Button>
          <Button disabled={busy} className="!bg-red-600 hover:!bg-red-700 !text-white" onClick={() => send(() => api.delete(`/stores/${storeId}/inventory/advanced/licences/${licence.id}`), `${licence.name} removed.`)}>
            {busy ? <Loading03Icon size={15} className="animate-spin" /> : 'Remove'}
          </Button>
        </>
      ) : (
        <>
          {licence && <Button variant="outline" disabled={busy} className="mr-auto" onClick={() => setRemoving(true)}>Remove</Button>}
          <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || busy} onClick={submit} className={primary}>
            {busy ? <Loading03Icon size={15} className="animate-spin" /> : 'Save'}
          </Button>
        </>
      )}
    >
      <Field label="What it is">
        <select className={field} value={form.kind} onChange={set('kind')}>
          {kinds.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
      </Field>
      <Field label="Name" optional={form.kind !== 'OTHER'} hint={form.kind !== 'OTHER' ? `Leave empty to call it “${kindLabel}”.` : undefined}>
        <input className={field} value={form.name} maxLength={80} onChange={set('name')} placeholder={form.kind === 'OTHER' ? 'Signage licence' : kindLabel} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Number" optional>
          <input className={`${field} font-mono`} value={form.number} maxLength={40} autoComplete="off" onChange={set('number')} />
        </Field>
        <Field label="Valid until" optional hint="You’re warned 30 days before.">
          <input className={field} type="date" value={form.expiresOn} onChange={set('expiresOn')} />
        </Field>
      </div>
      <Field label="Issued by" optional>
        <input className={field} value={form.issuedBy} maxLength={80} onChange={set('issuedBy')} placeholder="FSSAI, Municipal Corporation, the pest control company…" />
      </Field>
      <Field label="Notes" optional>
        <input className={field} value={form.notes} maxLength={200} onChange={set('notes')} placeholder="Where the paper copy is kept, who renews it" />
      </Field>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </Modal>
  );
};

/**
 * Licences: the papers a food business must keep valid, with their numbers and expiry dates,
 * so nothing lapses unnoticed and they are at hand when an inspector asks.
 *
 * @param {{ storeId: string, onChanged: (message?: string) => void }} props
 */
export const InvLicences = ({ storeId, onChanged }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null); // { licence } or { licence: null }

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/stores/${storeId}/inventory/advanced/licences`);
      setData(res.data.data);
    } catch (err) {
      setError(errorText(err, 'Could not load licences'));
    }
  }, [storeId]);
  useEffect(() => { load(); }, [load]);

  if (data === null) return <p className={`${card} px-5 py-5 text-sm ${error ? 'text-red-600 dark:text-red-400' : 'text-zinc-500'}`}>{error || 'Loading…'}</p>;
  const hasFssai = data.licences.some(l => l.kind === 'FSSAI');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 max-w-xl">
          {data.licences.length > 0 && !hasFssai
            ? 'Your FSSAI licence isn’t on record yet. It is the first thing an inspector asks for.'
            : 'Keep each licence’s number and expiry date here. You’re warned on the Today screen 30 days before one runs out.'}
        </p>
        <Button onClick={() => setDialog({ licence: null })} className={primary}><PlusSignIcon size={15} className="mr-1.5" /> Add licence</Button>
      </div>

      <section className={card}>
        {data.licences.length === 0 ? (
          <Empty title="No licences on record">Start with your FSSAI licence, then the fire safety certificate, pest control contract and water test report.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.licences.map(l => (
              <li key={l.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{l.name}</p>
                  <p className="text-xs text-zinc-500">
                    {[l.name !== l.kindLabel ? l.kindLabel : null, l.number ? `No. ${l.number}` : 'No number recorded', l.issuedBy].filter(Boolean).join(' · ')}
                  </p>
                  {l.notes && <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{l.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Tag tone={l.state === 'NO_DATE' ? 'OK' : l.state}>{licenceDeadline(l)}</Tag>
                  <Button size="sm" variant="outline" onClick={() => setDialog({ licence: l })}>Change</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {dialog && (
        <LicenceDialog storeId={storeId} licence={dialog.licence} kinds={data.kinds} onClose={() => setDialog(null)}
          onDone={(message) => { setDialog(null); load(); onChanged(message); }} />
      )}
    </div>
  );
};
