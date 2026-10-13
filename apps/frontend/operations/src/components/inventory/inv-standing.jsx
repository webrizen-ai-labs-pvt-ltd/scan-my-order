import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@smo/ui';
import { Cancel01Icon, Loading03Icon, PlusSignIcon } from 'hugeicons-react';
import api from '../../lib/api';
import { DAY_LABELS, amount, card, errorText, field, hourLabel, primary, rupees, unit } from './inv-format';
import { Empty, Field, Modal, Tag } from './inv-shared';
import { ItemPicker } from './item-picker';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const daysText = (days) => (days.length === 7 ? 'Every day' : days.map(d => DAY_LABELS[d]).join(', '));

/** Create or change a standing delivery */
const StandingDialog = ({ storeId, standing, materials, suppliers, onClose, onDone }) => {
  const materialOf = (id) => materials.find(m => m.id === id);
  const [name, setName] = useState(standing?.name || '');
  const [supplierId, setSupplierId] = useState(standing?.supplierId || '');
  const [days, setDays] = useState(standing?.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]);
  const [hour, setHour] = useState(standing?.arrivesByHour ?? 7);
  const [lines, setLines] = useState(() => (standing?.lines || []).filter(l => materialOf(l.materialId)).map(l => ({ materialId: l.materialId, qty: String(l.quantity), price: l.unitCost ? String(l.unitCost) : '' })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [focusId, setFocusId] = useState(null);
  const qtyInputs = useRef({});

  useEffect(() => {
    if (!focusId) return;
    qtyInputs.current[focusId]?.focus();
    setFocusId(null);
  }, [focusId]);

  const addItem = (material, quantity) => {
    setLines(prev => (prev.some(l => l.materialId === material.id)
      ? prev.map(l => (l.materialId === material.id && quantity !== null ? { ...l, qty: String(quantity) } : l))
      : [...prev, { materialId: material.id, qty: quantity === null ? '' : String(quantity), price: material.costPerUnit ? String(material.costPerUnit) : '' }]));
    if (quantity === null) setFocusId(material.id);
  };
  const change = (materialId, patch) => setLines(prev => prev.map(l => (l.materialId === materialId ? { ...l, ...patch } : l)));
  const toggleDay = (d) => setDays(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort()));
  const valid = name.trim().length >= 2 && days.length > 0 && lines.length > 0 && lines.every(l => Number(l.qty) > 0);

  const submit = async () => {
    setBusy(true);
    setError('');
    const payload = {
      name: name.trim(),
      supplierId: supplierId || null,
      daysOfWeek: days,
      arrivesByHour: Number(hour),
      lines: lines.map(l => ({ materialId: l.materialId, quantity: Number(l.qty), unitCost: l.price === '' ? null : Number(l.price) })),
    };
    try {
      if (standing) await api.patch(`/stores/${storeId}/inventory/advanced/standing/${standing.id}`, payload);
      else await api.post(`/stores/${storeId}/inventory/advanced/standing`, payload);
      onDone(standing ? `${payload.name} saved.` : `${payload.name} is set up. It starts from tomorrow.`);
    } catch (err) {
      setError(errorText(err, 'Could not save the standing delivery'));
      setBusy(false);
    }
  };

  return (
    <Modal
      wide
      title={standing ? `Change ${standing.name}` : 'New standing delivery'}
      subtitle="Stock is added by itself on the days you choose."
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Name">
          <input className={field} value={name} maxLength={60} autoFocus={!standing} onChange={e => setName(e.target.value)} placeholder="Morning milk" />
        </Field>
        <Field label="Supplier" optional>
          <select className={field} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
            <option value="">No supplier</option>
            {suppliers.filter(s => s.isActive || s.id === supplierId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_9rem] gap-3 items-start">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">Arrives on</legend>
          <div className="flex flex-wrap gap-1.5">
            {DAY_LABELS.map((label, d) => (
              <button key={label} type="button" aria-pressed={days.includes(d)} onClick={() => toggleDay(d)}
                className={`w-11 h-9 rounded-lg text-xs font-semibold border ${days.includes(d) ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900' : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'}`}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label="In stock by">
          <select className={field} value={hour} onChange={e => setHour(Number(e.target.value))}>
            {HOURS.map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">What arrives</p>
        <ItemPicker materials={materials} onAdd={addItem} />
        {lines.length > 0 && (
          <ul className="rounded-lg border border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-100 dark:divide-zinc-800">
            {lines.map(line => {
              const material = materialOf(line.materialId);
              return (
                <li key={line.materialId} className="px-3 py-2 grid grid-cols-[minmax(0,1fr)_6.5rem_7rem_1.75rem] gap-2 items-center">
                  <span className="text-sm text-zinc-900 dark:text-zinc-100 truncate">{material.name}</span>
                  <span className="flex items-center gap-1.5">
                    <input ref={el => { qtyInputs.current[line.materialId] = el; }} className={`${field} text-right tabular-nums`} type="number" inputMode="decimal" min="0" step="any"
                      aria-label={`Quantity of ${material.name}`} placeholder="Qty" value={line.qty} onChange={e => change(line.materialId, { qty: e.target.value })} />
                    <span className="w-8 shrink-0 text-xs text-zinc-500">{unit(material.unit)}</span>
                  </span>
                  <span className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-zinc-400">₹</span>
                    <input className={`${field} pl-6 text-right tabular-nums`} type="number" inputMode="decimal" min="0" step="any"
                      aria-label={`Price of ${material.name} per ${unit(material.unit)}`} placeholder={`per ${unit(material.unit)}`} value={line.price} onChange={e => change(line.materialId, { price: e.target.value })} />
                  </span>
                  <button type="button" aria-label={`Remove ${material.name}`} onClick={() => setLines(prev => prev.filter(l => l.materialId !== line.materialId))}
                    className="p-1.5 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><Cancel01Icon size={14} /></button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-zinc-500">Use-by dates come from each ingredient’s shelf life.</p>
      </div>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </Modal>
  );
};

/**
 * Standing deliveries: the milk, bread and vegetables that arrive the same way every time.
 * They add themselves to stock, so nobody types them in.
 *
 * @param {{ storeId: string, overview: object, suppliers: object[], onChanged: (message?: string) => void }} props
 */
export const InvStanding = ({ storeId, overview, suppliers, onChanged }) => {
  const materials = overview.materials;
  const [list, setList] = useState(null);
  const [dialog, setDialog] = useState(null); // { standing } or { standing: null }
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/stores/${storeId}/inventory/advanced/standing`);
      setList(res.data.data);
    } catch (err) {
      setList([]);
      setError(errorText(err, 'Could not load standing deliveries'));
    }
  }, [storeId]);
  useEffect(() => { load(); }, [load]);

  const act = async (id, request, message) => {
    setBusy(id);
    setError('');
    try {
      await request();
      setRemoving(null);
      await load();
      onChanged(message);
    } catch (err) {
      setError(errorText(err, 'Could not update the standing delivery'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 max-w-xl">For deliveries that arrive the same way every time, like the morning milk. Stock is added by itself on the chosen days; if one doesn’t come, pause it or correct the stock in Today’s count.</p>
        <Button disabled={materials.length === 0} onClick={() => setDialog({ standing: null })} className={primary}><PlusSignIcon size={15} className="mr-1.5" /> New standing delivery</Button>
      </div>
      {error && <p role="alert" className={`${card} px-4 py-2.5 text-sm text-red-600 dark:text-red-400`}>{error}</p>}

      <section className={card}>
        {list === null ? (
          <p className="px-5 py-5 text-sm text-zinc-500">Loading…</p>
        ) : list.length === 0 ? (
          <Empty title="No standing deliveries">Set one up for anything that comes daily or weekly in the same amount, and it never needs typing in again.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {list.map(s => {
              const lines = s.lines.filter(l => materials.some(m => m.id === l.materialId));
              const cost = lines.reduce((sum, l) => sum + (l.unitCost ? l.unitCost * l.quantity : 0), 0);
              return (
                <li key={s.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <div className={`min-w-0 flex-1 ${s.isActive ? '' : 'opacity-60'}`}>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {s.name}
                      {!s.isActive && <span className="ml-2"><Tag>Paused</Tag></span>}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {daysText(s.daysOfWeek)} · in stock by {hourLabel(s.arrivesByHour)}{s.supplier?.name ? ` · ${s.supplier.name}` : ''}{cost > 0 ? ` · ${rupees(cost)} each time` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                      {lines.map(l => { const m = materials.find(x => x.id === l.materialId); return `${m.name} ${amount(l.quantity, m.unit)}`; }).join(', ') || 'Its ingredients no longer exist.'}
                    </p>
                  </div>
                  {removing === s.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">Remove it?</span>
                      <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => setRemoving(null)}>Keep</Button>
                      <Button size="sm" disabled={busy === s.id} className="!bg-none !bg-red-600 hover:!bg-red-700 !text-white !border-red-600"
                        onClick={() => act(s.id, () => api.delete(`/stores/${storeId}/inventory/advanced/standing/${s.id}`), `${s.name} removed. Stock already added stays.`)}>
                        {busy === s.id ? <Loading03Icon size={14} className="animate-spin" /> : 'Remove'}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" disabled={busy === s.id}
                        onClick={() => act(s.id, () => api.patch(`/stores/${storeId}/inventory/advanced/standing/${s.id}`, { isActive: !s.isActive }), s.isActive ? `${s.name} paused.` : `${s.name} is running again.`)}>
                        {busy === s.id ? <Loading03Icon size={14} className="animate-spin" /> : s.isActive ? 'Pause' : 'Resume'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDialog({ standing: s })}>Change</Button>
                      <Button size="sm" variant="outline" onClick={() => setRemoving(s.id)}>Remove</Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {dialog && (
        <StandingDialog
          storeId={storeId}
          standing={dialog.standing}
          materials={materials}
          suppliers={suppliers}
          onClose={() => setDialog(null)}
          onDone={(message) => { setDialog(null); load(); onChanged(message); }}
        />
      )}
    </div>
  );
};
