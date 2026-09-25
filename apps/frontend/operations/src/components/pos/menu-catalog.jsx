import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search01Icon, Cancel01Icon, PlusSignIcon, MinusSignIcon } from 'hugeicons-react';

/* SVG placeholder for items without photos */
const ItemPlaceholder = ({ name }) => {
  const isDrink = /coffee|tea|latte|brew|shake|drink|juice|beverage|mocha|espresso|cappuccino/i.test(name || '');
  const isDessert = /cake|waffle|cookie|brownie|dessert|pastry|pie|sweet/i.test(name || '');
  return (
    <div className="w-full h-full flex items-center justify-center relative overflow-hidden rounded-xl bg-gradient-to-br from-stone-100 to-stone-200/60 dark:from-zinc-800/80 dark:to-zinc-900/60">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#b45309_1px,transparent_1px)] [background-size:8px_8px]" />
      <svg className="size-12 drop-shadow-sm text-amber-700/60 dark:text-amber-400/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {isDrink ? (
          <>
            <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
            <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
            <line x1="6" y1="2" x2="6" y2="4" /><line x1="10" y1="2" x2="10" y2="4" /><line x1="14" y1="2" x2="14" y2="4" />
          </>
        ) : isDessert ? (
          <>
            <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
            <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" />
            <path d="M2 21h20" /><path d="M7 8v3" /><path d="M12 5v6" /><path d="M17 8v3" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="5" strokeDasharray="3 3" />
            <path d="M12 3v2" /><path d="M12 19v2" />
          </>
        )}
      </svg>
    </div>
  );
};

const DIETARY_DOT = {
  VEG: 'bg-emerald-500',
  NON_VEG: 'bg-rose-500',
  VEGAN: 'bg-teal-400',
  EGG: 'bg-amber-400',
};

/**
 * Left side of the POS terminal: search, categories and item grid.
 */
