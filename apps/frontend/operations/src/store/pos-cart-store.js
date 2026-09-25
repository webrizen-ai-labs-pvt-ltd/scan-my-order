import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/* Stable, collision-free line ids */
let lineCounter = 0;
const createLineId = () => `ln_${Date.now().toString(36)}_${(lineCounter++).toString(36)}`;

const emptyCart = {
  lines: [],
  notes: {},
  orderType: 'DINE_IN',
  tableId: '',
  customerName: '',
  promo: null,
};

/**
 * POS cart shared by all /dashboard/pos child pages (terminal, custom dish, tables),
 * so moving between pages never loses the order being built. Kept per browser tab.
 */
export const usePosCartStore = create(
  persist(
    (set, get) => ({
      storeId: null,
      ...emptyCart,

      /** Switch store: a cart never carries across stores */
      bindStore: (storeId) => {
        if (get().storeId !== storeId) set({ storeId, ...emptyCart });
      },

      addItem: (menuItem, modifiers = []) => set((state) => {
        if (modifiers.length === 0) {
          const existing = state.lines.find(l => !l.isCustom && l.menuItem.id === menuItem.id && l.modifiers.length === 0);
          if (existing) {
            return { lines: state.lines.map(l => (l.lineId === existing.lineId ? { ...l, quantity: l.quantity + 1 } : l)) };
          }
        }
        return { lines: [...state.lines, { lineId: createLineId(), menuItem, quantity: 1, modifiers }] };
      }),

      addCustomDish: (dish) => {
        const lineId = createLineId();
        const name = dish.name || dish.customName || 'Custom Dish';
        const price = Math.max(0, Math.round(Number(dish.price ?? dish.customPrice ?? 0)));
        set((state) => ({
          lines: [...state.lines, {
            lineId,
            menuItem: { id: `custom_${lineId}`, name, price, dietary: dish.dietary || 'VEG', modifierGroups: [] },
            quantity: Math.max(1, parseInt(dish.quantity, 10) || 1),
            modifiers: [],
            isCustom: true,
            customName: name,
            customPrice: price,
            customIngredients: dish.customIngredients || [],
          }],
          notes: dish.notes || dish.kitchenNotes
            ? { ...state.notes, [lineId]: dish.notes || dish.kitchenNotes }
            : state.notes,
        }));
        return lineId;
      },

      updateQuantity: (lineId, delta) => set((state) => {
        const line = state.lines.find(l => l.lineId === lineId);
        if (!line) return {};
        const quantity = line.quantity + delta;
        if (quantity <= 0) {
          const notes = { ...state.notes };
          delete notes[lineId];
          return { lines: state.lines.filter(l => l.lineId !== lineId), notes };
        }
        return { lines: state.lines.map(l => (l.lineId === lineId ? { ...l, quantity: Math.min(quantity, 99) } : l)) };
      }),

      removeLine: (lineId) => set((state) => {
        const notes = { ...state.notes };
        delete notes[lineId];
        return { lines: state.lines.filter(l => l.lineId !== lineId), notes };
      }),

      setNote: (lineId, note) => set((state) => ({ notes: { ...state.notes, [lineId]: note } })),

      setLineIngredients: (lineId, customIngredients, note) => set((state) => ({
        lines: state.lines.map(l => (l.lineId === lineId ? { ...l, customIngredients } : l)),
        notes: note !== undefined ? { ...state.notes, [lineId]: note } : state.notes,
      })),

      setOrderType: (orderType) => set(orderType === 'TAKEAWAY' ? { orderType, tableId: '' } : { orderType }),
      setTableId: (tableId) => set({ tableId, orderType: tableId ? 'DINE_IN' : get().orderType }),
      setCustomerName: (customerName) => set({ customerName }),
      setPromo: (promo) => set({ promo }),

      clear: () => set({ ...emptyCart }),
      snapshot: () => {
        const { lines, notes, orderType, tableId, customerName, promo } = get();
        return { lines, notes, orderType, tableId, customerName, promo };
      },
      restore: (snap) => set({ ...snap }),
    }),
    {
      name: 'smo-pos-cart',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

/** Payload lines for POST /orders */
export function toOrderItems(lines, notes) {
  return lines.map((l) => ({
    menuItemId: l.isCustom ? undefined : l.menuItem.id,
    quantity: l.quantity,
    modifiers: (l.modifiers || []).map(m => m.id),
    notes: notes[l.lineId] || undefined,
    isCustom: l.isCustom || undefined,
    customName: l.customName || undefined,
    customPrice: l.isCustom ? l.customPrice : undefined,
    customIngredients: l.customIngredients?.length ? l.customIngredients : undefined,
  }));
}
