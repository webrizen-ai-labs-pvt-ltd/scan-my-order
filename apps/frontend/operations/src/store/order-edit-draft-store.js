import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

let draftCounter = 0;
export const createDraftLineId = () => `edit_${Date.now().toString(36)}_${(draftCounter++).toString(36)}`;

/**
 * Unsaved edits to placed orders, keyed by order id. Kept outside the edit page so the
 * custom-dish page can add a dish and hand control back without losing changes.
 */
export const useOrderEditDraftStore = create(
  persist(
    (set, get) => ({
      drafts: {},

      getDraft: (orderId) => get().drafts[orderId] || null,
      setDraft: (orderId, lines) => set((s) => ({ drafts: { ...s.drafts, [orderId]: lines } })),
      appendLine: (orderId, line) => set((s) => ({
        drafts: { ...s.drafts, [orderId]: [...(s.drafts[orderId] || []), { ...line, id: line.id || createDraftLineId() }] },
      })),
      clearDraft: (orderId) => set((s) => {
        const drafts = { ...s.drafts };
        delete drafts[orderId];
        return { drafts };
      }),
    }),
    {
      name: 'smo-order-edit-drafts',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

/**
 * Draft line from an existing order item. priceAtOrder already includes priced
 * ingredients, so keep the base separately to avoid counting them twice.
 */
export function draftLineFromOrderItem(item) {
  const ingTotal = (item.customIngredients || []).reduce((s, ing) => s + (Number(ing.price) || 0), 0);
  const isCustom = Boolean(item.customName);
  return {
    id: item.id || createDraftLineId(),
    // Lets the server keep the price this line was originally sold at
    orderItemId: item.id,
    // Custom dishes live on the store's system "open item"; re-send them as custom
    menuItemId: isCustom ? null : (item.menuItemId || item.menuItem?.id),
    isCustom,
    name: item.customName || item.menuItem?.name || 'Item',
    dietary: item.menuItem?.dietary,
    customPrice: isCustom ? item.priceAtOrder - ingTotal : undefined,
    basePrice: item.priceAtOrder - ingTotal,
    customIngredients: item.customIngredients || [],
    quantity: item.quantity || 1,
    kitchenNotes: item.kitchenNotes || '',
    modifiers: (item.modifiers || []).map(m => m.modifierOptionId || m.modifierOption?.id || m),
    modifierNames: (item.modifiers || []).map(m => m.modifierOption?.name).filter(Boolean),
  };
}

export function draftUnitPrice(line) {
  const extra = (line.customIngredients || []).reduce((s, ing) => s + (Number(ing.price) || 0), 0);
  return (line.isCustom ? Number(line.customPrice) || 0 : line.basePrice) + extra;
}

/** Used by the custom-dish page to hand a dish back to an order being edited */
export function appendCustomDishToDraft(orderId, dish) {
  useOrderEditDraftStore.getState().appendLine(orderId, {
    menuItemId: null,
    isCustom: true,
    name: dish.name,
    dietary: dish.dietary,
    customPrice: dish.price,
    basePrice: dish.price,
    customIngredients: dish.customIngredients || [],
    quantity: dish.quantity,
    kitchenNotes: dish.notes || '',
    modifiers: [],
    modifierNames: [],
  });
}
