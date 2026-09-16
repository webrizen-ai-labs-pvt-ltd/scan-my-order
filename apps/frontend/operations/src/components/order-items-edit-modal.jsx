import React, { useState, useEffect, useMemo } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { 
  Button, 
  Input, 
  Select, 
  SelectTrigger, 
  SelectValue, 
  SelectContent, 
  SelectItem 
} from '@smo/ui';
import { 
  Cancel01Icon, 
  PlusSignIcon, 
  Delete02Icon, 
  Search01Icon, 
  Dish01Icon, 
  CheckmarkBadge01Icon,
  Pot02Icon,
  Shield01Icon,
  AlertCircleIcon,
  RefreshIcon,
  SparklesIcon
} from 'hugeicons-react';
import { PosOpenOrderModal } from './pos-open-order-modal';
import { PosIngredientCustomizerModal } from './pos-ingredient-customizer-modal';

export const OrderItemsEditModal = ({ isOpen, onClose, order, storeId, onSuccess, onOrderUpdated }) => {
  const { user } = useAuthStore();
  const [items, setItems] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [searchMenu, setSearchMenu] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Nested Modals for Open Dish and Ingredient Customization
  const [openOrderModalOpen, setOpenOrderModalOpen] = useState(false);
  const [customizerItem, setCustomizerItem] = useState(null);

  const isManagerOrAdmin = ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER'].includes(user?.role);

  useEffect(() => {
    if (isOpen && order) {
      // Clone order items to local editable state
      const initialItems = (order.items || []).map(i => ({
        id: i.id || `temp-${Math.random()}`,
        menuItemId: i.menuItemId || i.menuItem?.id,
        menuItem: i.menuItem,
        customName: i.customName || null,
        customIngredients: i.customIngredients || [],
        quantity: i.quantity || 1,
        priceAtOrder: i.priceAtOrder,
        kitchenNotes: i.kitchenNotes || '',
        modifiers: (i.modifiers || []).map(m => m.modifierOptionId || m.modifierOption?.id || m)
      }));
      setItems(initialItems);
      setError('');
      setSearchMenu('');
      fetchMenu();
    }
  }, [isOpen, order]);

  const fetchMenu = async () => {
    if (!storeId) return;
    setLoadingMenu(true);
    try {
      const res = await api.get(`/stores/${storeId}/menu`);
      if (res.data.success) {
        // Flatten categories to get all available menu items
        const allItems = (res.data.data || []).flatMap(cat => 
          (cat.items || []).map(item => ({ ...item, categoryName: cat.name }))
        );
        setMenuItems(allItems.filter(i => !i.isManuallyDisabled && !i.isSystemDisabled));
      }
    } catch (err) {
      console.error('Failed to load menu for order edit:', err);
    } finally {
      setLoadingMenu(false);
    }
  };

  if (!isOpen || !order) return null;

  // Quantity updates
  const handleQuantityChange = (index, delta) => {
    setItems(prev => {
      const updated = [...prev];
      const newQty = Math.max(1, updated[index].quantity + delta);
      updated[index] = { ...updated[index], quantity: newQty };
      return updated;
    });
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) {
      setError('An order must contain at least one item. To cancel the order entirely, use order status cancellation.');
      return;
    }
    setError('');
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Add an item from store menu
  const handleAddMenuItem = (menuItem) => {
    setItems(prev => [
      ...prev,
      {
        id: `added-${Date.now()}-${Math.random()}`,
        menuItemId: menuItem.id,
        menuItem,
        customName: null,
        customIngredients: [],
        quantity: 1,
        priceAtOrder: menuItem.price,
        kitchenNotes: '',
        modifiers: []
      }
    ]);
    setSearchMenu('');
  };

  // Add an open custom dish
  const handleAddCustomDish = (customCartItem) => {
    const dishName = customCartItem.customName || customCartItem.name || 'Custom Dish';
    const dishPrice = customCartItem.customPrice !== undefined ? customCartItem.customPrice : (customCartItem.price || 0);
    const dishQuantity = Math.max(1, parseInt(customCartItem.quantity, 10) || 1);
    const dishNotes = customCartItem.kitchenNotes || customCartItem.notes || '';

    setItems(prev => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        menuItemId: null,
        isCustom: true,
        customName: dishName,
        customPrice: dishPrice,
        customIngredients: customCartItem.customIngredients || [],
        menuItem: customCartItem.menuItem || { name: dishName, price: dishPrice },
        quantity: dishQuantity,
        priceAtOrder: dishPrice,
        kitchenNotes: dishNotes,
        modifiers: []
      }
    ]);
  };

  // Save customized ingredients on an item
  const handleSaveCustomizedItem = (updatedItem) => {
    setItems(prev => prev.map(itm => itm.id === updatedItem.id ? updatedItem : itm));
  };

  // Recalculate preview totals
  const subTotal = items.reduce((sum, itm) => {
    const extraIng = (itm.customIngredients || []).reduce((s, ing) => s + (Number(ing.price) || 0), 0);
    const unitPrice = (itm.customPrice !== undefined ? itm.customPrice : itm.priceAtOrder) + extraIng;
    return sum + (unitPrice * itm.quantity);
  }, 0);

  // Filter menu items for quick addition
  const filteredMenuItems = menuItems.filter(m => 
    m.name.toLowerCase().includes(searchMenu.toLowerCase()) ||
    m.categoryName?.toLowerCase().includes(searchMenu.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!isManagerOrAdmin) {
      setError('Access denied. Only managers can modify items in placed orders.');
      return;
    }
    if (items.length === 0) {
      setError('Order must contain at least one item.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        items: items.map(itm => ({
          menuItemId: itm.menuItemId || undefined,
          isCustom: Boolean(itm.isCustom || !itm.menuItemId),
          customName: itm.customName || undefined,
          customPrice: itm.customPrice !== undefined ? itm.customPrice : itm.priceAtOrder,
          customIngredients: itm.customIngredients || [],
          quantity: itm.quantity,
          kitchenNotes: itm.kitchenNotes || '',
          modifiers: itm.modifiers || []
        }))
      };

      const res = await api.put(`/stores/${storeId}/orders/${order.id}/items`, payload);
      if (res.data.success) {
        if (onSuccess) onSuccess(res.data.data);
        if (onOrderUpdated) onOrderUpdated(res.data.data);
        onClose();
      } else {
        setError(res.data.message || 'Failed to update order items.');
      }
    } catch (err) {
      console.error('Update order items error:', err);
      setError(err.response?.data?.message || 'Failed to update order items.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-950/40">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
              <Shield01Icon size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-zinc-100 flex items-center gap-2">
                Update Order Items
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
                  Manager Power
                </span>
              </h2>
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                Order #{order.id.slice(-6).toUpperCase()} &bull; {order.table ? `Table ${order.table.tableNumber}` : order.origin} &bull; Status: <strong className="text-amber-600">{order.status}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 hover:bg-stone-200/50 dark:hover:bg-zinc-800 transition-colors"
          >
            <Cancel01Icon size={18} />
          </button>
        </div>

        {/* Manager Audit Warning Banner */}
        <div className="px-6 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
          <AlertCircleIcon size={15} className="shrink-0 text-amber-600" />
          <span>
            <strong>Manager Directive:</strong> Updating items dynamically resyncs live kitchen tickets in KDS, adjusts raw material inventory, and updates the bill total.
          </span>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 text-xs rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
              {error}
            </div>
          )}

          {/* Current Items List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                Order Items ({items.length})
              </span>
              <span className="text-xs text-stone-400">
                Estimated Subtotal: <strong className="text-stone-900 dark:text-zinc-100">₹{subTotal}</strong>
              </span>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => {
                const displayName = item.customName || item.menuItem?.name || 'Item';
                const extraIngPrice = (item.customIngredients || []).reduce((s, i) => s + (Number(i.price) || 0), 0);
                const unitPrice = (item.customPrice !== undefined ? item.customPrice : item.priceAtOrder) + extraIngPrice;
                const linePrice = unitPrice * item.quantity;

                return (
                  <div 
                    key={item.id || idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-stone-50/80 dark:bg-zinc-800/40 border border-stone-200/70 dark:border-zinc-700/60"
                  >
                    {/* Item Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-stone-900 dark:text-zinc-100 truncate">
                          {displayName}
                        </span>
                        {item.isCustom && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold uppercase">
                            Open Dish
                          </span>
                        )}
                      </div>

                      {/* Custom Ingredients Pills */}
                      {item.customIngredients && item.customIngredients.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.customIngredients.map((ing, ingIdx) => (
                            <span 
                              key={ingIdx}
                              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-medium"
                            >
                              +{ing.quantity}{ing.unit} {ing.name} {ing.price > 0 && `(₹${ing.price})`}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Kitchen Note */}
                      {item.kitchenNotes && (
                        <p className="text-[11px] text-stone-500 dark:text-zinc-400 italic mt-0.5">
                          Note: {item.kitchenNotes}
                        </p>
                      )}

                      {/* Quick Action: Customize Ingredients */}
                      <div className="mt-1.5">
                        <button
                          type="button"
                          onClick={() => setCustomizerItem(item)}
                          className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                        >
                          <Pot02Icon size={12} />
                          <span>Customize Ingredients / Recipe</span>
                        </button>
                      </div>
                    </div>

                    {/* Quantity Controls & Line Total */}
                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-stone-200 dark:border-zinc-700">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="size-7 p-0 font-bold text-xs rounded-lg"
                          onClick={() => handleQuantityChange(idx, -1)}
                        >
                          -
                        </Button>
                        <span className="w-7 text-center font-bold text-xs">{item.quantity}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="size-7 p-0 font-bold text-xs rounded-lg"
                          onClick={() => handleQuantityChange(idx, 1)}
                        >
                          +
                        </Button>
                      </div>

                      <div className="text-right min-w-[70px]">
                        <span className="text-xs font-bold text-stone-900 dark:text-zinc-100 block">
                          ₹{linePrice}
                        </span>
                        <span className="text-[10px] text-stone-400">
                          (₹{unitPrice} ea)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="size-8 text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg flex items-center justify-center transition-colors"
                        title="Remove item"
                      >
                        <Delete02Icon size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add New Items Area */}
          <div className="pt-4 border-t border-stone-100 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                Add Items to Placed Order
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpenOrderModalOpen(true)}
                className="h-8 text-xs font-bold rounded-xl border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-center gap-1.5"
              >
                <SparklesIcon size={13} className="text-amber-500" />
                <span>+ Add Open Custom Dish</span>
              </Button>
            </div>

            {/* Menu Search */}
            <div className="relative">
              <Search01Icon size={14} className="absolute left-3 top-3 text-stone-400" />
              <Input
                value={searchMenu}
                onChange={e => setSearchMenu(e.target.value)}
                placeholder="Search menu items to add to this order..."
                className="h-9 pl-8 text-xs rounded-xl bg-stone-50/50 dark:bg-zinc-800/60"
              />
            </div>

            {/* Menu Items Quick Pick */}
            {searchMenu.trim() && (
              <div className="p-2 rounded-xl bg-stone-50 dark:bg-zinc-950/60 border border-stone-200 dark:border-zinc-800 max-h-40 overflow-y-auto space-y-1">
                {filteredMenuItems.slice(0, 8).map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleAddMenuItem(m)}
                    className="w-full flex items-center justify-between p-2 rounded-lg text-xs bg-white dark:bg-zinc-900 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-stone-200/60 dark:border-zinc-800 text-left transition-colors"
                  >
                    <div>
                      <span className="font-bold text-stone-900 dark:text-zinc-100">{m.name}</span>
                      <span className="text-[10px] text-stone-400 ml-2 font-normal">({m.categoryName})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-600">₹{m.price}</span>
                      <PlusSignIcon size={14} className="text-amber-600" />
                    </div>
                  </button>
                ))}
                {filteredMenuItems.length === 0 && (
                  <div className="text-center py-2 text-xs text-stone-400">
                    No menu items matching "{searchMenu}"
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-stone-100 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-950/40">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="h-10 px-4 text-xs font-semibold rounded-xl"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || items.length === 0}
            className="h-10 px-6 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-md flex items-center gap-2"
          >
            {submitting ? (
              <>
                <RefreshIcon size={16} className="animate-spin" />
                <span>Updating Order...</span>
              </>
            ) : (
              <>
                <CheckmarkBadge01Icon size={16} />
                <span>Save & Update Order (₹{subTotal})</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Nested Open Order Modal */}
      <PosOpenOrderModal
        isOpen={openOrderModalOpen}
        onClose={() => setOpenOrderModalOpen(false)}
        storeId={storeId}
        onAddToCart={handleAddCustomDish}
      />

      {/* Nested Ingredient Customizer Modal */}
      {customizerItem && (
        <PosIngredientCustomizerModal
          isOpen={Boolean(customizerItem)}
          onClose={() => setCustomizerItem(null)}
          storeId={storeId}
          item={customizerItem}
          onSave={handleSaveCustomizedItem}
        />
      )}
    </div>
  );
};
