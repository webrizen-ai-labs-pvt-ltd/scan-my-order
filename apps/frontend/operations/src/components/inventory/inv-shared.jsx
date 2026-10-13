import React, { useEffect } from 'react';
import { Cancel01Icon } from 'hugeicons-react';
import { card } from './inv-format';

/* Small components shared by the Advanced inventory screens */

const STATE_TONE = {
  EXPIRED: 'border-red-300 text-red-700 dark:border-red-500/40 dark:text-red-400',
  SOON: 'border-amber-300 text-amber-700 dark:border-amber-500/40 dark:text-amber-400',
  LOW: 'border-amber-300 text-amber-700 dark:border-amber-500/40 dark:text-amber-400',
  OK: 'border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400',
};
/** A small labelled tag; the label always says what the colour means */
export const Tag = ({ tone = 'OK', children, title }) => (
  <span title={title} className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${STATE_TONE[tone] || STATE_TONE.OK}`}>{children}</span>
);

export const Notice = ({ msg }) => (msg?.text ? (
  <p role={msg.error ? 'alert' : 'status'} className={`${card} px-4 py-2.5 text-sm ${msg.error ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{msg.text}</p>
) : null);

export const Empty = ({ title, children }) => (
  <div className="px-6 py-10 text-center">
    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
    {children && <p className="mt-1 text-sm text-zinc-500 max-w-md mx-auto">{children}</p>}
  </div>
);

/** Dialog used across the inventory screens. Esc closes it unless `busy`. */
export const Modal = ({ title, subtitle, onClose, busy, children, footer, wide = false }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92vh] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-2xl sm:rounded-2xl overflow-hidden`}>
        <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
            {subtitle && <p className="text-sm text-zinc-500">{subtitle}</p>}
          </div>
          <button type="button" aria-label="Close" disabled={busy} onClick={onClose} className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"><Cancel01Icon size={16} /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex flex-col gap-4">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-end gap-2 shrink-0">{footer}</div>}
      </div>
    </div>
  );
};

/** A labelled form field */
export const Field = ({ label, hint, optional, children, className = '' }) => (
  <label className={`flex flex-col gap-1 text-sm font-medium text-zinc-900 dark:text-zinc-100 ${className}`}>
    <span>{label}{optional && <span className="font-normal text-zinc-400"> (optional)</span>}</span>
    {children}
    {hint && <span className="text-xs font-normal text-zinc-500">{hint}</span>}
  </label>
);
