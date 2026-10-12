import { create } from 'zustand';
import api from './api';

/**
 * What the signed-in user's brand may use: its plan's features and where the subscription
 * stands (ACTIVE, TRIAL, GRACE or LOCKED). Loaded once by the dashboard layout and refreshed
 * when the tab is opened again; the server enforces the same rules, this only shapes the screen.
 */
export const useEntitlements = create((set, get) => ({
  loaded: false,
  state: 'ACTIVE',
  plan: null,
  features: [],
  maxStores: null,
  periodEnd: null,
  graceEndsAt: null,
  daysLeft: null,
  isTrial: false,

  load: async () => {
    try {
      const res = await api.get('/billing/entitlements');
      set({ ...res.data.data, loaded: true });
    } catch {
      // Not knowing must not lock anyone out of the screen: the server still decides
      set({ loaded: get().loaded });
    }
  },

  /** True while entitlements are still loading, so nothing flashes as locked */
  has: (feature) => !get().loaded || get().features.includes(feature),
}));

// Pages that belong to a plan feature (matched by path prefix)
const PAGE_FEATURES = [
  ['/dashboard/inventory', 'INVENTORY'],
  ['/dashboard/waiter', 'WAITER_PANEL'],
  ['/dashboard/reservations', 'RESERVATIONS'],
  ['/dashboard/dues', 'DUES'],
  ['/dashboard/leakages', 'LEAKAGES'],
  ['/dashboard/audit', 'LEAKAGES'],
  ['/dashboard/table-analytics', 'TABLE_ANALYTICS'],
  ['/dashboard/customers', 'CUSTOMERS'],
  ['/dashboard/campaigns', 'CAMPAIGNS'],
  ['/dashboard/reviews', 'REVIEWS'],
];

/** The plan feature a dashboard page needs, or null when it is part of every plan */
export const featureForPath = (path) => PAGE_FEATURES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1] || null;
