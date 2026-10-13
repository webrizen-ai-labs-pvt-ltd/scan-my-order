/* Formatting and class names shared by the Advanced inventory screens */

export const card = 'rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900';
export const eyebrow = 'text-[11px] font-semibold uppercase tracking-wider text-zinc-500';
export const field = 'h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 text-sm outline-none focus:border-amber-500 disabled:opacity-60';
export const primary = '!bg-none !bg-amber-400 hover:!bg-amber-500 !text-zinc-950 !border-amber-400';

const UNIT = { KG: 'kg', GRAM: 'g', LITER: 'L', MILLILITER: 'ml', PIECE: 'pc', DOZEN: 'dozen' };
export const UNIT_NAMES = { KG: 'Kilogram (kg)', GRAM: 'Gram (g)', LITER: 'Litre (L)', MILLILITER: 'Millilitre (ml)', PIECE: 'Piece', DOZEN: 'Dozen' };
export const unit = (u) => UNIT[u] || String(u || '').toLowerCase();

/** 12.5 → "12.5", 3 → "3": quantities never show needless decimals */
export const qty = (n) => Number(Number(n || 0).toFixed(3)).toLocaleString('en-IN');
export const amount = (n, u) => `${qty(n)} ${unit(u)}`;
export const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—');
export const dayAndTime = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const errorText = (err, fallback) => err?.response?.data?.error?.message || err?.message || fallback;

/** "YYYY-MM-DD" for a date input, `days` from today (local time) */
export const dateInput = (days = 0) => {
  const d = new Date(Date.now() + days * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** When a lot must be used by, in words a kitchen uses */
export function lotDeadline(lot) {
  if (lot.daysLeft === null || lot.daysLeft === undefined) return 'No use-by date';
  if (lot.daysLeft === -1) return 'Expired yesterday';
  if (lot.daysLeft < 0) return `Expired ${Math.abs(lot.daysLeft)} days ago`;
  if (lot.daysLeft === 0) return 'Use by today';
  if (lot.daysLeft === 1) return 'Use by tomorrow';
  return `Use by ${day(lot.expiresAt)} (${lot.daysLeft} days)`;
}

/** A "YYYY-MM-DD" date moved by a number of days */
export const addDays = (date, days) => {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** 7 → "7 am", 13 → "1 pm" */
export const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'am' : 'pm'}`;
export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
