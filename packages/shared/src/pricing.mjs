// Single source of truth for bill arithmetic, shared by the backend and every frontend.
// All amounts are whole rupees (the DB stores Int).
//
// Order of operations (GST-style): promo discount and store credits reduce the
// taxable value, then each tax rule is applied to that reduced value.

const toInt = (n) => Math.round(Number(n) || 0);

/**
 * Promo discount for a given subtotal. Returns 0 when the promo does not apply.
 * @param {number} subTotal
 * @param {{discountType: 'PERCENTAGE'|'FLAT', discountValue: number, maxDiscount?: number|null, minOrderValue?: number}|null} promo
 */
export function computePromoDiscount(subTotal, promo) {
  if (!promo || subTotal <= 0) return 0;
  if (promo.minOrderValue && subTotal < promo.minOrderValue) return 0;

  let amount = promo.discountType === 'PERCENTAGE'
    ? toInt(subTotal * (Number(promo.discountValue) / 100))
    : toInt(promo.discountValue);

  if (promo.maxDiscount && amount > promo.maxDiscount) amount = promo.maxDiscount;
  return Math.max(0, Math.min(amount, subTotal));
}

/**
 * @param {object} input
 * @param {number} input.subTotal        Sum of line totals
 * @param {object|null} [input.promo]    Promo record (see computePromoDiscount)
 * @param {number} [input.walletDiscount] Store credits applied
 * @param {Array<{name: string, rate: number}>} [input.taxRules]
 */
export function computeOrderTotals({ subTotal, promo = null, walletDiscount = 0, taxRules = [] }) {
  const sub = Math.max(0, toInt(subTotal));
  const discountAmount = computePromoDiscount(sub, promo);
  const wallet = Math.max(0, Math.min(toInt(walletDiscount), sub - discountAmount));
  const taxableAmount = sub - discountAmount - wallet;

  const rules = Array.isArray(taxRules) ? taxRules : [];
  const taxBreakdown = rules.map((rule) => ({
    name: rule.name,
    rate: Number(rule.rate) || 0,
    amount: toInt(taxableAmount * ((Number(rule.rate) || 0) / 100)),
  }));
  const taxAmount = taxBreakdown.reduce((sum, t) => sum + t.amount, 0);

  return {
    subTotal: sub,
    discountAmount,
    walletDiscount: wallet,
    taxableAmount,
    taxAmount,
    taxBreakdown,
    totalAmount: taxableAmount + taxAmount,
  };
}

/**
 * Unit price of a cart line (base or custom price + modifiers + priced custom ingredients).
 * Accepts either the POS cart shape ({menuItem, modifiers:[{price}], customIngredients})
 * or a plain {price, modifiers, customIngredients}.
 */
export function computeLineUnitPrice(line) {
  const base = line.customPrice !== undefined && line.customPrice !== null
    ? Number(line.customPrice)
    : Number(line.menuItem?.price ?? line.price ?? 0);
  const mods = (line.modifiers || []).reduce((s, m) => s + (Number(m.price) || 0), 0);
  const ings = (line.customIngredients || []).reduce((s, i) => s + Math.max(0, Number(i.price) || 0), 0);
  return toInt(base + mods + ings);
}

export function computeCartSubTotal(lines) {
  return (lines || []).reduce((sum, line) => sum + computeLineUnitPrice(line) * (Number(line.quantity) || 0), 0);
}

/**
 * Standard NPCI UPI intent string with a pre-filled amount.
 */
export function buildUpiIntent({ vpa, payeeName, amount, note, reference }) {
  // Encode by hand: several UPI apps reject '%40' in the VPA and '+' for spaces
  const enc = (v) => encodeURIComponent(v).replace(/%40/g, '@');
  const parts = [`pa=${enc(vpa)}`];
  if (payeeName) parts.push(`pn=${enc(payeeName)}`);
  parts.push(`am=${Number(amount).toFixed(2)}`, 'cu=INR');
  if (note) parts.push(`tn=${enc(note)}`);
  if (reference) parts.push(`tr=${enc(reference)}`);
  return `upi://pay?${parts.join('&')}`;
}

// Loose VPA check: handle@psp, handle may contain . - _
export const UPI_ID_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/;
