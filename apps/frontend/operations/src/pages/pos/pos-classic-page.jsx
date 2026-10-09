import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search01Icon, Cancel01Icon, Loading03Icon, PauseIcon } from 'hugeicons-react';
import { computeCartSubTotal, computeLineUnitPrice, computeOrderTotals } from '@smo/shared/pricing';
import api from '../../lib/api';
import { usePos } from './pos-layout';
import { usePosCartStore, toOrderItems } from '../../store/pos-cart-store';
import { ModifierDialog } from '../../components/pos/modifier-dialog';
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

const DIET_BORDER = { VEG: 'border-l-emerald-600', VEGAN: 'border-l-emerald-600', EGG: 'border-l-amber-500', NON_VEG: 'border-l-rose-600' };
const PAY_METHODS = [
  { id: 'CASH', label: 'Cash' },
  { id: 'CARD', label: 'Card' },
  { id: 'UPI', label: 'UPI' },
  { id: 'DUE', label: 'Due' },
  { id: 'PART', label: 'Part' },
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
  const loadRunning = useCallback(async () => {
    if (!storeId || !tableId || orderType !== 'DINE_IN') { setRunning(null); return; }
    try {
      const res = await api.get(`/stores/${storeId}/orders/sessions/by-table/${tableId}`);
      setRunning(res.data.data || null);
    } catch {
      setRunning(null);
    }
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
        const key = `${name}|${it.priceAtOrder}`;
        const prev = map.get(key) || { name, quantity: 0, amount: 0 };
        map.set(key, { name, quantity: prev.quantity + it.quantity, amount: prev.amount + it.priceAtOrder * it.quantity });
      }
    }
    return [...map.values()];
  }, [running]);
  const runningTotal = running?.totalAmount || 0;

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
    loadRunning();
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

      // 2. Due and part payments need more details: open the checkout for this bill
      const kind = ref.tableSessionId ? 'table' : 'order';
      const id = ref.tableSessionId || ref.orderId;
      if (payMethod === 'DUE') { navigate(`/dashboard/pos/checkout/${kind}/${id}/dues`); return; }
      if (payMethod === 'PART') { navigate(`/dashboard/pos/checkout/${kind}/${id}`); return; }

      // 3. Cash, card or UPI for what's still due
      const summary = (await api.get(`/stores/${storeId}/payments/summary`, { params: ref })).data.data;
      if (summary.blockers?.length > 0) throw new Error(summary.blockers[0].reason);
      const due = Math.max(0, summary.dueAmount - (summary.pendingAmount || 0));
      if (due > 0) {
        const channel = payMethod === 'UPI' ? 'UPI_OFFLINE' : payMethod;
        await api.post(`/stores/${storeId}/payments`, { ...ref, channel, amount: due, received: payMethod === 'UPI' ? true : undefined });
      }
      toast(`Bill settled · ${rupees(summary.dueAmount)} ${PAY_METHODS.find(m => m.id === payMethod)?.label}`, 'success');
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

  const btn = 'h-11 rounded-md text-[13px] font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5';

  return (
    <div className="h-full grid grid-cols-[150px_minmax(0,1fr)_400px] xl:grid-cols-[180px_minmax(0,1fr)_440px] overflow-hidden bg-zinc-100 dark:bg-zinc-950">
      {/* Categories */}
      <nav aria-label="Categories" className="overflow-y-auto bg-zinc-800 dark:bg-zinc-900">
        {categories.map(cat => {
          const active = !q && activeCategory?.id === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => { setCategoryId(cat.id); setQuery(''); }}
              className={`w-full text-left px-3 py-3 text-[13px] font-semibold border-b border-zinc-700 ${active ? 'bg-amber-400 text-zinc-950' : 'text-zinc-200 hover:bg-zinc-700'}`}
            >
              {cat.name}
            </button>
          );
        })}
      </nav>

      {/* Items */}
      <section aria-label="Items" className="flex flex-col min-h-0 p-2 gap-2">
        <label className="flex items-center gap-2 h-10 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 focus-within:border-amber-500">
          <Search01Icon size={16} className="text-zinc-400 shrink-0" />
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder="Search item or type short code, then Enter  (F2)"
            aria-label="Search item or short code"
            className="flex-1 min-w-0 bg-transparent text-sm outline-none"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-zinc-400 hover:text-zinc-700"><Cancel01Icon size={15} /></button>
          )}
        </label>
       <div className="flex-1 min-h-0 overflow-y-auto">
  {shownItems.length === 0 ? (
    <p className="p-6 text-center text-sm text-zinc-500">
      {q ? 'No dish matches.' : 'No dishes in this category.'}
    </p>
  ) : (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 content-start">
      {shownItems.map(item => {
        const soldOut = item.isManuallyDisabled || item.isSystemDisabled;
        const qty = qtyInCart.get(item.id) ?? 0;
        const dietBorder = DIET_BORDER[item.dietary] || 'border-l-zinc-400';

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => addItem(item)}
            disabled={soldOut}
            aria-label={`${item.name}, ${rupees(item.price)}${qty ? `, ${qty} in cart` : ''}${soldOut ? ', sold out' : ''}`}
            className={[
              'group relative flex h-[72px] flex-col justify-between overflow-hidden rounded-lg',
              'border border-zinc-200 border-l-4 dark:border-zinc-800',
              dietBorder,
              'bg-white px-2.5 py-2 text-left shadow-sm',
              'transition-all duration-150',
              'hover:border-zinc-300 hover:bg-amber-50 hover:shadow',
              'active:translate-y-0',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1',
              'disabled:pointer-events-none disabled:opacity-50',
              'dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:focus-visible:ring-offset-zinc-950',
            ].join(' ')}
          >
            {/* name — reserves space for the qty badge only when present */}
            <span className={`line-clamp-2 break-words text-[13px] font-semibold leading-tight text-zinc-900 dark:text-zinc-100 ${qty > 0 ? 'pr-6' : ''}`}>
              {item.name}
            </span>

            {/* bottom row — flex instead of absolute, so price & code can't collide */}
            <span className="flex items-baseline justify-between gap-2">
              <span className={`text-[11px] tabular-nums ${soldOut ? 'font-semibold text-red-500' : 'text-zinc-500'}`}>
                {soldOut ? 'Sold out' : rupees(item.price)}
              </span>
              {item.shortCode && (
                <span className="shrink-0 font-mono text-[10px] text-zinc-400">
                  {item.shortCode}
                </span>
              )}
            </span>

            {/* qty badge */}
            {qty > 0 && !soldOut && (
              <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-black tabular-nums text-zinc-950 shadow-sm ring-2 ring-white dark:ring-zinc-900">
                {qty}
              </span>
            )}
          </button>
        );
      })}
    </div>
  )}
