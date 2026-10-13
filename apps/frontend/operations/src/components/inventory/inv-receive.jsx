import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@smo/ui';
import { Cancel01Icon, Loading03Icon, RepeatIcon } from 'hugeicons-react';
import api from '../../lib/api';
import { addDays, amount, card, dateInput, day, dayAndTime, errorText, eyebrow, field, primary, qty, rupees, unit } from './inv-format';
import { Empty, Field } from './inv-shared';
import { ItemPicker } from './item-picker';

const whole = (n) => Math.abs(n - Math.round(n)) < 1e-6;

/** A new line for an ingredient. The price starts at what was paid last time. */
function lineFor(material, quantity = null, unitCost = material.costPerUnit) {
  // Shown in packs when the quantity is a whole number of them: "2 bags" reads better than "50 kg"
  const inPacks = Boolean(material.packSize) && quantity !== null && whole(quantity / material.packSize);
  return {
    materialId: material.id,
    qty: quantity === null ? '' : String(inPacks ? Math.round(quantity / material.packSize) : quantity),
    inPacks,
    price: unitCost ? String(Number((inPacks ? unitCost * material.packSize : unitCost).toFixed(2))) : '',
    expires: '',
    // Until someone changes it, the use-by date follows the delivery date and the shelf life
    autoExpiry: true,
  };
}

/**
 * Receive: a delivery is typed in once, as it comes off the van. Lines start from the last
 * delivery or from short codes, prices from last time, use-by dates from each ingredient's shelf life.
 *
 * @param {{ storeId: string, overview: object, suppliers: object[], onChanged: (message?: string) => void, onGoTo: (tab: string) => void }} props
 */
