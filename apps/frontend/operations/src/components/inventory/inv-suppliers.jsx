import React, { useState } from 'react';
import { Button } from '@smo/ui';
import { Loading03Icon, PlusSignIcon } from 'hugeicons-react';
import api from '../../lib/api';
import { card, day, errorText, field, primary } from './inv-format';
import { Empty, Field, Modal, Tag } from './inv-shared';

const SupplierDialog = ({ storeId, supplier, onClose, onDone }) => {
  const [form, setForm] = useState({
    name: supplier?.name || '',
    phone: supplier?.phone || '',
    fssaiNumber: supplier?.fssaiNumber || '',
    gstin: supplier?.gstin || '',
    notes: supplier?.notes || '',
    isActive: supplier ? supplier.isActive : true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));
  const fssai = form.fssaiNumber.replace(/\s/g, '');
  const fssaiProblem = fssai !== '' && !/^\d{14}$/.test(fssai);
  const valid = form.name.trim().length >= 2 && !fssaiProblem;

  const submit = async () => {
    setBusy(true);
    setError('');
    const payload = { name: form.name.trim(), phone: form.phone.trim(), fssaiNumber: fssai, gstin: form.gstin.trim(), notes: form.notes.trim(), isActive: form.isActive };
    try {
      if (supplier) await api.patch(`/stores/${storeId}/inventory/advanced/suppliers/${supplier.id}`, payload);
      else await api.post(`/stores/${storeId}/inventory/advanced/suppliers`, payload);
      onDone(`${payload.name} saved.`);
    } catch (err) {
      setError(errorText(err, 'Could not save the supplier'));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={supplier ? `Change ${supplier.name}` : 'Add a supplier'}
      onClose={onClose}
      busy={busy}
      footer={(
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || busy} onClick={submit} className={primary}>
            {busy ? <Loading03Icon size={15} className="animate-spin" /> : 'Save'}
          </Button>
        </>
      )}
    >
      <Field label="Name">
        <input className={field} value={form.name} maxLength={80} autoFocus={!supplier} onChange={set('name')} placeholder="Sharma Dairy" />
      </Field>
      <Field label="Phone" optional>
        <input className={field} type="tel" inputMode="tel" value={form.phone} maxLength={20} onChange={set('phone')} />
      </Field>
      <Field label="FSSAI licence number" optional hint={fssaiProblem ? undefined : '14 digits, printed on the supplier’s bill. Inspectors ask who your food came from.'}>
        <input className={`${field} font-mono tabular-nums`} inputMode="numeric" value={form.fssaiNumber} maxLength={17} autoComplete="off" onChange={set('fssaiNumber')} />
        {fssaiProblem && <span className="text-xs font-normal text-red-600 dark:text-red-400">An FSSAI licence number has 14 digits; this has {fssai.replace(/\D/g, '').length}{/\D/.test(fssai) ? ' and other characters' : ''}.</span>}
      </Field>
      <Field label="GSTIN" optional>
        <input className={`${field} font-mono uppercase`} value={form.gstin} maxLength={15} autoComplete="off" onChange={set('gstin')} />
      </Field>
      <Field label="Notes" optional>
        <input className={field} value={form.notes} maxLength={200} onChange={set('notes')} placeholder="Delivers before 8 am, cash only" />
      </Field>
      {supplier && (
        <label className="flex items-start gap-2.5 text-sm text-zinc-900 dark:text-zinc-100 cursor-pointer">
          <input type="checkbox" className="mt-0.5 accent-amber-500" checked={form.isActive} onChange={e => setForm(prev => ({ ...prev, isActive: e.target.checked }))} />
          <span>
            We still buy from this supplier
            <span className="block text-xs text-zinc-500">Untick to hide them when receiving. Past deliveries stay on record.</span>
          </span>
        </label>
      )}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </Modal>
  );
};

/**
 * Suppliers: who the food comes from, with their licence number on record.
 *
 * @param {{ storeId: string, suppliers: object[]|null, onChanged: (message?: string) => void }} props
 */
export const InvSuppliers = ({ storeId, suppliers, onChanged }) => {
  const [dialog, setDialog] = useState(null); // { supplier } or { supplier: null }
  const withoutLicence = (suppliers || []).filter(s => s.isActive && !s.fssaiNumber).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 max-w-xl">
          {withoutLicence > 0
            ? `${withoutLicence} ${withoutLicence === 1 ? 'supplier has' : 'suppliers have'} no FSSAI licence number on record. It is printed on their bill.`
            : 'Every delivery is tied to its supplier, so any ingredient can be traced back to where it came from.'}
        </p>
        <Button onClick={() => setDialog({ supplier: null })} className={primary}><PlusSignIcon size={15} className="mr-1.5" /> Add supplier</Button>
      </div>

      <section className={card}>
        {suppliers === null ? (
          <p className="px-5 py-5 text-sm text-zinc-500">Loading…</p>
        ) : suppliers.length === 0 ? (
          <Empty title="No suppliers yet">Add the people you buy from. Receiving a delivery then starts with one tap on “Same as last time”.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {suppliers.map(s => (
              <li key={s.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className={`min-w-0 flex-1 ${s.isActive ? '' : 'opacity-60'}`}>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {s.name}
                    {!s.isActive && <span className="ml-2"><Tag>Not in use</Tag></span>}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {[
                      s.phone,
                      s.fssaiNumber ? `FSSAI ${s.fssaiNumber}` : null,
                      s.gstin ? `GSTIN ${s.gstin}` : null,
                      s.deliveries > 0 ? `${s.deliveries} ${s.deliveries === 1 ? 'delivery' : 'deliveries'}${s.lastDeliveryAt ? `, last on ${day(s.lastDeliveryAt)}` : ''}` : 'No deliveries yet',
                    ].filter(Boolean).join(' · ')}
                  </p>
                  {s.notes && <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{s.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {s.isActive && !s.fssaiNumber && <Tag tone="LOW">No licence number</Tag>}
                  <Button size="sm" variant="outline" onClick={() => setDialog({ supplier: s })}>Change</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {dialog && (
        <SupplierDialog storeId={storeId} supplier={dialog.supplier} onClose={() => setDialog(null)} onDone={(message) => { setDialog(null); onChanged(message); }} />
      )}
    </div>
  );
};
