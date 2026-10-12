/**
 * What a subscription plan can switch on. One list for the backend (which enforces it) and the
 * apps (which show locks and plan comparisons), so they can never disagree.
 *
 * Everything not listed here is part of every plan: POS, QR menu, kitchen screen, tables,
 * cash and own-UPI payments, order history, sales report and GST bills.
 */

export const PLAN_FEATURES = [
  { key: 'WAITER_PANEL', group: 'Service', label: 'Waiter panel', description: 'Waiters take orders and answer table calls on their phones' },
  { key: 'RESERVATIONS', group: 'Service', label: 'Table reservations', description: 'Book tables ahead and hold them' },
  { key: 'COMPLIMENTARY', group: 'Service', label: 'Complimentary food', description: 'Send free replacements and track what they cost' },

  { key: 'ONLINE_PAYMENTS', group: 'Payments', label: 'Online payments', description: 'Razorpay with your own keys: guests pay from their phone' },
  { key: 'DUES', group: 'Payments', label: 'Dues (credit)', description: 'Let regulars and companies pay later, and collect it' },
  { key: 'CORPORATE_INVOICES', group: 'Payments', label: 'Corporate invoices', description: 'GST invoices in a company’s name' },

  { key: 'INVENTORY', group: 'Control', label: 'Inventory & recipes', description: 'Stock that goes down as dishes are sold' },
  { key: 'LEAKAGES', group: 'Control', label: 'Leakages & audit log', description: 'Every cancellation, edit and refund, by person' },
  { key: 'TABLE_ANALYTICS', group: 'Control', label: 'Table analytics', description: 'Which tables earn, and how long guests stay' },

  { key: 'PROMO_CODES', group: 'Marketing', label: 'Promo codes', description: 'Discount codes for guests' },
  { key: 'CUSTOMERS', group: 'Marketing', label: 'Customer directory', description: 'Everyone who ordered, with visits and spend' },
  { key: 'REVIEWS', group: 'Marketing', label: 'Ratings & reviews', description: 'Guests rate their order and each dish, and are asked for a Google review' },
  { key: 'CAMPAIGNS', group: 'Marketing', label: 'Campaigns', description: 'Send offers to guests’ phones' },
  { key: 'LOYALTY', group: 'Marketing', label: 'Loyalty wallet', description: 'Store credits that bring guests back' },
  { key: 'ITEM_VIDEOS', group: 'Marketing', label: 'Dish videos', description: 'A short video on a dish in the QR menu' },
];

export const PLAN_FEATURE_KEYS = PLAN_FEATURES.map(f => f.key);
export const PLAN_FEATURE_GROUPS = [...new Set(PLAN_FEATURES.map(f => f.group))];

const BY_KEY = new Map(PLAN_FEATURES.map(f => [f.key, f]));
export const planFeature = (key) => BY_KEY.get(key) || null;
export const planFeatureLabel = (key) => BY_KEY.get(key)?.label || key;

/** Keeps only known feature keys, in catalog order, without repeats */
export function cleanFeatureKeys(keys) {
  const wanted = new Set(Array.isArray(keys) ? keys : []);
  return PLAN_FEATURE_KEYS.filter(k => wanted.has(k));
}

// Trial and grace lengths, in days
export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 3;

/**
 * Where a subscription stands.
 * ACTIVE paid and in date · TRIAL free trial · GRACE ended, still working for a few days ·
 * LOCKED ended: no new orders or changes until it is renewed (data stays readable)
 */
export const SUBSCRIPTION_STATES = ['ACTIVE', 'TRIAL', 'GRACE', 'LOCKED'];
