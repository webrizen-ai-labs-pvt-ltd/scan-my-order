import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@smo/ui';
import { computeCartSubTotal, computeOrderTotals } from '@smo/shared/pricing';
import api from '../../lib/api';
import { usePos } from './pos-layout';
import { usePosCartStore, toOrderItems } from '../../store/pos-cart-store';
import { MenuCatalog } from '../../components/pos/menu-catalog';
import { CartPanel } from '../../components/pos/cart-panel';
import { ModifierDialog } from '../../components/pos/modifier-dialog';
import { PosIngredientCustomizerModal } from '../../components/pos-ingredient-customizer-modal';
import { apiErrorMessage } from '../../components/pos/pos-toasts';

const tableBadge = (t) => {
  if (t.isOccupied) return { label: t.activePin ? `Occupied · PIN ${t.activePin}` : 'Occupied', tone: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
  if (t.isReserved) return { label: 'Reserved', tone: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20' };
  return { label: 'Free', tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
};

export const PosTerminalPage = () => {
  const { storeId, store, data, toast, subscribe } = usePos();

  // A dish sold out or back on sale anywhere (kitchen, menu editor, another till): refresh the menu
  const reloadMenu = data.reload;
  useEffect(() => subscribe((msg) => {
    if (msg.type === 'MENU_ITEM_AVAILABILITY') reloadMenu();
  }), [subscribe, reloadMenu]);

  const restockItem = async (item) => {
    try {
      await api.patch(`/stores/${storeId}/menu/items/${item.id}/availability`, { available: true });
      await data.reload();
      toast(`${item.name} is back on sale`, 'success');
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not update the item'), 'error');
    }
  };
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const cart = usePosCartStore();
  const { lines, notes, orderType, tableId, customerName, promo } = cart;

  const [modifierItem, setModifierItem] = useState(null);
  const [customizing, setCustomizing] = useState(null);
  const [busy, setBusy] = useState(false);

  // ?table=<id|number> preselects a table (e.g. from the Tables board)
  useEffect(() => {
    const param = searchParams.get('table');
    if (!param || data.tables.length === 0) return;
    const found = data.tables.find(t => t.id === param || String(t.tableNumber) === param);
    if (found) cart.setTableId(found.id);
    searchParams.delete('table');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, data.tables]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedTable = useMemo(() => data.tables.find(t => t.id === tableId) || null, [data.tables, tableId]);

  // Drop a selected table that no longer exists (deleted/deactivated)
  useEffect(() => {
    if (tableId && data.tables.length > 0 && !selectedTable) cart.setTableId('');
  }, [tableId, selectedTable, data.tables.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => computeOrderTotals({
    subTotal: computeCartSubTotal(lines),
    promo,
    taxRules: store?.taxRules,
  }), [lines, promo, store?.taxRules]);

  // A promo can stop applying when the cart shrinks below its minimum
  useEffect(() => {
    if (promo && totals.subTotal < (promo.minOrderValue || 0)) {
      cart.setPromo(null);
      toast(`Promo ${promo.code} removed: minimum order is ₹${promo.minOrderValue}`, 'info');
    }
  }, [promo, totals.subTotal]); // eslint-disable-line react-hooks/exhaustive-deps

  const blockReason = orderType === 'DINE_IN' && !tableId ? 'Select a table for dine-in orders.' : '';

  const handleAdd = useCallback((item) => {
    if (item.isManuallyDisabled || item.isSystemDisabled) return;
    if (item.modifierGroups?.length > 0) setModifierItem(item);
    else cart.addItem(item, []);
  }, [cart]);

  const applyPromo = (code) => {
    const found = data.promos.find(p => p.code === code && p.isActive && (!p.validUntil || new Date(p.validUntil) > new Date()));
    if (!found) {
      toast('Invalid or inactive promo code.', 'error');
      return false;
    }
    if (totals.subTotal < (found.minOrderValue || 0)) {
      toast(`Minimum order value for this promo is ₹${found.minOrderValue}`, 'error');
      return false;
    }
    cart.setPromo(found);
    toast(`Promo ${found.code} applied`, 'success');
    return true;
  };

  const clearCart = () => {
    const snap = cart.snapshot();
    cart.clear();
    toast('Order cleared', 'info', { label: 'Undo', onClick: () => cart.restore(snap) });
  };

  /**
   * @param {'KITCHEN'|'CHARGE'|'QUICK_CASH'} mode
   */
  const placeOrder = async (mode) => {
    if (lines.length === 0 || busy) return;
    if (blockReason) {
      toast(blockReason, 'error');
      return;
    }

    // Other payment options: nothing is placed yet — checkout creates the order
    // once the cashier picks how the guest is paying.
    if (mode === 'CHARGE') {
      navigate('/dashboard/pos/checkout/draft/new');
      return;
    }

    setBusy(true);
    try {
      const payload = {
        type: orderType,
        paymentModel: mode === 'KITCHEN' ? 'POSTPAID' : 'PREPAID',
        customerName: customerName.trim() || undefined,
        tableId: orderType === 'DINE_IN' ? tableId : undefined,
        promoCode: promo?.code,
        items: toOrderItems(lines, notes),
        payNow: mode === 'QUICK_CASH' ? { channel: 'CASH' } : undefined,
      };
      const res = await api.post(`/stores/${storeId}/orders`, payload);
      const { order } = res.data.data;
      const tableNumber = selectedTable?.tableNumber;
      cart.clear();
      data.refreshTables();

      if (mode === 'KITCHEN') {
        toast(tableNumber ? `Sent to kitchen · added to Table ${tableNumber}'s bill` : 'Sent to kitchen', 'success');
      } else {
        navigate(`/dashboard/pos/checkout/order/${order.id}`);
      }
    } catch (err) {
      toast(`Could not place order: ${apiErrorMessage(err)}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const toolbar = (
    <>
      <input
        type="text"
        value={customerName}
        onChange={e => cart.setCustomerName(e.target.value)}
        placeholder="Customer name"
        aria-label="Customer name"
        maxLength={60}
        className="h-10 w-full bg-white dark:bg-zinc-900 border border-stone-200/90 dark:border-zinc-800 shadow-xs px-5 text-xs font-medium outline-none"
      />
      {orderType === 'DINE_IN' ? (
        <Select value={tableId || undefined} onValueChange={cart.setTableId}>
          <SelectTrigger aria-label="Table" className={`h-10 w-full rounded-r-full bg-white dark:bg-zinc-900 px-4 text-xs font-medium ${!tableId ? 'border-amber-400' : 'border-stone-200/90 dark:border-zinc-800'}`}>
            <SelectValue placeholder="Select table" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {data.tables.length === 0 ? (
              <div className="px-3 py-2 text-xs text-stone-400">No tables configured</div>
            ) : data.tables.map(t => {
              const badge = tableBadge(t);
              return (
                <SelectItem key={t.id} value={t.id} className="text-xs py-1.5">
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="font-bold">Table {t.tableNumber}</span>
                    <span className="text-[10px] text-stone-400">({t.capacity || 4}p)</span>
                    <span className={`ml-auto px-1.5 rounded text-[9px] font-bold border ${badge.tone}`}>{badge.label}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      ) : (
        <div className="h-10 w-full rounded-r-full border border-dashed border-stone-200 dark:border-zinc-700 bg-stone-100/50 dark:bg-zinc-800/40 text-[11px] font-medium text-stone-400 flex items-center justify-center">
          Takeaway
        </div>
      )}
    </>
  );

  return (
    <div className="h-full grid grid-cols-[1fr_360px] 2xl:grid-cols-[1fr_400px] gap-3 p-3 overflow-hidden">
      <MenuCatalog
        menu={data.menu}
        onRestock={restockItem}
        lines={lines}
        onAdd={handleAdd}
        onDecrement={(lineId) => cart.updateQuantity(lineId, -1)}
        onOpenCustomDish={() => navigate('/dashboard/pos/custom-dish')}
        toolbar={toolbar}
      />

      <CartPanel
        lines={lines}
        notes={notes}
        orderType={orderType}
        selectedTable={selectedTable}
        totals={totals}
        promo={promo}
        onApplyPromo={applyPromo}
        onRemovePromo={() => cart.setPromo(null)}
        onSetOrderType={cart.setOrderType}
        onUpdateQuantity={cart.updateQuantity}
        onRemoveLine={cart.removeLine}
        onSetNote={cart.setNote}
        onCustomizeLine={(line) => setCustomizing({
          lineId: line.lineId,
          name: line.customName || line.menuItem?.name,
          customIngredients: line.customIngredients || [],
          kitchenNotes: notes[line.lineId] || '',
        })}
        onClear={clearCart}
        onSendToKitchen={() => placeOrder('KITCHEN')}
        onCharge={() => placeOrder('CHARGE')}
        onQuickCash={() => placeOrder('QUICK_CASH')}
        busy={busy}
        blockReason={blockReason}
      />

      <ModifierDialog
        item={modifierItem}
        onClose={() => setModifierItem(null)}
        onConfirm={(item, mods) => { cart.addItem(item, mods); setModifierItem(null); }}
        onError={(msg) => toast(msg, 'error')}
      />

      <PosIngredientCustomizerModal
        isOpen={Boolean(customizing)}
        onClose={() => setCustomizing(null)}
        storeId={storeId}
        item={customizing}
        onSave={(result) => {
          cart.setLineIngredients(result.lineId, result.customIngredients || [], result.kitchenNotes);
          toast('Ingredients updated', 'success');
        }}
      />
    </div>
  );
};
