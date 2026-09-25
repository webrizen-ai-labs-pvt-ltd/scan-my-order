import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@smo/ui';
import {
  ArrowLeft01Icon,
  Search01Icon,
  PlusSignIcon,
  MinusSignIcon,
  Delete02Icon,
  Dish01Icon,
  Pot02Icon,
  NoteEditIcon,
  Loading03Icon,
  Alert01Icon,
  CheckmarkCircle02Icon,
} from 'hugeicons-react';
import api from '../../lib/api';
import { usePos } from './pos-layout';
import { usePosCartStore } from '../../store/pos-cart-store';
import { appendCustomDishToDraft } from '../../store/order-edit-draft-store';

const DIETARY = [
  { id: 'VEG', label: 'Veg', dot: 'bg-emerald-500', ring: 'ring-emerald-500/40' },
  { id: 'NON_VEG', label: 'Non-veg', dot: 'bg-rose-500', ring: 'ring-rose-500/40' },
  { id: 'VEGAN', label: 'Vegan', dot: 'bg-teal-400', ring: 'ring-teal-500/40' },
  { id: 'EGG', label: 'Egg', dot: 'bg-amber-400', ring: 'ring-amber-500/40' },
];

const NOTE_CHIPS = ['Less spicy', 'Extra spicy', 'No onion', 'No garlic', 'Jain', 'Less oil', 'Pack separately'];

// Sensible default amount and step for each inventory unit
const UNIT_RULES = {
  GRAM: { start: 50, step: 10, label: 'g' },
  MILLILITER: { start: 50, step: 10, label: 'ml' },
  KG: { start: 0.1, step: 0.05, label: 'kg' },
  LITER: { start: 0.1, step: 0.05, label: 'L' },
  PIECE: { start: 1, step: 1, label: 'pc' },
  DOZEN: { start: 1, step: 1, label: 'dz' },
};
const unitRule = (unit) => UNIT_RULES[unit] || { start: 1, step: 1, label: unit?.toLowerCase() || '' };
const round = (n) => Math.round(n * 1000) / 1000;

const Section = ({ index, title, hint, icon: Icon, children }) => (
  <section className="rounded-2xl border border-stone-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
    <header className="flex items-center gap-3 px-5 pt-4 pb-3">
      <span className="size-7 rounded-full bg-amber-400 text-amber-950 text-xs font-black flex items-center justify-center shrink-0">{index}</span>
      <div className="min-w-0">
        <h2 className="text-sm font-black text-stone-900 dark:text-zinc-100 flex items-center gap-1.5">
          <Icon size={15} className="text-amber-600 dark:text-amber-400" /> {title}
        </h2>
        {hint && <p className="text-[11px] text-stone-500 dark:text-zinc-400">{hint}</p>}
      </div>
    </header>
    <div className="px-5 pb-5">{children}</div>
  </section>
);

const Stepper = ({ value, onChange, step = 1, min = 1, max = 99, label, suffix }) => (
  <div className="flex items-center rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 h-10">
    <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(min, round(value - step)))} className="h-full px-3 text-stone-500 hover:text-stone-900 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-l-xl">
      <MinusSignIcon size={14} />
    </button>
    <input
      aria-label={label}
      type="number"
      inputMode="decimal"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={e => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(Math.min(max, Math.max(0, n)));
      }}
      className="w-14 text-center bg-transparent text-sm font-bold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
    />
    {suffix && <span className="text-[11px] text-stone-400 pr-1">{suffix}</span>}
    <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(Math.min(max, round(value + step)))} className="h-full px-3 text-stone-500 hover:text-stone-900 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-r-xl">
      <PlusSignIcon size={14} />
    </button>
  </div>
);

/**
 * /dashboard/pos/custom-dish — compose an off-menu dish from inventory.
 * Adds to the POS cart, or (with ?for=<orderId>) to an order being edited.
 */
