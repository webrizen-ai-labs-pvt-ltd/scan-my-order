import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@smo/ui';
import { Cancel01Icon, GiftIcon, Loading03Icon, MinusSignIcon, PlusSignIcon, Search01Icon } from 'hugeicons-react';
import api from '../../lib/api';
import { printKitchenTicket, markPrinted, readPrintSettings } from '../../lib/kitchen-ticket';

const PRESET_REASONS = [
  'Out of stock',
  'Fell or spilled',
  'Bad smell or taste',
  'Wrong dish made',
  'Took too long',
  'Guest complaint',
];

const errorText = (err) => err?.response?.data?.error?.message || err?.message || 'Could not send the complimentary order';
const itemName = (item) => item.displayName || item.customName || item.menuItem?.name || 'Item';
const soldOut = (menuItem) => Boolean(menuItem?.isManuallyDisabled || menuItem?.isSystemDisabled);

/**
 * Sends free food in place of something that went wrong on an order (out of stock, dropped, bad quality...).
 * The free food is a new kitchen order linked to this one; it's billed at ₹0 and shows in the Leakages report.
 *
 * @param {{ storeId: string, storeName?: string, order: object | null, menu?: Array<{ items: object[] }>,
 *           onClose: Function, onSent?: (order: object) => void }} props
 */
