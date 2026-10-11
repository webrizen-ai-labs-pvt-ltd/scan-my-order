import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search01Icon, Cancel01Icon, Loading03Icon, PauseIcon, Table01Icon, ArrowDown01Icon } from 'hugeicons-react';
import { computeCartSubTotal, computeLineUnitPrice, computeOrderTotals } from '@smo/shared/pricing';
import api from '../../lib/api';
import { usePos } from './pos-layout';
import { useAuthStore } from '../../store/authStore';
import { useEntitlements } from '../../lib/entitlements';
import { ComplimentaryDialog } from '../../components/pos/complimentary-dialog';
import { canGiveComplimentary } from '../../lib/complimentary';
import { usePosCartStore, toOrderItems } from '../../store/pos-cart-store';
import { ModifierDialog } from '../../components/pos/modifier-dialog';
import { CustomerPicker } from '../../components/pos/customer-picker';
import { apiErrorMessage } from '../../components/pos/pos-toasts';
import { Receipt } from '../../components/receipt';
import { printReceipt } from '../../lib/print-receipt';
import { sessionBillToReceipt } from '../../lib/session-receipt';
import { printKitchenTicket, markPrinted, readPrintSettings } from '../../lib/kitchen-ticket';

/*
 * Classic billing: everything on one screen, the way counter staff are used to working.
 * Categories | item tiles | the bill with payment and Save / KOT buttons. Same cart, orders,
 * payments and printing as the modern screen.
 */

const DIET_LABEL = { VEG: 'Veg', VEGAN: 'Vegan', EGG: 'Contains egg', NON_VEG: 'Non-veg' };
// The familiar food mark: a dot in a square. Green veg, amber egg, red non-veg; same in light and dark.
const DIET_TONE = {
  VEG: ['border-emerald-600 dark:border-emerald-400', 'bg-emerald-600 dark:bg-emerald-400'],
  VEGAN: ['border-emerald-600 dark:border-emerald-400', 'bg-emerald-600 dark:bg-emerald-400'],
  EGG: ['border-amber-500 dark:border-amber-400', 'bg-amber-500 dark:bg-amber-400'],
  NON_VEG: ['border-red-600 dark:border-red-400', 'bg-red-600 dark:bg-red-400'],
};
const DietMark = ({ dietary, className = '' }) => {
  const [box, dot] = DIET_TONE[dietary] || DIET_TONE.VEG;
  return (
    <span title={DIET_LABEL[dietary] || 'Veg'} className={`inline-flex size-3 shrink-0 items-center justify-center rounded-[3px] border-[1.5px] ${box} ${className}`}>
      <span className={`size-1.5 rounded-full ${dot}`} />
    </span>
  );
};

// Keyboard shortcut hint shown on a button or field
const KEY_TONE = {
  plain: 'border-zinc-300 text-zinc-500 dark:border-zinc-600 dark:text-zinc-400',
  dark: 'border-zinc-950/30 text-zinc-950/70',
  invert: 'border-white/30 text-white/70',
};
const Key = ({ children, tone = 'plain' }) => (
  <kbd className={`ml-1 rounded border px-1 font-sans text-[10px] font-medium leading-4 ${KEY_TONE[tone]}`}>{children}</kbd>
);
const PAY_METHODS = [
  { id: 'CASH', label: 'Cash' },
  { id: 'OTHER', label: 'Card / UPI' },
  { id: 'DUE', label: 'Due' },
];
const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/* ---------- held bills (this device) ---------- */

const heldKey = (storeId) => `smo_pos_held_${storeId}`;
const readHeld = (storeId) => {
  try { return JSON.parse(localStorage.getItem(heldKey(storeId)) || '[]'); } catch { return []; }
};
const writeHeld = (storeId, list) => {
  try { localStorage.setItem(heldKey(storeId), JSON.stringify(list)); } catch { /* storage full */ }
};

