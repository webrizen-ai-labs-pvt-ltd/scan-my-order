import React, { useEffect, useMemo, useState } from 'react';
import { Cancel01Icon, CheckmarkCircle02Icon } from 'hugeicons-react';

/**
 * Picks modifier options for one menu item. Kept as a compact dialog on purpose:
 * cashiers add items many times a minute, so a full page per item would slow them down.
 */
export const ModifierDialog = ({ item, onClose, onConfirm, onError }) => {
  const [selected, setSelected] = useState({});

  useEffect(() => { setSelected({}); }, [item]);

  useEffect(() => {
    if (!item) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [item, onClose]);

  const total = useMemo(() => {
    if (!item) return 0;
    return item.modifierGroups.reduce((sum, g) => (
      sum + g.options.filter(o => (selected[g.id] || []).includes(o.id)).reduce((s, o) => s + o.price, 0)
    ), item.price);
  }, [item, selected]);

  if (!item) return null;

  const toggle = (group, optionId) => {
    setSelected(prev => {
      const current = prev[group.id] || [];
      if (current.includes(optionId)) return { ...prev, [group.id]: current.filter(id => id !== optionId) };
      if (group.maxSelections === 1) return { ...prev, [group.id]: [optionId] };
      if (current.length >= group.maxSelections) return prev;
      return { ...prev, [group.id]: [...current, optionId] };
    });
  };

  const confirm = () => {
    for (const group of item.modifierGroups) {
      if (group.isRequired && (selected[group.id] || []).length < group.minSelections) {
        onError?.(`Please select at least ${group.minSelections} for ${group.name}`);
        return;
      }
    }
    const mods = item.modifierGroups.flatMap(g => g.options.filter(o => (selected[g.id] || []).includes(o.id)));
    onConfirm(item, mods);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Customize ${item.name}`}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] border border-stone-200 dark:border-zinc-800">
        <div className="shrink-0 p-4 border-b border-stone-200 dark:border-zinc-800 flex justify-between items-center bg-stone-50 dark:bg-zinc-800/50">
          <div className="min-w-0">
            <h3 className="font-bold text-base truncate text-stone-900 dark:text-zinc-100">{item.name}</h3>
            <p className="text-xs text-stone-500 dark:text-zinc-400">Select options</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1.5 hover:bg-stone-200 dark:hover:bg-zinc-700 rounded-full">
            <Cancel01Icon size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
          {item.modifierGroups.map(group => {
            const picked = selected[group.id] || [];
            const short = group.isRequired && picked.length < group.minSelections;
            return (
              <div key={group.id} className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-xs text-stone-900 dark:text-zinc-100">{group.name}</h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${short ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' : 'bg-stone-100 text-stone-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                    {group.isRequired ? `Required (min ${group.minSelections})` : 'Optional'} · max {group.maxSelections}
                  </span>
                </div>
                {group.options.map(opt => {
                  const on = picked.includes(opt.id);
                  return (
                    <button
                      type="button"
                      key={opt.id}
                      aria-pressed={on}
                      onClick={() => toggle(group, opt.id)}
                      className={`flex justify-between items-center p-2.5 border rounded-xl ${on ? 'border-amber-400 bg-amber-500/10' : 'border-stone-200 hover:border-stone-300 dark:border-zinc-700'}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`size-4 rounded-full border flex items-center justify-center ${on ? 'bg-amber-400 border-amber-400 text-amber-950' : 'border-stone-300 dark:border-zinc-600'}`}>
                          {on && <CheckmarkCircle02Icon size={12} />}
                        </span>
                        <span className="font-medium text-xs text-stone-900 dark:text-zinc-100">{opt.name}</span>
                      </span>
                      {opt.price > 0 && <span className="text-xs font-bold tabular-nums">+₹{opt.price}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="shrink-0 p-3 border-t border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950">
          <button
            type="button"
            onClick={confirm}
            className="w-full h-11 rounded-full bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold text-xs shadow-md"
          >
            Add to cart · ₹{total}
          </button>
        </div>
      </div>
    </div>
  );
};
