import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Cancel01Icon } from 'hugeicons-react';

/**
 * Lightweight toast queue for the POS. `push(message, type, action?)`.
 */
export function usePosToasts() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((message, type = 'info', action = null) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev.slice(-2), { id, message, type, action }]);
    timers.current.set(id, setTimeout(() => dismiss(id), action ? 7000 : 3500));
  }, [dismiss]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return { toasts, push, dismiss };
}

const TONES = {
  error: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/90 dark:text-rose-200 dark:border-rose-900',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/90 dark:text-emerald-200 dark:border-emerald-900',
  info: 'bg-white text-stone-800 border-stone-200 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700',
};

export const PosToasts = ({ toasts, dismiss }) => (
  <div aria-live="polite" className="pointer-events-none fixed top-16 right-4 z-[100] flex max-w-[340px] flex-col items-end gap-2">
    {toasts.map(t => (
      <div
        key={t.id}
        role="status"
        className={`pointer-events-auto flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold shadow-lg ${TONES[t.type] || TONES.info}`}
      >
        <span className="min-w-0 flex-1">{t.message}</span>
        {t.action && (
          <button
            type="button"
            onClick={() => { t.action.onClick(); dismiss(t.id); }}
            className="shrink-0 rounded px-2 py-0.5 text-[11px] font-bold underline hover:opacity-80"
          >
            {t.action.label}
          </button>
        )}
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={() => dismiss(t.id)}
          className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
        >
          <Cancel01Icon size={14} />
        </button>
      </div>
    ))}
  </div>
);

/** Pull a readable message out of an API error */
export function apiErrorMessage(err, fallback = 'Something went wrong') {
  return err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || fallback;
}