export const PosCustomDishPage = () => {
  const { storeId, data, toast } = usePos();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editOrderId = searchParams.get('for');
  const returnTo = searchParams.get('returnTo') || '/dashboard/pos';

  const addCustomDish = usePosCartStore(s => s.addCustomDish);
  const cartTableId = usePosCartStore(s => s.tableId);
  const cartOrderType = usePosCartStore(s => s.orderType);
  const cartTable = data.tables.find(t => t.id === cartTableId);

  const [name, setName] = useState('');
  const [dietary, setDietary] = useState('VEG');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [materials, setMaterials] = useState(null);
  const [materialsError, setMaterialsError] = useState('');
  const [search, setSearch] = useState('');
  const [touched, setTouched] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
    api.get(`/stores/${storeId}/inventory/materials`)
      .then(res => setMaterials(res.data.data || []))
      .catch(() => { setMaterials([]); setMaterialsError('Inventory could not be loaded — you can still add the dish without ingredients.'); });
  }, [storeId]);

  const priceNum = Math.max(0, Math.round(Number(price) || 0));
  const extras = ingredients.reduce((s, i) => s + Math.max(0, Math.round(Number(i.price) || 0)), 0);
  const unitPrice = priceNum + extras;
  const lineTotal = unitPrice * quantity;

  const nameError = touched && !name.trim() ? 'Give the dish a name the kitchen will recognise.' : '';
  const priceError = touched && unitPrice <= 0 ? 'Set a price (or charge for at least one ingredient).' : '';

  const availableMaterials = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (materials || [])
      .filter(m => !ingredients.some(i => i.rawMaterialId === m.id))
      .filter(m => !q || m.name.toLowerCase().includes(q));
  }, [materials, ingredients, search]);

  const addIngredient = (m) => {
    setIngredients(prev => [...prev, {
      rawMaterialId: m.id,
      name: m.name,
      unit: m.unit,
      quantity: unitRule(m.unit).start,
      price: 0,
      stock: m.currentStock,
    }]);
    setSearch('');
  };

  const updateIngredient = (id, patch) => setIngredients(prev => prev.map(i => (i.rawMaterialId === id ? { ...i, ...patch } : i)));

  const addNoteChip = (chip) => setNote(prev => (prev.toLowerCase().includes(chip.toLowerCase()) ? prev : [prev.trim(), chip].filter(Boolean).join(', ')));

  const reset = () => {
    setName('');
    setPrice('');
    setQuantity(1);
    setNote('');
    setIngredients([]);
    setTouched(false);
    nameRef.current?.focus();
  };

  const submit = (another = false) => {
    setTouched(true);
    if (!name.trim() || unitPrice <= 0) return;

    const dish = {
      name: name.trim(),
      price: priceNum, // base only — ingredient charges are added on top
      quantity,
      dietary,
      notes: note.trim(),
      customIngredients: ingredients.map(i => ({
        rawMaterialId: i.rawMaterialId,
        name: i.name,
        unit: i.unit,
        quantity: Number(i.quantity) || unitRule(i.unit).start,
        price: Math.max(0, Math.round(Number(i.price) || 0)),
      })),
    };

    if (editOrderId) appendCustomDishToDraft(editOrderId, dish);
    else addCustomDish(dish);
    toast(`Added "${dish.name}"${quantity > 1 ? ` ×${quantity}` : ''}`, 'success');

    if (another) reset();
    else navigate(returnTo);
  };

  // Ctrl/Cmd+Enter adds, Esc goes back
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submit(false);
      } else if (e.key === 'Escape' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        navigate(returnTo);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const destination = editOrderId
    ? `Order #${editOrderId.slice(-6).toUpperCase()} (editing)`
    : cartOrderType === 'TAKEAWAY' ? 'Current takeaway order' : cartTable ? `Current order · Table ${cartTable.tableNumber}` : 'Current order';
  const dietaryMeta = DIETARY.find(d => d.id === dietary);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-4 py-3 flex items-center gap-3 border-b border-stone-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70">
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => navigate(returnTo)} aria-label="Back">
          <ArrowLeft01Icon size={16} />
        </Button>
        <div className="min-w-0">
          <h1 className="text-base font-black text-stone-900 dark:text-zinc-100">Custom dish</h1>
          <p className="text-[11px] text-stone-500 dark:text-zinc-400 truncate">Off-menu item built from your inventory</p>
        </div>
        <span className="ml-auto text-[11px] font-bold px-3 py-1 rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30 truncate">
          Adding to: {destination}
        </span>
      </div>

      <form
        className="flex-1 min-h-0 overflow-y-auto"
        onSubmit={(e) => { e.preventDefault(); submit(false); }}
        noValidate
      >
        <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
          <div className="flex flex-col gap-4">
            <Section index={1} title="Dish" hint="What the guest ordered and what it costs." icon={Dish01Icon}>
              <div className="flex flex-col gap-4">
                <div>
                  <label htmlFor="dish-name" className="text-xs font-semibold text-stone-700 dark:text-zinc-300">Name</label>
                  <input
                    id="dish-name"
                    ref={nameRef}
                    value={name}
                    maxLength={60}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Chef's special paneer bowl"
                    aria-invalid={Boolean(nameError)}
                    aria-describedby={nameError ? 'dish-name-error' : undefined}
                    className={`mt-1 w-full h-12 rounded-xl border bg-white dark:bg-zinc-950 px-4 text-base font-semibold outline-none focus:ring-2 focus:ring-amber-400/50 ${nameError ? 'border-rose-400' : 'border-stone-200 dark:border-zinc-700'}`}
                  />
                  {nameError && <p id="dish-name-error" className="mt-1 text-[11px] font-semibold text-rose-600">{nameError}</p>}
                </div>

                <div>
                  <span className="text-xs font-semibold text-stone-700 dark:text-zinc-300">Type</span>
                  <div className="mt-1 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Dietary type">
                    {DIETARY.map(d => (
                      <button
                        key={d.id}
                        type="button"
                        role="radio"
                        aria-checked={dietary === d.id}
                        onClick={() => setDietary(d.id)}
                        className={`h-10 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 ${dietary === d.id
                          ? `border-transparent bg-stone-900 text-white dark:bg-zinc-100 dark:text-zinc-900 ring-2 ${d.ring}`
                          : 'border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-zinc-300 hover:border-stone-300'}`}
                      >
                        <span className={`size-2.5 rounded-full ${d.dot}`} /> {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="dish-price" className="text-xs font-semibold text-stone-700 dark:text-zinc-300">Price per dish</label>
                    <div className={`mt-1 flex items-center h-10 rounded-xl border bg-white dark:bg-zinc-950 focus-within:ring-2 focus-within:ring-amber-400/50 ${priceError ? 'border-rose-400' : 'border-stone-200 dark:border-zinc-700'}`}>
                      <span className="pl-3 pr-1 text-stone-400 font-bold">₹</span>
                      <input
                        id="dish-price"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={price}
                        onChange={e => setPrice(e.target.value.replace(/[^\d]/g, ''))}
                        placeholder="0"
                        aria-invalid={Boolean(priceError)}
                        className="flex-1 min-w-0 bg-transparent pr-3 text-sm font-bold tabular-nums outline-none"
                      />
                    </div>
                    {priceError && <p className="mt-1 text-[11px] font-semibold text-rose-600">{priceError}</p>}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-stone-700 dark:text-zinc-300">Quantity</span>
                    <div className="mt-1"><Stepper value={quantity} onChange={v => setQuantity(Math.max(1, Math.round(v)))} label="quantity" /></div>
                  </div>
                </div>
              </div>
            </Section>

            <Section index={2} title="Ingredients" hint="Optional. Picked ingredients are deducted from inventory when the order is cooked." icon={Pot02Icon}>
              {ingredients.length > 0 && (
                <ul className="flex flex-col gap-2 mb-4">
                  {ingredients.map(i => {
                    const rule = unitRule(i.unit);
                    const short = typeof i.stock === 'number' && i.stock < Number(i.quantity) * quantity;
                    return (
                      <li key={i.rawMaterialId} className="rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/60 dark:bg-zinc-800/40 p-3 flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold truncate">{i.name}</div>
                          <div className={`text-[11px] ${short ? 'text-rose-600 font-semibold' : 'text-stone-500'}`}>
                            {short ? `Only ${i.stock} ${rule.label} in stock` : `${i.stock ?? '–'} ${rule.label} in stock`}
                          </div>
                        </div>
                        <Stepper
                          value={Number(i.quantity)}
                          step={rule.step}
                          min={rule.step}
                          max={100000}
                          label={`${i.name} amount`}
                          suffix={rule.label}
                          onChange={v => updateIngredient(i.rawMaterialId, { quantity: v })}
                        />
                        <label className="flex items-center h-10 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 w-28">
                          <span className="pl-3 pr-1 text-[11px] text-stone-400 font-bold">+₹</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={i.price || ''}
                            placeholder="0"
                            aria-label={`Extra charge for ${i.name}`}
                            onChange={e => updateIngredient(i.rawMaterialId, { price: e.target.value.replace(/[^\d]/g, '') })}
                            className="w-full bg-transparent pr-2 text-sm font-bold tabular-nums outline-none"
                          />
                        </label>
                        <button type="button" aria-label={`Remove ${i.name}`} onClick={() => setIngredients(prev => prev.filter(x => x.rawMaterialId !== i.rawMaterialId))} className="size-9 rounded-lg flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40">
                          <Delete02Icon size={16} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="flex items-center gap-2 h-10 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 focus-within:ring-2 focus-within:ring-amber-400/50">
                <Search01Icon size={15} className="text-stone-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search inventory (paneer, rice, cheese…)"
                  aria-label="Search inventory"
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              </div>

              {materialsError && (
                <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1"><Alert01Icon size={12} /> {materialsError}</p>
              )}

              <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                {materials === null ? (
                  <div className="col-span-full h-20 flex items-center justify-center text-stone-400"><Loading03Icon size={20} className="animate-spin" /></div>
                ) : availableMaterials.length === 0 ? (
                  <p className="col-span-full text-xs text-stone-400 py-4 text-center">
                    {search ? `Nothing in inventory matches "${search}".` : materials.length ? 'All inventory items are already added.' : 'No inventory items yet.'}
                  </p>
                ) : availableMaterials.map(m => {
                  const out = m.currentStock <= 0;
                  const low = !out && m.currentStock <= (m.lowStockThreshold || 0);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => addIngredient(m)}
                      className="text-left rounded-xl border border-stone-200 dark:border-zinc-700 px-3 py-2 hover:border-amber-400 hover:bg-amber-50/60 dark:hover:bg-amber-950/20 flex items-center gap-2"
                    >
                      <PlusSignIcon size={14} className="text-amber-600 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold truncate">{m.name}</span>
                        <span className={`block text-[10px] ${out ? 'text-rose-600 font-semibold' : low ? 'text-amber-700 dark:text-amber-400 font-semibold' : 'text-stone-400'}`}>
                          {out ? 'Out of stock' : `${round(m.currentStock)} ${unitRule(m.unit).label}${low ? ' · low' : ''}`}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section index={3} title="Kitchen note" hint="Printed on the kitchen ticket." icon={NoteEditIcon}>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value.slice(0, 200))}
                rows={2}
                placeholder="Anything the chef should know"
                aria-label="Kitchen note"
                className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400/50 resize-none"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {NOTE_CHIPS.map(chip => (
                  <button key={chip} type="button" onClick={() => addNoteChip(chip)} className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-zinc-300 hover:border-amber-400">
                    + {chip}
                  </button>
                ))}
              </div>
            </Section>
          </div>

          <aside className="lg:sticky lg:top-4 flex flex-col gap-3" aria-label="Summary">
            <div className="rounded-2xl border border-stone-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-stone-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[10px] font-black uppercase tracking-widest">
                Kitchen ticket preview
              </div>
              <div className="p-4 font-mono text-xs flex flex-col gap-1.5 border-b border-dashed border-stone-300 dark:border-zinc-700">
                <div className="flex items-start gap-2 text-sm font-bold">
                  <span className={`mt-1 size-2.5 rounded-full shrink-0 ${dietaryMeta?.dot}`} />
                  <span className="flex-1 break-words">{quantity}× {name.trim() || 'Untitled dish'}</span>
                </div>
                {ingredients.map(i => (
                  <div key={i.rawMaterialId} className="pl-4 text-stone-600 dark:text-zinc-400">+ {i.name} {i.quantity}{unitRule(i.unit).label}</div>
                ))}
                {note.trim() && <div className="pl-4 italic text-amber-700 dark:text-amber-400">“{note.trim()}”</div>}
              </div>
              <div className="p-4 flex flex-col gap-1.5 text-xs">
                <div className="flex justify-between text-stone-500"><span>Dish price</span><span className="tabular-nums">₹{priceNum}</span></div>
                {extras > 0 && <div className="flex justify-between text-stone-500"><span>Ingredient charges</span><span className="tabular-nums">+₹{extras}</span></div>}
                <div className="flex justify-between text-stone-500"><span>Per dish</span><span className="tabular-nums">₹{unitPrice}</span></div>
                <div className="flex justify-between items-baseline pt-2 mt-1 border-t border-stone-200 dark:border-zinc-800">
                  <span className="text-sm font-black">Total {quantity > 1 ? `(×${quantity})` : ''}</span>
                  <span className="text-xl font-black tabular-nums">₹{lineTotal}</span>
                </div>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full h-12 bg-amber-400 hover:bg-amber-500 text-amber-950 font-black">
              <CheckmarkCircle02Icon size={18} className="mr-2" /> Add to order · ₹{lineTotal}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => submit(true)}>Add & another</Button>
              <Button type="button" variant="outline" onClick={() => navigate(returnTo)}>Cancel</Button>
            </div>
            <p className="text-[10px] text-center text-stone-400">Ctrl + Enter to add · Esc to go back</p>
          </aside>
        </div>
      </form>
    </div>
  );
};