export const ComplimentaryDialog = ({ storeId, storeName, order, menu, onClose, onSent }) => {
  const [picked, setPicked] = useState({}); // original line id -> true
  const [give, setGive] = useState([]); // lines to send free
  const [preset, setPreset] = useState('');
  const [details, setDetails] = useState('');
  const [query, setQuery] = useState('');
  const [fetchedMenu, setFetchedMenu] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const detailsRef = useRef(null);
  const orderId = order?.id;

  useEffect(() => {
    setPicked({});
    setGive([]);
    setPreset('');
    setDetails('');
    setQuery('');
    setError('');
  }, [orderId]);

  // Pages without the POS menu loaded (e.g. order history) fetch it here
  useEffect(() => {
    if (!orderId || menu) return undefined;
    let cancelled = false;
    api.get(`/stores/${storeId}/menu`)
      .then(res => { if (!cancelled) setFetchedMenu(res.data.data || []); })
      .catch(() => { if (!cancelled) setFetchedMenu([]); });
    return () => { cancelled = true; };
  }, [orderId, menu, storeId]);

  useEffect(() => {
    if (!orderId) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [orderId, busy, onClose]);

  const allItems = useMemo(() => (menu || fetchedMenu || []).flatMap(c => c.items || []), [menu, fetchedMenu]);
  const menuById = useMemo(() => new Map(allItems.map(i => [i.id, i])), [allItems]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allItems
      .filter(i => i.name.toLowerCase().includes(q) || (i.shortCode && i.shortCode.toLowerCase().startsWith(q)))
      .slice(0, 6);
  }, [allItems, query]);

  if (!order) return null;

  const lines = (order.items || []).filter(i => i.status !== 'REJECTED');

  // Ticking a line offers the same dish again; it can be swapped for another below
  const toggleLine = (item) => {
    const on = !picked[item.id];
    setPicked(prev => ({ ...prev, [item.id]: on }));
    setGive(prev => {
      if (!on) return prev.filter(g => g.fromLineId !== item.id);
      const isCustom = Boolean(item.customName);
      return [...prev, {
        key: `line-${item.id}`,
        fromLineId: item.id,
        name: itemName(item),
        quantity: item.quantity,
        unitValue: item.compValue ?? item.priceAtOrder,
        ...(isCustom
          ? { isCustom: true, customName: item.customName, customPrice: item.priceAtOrder }
          : { menuItemId: item.menuItemId, modifiers: (item.modifiers || []).map(m => m.modifierOptionId).filter(Boolean) }),
      }];
    });
  };

  const addFromMenu = (menuItem) => {
    setGive(prev => {
      const existing = prev.find(g => g.key === `menu-${menuItem.id}`);
      if (existing) return prev.map(g => (g === existing ? { ...g, quantity: g.quantity + 1 } : g));
      return [...prev, { key: `menu-${menuItem.id}`, menuItemId: menuItem.id, name: menuItem.name, quantity: 1, unitValue: menuItem.price, modifiers: [] }];
    });
    setQuery('');
  };

  const changeQty = (key, delta) => setGive(prev => prev
    .map(g => (g.key === key ? { ...g, quantity: g.quantity + delta } : g))
    .filter(g => g.quantity > 0));

  const unavailable = (g) => !g.isCustom && allItems.length > 0 && soldOut(menuById.get(g.menuItemId));
  const isOther = preset === 'Other';
  const reason = isOther ? details.trim() : [preset, details.trim()].filter(Boolean).join(' — ');
  const value = give.reduce((sum, g) => sum + g.unitValue * g.quantity, 0);
  const blocked = give.some(unavailable);
  const valid = reason.length >= 3 && give.length > 0 && !blocked;

  const send = async (print) => {
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/stores/${storeId}/orders`, {
        complimentary: { orderId: order.id, reason, itemIds: Object.keys(picked).filter(id => picked[id]) },
        items: give.map(g => (g.isCustom
          ? { isCustom: true, customName: g.customName, customPrice: g.customPrice, quantity: g.quantity }
          : { menuItemId: g.menuItemId, quantity: g.quantity, modifiers: g.modifiers })),
      });
      const created = res.data.data.order;
      if (print) {
        printKitchenTicket(created, { storeName, paper: readPrintSettings(storeId).paper });
        markPrinted(storeId, [created.id]);
      }
      onSent?.(created);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const label = `Order #${order.id.slice(-6).toUpperCase()}${order.table ? ` · Table ${order.table.tableNumber}` : ''}`;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="complimentary-title">
      <div className="w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-3xl sm:rounded-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-start gap-3 shrink-0">
          <div className="size-10 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
            <GiftIcon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="complimentary-title" className="text-base font-black text-zinc-900 dark:text-zinc-50">Send complimentary food</h2>
            <p className="text-xs text-zinc-500">{label}</p>
          </div>
          <button type="button" aria-label="Close" disabled={busy} onClick={onClose} className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400">
            <Cancel01Icon size={16} />
          </button>
        </div>

        <div className="px-5 pb-4 flex flex-col gap-4 overflow-y-auto">
          <fieldset>
            <legend className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">Which dish had the problem?</legend>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
              {lines.map(item => (
                <label key={item.id} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={Boolean(picked[item.id])} onChange={() => toggleLine(item)} className="size-4 accent-amber-500" />
                  <span className="flex-1 min-w-0 truncate"><span className="font-semibold text-zinc-500">{item.quantity}×</span> {itemName(item)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">Reason <span className="text-rose-600">*</span></legend>
            <div className="flex flex-wrap gap-1.5">
              {[...PRESET_REASONS, 'Other'].map(r => (
                <button key={r} type="button" aria-pressed={preset === r}
                  onClick={() => { setPreset(r); if (r === 'Other') setTimeout(() => detailsRef.current?.focus(), 0); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${preset === r
                    ? 'bg-amber-500 border-amber-500 text-zinc-950'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-amber-400'}`}>
                  {r}
                </button>
              ))}
            </div>
            <input
              ref={detailsRef}
              value={details}
              maxLength={150}
              onChange={e => setDetails(e.target.value)}
              aria-label={isOther ? 'Describe the reason' : 'Details (optional)'}
              placeholder={isOther ? 'What happened?' : 'Details (optional)'}
              className="mt-2 w-full h-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 text-sm outline-none focus:border-amber-400"
            />
          </fieldset>

          <fieldset>
            <legend className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">Send free to the guest</legend>
            {give.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 px-3 py-3 text-xs text-zinc-500">
                Tick a dish above to send the same one again, or search below for a different dish.
              </p>
            ) : (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                {give.map(g => (
                  <div key={g.key} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{g.name}</span>
                      {unavailable(g) && <span className="block text-[11px] font-semibold text-rose-600">Sold out. Remove it and pick another dish.</span>}
                    </span>
                    <span className="text-xs text-zinc-400 tabular-nums line-through">₹{g.unitValue * g.quantity}</span>
                    <span className="flex items-center gap-1">
                      <button type="button" aria-label={`One less ${g.name}`} onClick={() => changeQty(g.key, -1)} className="size-7 rounded-md border border-zinc-200 dark:border-zinc-700 flex items-center justify-center"><MinusSignIcon size={12} /></button>
                      <span className="w-5 text-center font-semibold tabular-nums">{g.quantity}</span>
                      <button type="button" aria-label={`One more ${g.name}`} onClick={() => changeQty(g.key, 1)} className="size-7 rounded-md border border-zinc-200 dark:border-zinc-700 flex items-center justify-center"><PlusSignIcon size={12} /></button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="relative mt-2">
              <Search01Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && matches[0] && !soldOut(matches[0])) { e.preventDefault(); addFromMenu(matches[0]); } }}
                aria-label="Add a different dish"
                placeholder="Add a different dish (name or short code)"
                className="w-full h-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 pl-8 pr-3 text-sm outline-none focus:border-amber-400"
              />
            </div>
            {matches.length > 0 && (
              <div className="mt-1 rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                {matches.map(m => (
                  <button key={m.id} type="button" disabled={soldOut(m)} onClick={() => addFromMenu(m)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed">
                    <span className="truncate">{m.name}</span>
                    <span className="text-xs text-zinc-500 tabular-nums shrink-0">{soldOut(m) ? 'Sold out' : `₹${m.price}`}</span>
                  </button>
                ))}
              </div>
            )}
          </fieldset>

          {error && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 shrink-0">
          <p className="text-xs text-zinc-500 mb-2">
            {give.length > 0
              ? <>Worth <strong className="text-zinc-900 dark:text-zinc-100 tabular-nums">₹{value}</strong>, free for the guest. It goes to the kitchen now and is recorded under Leakages.</>
              : 'The guest is not charged. The original order and its bill stay as they are.'}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Close</Button>
            <Button type="button" variant="outline" disabled={!valid || busy} onClick={() => send(false)}>
              {busy ? <Loading03Icon size={16} className="animate-spin" /> : 'Send'}
            </Button>
            <Button type="button" disabled={!valid || busy} onClick={() => send(true)} className="bg-amber-500 hover:bg-amber-600 text-zinc-950">
              Send & print KOT
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
