import { create } from 'zustand';

export const useCartStore = create((set, get) => ({
  items: [],
  storeId: null,

  setStoreId: (id) => {
    const { storeId } = get();
    if (storeId !== id) {
      set({ storeId: id, items: [] }); // Clear cart if switching stores
    }
  },

  addItem: (item, quantity = 1) => {
    set((state) => {
      const existingItem = state.items.find(i => i.menuItemId === item.id);
      if (existingItem) {
        return {
          items: state.items.map(i => 
            i.menuItemId === item.id 
              ? { ...i, quantity: i.quantity + quantity }
              : i
          )
        };
      }
      return {
        items: [...state.items, {
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity,
          dietary: item.dietary
        }]
      };
    });
  },

  updateQuantity: (menuItemId, delta) => {
    set((state) => {
      const newItems = state.items.map(i => {
        if (i.menuItemId === menuItemId) {
          return { ...i, quantity: Math.max(0, i.quantity + delta) };
        }
        return i;
      }).filter(i => i.quantity > 0);
      return { items: newItems };
    });
  },

  clearCart: () => set({ items: [] }),

  getTotalPrice: () => {
    return get().items.reduce((total, item) => total + (item.price * item.quantity), 0);
  },

  getTotalItems: () => {
    return get().items.reduce((total, item) => total + item.quantity, 0);
  }
}));
