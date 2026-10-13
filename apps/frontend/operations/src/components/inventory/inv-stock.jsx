import React, { useMemo, useState } from 'react';
import { Button } from '@smo/ui';
import { ArrowDown01Icon, Loading03Icon, PlusSignIcon, Search01Icon } from 'hugeicons-react';
import api from '../../lib/api';
import { UNIT_NAMES, amount, card, day, errorText, eyebrow, field, lotDeadline, primary, rupees, unit } from './inv-format';
import { Empty, Field, Modal, Tag } from './inv-shared';

const LOT_KIND = { OPENING: 'Stock from before lots were tracked', FOUND: 'Found in a count' };
const FILTERS = [['ALL', 'All'], ['LOW', 'Running low'], ['EXPIRY', 'Expired or expiring']];

/**
 * Add or set up an ingredient. The setup is what makes receiving fast: a short code to type,
 * a shelf life so use-by dates fill themselves in, and a pack size so "2 bags" can be typed.
 */
const MaterialDialog = ({ storeId, material, units, onClose, onDone }) => {
  const [form, setForm] = useState({
    name: material?.name || '',
    unit: material?.unit || 'KG',
    shortCode: material?.shortCode || '',
    shelfLifeDays: material?.shelfLifeDays ? String(material.shelfLifeDays) : '',
    packName: material?.packName || '',
    packSize: material?.packSize ? String(material.packSize) : '',
    lowStockThreshold: material?.lowStockThreshold ? String(material.lowStockThreshold) : '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));
  const packProblem = form.packName.trim() && !(Number(form.packSize) > 0);
  const valid = form.name.trim().length >= 2 && !packProblem;

  const submit = async () => {
    setBusy(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      shortCode: form.shortCode.trim(),
      shelfLifeDays: form.shelfLifeDays === '' ? null : Number(form.shelfLifeDays),
      packName: form.packName.trim(),
      packSize: form.packName.trim() ? Number(form.packSize) : null,
      lowStockThreshold: Number(form.lowStockThreshold) || 0,
      // The unit of an existing ingredient is fixed: recipes and stock are measured in it
      ...(material ? {} : { unit: form.unit }),
    };
    try {
      if (material) await api.patch(`/stores/${storeId}/inventory/advanced/materials/${material.id}`, payload);
      else await api.post(`/stores/${storeId}/inventory/advanced/materials`, payload);
      onDone(material ? `${payload.name} saved.` : `${payload.name} added. Receive a delivery to put it in stock.`);
    } catch (err) {
      setError(errorText(err, 'Could not save the ingredient'));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={material ? `Set up ${material.name}` : 'Add an ingredient'}
      subtitle={material ? undefined : 'It starts with no stock. Receive a delivery to add some.'}
      onClose={onClose}
      busy={busy}
      footer={(
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || busy} onClick={submit} className={primary}>
            {busy ? <Loading03Icon size={15} className="animate-spin" /> : material ? 'Save' : 'Add ingredient'}
          </Button>
        </>
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_9.5rem] gap-3">
        <Field label="Name">
          <input className={field} value={form.name} maxLength={80} autoFocus={!material} onChange={set('name')} placeholder="Paneer" />
        </Field>
        <Field label="Measured in">
          <select className={field} value={form.unit} disabled={Boolean(material)} onChange={set('unit')}>
            {units.map(u => <option key={u} value={u}>{UNIT_NAMES[u] || u}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Short code" optional hint="Type it with a quantity when receiving: “PN 10”.">
          <input className={`${field} font-mono uppercase`} value={form.shortCode} maxLength={10} autoComplete="off" spellCheck={false}
            onChange={e => setForm(prev => ({ ...prev, shortCode: e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() }))} placeholder="PN" />
        </Field>
        <Field label="Keeps for (days)" optional hint="Fills in the use-by date on every delivery.">
          <input className={`${field} tabular-nums`} type="number" inputMode="numeric" min="1" step="1" value={form.shelfLifeDays} onChange={set('shelfLifeDays')} placeholder="5" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Comes in a" optional hint="Bag, crate, tin, tray…">
          <input className={field} value={form.packName} maxLength={20} onChange={set('packName')} placeholder="bag" />
        </Field>
        <Field label={`One ${form.packName.trim() || 'pack'} holds (${unit(form.unit)})`} hint={packProblem ? undefined : 'So you can receive “2 bags”.'}>
          <input className={`${field} tabular-nums`} type="number" inputMode="decimal" min="0" step="any" disabled={!form.packName.trim()} value={form.packSize} onChange={set('packSize')} placeholder="25" />
          {packProblem && <span className="text-xs font-normal text-red-600 dark:text-red-400">Say how much one {form.packName.trim()} holds.</span>}
        </Field>
      </div>
      <Field label={`Warn me when below (${unit(form.unit)})`} optional hint="It then shows under “Running low” on the Today screen.">
        <input className={`${field} tabular-nums`} type="number" inputMode="decimal" min="0" step="any" value={form.lowStockThreshold} onChange={set('lowStockThreshold')} placeholder="0" />
      </Field>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </Modal>
  );
};

/**
 * Stock: every ingredient with what is on the shelf, what it is worth and the lots it is made of.
 *
 * @param {{ storeId: string, overview: object, onChanged: (message?: string) => void, onWaste: (material: object, lot?: object) => void }} props
 */
export const InvStock = ({ storeId, overview, onChanged, onWaste }) => {
  const { materials, units, canManage } = overview;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [open, setOpen] = useState(null);
  const [dialog, setDialog] = useState(null); // { material } or { material: null } for a new one

  const shown = useMemo(() => {
    const words = search.trim().toLowerCase();
    return materials.filter(m => (
      (!words || m.name.toLowerCase().includes(words) || (m.shortCode || '').toLowerCase().includes(words))
      && (filter === 'ALL' || (filter === 'LOW' ? m.low : m.worstState !== 'OK'))
    ));
  }, [materials, search, filter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search01Icon size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input className={`${field} pl-8`} type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ingredients" aria-label="Search ingredients" />
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Show">
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}
              className={`px-3 h-9 rounded-full text-xs font-semibold border whitespace-nowrap ${filter === id ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900' : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'}`}>
              {label}
            </button>
          ))}
        </div>
        {canManage && <Button onClick={() => setDialog({ material: null })} className={`${primary} ml-auto`}><PlusSignIcon size={15} className="mr-1.5" /> Add ingredient</Button>}
      </div>

      <section className={card}>
        {materials.length === 0 ? (
          <Empty title="No ingredients yet">{canManage ? 'Add what your kitchen buys: paneer, oil, flour, milk. Then receive deliveries against them.' : 'Your manager adds the ingredients; they appear here once that is done.'}</Empty>
        ) : shown.length === 0 ? (
          <Empty title="Nothing matches">Try a different search, or show all ingredients.</Empty>
        ) : (
          <>
            <div className="hidden md:grid grid-cols-[minmax(0,1fr)_8rem_7rem_13rem_1.5rem] gap-3 px-5 py-2 border-b border-zinc-200 dark:border-zinc-800">
              {['Ingredient', 'In stock', canManage ? 'Value' : '', 'Use by', ''].map((h, i) => <span key={i} className={`${eyebrow} ${i === 1 || i === 2 ? 'text-right' : ''}`}>{h}</span>)}
            </div>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {shown.map(m => {
                const isOpen = open === m.id;
                const first = m.lots.find(l => l.state !== 'NO_DATE') || null;
                return (
                  <li key={m.id}>
                    <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : m.id)}
                      className="w-full px-5 py-3 grid grid-cols-[minmax(0,1fr)_auto_1.5rem] md:grid-cols-[minmax(0,1fr)_8rem_7rem_13rem_1.5rem] gap-x-3 gap-y-1 items-center text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {m.name}
                          {m.shortCode && <span className="ml-2 font-mono font-normal text-xs text-zinc-500">{m.shortCode}</span>}
                        </span>
                        {canManage && <span className="block text-xs text-zinc-500 md:hidden">{m.stockValue ? rupees(m.stockValue) : 'No price yet'}</span>}
                      </span>
                      <span className="text-sm text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                        {amount(m.stock, m.unit)}
                        {m.low && <span className="block md:inline md:ml-2"><Tag tone={m.stock <= 0 ? 'EXPIRED' : 'LOW'}>{m.stock <= 0 ? 'Out' : 'Low'}</Tag></span>}
                      </span>
                      <span className="hidden md:block text-sm text-right tabular-nums text-zinc-600 dark:text-zinc-400">{!canManage ? '' : m.stockValue ? rupees(m.stockValue) : '—'}</span>
                      <span className="col-span-2 md:col-span-1 md:order-none order-last">
                        {first ? <Tag tone={first.state}>{lotDeadline(first)}</Tag> : <span className="text-xs text-zinc-400">{m.stock > 0 ? 'No use-by date' : ''}</span>}
                      </span>
                      <ArrowDown01Icon size={15} className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-4 pt-1 flex flex-col gap-3 bg-zinc-50/60 dark:bg-zinc-950/40 border-t border-zinc-100 dark:border-zinc-800">
                        {m.lots.length === 0 ? (
                          <p className="pt-2 text-sm text-zinc-500">Nothing on the shelf. Receive a delivery to add stock.</p>
                        ) : (
                          <div>
                            <p className={`${eyebrow} pt-2 pb-1`}>On the shelf, oldest first</p>
                            <ul className="flex flex-col divide-y divide-zinc-200/70 dark:divide-zinc-800">
                              {m.lots.map(lot => (
                                <li key={lot.id} className="py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                                  <div className="min-w-0">
                                    <p className="text-sm text-zinc-900 dark:text-zinc-100">
                                      <span className="font-semibold tabular-nums">{amount(lot.remaining, m.unit)}</span>
                                      {lot.remaining < lot.received && <span className="text-zinc-500"> of {amount(lot.received, m.unit)}</span>}
                                      <span className="ml-2"><Tag tone={lot.state}>{lotDeadline(lot)}</Tag></span>
                                    </p>
                                    <p className="text-xs text-zinc-500">
                                      {lot.kind === 'RECEIVED'
                                        ? `Received ${day(lot.receivedAt)}${lot.supplierName ? ` from ${lot.supplierName}` : ''}${lot.billNumber ? ` · Bill ${lot.billNumber}` : ''}${canManage && lot.unitCost ? ` · ${rupees(lot.unitCost)} per ${unit(m.unit)}` : ''}`
                                        : LOT_KIND[lot.kind]}
                                    </p>
                                  </div>
                                  <Button size="sm" variant="outline" onClick={() => onWaste(m, lot)}>Throw away</Button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                          <p className="text-xs text-zinc-500">
                            {[
                              m.shelfLifeDays ? `Keeps ${m.shelfLifeDays} ${m.shelfLifeDays === 1 ? 'day' : 'days'}` : 'No shelf life set',
                              m.packName ? `1 ${m.packName} = ${amount(m.packSize, m.unit)}` : null,
                              m.lowStockThreshold > 0 ? `Low below ${amount(m.lowStockThreshold, m.unit)}` : null,
                              canManage && m.costPerUnit ? `Last paid ${rupees(m.costPerUnit)} per ${unit(m.unit)}` : null,
                              m.lastCountedAt ? `Counted ${day(m.lastCountedAt)}` : 'Never counted',
                            ].filter(Boolean).join(' · ')}
                          </p>
                          {canManage && <Button size="sm" variant="outline" onClick={() => setDialog({ material: m })}>Set up</Button>}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {dialog && (
        <MaterialDialog
          storeId={storeId}
          material={dialog.material}
          units={units}
          onClose={() => setDialog(null)}
          onDone={(message) => { setDialog(null); onChanged(message); }}
        />
      )}
    </div>
  );
};
