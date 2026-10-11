import React, { useEffect, useRef, useState } from 'react';
import { Call02Icon, UserIcon, UserCheck01Icon } from 'hugeicons-react';
import api from '../../lib/api';

const formatPhone = (p) => (p && p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p || '');
const visitText = (c) => {
  const visits = `${c.visits} ${c.visits === 1 ? 'visit' : 'visits'}`;
  if (!c.lastVisitAt) return visits;
  return `${visits} · last on ${new Date(c.lastVisitAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
};

/**
 * Customer mobile + name for a bill, with the customer directory behind it: typing part of a
 * number or a name lists people who ordered before, and picking one fills both fields.
 *
 * @param {{ storeId: string, name: string, phone: string, onName: (v: string) => void, onPhone: (v: string) => void }} props
 */
export const CustomerPicker = ({ storeId, name, phone, onName, onPhone }) => {
  const [search, setSearch] = useState(''); // what the directory is asked for
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState(null); // the directory entry behind the current number
  const boxRef = useRef(null);

  // Ask the directory shortly after typing stops
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/stores/${storeId}/orders/customers`, { params: { q: term } });
        if (cancelled) return;
        setResults(res.data.data || []);
        setActive(0);
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [search, storeId]);

  // Close the list when clicking elsewhere
  useEffect(() => {
    const onDown = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const type = (setter) => (e) => {
    setter(e.target.value);
    setSearch(e.target.value);
    setOpen(true);
  };

  const pick = (customer) => {
    onPhone(customer.phone);
    onName(customer.name || '');
    setPicked(customer);
    setSearch('');
    setResults([]);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!showList) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % matches.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i - 1 + matches.length) % matches.length); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(matches[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  // Results only count while there is something typed to search for
  const matches = search.trim().length >= 2 ? results : [];
  const showList = open && matches.length > 0;
  const returning = picked && picked.phone === phone.replace(/\D/g, '').slice(-10) ? picked : null;
  const field = 'flex items-center gap-2 h-9 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 focus-within:border-amber-500';
  const input = 'flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-zinc-400';

  return (
    <div ref={boxRef} className="relative">
      <div className="grid grid-cols-2 gap-1.5">
        <label className={field}>
          <Call02Icon size={14} className="text-zinc-400 shrink-0" />
          <input value={phone} onChange={type(onPhone)} onKeyDown={onKeyDown} onFocus={() => setOpen(true)}
            placeholder="Mobile number" aria-label="Customer mobile" inputMode="tel" maxLength={15} autoComplete="off"
            role="combobox" aria-expanded={showList} aria-controls="customer-directory" className={`${input} tabular-nums`} />
        </label>
        <label className={field}>
          <UserIcon size={14} className="text-zinc-400 shrink-0" />
          <input value={name} onChange={type(onName)} onKeyDown={onKeyDown} onFocus={() => setOpen(true)}
            placeholder="Customer name" aria-label="Customer name" maxLength={60} autoComplete="off"
            role="combobox" aria-expanded={showList} aria-controls="customer-directory" className={input} />
        </label>
      </div>

      {returning && (
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
          <UserCheck01Icon size={12} /> Returning customer · {visitText(returning)}
        </p>
      )}

      {showList && (
        <ul id="customer-directory" role="listbox" aria-label="Customers who ordered before"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-1">
          <li className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Customers who ordered before</li>
          {matches.map((c, i) => (
            <li key={c.phone} role="option" aria-selected={i === active}>
              <button type="button" onMouseEnter={() => setActive(i)} onClick={() => pick(c)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left ${i === active ? 'bg-amber-50 dark:bg-zinc-800' : ''}`}>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{c.name || 'No name saved'}</span>
                  <span className="block text-xs tabular-nums text-zinc-500">{formatPhone(c.phone)}</span>
                </span>
                <span className="shrink-0 text-right text-[11px] text-zinc-500">{visitText(c)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