</div>
      </section>

      {/* Bill */}
      <section aria-label="Bill" className="relative flex flex-col min-h-0 bg-white dark:bg-zinc-900 border-l border-zinc-300 dark:border-zinc-800">
        <div className="grid grid-cols-2 shrink-0">
          {[['DINE_IN', 'Dine In'], ['TAKEAWAY', 'Takeaway']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => cart.setOrderType(id)}
              className={`h-10 text-sm font-bold ${orderType === id ? 'bg-rose-600 text-white' : 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="shrink-0 p-2 flex flex-col gap-1.5 border-b border-zinc-200 dark:border-zinc-800">
          {orderType === 'DINE_IN' && (
            <button
              type="button"
              onClick={() => setTablePicker(v => !v)}
              className={`h-9 rounded-md border px-3 text-left text-sm font-bold flex items-center justify-between ${selectedTable ? 'border-zinc-300 dark:border-zinc-700' : 'border-amber-500 text-amber-700 dark:text-amber-400'}`}
            >
              <span>{selectedTable ? `Table ${selectedTable.tableNumber}` : 'Select table'}</span>
              {running && <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Running {rupees(runningTotal)}</span>}
            </button>
          )}
          {tablePicker && orderType === 'DINE_IN' && (
            <div className="grid grid-cols-5 gap-1 max-h-40 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800 p-1">
              {data.tables.map(t => {
                const busyTable = t.isOccupied || t.unpaidTotal > 0;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { cart.setTableId(t.id); setTablePicker(false); }}
                    className={`h-11 rounded text-xs font-bold leading-tight ${t.id === tableId ? 'ring-2 ring-rose-600' : ''} ${busyTable ? 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200' : t.isReserved ? 'bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-200' : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'}`}
                    title={busyTable ? `Running ${rupees(t.unpaidTotal)}` : t.isReserved ? 'Reserved' : 'Free'}
                  >
                    {t.tableNumber}
                    {t.unpaidTotal > 0 && <span className="block text-[9px] font-semibold">{rupees(t.unpaidTotal)}</span>}
                  </button>
                );
              })}
              {data.tables.length === 0 && <p className="col-span-5 p-2 text-xs text-zinc-500">No tables set up.</p>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            <input value={customerName} onChange={e => cart.setCustomerName(e.target.value)} placeholder="Customer name" aria-label="Customer name" maxLength={60} className="h-8 rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-2 text-xs outline-none focus:border-zinc-400" />
            <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Mobile" aria-label="Customer mobile" inputMode="tel" maxLength={15} className="h-8 rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-2 text-xs outline-none focus:border-zinc-400" />
          </div>
        </div>

        {/* Lines */}
        <div className="grid grid-cols-[minmax(0,1fr)_92px_70px] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <span>Item</span><span className="text-center">Qty</span><span className="text-right">Price</span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {runningLines.length > 0 && (
            <div className="bg-zinc-50 dark:bg-zinc-950/50">
              <p className="px-3 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">Already sent to kitchen</p>
              {runningLines.map((r, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_92px_70px] px-3 py-1 text-xs text-zinc-500">
                  <span className="truncate">{r.name}</span><span className="text-center tabular-nums">{r.quantity}</span><span className="text-right tabular-nums">{r.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          {lines.length === 0 && runningLines.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-400">No item selected. Tap a dish or type its code.</p>
          ) : lines.map(line => (
            <div key={line.lineId} className="grid grid-cols-[minmax(0,1fr)_92px_70px] items-center px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800 text-sm">
              <button type="button" onClick={() => editNote(line)} className="min-w-0 text-left" title="Add a note for the kitchen">
                <span className="block truncate font-medium text-zinc-900 dark:text-zinc-100">{line.customName || line.menuItem?.name}</span>
                {(line.modifiers?.length > 0 || notes[line.lineId]) && (
                  <span className="block truncate text-[11px] text-zinc-500">
                    {[...(line.modifiers || []).map(m => m.name), notes[line.lineId] && `“${notes[line.lineId]}”`].filter(Boolean).join(', ')}
                  </span>
                )}
              </button>
              <div className="flex items-center justify-center gap-1">
                <button type="button" onClick={() => cart.updateQuantity(line.lineId, -1)} aria-label="One less" className="size-7 rounded bg-zinc-200 dark:bg-zinc-800 font-bold">−</button>
                <span className="w-6 text-center font-bold tabular-nums">{line.quantity}</span>
                <button type="button" onClick={() => cart.updateQuantity(line.lineId, 1)} aria-label="One more" className="size-7 rounded bg-zinc-200 dark:bg-zinc-800 font-bold">+</button>
              </div>
              <span className="text-right tabular-nums">{(computeLineUnitPrice(line) * line.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Totals, payment and actions */}
        <div className="shrink-0 border-t border-zinc-300 dark:border-zinc-700 bg-zinc-800 text-zinc-100">
          <div className="px-3 py-2 text-xs flex flex-col gap-0.5">
            {lines.length > 0 && (
              <>
                <div className="flex justify-between text-zinc-300"><span>New items</span><span className="tabular-nums">{rupees(totals.subTotal)}</span></div>
                {totals.discountAmount > 0 && <div className="flex justify-between text-emerald-300"><span>Discount ({promo?.code})</span><span className="tabular-nums">−{rupees(totals.discountAmount)}</span></div>}
                {totals.taxAmount > 0 && <div className="flex justify-between text-zinc-300"><span>Tax</span><span className="tabular-nums">{rupees(totals.taxAmount)}</span></div>}
              </>
            )}
            {runningTotal > 0 && <div className="flex justify-between text-zinc-300"><span>Running bill</span><span className="tabular-nums">{rupees(runningTotal)}</span></div>}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-3">
                {promo ? (
                  <button type="button" onClick={() => cart.setPromo(null)} className="text-[11px] text-emerald-300 underline">Remove {promo.code}</button>
                ) : promoOpen ? (
                  <span className="flex items-center gap-1">
                    <input autoFocus value={promoInput} onChange={e => setPromoInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyPromo()} placeholder="Code" className="h-7 w-24 rounded bg-zinc-700 px-2 text-xs uppercase outline-none" aria-label="Promo code" />
                    <button type="button" onClick={applyPromo} className="h-7 rounded bg-zinc-600 px-2 text-[11px] font-bold">Apply</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setPromoOpen(true)} disabled={lines.length === 0} className="text-[11px] text-zinc-300 underline disabled:opacity-40">Discount code</button>
                )}
              </div>
              <span className="text-lg font-black tabular-nums">Total <span className="text-amber-400">{rupees(payable)}</span></span>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1 px-2 pb-2" role="radiogroup" aria-label="Payment method">
            {PAY_METHODS.map(m => (
              <label key={m.id} className={`h-8 rounded-md flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer ${payMethod === m.id ? 'bg-white text-zinc-900' : 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600'}`}>
                <input type="radio" name="pay-method" value={m.id} checked={payMethod === m.id} onChange={() => setPayMethod(m.id)} className="accent-rose-600" />
                {m.label}
              </label>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-1.5 px-2 pb-2">
            <button type="button" onClick={() => save(false)} disabled={Boolean(busy)} className={`${btn} bg-rose-600 hover:bg-rose-700 text-white`}>
              {busy === 'SAVE' ? <Loading03Icon size={15} className="animate-spin" /> : 'Save'}
            </button>
            <button type="button" onClick={() => save(true)} disabled={Boolean(busy)} className={`${btn} bg-rose-600 hover:bg-rose-700 text-white`} title="F8">
              {busy === 'SAVE_PRINT' ? <Loading03Icon size={15} className="animate-spin" /> : 'Save & Print'}
            </button>
            {orderType === 'DINE_IN' && running && lines.length === 0 ? (
              <button type="button" onClick={printRunningBill} disabled={Boolean(busy)} className={`${btn} bg-zinc-200 hover:bg-white text-zinc-900`}>
                {busy === 'BILL' ? <Loading03Icon size={15} className="animate-spin" /> : 'Print Bill'}
              </button>
            ) : (
              <button type="button" onClick={hold} disabled={Boolean(busy)} className={`${btn} bg-zinc-200 hover:bg-white text-zinc-900`} title="F9">
                <PauseIcon size={14} /> {lines.length > 0 ? 'Hold' : `Held (${held.length})`}
              </button>
            )}
            <button type="button" onClick={() => sendKot(false)} disabled={Boolean(busy)} className={`${btn} bg-zinc-600 hover:bg-zinc-500 text-white`}>
              {busy === 'KOT' ? <Loading03Icon size={15} className="animate-spin" /> : 'KOT'}
            </button>
            <button type="button" onClick={() => sendKot(true)} disabled={Boolean(busy)} className={`${btn} bg-zinc-600 hover:bg-zinc-500 text-white`} title="F7">
              {busy === 'KOT_PRINT' ? <Loading03Icon size={15} className="animate-spin" /> : 'KOT & Print'}
            </button>
            <button type="button" onClick={() => { const snap = cart.snapshot(); cart.clear(); toast('Bill cleared', 'info', { label: 'Undo', onClick: () => cart.restore(snap) }); }} disabled={Boolean(busy) || lines.length === 0} className={`${btn} border border-zinc-500 text-zinc-200 hover:bg-zinc-700`}>
              Clear
            </button>
          </div>
        </div>

        {/* Held bills */}
        {heldOpen && (
          <div className="absolute right-2 bottom-40 z-30 w-[380px] max-h-80 overflow-y-auto rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2">
            <div className="flex items-center justify-between px-1 pb-1.5">
              <span className="text-sm font-bold">Held bills</span>
              <button type="button" onClick={() => setHeldOpen(false)} aria-label="Close" className="text-zinc-400 hover:text-zinc-700"><Cancel01Icon size={15} /></button>
            </div>
            {held.length === 0 ? (
              <p className="p-3 text-center text-xs text-zinc-500">No held bills on this device.</p>
            ) : held.map(h => (
              <div key={h.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                <button type="button" onClick={() => resumeHeld(h)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold">{h.label}</span>
                  <span className="block text-[11px] text-zinc-500">{rupees(h.total)} · {h.snapshot.lines.length} items · {new Date(h.savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                </button>
                <button type="button" onClick={() => dropHeld(h)} aria-label={`Delete ${h.label}`} className="text-xs text-zinc-400 hover:text-rose-600">Delete</button>
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

      {/* Rendered only while printing a bill */}
      <div className="hidden" aria-hidden="true">
        {printDoc && <Receipt ref={printRef} order={printDoc} storeData={store} />}
      </div>
    </div>
  );
};

