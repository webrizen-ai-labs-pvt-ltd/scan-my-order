import React, { useState } from 'react';
import { Button } from '@smo/ui';
import {
  CashierIcon,
  Delete02Icon,
  Chair01Icon,
  PackageProcess01Icon,
  MinusSignIcon,
  PlusSignIcon,
  Pot02Icon,
  NoteEditIcon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  LockKeyIcon,
} from 'hugeicons-react';
import { computeLineUnitPrice } from '@smo/shared/pricing';

/**
 * Right side of the POS terminal: order type, lines, totals and checkout actions.
 */
export const CartPanel = ({
  lines,
  notes,
  orderType,
  selectedTable,
  totals,
  promo,
  onApplyPromo,
  onRemovePromo,
  onSetOrderType,
  onUpdateQuantity,
  onRemoveLine,
  onSetNote,
  onCustomizeLine,
  onClear,
  onSendToKitchen,
  onCharge,
  onQuickCash,
  busy,
  blockReason,
}) => {
  const [promoInput, setPromoInput] = useState('');
  const [activeNoteId, setActiveNoteId] = useState(null);

  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const isOccupied = Boolean(selectedTable?.isOccupied);
  const disabled = lines.length === 0 || busy || Boolean(blockReason);

  const submitPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (code && onApplyPromo(code)) setPromoInput('');
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden rounded-2xl border border-stone-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
      <div className="shrink-0 flex items-center justify-between border-b border-stone-200/80 px-4 py-3 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center">
            <CashierIcon size={14} />
          </div>
          <h3 className="text-xs font-black text-stone-900 dark:text-zinc-100">Current Order</h3>
          {itemCount > 0 && (
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full tabular-nums">
              {itemCount} items
            </span>
          )}
        </div>
        {lines.length > 0 && (
          <button type="button" title="Clear cart" aria-label="Clear cart" onClick={onClear} className="size-7 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center">
            <Delete02Icon size={15} />
          </button>
        )}
      </div>

      <div className="shrink-0 p-3 border-b border-stone-200/80 dark:border-zinc-800 flex flex-col gap-2">
        <div className="flex items-stretch rounded-full overflow-hidden border border-stone-300 dark:border-zinc-700 divide-x divide-stone-300 dark:divide-zinc-700">
          {[
            { value: 'DINE_IN', label: 'Dine In', icon: Chair01Icon },
            { value: 'TAKEAWAY', label: 'Take Away', icon: PackageProcess01Icon },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={orderType === value}
              onClick={() => onSetOrderType(value)}
              className={`flex-1 flex items-center justify-center gap-1.5 h-10 text-xs font-bold ${orderType === value
                ? 'bg-amber-400 text-amber-950'
                : 'bg-stone-50 text-stone-600 hover:bg-stone-100 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'}`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {orderType === 'DINE_IN' && isOccupied && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
            <div className="flex items-center justify-between gap-2 font-bold">
              <span>Adding to Table {selectedTable.tableNumber}</span>
              {selectedTable.activePin && (
                <span className="inline-flex items-center gap-1 rounded-md bg-white/70 px-1.5 py-0.5 font-mono dark:bg-blue-900/40">
                  <LockKeyIcon size={11} /> PIN {selectedTable.activePin}
                </span>
              )}
            </div>
            <div className="mt-0.5 text-blue-800/80 dark:text-blue-300/80">
              {selectedTable.unpaidTotal > 0
                ? `Running bill ₹${selectedTable.unpaidTotal} across ${selectedTable.unpaidOrderCount} order(s). New items join the same bill.`
                : 'New items join this table’s open session — no PIN needed.'}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col gap-2">
        {lines.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-stone-400 dark:text-zinc-500 py-8">
            <p className="text-xs font-bold text-stone-600 dark:text-zinc-400">Cart is empty</p>
            <p className="text-[11px] mt-0.5">Tap any menu item to start</p>
          </div>
        ) : lines.map(line => {
          const unit = computeLineUnitPrice(line);
          const isNoteOpen = activeNoteId === line.lineId;
          return (
            <div key={line.lineId} className="rounded-xl border border-stone-200/80 bg-stone-50/50 dark:border-zinc-800/80 dark:bg-zinc-800/30 p-2.5">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-xs font-bold text-stone-900 dark:text-zinc-100 truncate">{line.customName || line.menuItem?.name}</h4>
                    {line.isCustom && (
                      <span className="px-1.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">Custom</span>
                    )}
                  </div>
                  <div className="text-[10px] text-stone-500 dark:text-zinc-400 truncate">
                    ₹{unit} each
                    {line.modifiers?.length > 0 && <span className="text-amber-700 dark:text-amber-400"> · {line.modifiers.map(m => m.name).join(', ')}</span>}
                  </div>
                  {line.customIngredients?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {line.customIngredients.map((ing, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          +{ing.name} ({ing.quantity}{ing.unit}){Number(ing.price) > 0 ? ` · ₹${ing.price}` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                  {notes[line.lineId] && !isNoteOpen && (
                    <p className="text-[10px] italic text-amber-700 dark:text-amber-400 truncate mt-0.5">“{notes[line.lineId]}”</p>
                  )}
                </div>
                <span className="shrink-0 text-xs font-black tabular-nums">₹{unit * line.quantity}</span>
                <div className="flex shrink-0 items-center rounded-lg border border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                  <button type="button" aria-label="Decrease quantity" onClick={() => onUpdateQuantity(line.lineId, -1)} className="p-1 text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-l-lg">
                    <MinusSignIcon size={12} />
                  </button>
                  <span className="w-5 text-center text-[11px] font-black tabular-nums">{line.quantity}</span>
                  <button type="button" aria-label="Increase quantity" onClick={() => onUpdateQuantity(line.lineId, 1)} className="p-1 text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-r-lg">
                    <PlusSignIcon size={12} />
                  </button>
                </div>
                <button type="button" title="Customize ingredients" aria-label="Customize ingredients" onClick={() => onCustomizeLine(line)}
                  className={`shrink-0 size-6 rounded-md flex items-center justify-center ${line.customIngredients?.length ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'text-stone-400 hover:bg-stone-100 dark:hover:bg-zinc-800'}`}>
                  <Pot02Icon size={13} />
                </button>
                <button type="button" title="Kitchen note" aria-label="Kitchen note" onClick={() => setActiveNoteId(isNoteOpen ? null : line.lineId)}
                  className={`shrink-0 size-6 rounded-md flex items-center justify-center ${isNoteOpen || notes[line.lineId] ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' : 'text-stone-400 hover:bg-stone-100 dark:hover:bg-zinc-800'}`}>
                  <NoteEditIcon size={13} />
                </button>
                <button type="button" title="Remove item" aria-label="Remove item" onClick={() => onRemoveLine(line.lineId)} className="shrink-0 size-6 rounded-md flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40">
                  <Cancel01Icon size={13} />
                </button>
              </div>
              {isNoteOpen && (
                <div className="mt-2 pt-2 border-t border-stone-200/60 dark:border-zinc-700/60 flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={notes[line.lineId] || ''}
                    maxLength={300}
                    onChange={e => onSetNote(line.lineId, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setActiveNoteId(null); }}
                    placeholder="e.g. Less spicy, no onions…"
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-amber-400 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <button type="button" onClick={() => setActiveNoteId(null)} className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 dark:bg-zinc-700 shrink-0">Done</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-stone-200/90 bg-stone-50/80 dark:border-zinc-800 dark:bg-zinc-950/70 p-3 flex flex-col gap-3">
        <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-full pl-3.5 pr-1.5 py-1.5">
          {promo ? (
            <div className="flex items-center justify-between flex-1">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <CheckmarkCircle02Icon size={13} /> {promo.code} applied
              </span>
              <button type="button" aria-label="Remove promo" onClick={onRemovePromo} className="size-7 rounded-full flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40">
                <Cancel01Icon size={13} />
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={promoInput}
                onChange={e => setPromoInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitPromo()}
                placeholder="Promo code"
                aria-label="Promo code"
                disabled={lines.length === 0}
                className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-xs uppercase tracking-wide outline-none placeholder-stone-400 font-medium"
              />
              <button type="button" onClick={submitPromo} disabled={lines.length === 0 || !promoInput.trim()} className="shrink-0 h-8 px-3.5 rounded-full bg-amber-400 text-amber-950 text-[11px] font-bold hover:bg-amber-500 disabled:opacity-30">
                Apply
              </button>
            </>
          )}
        </div>

        <div className="flex flex-col gap-1 text-xs">
          <div className="flex justify-between text-stone-500 dark:text-zinc-400">
            <span>Subtotal</span><span className="font-bold text-stone-800 dark:text-zinc-200 tabular-nums">₹{totals.subTotal}</span>
          </div>
          {totals.discountAmount > 0 && (
            <div className="flex justify-between text-amber-700 dark:text-amber-400 font-semibold">
              <span>Discount</span><span className="tabular-nums">−₹{totals.discountAmount}</span>
            </div>
          )}
          {totals.taxBreakdown.filter(t => t.amount > 0).map(t => (
            <div key={t.name} className="flex justify-between text-stone-500 dark:text-zinc-400">
              <span>{t.name} ({t.rate}%)</span><span className="font-bold text-stone-800 dark:text-zinc-200 tabular-nums">₹{t.amount}</span>
            </div>
          ))}
          <div className="flex justify-between items-baseline pt-1.5 border-t border-dashed border-stone-200 dark:border-zinc-800">
            <span className="font-black text-sm uppercase">Total</span>
            <span className="font-black text-xl tabular-nums">₹{totals.totalAmount}</span>
          </div>
        </div>

        {blockReason && lines.length > 0 && (
          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 text-center">{blockReason}</p>
        )}

        {orderType === 'DINE_IN' ? (
          <>
            <Button size="lg" disabled={disabled} onClick={onSendToKitchen} title="Kitchen ticket now, bill paid later from Tables">
              {busy ? 'Placing…' : isOccupied ? `Add to Table Tab · ₹${totals.totalAmount}` : `Send to Kitchen · Pay Later`}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" disabled={disabled} onClick={onCharge} title="Collect payment for these items now">
                Charge Now
              </Button>
              <Button variant="outline" size="lg" disabled={disabled} onClick={onQuickCash} title="Exact cash received, settle immediately">
                Quick Cash
              </Button>
            </div>
          </>
        ) : (
          <>
            <Button size="lg" disabled={disabled} onClick={onCharge}>
              {busy ? 'Placing…' : `Charge · ₹${totals.totalAmount}`}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" disabled={disabled} onClick={onQuickCash}>Quick Cash</Button>
              <Button variant="outline" size="lg" disabled={disabled} onClick={onSendToKitchen} title="Kitchen ticket now, collect on pickup">
                Pay on Pickup
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
