import React, { useMemo, useRef, useState } from 'react';
import { amount, field } from './inv-format';

/**
 * Reads what was typed into the quick-add box: "PN 10" is a short code and a quantity,
 * "PN" a short code alone, anything else a search by name (a trailing number is the quantity).
 */
function read(text, materials) {
  const typed = text.trim();
  if (!typed) return { matches: [], quantity: null };
  const withQty = typed.match(/^(.*\S)\s+(\d*\.?\d+)$/);
  const words = (withQty ? withQty[1] : typed).toLowerCase();
  const quantity = withQty ? Number(withQty[2]) : null;
  const byCode = materials.find(m => m.shortCode && m.shortCode.toLowerCase() === words);
  if (byCode) return { matches: [byCode], quantity: quantity > 0 ? quantity : null };
  const starts = materials.filter(m => m.name.toLowerCase().startsWith(words));
  const contains = materials.filter(m => !starts.includes(m) && (m.name.toLowerCase().includes(words) || (m.shortCode || '').toLowerCase().startsWith(words)));
  return { matches: [...starts, ...contains].slice(0, 6), quantity: quantity > 0 ? quantity : null };
}

/**
 * Quick-add box for ingredients, built for the keyboard: type a short code and a quantity
 * and press Enter. Typing part of a name works too.
 *
 * @param {{ materials: object[], onAdd: (material: object, quantity: number|null) => void, autoFocus?: boolean }} props
 */
export const ItemPicker = ({ materials, onAdd, autoFocus = false }) => {
  const [text, setText] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef(null);
  const { matches, quantity } = useMemo(() => read(text, materials), [text, materials]);
  const picked = matches[Math.min(index, matches.length - 1)] || null;
  const hasCodes = materials.some(m => m.shortCode);

  const add = (material) => {
    if (!material) return;
    onAdd(material, quantity);
    setText('');
    setIndex(0);
    input.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); add(picked); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Escape' && text) { e.stopPropagation(); setText(''); }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={input}
        className={field}
        value={text}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        aria-label="Add an item"
        placeholder={hasCodes ? 'Short code and quantity, like “PN 10”, or type a name' : 'Type a name, then a quantity, like “paneer 10”'}
        onChange={e => { setText(e.target.value); setIndex(0); }}
        onKeyDown={onKeyDown}
      />
      {text.trim() && (
        matches.length === 0 ? (
          <p className="text-xs text-zinc-500">No ingredient matches “{text.trim()}”. Add it under Stock first.</p>
        ) : (
          <ul className="rounded-lg border border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden" role="listbox" aria-label="Matching ingredients">
            {matches.map((m, i) => (
              <li key={m.id} role="option" aria-selected={m === picked}>
                <button type="button" onClick={() => add(m)} onMouseEnter={() => setIndex(i)}
                  className={`w-full px-3 py-1.5 flex items-center justify-between gap-3 text-left text-sm ${m === picked ? 'bg-amber-50 dark:bg-amber-500/10' : ''}`}>
                  <span className="min-w-0 truncate text-zinc-900 dark:text-zinc-100">
                    {m.shortCode && <span className="mr-2 font-mono text-xs text-zinc-500">{m.shortCode}</span>}
                    {m.name}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {m === picked ? `Enter adds ${quantity ? amount(quantity, m.unit) : 'it'}` : `${amount(m.stock, m.unit)} in stock`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}
      {!text.trim() && !hasCodes && materials.length > 0 && (
        <p className="text-xs text-zinc-500">Tip: give ingredients a short code under Stock (PN for paneer) and you can type “PN 10” here.</p>
      )}
    </div>
  );
};