export const MenuCatalog = ({ menu, lines, onAdd, onDecrement, onOpenCustomDish, toolbar }) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState(() => menu[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef(null);
  const isSearching = searchQuery.trim().length > 0;

  useEffect(() => {
    if (!menu.length) return;
    setSelectedCategoryId(prev => (prev && menu.some(c => c.id === prev) ? prev : menu[0].id));
  }, [menu]);

  // '/' or Ctrl/Cmd+K focuses search, Esc clears it
  useEffect(() => {
    const onKeyDown = (e) => {
      const typing = ['INPUT', 'TEXTAREA'].includes(e.target.tagName);
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'Escape' && e.target === searchRef.current) {
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const items = useMemo(() => {
    if (isSearching) {
      const q = searchQuery.trim().toLowerCase();
      return menu.flatMap(c => c.items || []).filter(item => item.name.toLowerCase().includes(q));
    }
    return menu.find(c => c.id === selectedCategoryId)?.items || [];
  }, [menu, selectedCategoryId, isSearching, searchQuery]);

  const plainLineFor = (item) => lines.find(l => !l.isCustom && l.menuItem.id === item.id && l.modifiers.length === 0);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden gap-3">
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-[minmax(0,1fr)_170px_210px] gap-2">
        <div className="relative col-span-2 lg:col-span-1">
          <div className="h-10 rounded-l-full bg-white dark:bg-zinc-900 border border-stone-200/90 dark:border-zinc-800 shadow-xs flex items-center pl-4 pr-1.5 gap-3">
            <Search01Icon size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <input
              ref={searchRef}
              type="text"
              aria-label="Search menu"
              placeholder="Search dishes, drinks, or items… ('/' or Ctrl+K)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-zinc-500 outline-none font-medium py-3"
            />
            {isSearching && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }}
                aria-label="Clear search"
                className="shrink-0 size-7 flex items-center justify-center text-stone-500 hover:text-stone-700"
              >
                <Cancel01Icon size={15} />
              </button>
            )}
          </div>
        </div>
        {toolbar}
      </div>

      <div className="shrink-0 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
        <button
          type="button"
          onClick={onOpenCustomDish}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap shadow-xs bg-amber-500/15 border border-amber-500/40 hover:border-amber-500 text-amber-900 dark:text-amber-200 hover:bg-amber-500/25"
        >
          <PlusSignIcon size={14} className="text-amber-600 dark:text-amber-400" />
          <span>Open Dish / Custom</span>
        </button>
        {menu.map(cat => {
          const active = selectedCategoryId === cat.id && !isSearching;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => { setSelectedCategoryId(cat.id); setSearchQuery(''); }}
              className={`shrink-0 inline-flex items-center gap-2 rounded-full pl-4 pr-1.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors shadow-xs ${active
                ? 'bg-amber-400 text-amber-950 shadow-md'
                : 'bg-white dark:bg-zinc-900 border border-stone-200/90 dark:border-zinc-800 text-stone-700 dark:text-zinc-300 hover:border-amber-400/60'}`}
            >
              <span className="truncate max-w-[9rem]">{cat.name}</span>
              <span className={`inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full text-[11px] font-bold tabular-nums ${active ? 'bg-amber-950/15' : 'bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-zinc-400'}`}>
                {cat.items?.length || 0}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-xs text-stone-400">
            {isSearching ? 'No items match your search.' : 'No items in this category.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 auto-rows-max pb-3">
            {items.map(item => {
              const isDisabled = item.isManuallyDisabled || item.isSystemDisabled;
              const line = plainLineFor(item);
              const hasOptions = item.modifierGroups?.length > 0;
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={isDisabled ? -1 : 0}
                  aria-disabled={isDisabled}
                  onClick={() => !isDisabled && onAdd(item)}
                  onKeyDown={(e) => {
                    if (!isDisabled && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onAdd(item);
                    }
                  }}
                  className={`group relative h-48 rounded-2xl overflow-hidden border cursor-pointer select-none transition-shadow ${isDisabled
                    ? 'opacity-60 grayscale cursor-not-allowed border-stone-200/80 dark:border-zinc-800/80'
                    : line
                      ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-lg'
                      : 'border-stone-200/80 dark:border-zinc-800/80 hover:border-amber-400/70 hover:shadow-xl'}`}
                >
                  <div className="absolute inset-0">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <ItemPlaceholder name={item.name} />
                    )}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/85 via-black/45 to-transparent pointer-events-none" />
                  <span
                    title={item.dietary}
                    className={`absolute top-2.5 left-2.5 size-3 rounded-full border-2 border-white/90 shadow-sm ${DIETARY_DOT[item.dietary] || 'bg-stone-300'}`}
                  />
                  {line && !isDisabled && (
                    <span className="absolute top-2.5 right-2.5 text-[9px] font-black uppercase tracking-wider text-amber-950 bg-amber-400 px-2 py-0.5 rounded-full">
                      In cart
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-3 flex flex-col gap-2">
                    {hasOptions && !isDisabled && (
                      <span className="self-start text-[9px] font-black tracking-wider uppercase text-amber-200 bg-amber-500/25 border border-amber-300/30 px-1.5 py-0.5 rounded-md">
                        Options
                      </span>
                    )}
                    <h4 className="font-bold text-[13px] leading-snug text-white truncate">{item.name}</h4>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-[15px] text-white tabular-nums">
                        <span className="text-[11px] font-bold text-white/70 mr-0.5">₹</span>{item.price}
                      </span>
                      {!isDisabled && (line && !hasOptions ? (
                        <div onClick={e => e.stopPropagation()} className="flex items-center gap-0.5 bg-amber-400 text-amber-950 rounded-full p-0.5 shadow-md">
                          <button type="button" aria-label={`Remove one ${item.name}`} onClick={() => onDecrement(line.lineId)} className="size-6 rounded-full flex items-center justify-center hover:bg-amber-950/15">
                            <MinusSignIcon size={12} />
                          </button>
                          <span className="text-xs font-black px-1.5 tabular-nums min-w-5 text-center">{line.quantity}</span>
                          <button type="button" aria-label={`Add one ${item.name}`} onClick={() => onAdd(item)} className="size-6 rounded-full flex items-center justify-center hover:bg-amber-950/15">
                            <PlusSignIcon size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); onAdd(item); }}
                          aria-label={`Add ${item.name}`}
                          className="h-7 px-3 rounded-full bg-white/95 hover:bg-amber-400 text-stone-900 text-[11px] font-bold flex items-center gap-1 shadow-md"
                        >
                          <PlusSignIcon size={13} /> Add
                        </button>
                      ))}
                    </div>
                  </div>
                  {isDisabled && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-[10px] font-black tracking-widest text-white uppercase bg-rose-600 px-2.5 py-1 rounded-md">Sold Out</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