export const PosClassicPage = () => {
  const { storeId, store, data, toast, subscribe } = usePos();
  const { user } = useAuthStore();
  const [comping, setComping] = useState(null); // table bill getting complimentary food
  // "Due" is only offered when dues are part of the brand's plan
  const duesInPlan = useEntitlements(s => !s.loaded || s.features.includes('DUES'));
  const payMethods = PAY_METHODS.filter(m => m.id !== 'DUE' || duesInPlan);
  const navigate = useNavigate();
  const cart = usePosCartStore();
  const { lines, notes, orderType, tableId, customerName, promo } = cart;

  const [categoryId, setCategoryId] = useState(null);
  const [query, setQuery] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [customerPhone, setCustomerPhone] = useState('');
  const [busy, setBusy] = useState(null); // which action is running
  const [modifierItem, setModifierItem] = useState(null);
  const [tablePicker, setTablePicker] = useState(false);
  const [running, setRunning] = useState(null); // the selected table's open bill
  const [held, setHeld] = useState(() => readHeld(storeId));
  const [heldOpen, setHeldOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [printDoc, setPrintDoc] = useState(null);
  const searchRef = useRef(null);
  const printRef = useRef(null);

  /* ---------- menu ---------- */

  const categories = data.menu;
  const activeCategory = categories.find(c => c.id === categoryId) || categories[0];
  const allItems = useMemo(() => categories.flatMap(c => c.items || []), [categories]);
  const q = query.trim().toLowerCase();
  const shownItems = q
    ? allItems.filter(i => i.name.toLowerCase().includes(q) || (i.shortCode && i.shortCode.toLowerCase().startsWith(q)))
    : (activeCategory?.items || []);
  const qtyInCart = useMemo(() => {
    const map = new Map();
    for (const l of lines) map.set(l.menuItem.id, (map.get(l.menuItem.id) || 0) + l.quantity);
    return map;
  }, [lines]);

  // A dish sold out or back on sale anywhere: refresh the menu
  const reloadMenu = data.reload;
  useEffect(() => subscribe((msg) => {
    if (msg.type === 'MENU_ITEM_AVAILABILITY') reloadMenu();
  }), [subscribe, reloadMenu]);

  const addItem = useCallback((item) => {
    if (item.isManuallyDisabled || item.isSystemDisabled) {
      toast(`${item.name} is sold out`, 'error');
      return;
    }
    if (item.modifierGroups?.length > 0) setModifierItem(item);
    else cart.addItem(item, []);
  }, [cart, toast]);

  // Search box: Enter adds the dish whose short code matches, else the first match
  const onSearchKey = (e) => {
    if (e.key === 'Escape') { setQuery(''); return; }
    if (e.key !== 'Enter' || !q) return;
    e.preventDefault();
    const byCode = allItems.find(i => i.shortCode && i.shortCode.toLowerCase() === q);
    const pick = byCode || shownItems[0];
    if (pick) {
      addItem(pick);
      setQuery('');
    } else {
      toast(`No dish matches "${query}"`, 'error');
    }
  };

  /* ---------- table & its running bill ---------- */

  const selectedTable = data.tables.find(t => t.id === tableId) || null;
  // The table whose bill is wanted right now; answers for any other table are dropped
  const runningTableRef = useRef(null);
  const loadRunning = useCallback(async () => {
    const wanted = storeId && tableId && orderType === 'DINE_IN' ? tableId : null;
    runningTableRef.current = wanted;
    if (!wanted) { setRunning(null); return; }
    let bill = null;
    try {
      const res = await api.get(`/stores/${storeId}/orders/sessions/by-table/${wanted}`);
      bill = res.data.data || null;
    } catch { /* shown as no running bill */ }
    if (runningTableRef.current === wanted) setRunning(bill);
  }, [storeId, tableId, orderType]);

  useEffect(() => { loadRunning(); }, [loadRunning]);
  useEffect(() => subscribe((msg) => {
    if (/^(ORDER_|TABLE_|PAYMENT_UPDATED|STREAM_RECONNECTED)/.test(msg.type)) loadRunning();
  }), [subscribe, loadRunning]);

  // Items already sent to the kitchen for this table, merged by dish
  const runningLines = useMemo(() => {
    const map = new Map();
    for (const o of running?.orders || []) {
      for (const it of o.items || []) {
        if (it.status === 'REJECTED') continue;
        const name = it.displayName || it.customName || it.menuItem?.name || 'Item';
        const free = it.compValue != null;
        const key = `${name}|${it.priceAtOrder}|${free}`;
        const prev = map.get(key) || { name, quantity: 0, amount: 0, free };
        map.set(key, { ...prev, quantity: prev.quantity + it.quantity, amount: prev.amount + it.priceAtOrder * it.quantity });
      }
    }
    return [...map.values()];
  }, [running]);
  const runningTotal = running?.totalAmount || 0;
  // Everything this table was served, as one order, for "Complimentary"
  const compTarget = useMemo(() => {
    const sent = (running?.orders || []).filter(o => canGiveComplimentary(user, o));
    if (sent.length === 0) return null;
    return {
      id: sent[0].id,
      status: sent[0].status,
      table: selectedTable ? { tableNumber: selectedTable.tableNumber } : null,
      items: sent.flatMap(o => o.items || []),
    };
  }, [running, user, selectedTable]);

  /* ---------- totals ---------- */

  const totals = useMemo(() => computeOrderTotals({
    subTotal: computeCartSubTotal(lines),
    promo,
    taxRules: store?.taxRules,
  }), [lines, promo, store?.taxRules]);
  const payable = runningTotal + (lines.length > 0 ? totals.totalAmount : 0);

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    const found = data.promos.find(p => p.code === code && p.isActive && (!p.validUntil || new Date(p.validUntil) > new Date()));
    if (!found) { toast('Invalid or inactive promo code', 'error'); return; }
    if (totals.subTotal < (found.minOrderValue || 0)) { toast(`Minimum order for this code is ₹${found.minOrderValue}`, 'error'); return; }
    cart.setPromo(found);
    setPromoInput('');
    setPromoOpen(false);
    toast(`Promo ${found.code} applied`, 'success');
  };

  /* ---------- placing orders and settling bills ---------- */

  const placeOrder = async (paymentModel) => {
    const res = await api.post(`/stores/${storeId}/orders`, {
      type: orderType,
      paymentModel,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      tableId: orderType === 'DINE_IN' ? tableId : undefined,
      promoCode: promo?.code,
      items: toOrderItems(lines, notes),
    });
    return res.data.data;
  };

  const printOrderTicket = (order) => {
    const settings = readPrintSettings(storeId);
    printKitchenTicket(order, { storeName: store?.name, paper: settings.paper });
    markPrinted(storeId, order.id);
  };

  const printBillFor = async (ref) => {
    let doc;
    if (ref.tableSessionId) {
      const [billRes, sumRes] = await Promise.all([
        api.get(`/stores/${storeId}/orders/sessions/${ref.tableSessionId}`),
        api.get(`/stores/${storeId}/payments/summary`, { params: ref }),
      ]);
      doc = sessionBillToReceipt(billRes.data.data, sumRes.data.data.payments);
    } else {
      doc = (await api.get(`/stores/${storeId}/orders/${ref.orderId}`)).data.data;
    }
    flushSync(() => setPrintDoc(doc));
    printReceipt(printRef.current);
    setPrintDoc(null);
  };

  const finishOrder = () => {
    cart.clear();
    setCustomerPhone('');
    data.refreshTables();
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const needsTable = orderType === 'DINE_IN' && !tableId;

  /** KOT: send the new items to the kitchen (the bill stays open) */
  const sendKot = async (print) => {
    if (busy) return;
    if (lines.length === 0) { toast('Add items first', 'error'); return; }
    if (needsTable) { setTablePicker(true); toast('Pick a table for this KOT', 'error'); return; }
    setBusy(print ? 'KOT_PRINT' : 'KOT');
    try {
      const { order } = await placeOrder('POSTPAID');
      if (print) printOrderTicket(order);
      toast(selectedTable ? `KOT sent · Table ${selectedTable.tableNumber}` : 'KOT sent', 'success');
      finishOrder();
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not send the KOT'), 'error');
    } finally {
      setBusy(null);
    }
  };

  /** Save: settle the bill with the chosen payment (and print it) */
  const save = async (print) => {
    if (busy) return;
    if (needsTable) { setTablePicker(true); toast('Pick a table', 'error'); return; }
    if (lines.length === 0 && !running) { toast('Add items first', 'error'); return; }
    setBusy(print ? 'SAVE_PRINT' : 'SAVE');
    try {
      // 1. New items become an order: on the table's bill (sent to the kitchen) or a takeaway order
      let ref;
      if (orderType === 'DINE_IN') {
        let sessionId = running?.id || selectedTable?.activeSessionId || null;
        if (lines.length > 0) {
          const result = await placeOrder('POSTPAID');
          sessionId = result.tableSessionId || sessionId;
        }
        if (!sessionId) throw new Error('This table has no open bill');
        ref = { tableSessionId: sessionId };
      } else {
        const result = await placeOrder('PREPAID');
        ref = { orderId: result.order.id };
      }
      finishOrder();

      // 2. Card, UPI and dues need more details (which one, a QR, whose account): the checkout
      //    page for this bill takes it from here
      const kind = ref.tableSessionId ? 'table' : 'order';
      const id = ref.tableSessionId || ref.orderId;
      if (payMethod === 'DUE') { navigate(`/dashboard/pos/checkout/${kind}/${id}/dues`); return; }
      if (payMethod === 'OTHER') { navigate(`/dashboard/pos/checkout/${kind}/${id}`); return; }

      // 3. Cash: take the whole amount still due and close the bill right here
      const summary = (await api.get(`/stores/${storeId}/payments/summary`, { params: ref })).data.data;
      if (summary.blockers?.length > 0) throw new Error(summary.blockers[0].reason);
      const due = Math.max(0, summary.dueAmount - (summary.pendingAmount || 0));
      if (due > 0) await api.post(`/stores/${storeId}/payments`, { ...ref, channel: 'CASH', amount: due });
      toast(`Bill settled · ${rupees(summary.dueAmount)} cash`, 'success');
      if (print) await printBillFor(ref);
      data.refreshTables();
      loadRunning();
    } catch (err) {
      toast(apiErrorMessage(err, err.message || 'Could not save the bill'), 'error');
      loadRunning();
    } finally {
      setBusy(null);
    }
  };

  /** Print the table's bill to hand over, without settling it */
  const printRunningBill = async () => {
    if (busy || !running) return;
    if (lines.length > 0) { toast('Send the new items with KOT first, then print the bill', 'error'); return; }
    setBusy('BILL');
    try {
      await printBillFor({ tableSessionId: running.id });
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not print the bill'), 'error');
    } finally {
      setBusy(null);
    }
  };

  /** Hold: park this cart on this device and start a fresh one */
  const hold = () => {
    if (lines.length === 0) { setHeldOpen(v => !v); return; }
    const entry = {
      id: `h_${Date.now()}`,
      savedAt: Date.now(),
      label: selectedTable ? `Table ${selectedTable.tableNumber}` : (customerName.trim() || `Takeaway ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`),
      total: totals.totalAmount,
      snapshot: cart.snapshot(),
    };
    const next = [entry, ...held].slice(0, 20);
    setHeld(next);
    writeHeld(storeId, next);
    cart.clear();
    toast(`Held: ${entry.label}`, 'info');
  };
  const resumeHeld = (entry) => {
    if (lines.length > 0) { toast('Hold or clear the current bill first', 'error'); return; }
    cart.restore(entry.snapshot);
    const next = held.filter(h => h.id !== entry.id);
    setHeld(next);
    writeHeld(storeId, next);
    setHeldOpen(false);
  };
  const dropHeld = (entry) => {
    const next = held.filter(h => h.id !== entry.id);
    setHeld(next);
    writeHeld(storeId, next);
  };

  /* ---------- keyboard ---------- */

  const actionsRef = useRef({});
  // Shortcuts always call the latest handlers
  useEffect(() => { actionsRef.current = { save, sendKot, hold }; });
  useEffect(() => {
    const onKey = (e) => {
      const keys = { F2: () => searchRef.current?.focus(), F7: () => actionsRef.current.sendKot(true), F8: () => actionsRef.current.save(true), F9: () => actionsRef.current.hold() };
      if (keys[e.key]) { e.preventDefault(); keys[e.key](); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { searchRef.current?.focus(); }, []);

  const editNote = (line) => {
    const next = window.prompt(`Note for the kitchen: ${line.customName || line.menuItem?.name}`, notes[line.lineId] || '');
    if (next !== null) cart.setNote(line.lineId, next.trim());
  };

  /* ---------- layout ---------- */

  const btn = 'relative h-12 rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5';
  const primaryBtn = `${btn} !bg-amber-400 hover:!bg-amber-500 !text-zinc-950`;
  const kitchenBtn = `${btn} bg-zinc-800 hover:bg-zinc-700 text-white dark:bg-zinc-700 dark:hover:bg-zinc-600`;
  const quietBtn = `${btn} border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800`;
  const spinner = <Loading03Icon size={16} className="animate-spin" />;
  const lineCount = lines.reduce((n, l) => n + l.quantity, 0);

  return (
    <div className="h-full grid grid-cols-[150px_minmax(0,1fr)_400px] xl:grid-cols-[176px_minmax(0,1fr)_440px] overflow-hidden bg-zinc-100 dark:bg-zinc-950">
      {/* Categories */}
      <nav aria-label="Categories" className="overflow-y-auto bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 py-1">
        {categories.map(cat => {
          const active = !q && activeCategory?.id === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              aria-current={active ? 'true' : undefined}
              onClick={() => { setCategoryId(cat.id); setQuery(''); }}
              className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 text-[13px] ${active
                ? 'bg-amber-400 text-zinc-950 font-semibold'
                : 'font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            >
              <span className="truncate">{cat.name}</span>
              <span className={`text-[11px] tabular-nums ${active ? 'text-zinc-800' : 'text-zinc-400'}`}>{(cat.items || []).length}</span>
            </button>
          );
        })}
      </nav>

      {/* Items */}
      <section aria-label="Items" className="flex flex-col min-h-0 p-3 gap-3">
        <label className="flex items-center gap-2 h-11 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 focus-within:border-amber-500">
          <Search01Icon size={17} className="text-zinc-400 shrink-0" />
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder="Search a dish or type its short code, then press Enter"
            aria-label="Search item or short code"
            className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-zinc-400"
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"><Cancel01Icon size={16} /></button>
          ) : <Key>F2</Key>}
        </label>

        <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">{q ? `Results for “${query.trim()}”` : activeCategory?.name}</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5"><DietMark dietary="VEG" /> Veg</span>
            <span className="flex items-center gap-1.5"><DietMark dietary="EGG" /> Egg</span>
            <span className="flex items-center gap-1.5"><DietMark dietary="NON_VEG" /> Non-veg</span>
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {shownItems.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-500">{q ? 'No dish matches.' : 'No dishes in this category.'}</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-2 content-start">
              {shownItems.map(item => {
                const soldOut = item.isManuallyDisabled || item.isSystemDisabled;
                const qty = qtyInCart.get(item.id) ?? 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addItem(item)}
                    disabled={soldOut}
                    aria-label={`${item.name}, ${DIET_LABEL[item.dietary] || 'Veg'}, ${rupees(item.price)}${qty ? `, ${qty} in bill` : ''}${soldOut ? ', sold out' : ''}`}
                    className={`relative flex h-[76px] flex-col justify-between rounded-lg border bg-white dark:bg-zinc-900 px-2.5 py-2 text-left transition-colors hover:bg-amber-50 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:pointer-events-none disabled:opacity-50 ${qty > 0 ? 'border-amber-400' : 'border-zinc-200 dark:border-zinc-800'}`}
                  >
                    <span className="flex items-start gap-1.5">
                      <DietMark dietary={item.dietary} className="mt-[3px]" />
                      <span className={`line-clamp-2 break-words text-[13px] font-semibold leading-tight text-zinc-900 dark:text-zinc-100 ${qty > 0 ? 'pr-5' : ''}`}>{item.name}</span>
                    </span>
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`text-xs tabular-nums font-medium ${soldOut ? 'text-red-600 dark:text-red-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                        {soldOut ? 'Sold out' : rupees(item.price)}
                      </span>
                      {item.shortCode && <span className="shrink-0 font-mono text-[10px] text-zinc-400">{item.shortCode}</span>}
                    </span>
                    {qty > 0 && !soldOut && (
                      <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-bold tabular-nums text-zinc-950">{qty}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Bill */}
      <section aria-label="Bill" className="relative flex flex-col min-h-0 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800">
        <div className="shrink-0 p-3 flex flex-col gap-2 border-b border-zinc-200 dark:border-zinc-800">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1" role="radiogroup" aria-label="Order type">
            {[['DINE_IN', 'Dine in'], ['TAKEAWAY', 'Takeaway']].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={orderType === id}
                onClick={() => cart.setOrderType(id)}
                className={`h-9 rounded-md text-sm font-semibold ${orderType === id ? 'bg-amber-400 text-zinc-950' : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {orderType === 'DINE_IN' && (
            <button
              type="button"
              aria-expanded={tablePicker}
              onClick={() => setTablePicker(v => !v)}
              className={`h-10 rounded-md border px-3 text-left text-sm flex items-center justify-between gap-2 ${selectedTable ? 'border-zinc-200 dark:border-zinc-700' : 'border-dashed border-amber-500 bg-amber-50 dark:bg-amber-500/10'}`}
            >
              <span className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
                <Table01Icon size={16} className={selectedTable ? 'text-zinc-400' : 'text-amber-600 dark:text-amber-400'} />
                {selectedTable ? `Table ${selectedTable.tableNumber}` : 'Choose a table'}
              </span>
              <span className="flex items-center gap-2 text-xs text-zinc-500">
                {running && <span className="font-semibold text-zinc-700 dark:text-zinc-300">Running {rupees(runningTotal)}</span>}
                <ArrowDown01Icon size={15} className={tablePicker ? 'rotate-180' : ''} />
              </span>
            </button>
          )}
          {tablePicker && orderType === 'DINE_IN' && (
            <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-1.5">
              <div className="grid grid-cols-6 gap-1 max-h-40 overflow-y-auto">
                {data.tables.map(t => {
                  const busyTable = t.isOccupied || t.unpaidTotal > 0;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { cart.setTableId(t.id); setTablePicker(false); }}
                      className={`h-11 rounded-md border text-xs font-bold leading-tight ${t.id === tableId ? 'ring-2 ring-amber-400' : ''} ${busyTable
                        ? 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-200'
                        : t.isReserved
                          ? 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-200'
                          : 'border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'}`}
                      title={busyTable ? `Running ${rupees(t.unpaidTotal)}` : t.isReserved ? 'Reserved' : 'Free'}
                    >
                      {t.tableNumber}
                      {t.unpaidTotal > 0 && <span className="block text-[9px] font-semibold">{rupees(t.unpaidTotal)}</span>}
                    </button>
                  );
                })}
                {data.tables.length === 0 && <p className="col-span-6 p-2 text-xs text-zinc-500">No tables set up.</p>}
              </div>
              {data.tables.length > 0 && (
                <p className="mt-1.5 flex items-center gap-3 px-0.5 text-[10px] text-zinc-500">
                  <span className="flex items-center gap-1"><span className="size-2 rounded-sm border border-zinc-300 dark:border-zinc-600" /> Free</span>
                  <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-amber-300 dark:bg-amber-500/60" /> Running bill</span>
                  <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-sky-300 dark:bg-sky-500/60" /> Reserved</span>
                </p>
              )}
            </div>
          )}

          <CustomerPicker storeId={storeId} name={customerName} phone={customerPhone} onName={cart.setCustomerName} onPhone={setCustomerPhone} />
        </div>

        {/* Lines */}
        <div className="grid grid-cols-[minmax(0,1fr)_96px_72px] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <span>Item</span><span className="text-center">Qty</span><span className="text-right">Amount</span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {runningLines.length > 0 && (
            <div className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800 pb-1">
              <div className="px-3 pt-1.5 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Already sent to kitchen</p>
                {compTarget && (
                  <button type="button" onClick={() => setComping(compTarget)} title="Send free food in place of something that went wrong"
                    className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 underline underline-offset-2">
                    Complimentary
                  </button>
                )}
              </div>
              {runningLines.map((r, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_96px_72px] px-3 py-1 text-xs text-zinc-500">
                  <span className="truncate">{r.name}</span><span className="text-center tabular-nums">{r.quantity}</span><span className="text-right tabular-nums">{r.free ? 'Free' : r.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          {lines.length === 0 && runningLines.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-1 p-6 text-center">
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">The bill is empty</p>
              <p className="text-xs text-zinc-500">Tap a dish on the left, or type its short code and press Enter.</p>
            </div>
          ) : lines.map(line => (
            <div key={line.lineId} className="grid grid-cols-[minmax(0,1fr)_96px_72px] items-center px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 text-sm">
              <button type="button" onClick={() => editNote(line)} className="min-w-0 text-left" title="Add a note for the kitchen">
                <span className="block truncate font-medium text-zinc-900 dark:text-zinc-100">{line.customName || line.menuItem?.name}</span>
                <span className="block truncate text-[11px] text-zinc-500">
                  {[...(line.modifiers || []).map(m => m.name), notes[line.lineId] && `“${notes[line.lineId]}”`].filter(Boolean).join(', ') || 'Add note'}
                </span>
              </button>
              <div className="flex items-center justify-center gap-1">
                <button type="button" onClick={() => cart.updateQuantity(line.lineId, -1)} aria-label="One less" className="size-7 rounded-md border border-zinc-300 dark:border-zinc-700 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800">−</button>
                <span className="w-6 text-center font-semibold tabular-nums">{line.quantity}</span>
                <button type="button" onClick={() => cart.updateQuantity(line.lineId, 1)} aria-label="One more" className="size-7 rounded-md border border-zinc-300 dark:border-zinc-700 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800">+</button>
              </div>
              <span className="text-right tabular-nums text-zinc-900 dark:text-zinc-100">{(computeLineUnitPrice(line) * line.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Totals, payment and actions */}
        <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40">
          <div className="px-3 pt-2.5 pb-2 text-xs flex flex-col gap-1 text-zinc-600 dark:text-zinc-400">
            {lines.length > 0 && (
              <>
                <div className="flex justify-between"><span>New items ({lineCount})</span><span className="tabular-nums">{rupees(totals.subTotal)}</span></div>
                {totals.discountAmount > 0 && <div className="flex justify-between text-emerald-700 dark:text-emerald-400"><span>Discount ({promo?.code})</span><span className="tabular-nums">−{rupees(totals.discountAmount)}</span></div>}
                {totals.taxAmount > 0 && <div className="flex justify-between"><span>Tax</span><span className="tabular-nums">{rupees(totals.taxAmount)}</span></div>}
              </>
            )}
            {runningTotal > 0 && <div className="flex justify-between"><span>Running bill</span><span className="tabular-nums">{rupees(runningTotal)}</span></div>}
            <div className="flex items-end justify-between pt-0.5">
              <div>
                <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">Total to pay</span>
                {promo ? (
                  <button type="button" onClick={() => cart.setPromo(null)} className="text-[11px] text-emerald-700 dark:text-emerald-400 underline">Remove {promo.code}</button>
                ) : promoOpen ? (
                  <span className="mt-0.5 flex items-center gap-1">
                    <input autoFocus value={promoInput} onChange={e => setPromoInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyPromo()} placeholder="Code" className="h-7 w-24 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-xs uppercase outline-none focus:border-amber-500" aria-label="Promo code" />
                    <button type="button" onClick={applyPromo} className="h-7 rounded-md bg-zinc-900 dark:bg-zinc-100 px-2 text-[11px] font-semibold text-white dark:text-zinc-900">Apply</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setPromoOpen(true)} disabled={lines.length === 0} className="text-[11px] underline underline-offset-2 disabled:opacity-40 disabled:no-underline">Add discount code</button>
                )}
              </div>
              <span className="text-3xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">{rupees(payable)}</span>
            </div>
          </div>

          <div className="px-3 pb-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Paid by</p>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${payMethods.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label="Payment method">
              {payMethods.map(m => (
                <label key={m.id} className={`h-9 rounded-md border flex items-center justify-center text-[13px] font-semibold cursor-pointer ${payMethod === m.id
                  ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                  : 'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                  <input type="radio" name="pay-method" value={m.id} checked={payMethod === m.id} onChange={() => setPayMethod(m.id)} className="sr-only" />
                  {m.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 px-3 pb-3">
            <button type="button" onClick={() => save(false)} disabled={Boolean(busy)} className={primaryBtn} title="Take the payment and close the bill">
              {busy === 'SAVE' ? spinner : 'Save'}
            </button>
            <button type="button" onClick={() => save(true)} disabled={Boolean(busy)} className={primaryBtn} title="Take the payment, close the bill and print it (F8)">
              {busy === 'SAVE_PRINT' ? spinner : <>Save &amp; Print <Key tone="dark">F8</Key></>}
            </button>
            {orderType === 'DINE_IN' && running && lines.length === 0 ? (
              <button type="button" onClick={printRunningBill} disabled={Boolean(busy)} className={quietBtn}>
                {busy === 'BILL' ? spinner : 'Print bill'}
              </button>
            ) : (
              <button type="button" onClick={hold} disabled={Boolean(busy)} className={quietBtn}>
                <PauseIcon size={14} /> {lines.length > 0 ? 'Hold' : `Held (${held.length})`} <Key>F9</Key>
              </button>
            )}
            <button type="button" onClick={() => sendKot(false)} disabled={Boolean(busy)} className={kitchenBtn} title="Send the new items to the kitchen. The bill stays open; the guest pays later">
              {busy === 'KOT' ? spinner : 'KOT'}
            </button>
            <button type="button" onClick={() => sendKot(true)} disabled={Boolean(busy)} className={kitchenBtn} title="Send the new items to the kitchen and print the kitchen ticket (F7)">
              {busy === 'KOT_PRINT' ? spinner : <>KOT &amp; Print <Key tone="invert">F7</Key></>}
            </button>
            <button type="button" onClick={() => { const snap = cart.snapshot(); cart.clear(); toast('Bill cleared', 'info', { label: 'Undo', onClick: () => cart.restore(snap) }); }} disabled={Boolean(busy) || lines.length === 0} className={quietBtn}>
              Clear
            </button>
          </div>
        </div>

        {/* Held bills */}
        {heldOpen && (
          <div className="absolute right-3 bottom-44 z-30 w-[380px] max-h-80 overflow-y-auto rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2">
            <div className="flex items-center justify-between px-1 pb-1.5">
              <span className="text-sm font-semibold">Held bills</span>
              <button type="button" onClick={() => setHeldOpen(false)} aria-label="Close" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"><Cancel01Icon size={15} /></button>
            </div>
            {held.length === 0 ? (
              <p className="p-3 text-center text-xs text-zinc-500">No held bills on this device.</p>
            ) : held.map(h => (
              <div key={h.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                <button type="button" onClick={() => resumeHeld(h)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold">{h.label}</span>
                  <span className="block text-[11px] text-zinc-500">{rupees(h.total)} · {h.snapshot.lines.length} items · {new Date(h.savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                </button>
                <button type="button" onClick={() => dropHeld(h)} aria-label={`Delete ${h.label}`} className="text-xs text-zinc-400 hover:text-red-600">Delete</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <ModifierDialog
        item={modifierItem}
        onClose={() => setModifierItem(null)}
        onConfirm={(item, mods) => { cart.addItem(item, mods); setModifierItem(null); searchRef.current?.focus(); }}
        onError={(msg) => toast(msg, 'error')}
      />

      <ComplimentaryDialog
        storeId={storeId}
        storeName={store?.name}
        order={comping}
        menu={data.menu}
        onClose={() => setComping(null)}
        onSent={() => { toast('Complimentary order sent to the kitchen', 'success'); loadRunning(); }}
      />

      {/* Rendered only while printing a bill */}
      <div className="hidden" aria-hidden="true">
        {printDoc && <Receipt ref={printRef} order={printDoc} storeData={store} />}
      </div>
    </div>
  );
};