export const InvReceive = ({ storeId, overview, suppliers, onChanged, onGoTo }) => {
  const materials = overview.materials;
  const [supplierId, setSupplierId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [date, setDate] = useState(() => dateInput());
  const [lines, setLines] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipts, setReceipts] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const qtyInputs = useRef({});

  const materialOf = (id) => materials.find(m => m.id === id);
  const supplier = suppliers.find(s => s.id === supplierId) || null;
  const lastLines = (supplier?.lastLines || []).filter(l => materialOf(l.materialId));
  const active = suppliers.filter(s => s.isActive);

  const loadReceipts = useCallback(async () => {
    try {
      const res = await api.get(`/stores/${storeId}/inventory/advanced/receipts`);
      setReceipts(res.data.data.receipts);
    } catch {
      setReceipts([]);
    }
  }, [storeId]);
  useEffect(() => { loadReceipts(); }, [loadReceipts]);

  // After adding an item without a quantity, the cursor moves to its quantity box
  useEffect(() => {
    if (!focusId) return;
    qtyInputs.current[focusId]?.focus();
    setFocusId(null);
  }, [focusId]);

  const addItem = (material, quantity) => {
    setError('');
    setLines(prev => {
      const existing = prev.find(l => l.materialId === material.id);
      if (!existing) return [...prev, lineFor(material, quantity)];
      if (quantity === null) return prev;
      // Typed again: the quantities add up, in whatever the line is counted in
      const more = existing.inPacks ? quantity / material.packSize : quantity;
      return prev.map(l => (l === existing ? { ...l, qty: String(Number(((Number(l.qty) || 0) + more).toFixed(3))) } : l));
    });
    if (quantity === null) setFocusId(material.id);
  };
  const change = (materialId, patch) => setLines(prev => prev.map(l => (l.materialId === materialId ? { ...l, ...patch } : l)));
  const remove = (materialId) => setLines(prev => prev.filter(l => l.materialId !== materialId));

  // Switching between "kg" and "bag" keeps the money the same: the price moves with the unit
  const togglePacks = (line, material) => {
    const price = Number(line.price);
    const next = !line.inPacks;
    change(line.materialId, { inPacks: next, price: price > 0 ? String(Number((next ? price * material.packSize : price / material.packSize).toFixed(2))) : line.price });
  };

  const expiryOf = (line, material) => (line.autoExpiry ? (material.shelfLifeDays ? addDays(date, material.shelfLifeDays) : '') : line.expires);
  const unitsOf = (line, material) => (Number(line.qty) || 0) * (line.inPacks ? material.packSize : 1);
  const totalOf = (line) => (Number(line.qty) || 0) * (Number(line.price) || 0);
  const total = lines.reduce((sum, l) => sum + totalOf(l), 0);
  const incomplete = lines.filter(l => !(Number(l.qty) > 0)).length;
  const today = date === dateInput();
  const valid = lines.length > 0 && incomplete === 0 && Boolean(date) && date <= dateInput();

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/stores/${storeId}/inventory/advanced/receipts`, {
        supplierId: supplierId || undefined,
        billNumber: billNumber.trim() || undefined,
        receivedAt: today ? undefined : new Date(`${date}T12:00:00`).toISOString(),
        lines: lines.map(line => {
          const material = materialOf(line.materialId);
          const price = Number(line.price);
          return {
            materialId: line.materialId,
            quantity: unitsOf(line, material),
            unitCost: line.price !== '' && price >= 0 ? (line.inPacks ? price / material.packSize : price) : undefined,
            expiresAt: expiryOf(line, material) || undefined,
          };
        }),
      });
      const done = res.data.data;
      setLines([]);
      setBillNumber('');
      loadReceipts();
      onChanged(`Delivery received: ${done.lines} ${done.lines === 1 ? 'item' : 'items'}${done.totalCost ? ` worth ${rupees(done.totalCost)}` : ''}. Stock is updated.`);
    } catch (err) {
      setError(errorText(err, 'Could not receive the delivery'));
    } finally {
      setBusy(false);
    }
  };

  if (materials.length === 0) {
    return (
      <div className={card}>
        <Empty title="Add your ingredients first">A delivery is made of ingredients. Add them under Stock, then come back to receive.</Empty>
        <div className="pb-8 flex justify-center"><Button size="sm" variant="outline" onClick={() => onGoTo('stock')}>Go to Stock</Button></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-zinc-200 dark:border-zinc-800">
          <Field label="Supplier" optional hint={active.length === 0 ? 'No suppliers yet. Add them under Suppliers.' : undefined}>
            <select className={field} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
              <option value="">No supplier</option>
              {active.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Bill number" optional hint="Ties this stock to the supplier’s bill, if an inspector asks.">
            <input className={field} value={billNumber} maxLength={40} autoComplete="off" onChange={e => setBillNumber(e.target.value)} placeholder="As printed on the bill" />
          </Field>
          <Field label="Received on">
            <input className={field} type="date" value={date} max={dateInput()} onChange={e => setDate(e.target.value)} />
          </Field>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          {lastLines.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                {supplier.name} last brought {lastLines.length} {lastLines.length === 1 ? 'item' : 'items'} on {day(supplier.lastDeliveryAt)}.
              </p>
              <Button size="sm" variant="outline" onClick={() => { setError(''); setLines(lastLines.map(l => lineFor(materialOf(l.materialId), l.quantity, l.unitCost))); }}>
                <RepeatIcon size={14} className="mr-1.5" /> Same as last time
              </Button>
            </div>
          )}
          <ItemPicker materials={materials} onAdd={addItem} autoFocus />
        </div>

        {lines.length > 0 && (
          <>
            <div className="hidden md:grid grid-cols-[minmax(0,1fr)_10.5rem_8rem_9.5rem_6rem_2rem] gap-3 px-5 py-2 border-y border-zinc-200 dark:border-zinc-800">
              {['Item', 'Quantity', 'Price', 'Use by', 'Total', ''].map((h, i) => <span key={i} className={`${eyebrow} ${i === 4 ? 'text-right' : ''}`}>{h}</span>)}
            </div>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 border-t md:border-t-0 border-zinc-200 dark:border-zinc-800">
              {lines.map(line => {
                const material = materialOf(line.materialId);
                const per = line.inPacks ? material.packName : unit(material.unit);
                const expiry = expiryOf(line, material);
                return (
                  <li key={line.materialId} className="px-5 py-3 grid grid-cols-2 md:grid-cols-[minmax(0,1fr)_10.5rem_8rem_9.5rem_6rem_2rem] gap-x-3 gap-y-2 items-start">
                    <div className="col-span-2 md:col-span-1 min-w-0 md:pt-1.5">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{material.name}</p>
                      <p className="text-xs text-zinc-500">
                        {line.inPacks && Number(line.qty) > 0 ? `${amount(unitsOf(line, material), material.unit)} · ` : ''}{amount(material.stock, material.unit)} in stock now
                      </p>
                    </div>
                    <div>
                      <div className="flex gap-1">
                        <input
                          ref={el => { qtyInputs.current[line.materialId] = el; }}
                          className={`${field} text-right tabular-nums`} type="number" inputMode="decimal" min="0" step="any"
                          aria-label={`Quantity of ${material.name}`} placeholder="Qty"
                          value={line.qty} onChange={e => change(line.materialId, { qty: e.target.value })}
                        />
                        {material.packSize ? (
                          <button type="button" onClick={() => togglePacks(line, material)}
                            title={`One ${material.packName} holds ${amount(material.packSize, material.unit)}. Tap to count in ${line.inPacks ? unit(material.unit) : material.packName}.`}
                            className="shrink-0 h-9 min-w-14 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-zinc-400">
                            {per}
                          </button>
                        ) : (
                          <span className="shrink-0 h-9 min-w-14 px-2 flex items-center text-xs text-zinc-500">{per}</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-zinc-400">₹</span>
                        <input className={`${field} pl-6 text-right tabular-nums`} type="number" inputMode="decimal" min="0" step="any"
                          aria-label={`Price of ${material.name} per ${per}`} placeholder={`per ${per}`}
                          value={line.price} onChange={e => change(line.materialId, { price: e.target.value })} />
                      </div>
                      <p className="mt-0.5 text-[11px] text-zinc-400 text-right">per {per}</p>
                    </div>
                    <div>
                      <input className={field} type="date" min={date} aria-label={`Use-by date of ${material.name}`}
                        value={expiry} onChange={e => change(line.materialId, { expires: e.target.value, autoExpiry: false })} />
                      <p className="mt-0.5 text-[11px] text-zinc-400">
                        {line.autoExpiry && material.shelfLifeDays ? `Keeps ${material.shelfLifeDays} ${material.shelfLifeDays === 1 ? 'day' : 'days'}` : expiry ? 'From the pack' : 'No use-by date'}
                      </p>
                    </div>
                    <div className="flex items-start justify-end gap-2 md:contents">
                      <p className="pt-2 text-sm text-right tabular-nums text-zinc-900 dark:text-zinc-100">{totalOf(line) > 0 ? rupees(totalOf(line)) : '—'}</p>
                      <button type="button" aria-label={`Remove ${material.name}`} onClick={() => remove(line.materialId)}
                        className="justify-self-end mt-1.5 p-1.5 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><Cancel01Icon size={14} /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-500">
            {lines.length === 0 ? 'Add what arrived, one item at a time.'
              : incomplete > 0 ? `${incomplete} ${incomplete === 1 ? 'item needs' : 'items need'} a quantity.`
              : <>{lines.length} {lines.length === 1 ? 'item' : 'items'}{total > 0 && <> · <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">{rupees(total)}</span></>}</>}
          </p>
          <Button disabled={!valid || busy} onClick={submit} className={primary}>
            {busy ? <Loading03Icon size={15} className="animate-spin" /> : 'Receive delivery'}
          </Button>
        </div>
        {error && <p role="alert" className="px-5 pb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </section>

      <section className={card}>
        <header className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent deliveries</h2>
        </header>
        {receipts === null ? (
          <p className="px-5 py-5 text-sm text-zinc-500">Loading…</p>
        ) : receipts.length === 0 ? (
          <Empty title="No deliveries yet">Each delivery you receive is kept here with its supplier, bill number and use-by dates.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {receipts.map(r => (
              <li key={r.id}>
                <details className="group">
                  <summary className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {r.supplierName || (r.source === 'STANDING' ? r.note : 'No supplier')}
                        {r.source === 'STANDING' && <span className="ml-2 font-normal text-xs text-zinc-500">Standing delivery</span>}
                      </span>
                      <span className="block text-xs text-zinc-500">
                        {dayAndTime(r.receivedAt)} · {r.lines.length} {r.lines.length === 1 ? 'item' : 'items'}{r.billNumber ? ` · Bill ${r.billNumber}` : ''}{r.receivedByName && r.source !== 'STANDING' ? ` · ${r.receivedByName}` : ''}
                      </span>
                    </span>
                    <span className="text-sm tabular-nums text-zinc-900 dark:text-zinc-100">{r.totalCost ? rupees(r.totalCost) : '—'}</span>
                  </summary>
                  <ul className="px-5 pb-3 flex flex-col gap-1">
                    {r.lines.map((l, i) => (
                      <li key={i} className="flex flex-wrap justify-between gap-x-4 text-xs text-zinc-600 dark:text-zinc-400">
                        <span>{l.name} · {qty(l.quantity)} {unit(l.unit)}{l.unitCost ? ` at ${rupees(l.unitCost)}` : ''}</span>
                        <span>{l.expiresAt ? `Use by ${day(l.expiresAt)}` : 'No use-by date'}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
