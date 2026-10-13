import React from 'react';
import { Call02Icon } from 'hugeicons-react';

/** A number the phone's dialler accepts: Indian mobiles are stored as 10 digits */
function dialNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return digits.length >= 7 ? digits : null;
}
const spaced = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : String(phone || '');
};

/**
 * Tap to call the guest who placed an order: opens the phone's dialler (or the computer's
 * calling app) with their number. Renders nothing when the order has no number.
 *
 * @param {{ phone?: string, name?: string, compact?: boolean, className?: string }} props
 *        compact: just the icon, for tight rows
 */
export const CallCustomer = ({ phone, name, compact = false, className = '' }) => {
  const number = dialNumber(phone);
  if (!number) return null;
  const who = name ? `${name} on ${spaced(phone)}` : spaced(phone);
  return (
    <a
      href={`tel:${number}`}
      onClick={e => e.stopPropagation()}
      title={`Call ${who}`}
      aria-label={`Call ${who}`}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-zinc-500 ${compact ? 'size-7 justify-center' : 'h-7 px-2.5'} ${className}`}
    >
      <Call02Icon size={13} />
      {!compact && <span className="tabular-nums">{name ? `${name} · ${spaced(phone)}` : spaced(phone)}</span>}
    </a>
  );
};
