import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@smo/ui';
import api from '../../lib/api';
import { amount, card, dayAndTime, errorText, field, rupees } from './inv-format';
import { Empty, Modal, Tag } from './inv-shared';

const RANGES = [[7, '7 days'], [30, '30 days'], [90, '90 days']];

/** Step one of recording wastage from this screen: which ingredient */
const PickIngredient = ({ materials, onClose, onPick }) => {
  const [search, setSearch] = useState('');
  const words = search.trim().toLowerCase();
  const inStock = materials.filter(m => m.stock > 0 && (!words || m.name.toLowerCase().includes(words) || (m.shortCode || '').toLowerCase() === words));
  return (
    <Modal title="What was thrown away?" onClose={onClose}>
      <input className={field} type="search" autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or short code" aria-label="Search ingredients"
        onKeyDown={e => { if (e.key === 'Enter' && inStock.length > 0) onPick(inStock[0]); }} />
      {inStock.length === 0 ? (
        <p className="text-sm text-zinc-500">{materials.some(m => m.stock > 0) ? 'No ingredient in stock matches.' : 'Nothing is in stock, so there is nothing to throw away.'}</p>
      ) : (
        <ul className="rounded-lg border border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-100 dark:divide-zinc-800 max-h-72 overflow-y-auto">
          {inStock.map(m => (
            <li key={m.id}>
              <button type="button" onClick={() => onPick(m)} className="w-full px-3 py-2 flex items-center justify-between gap-3 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <span className="truncate text-zinc-900 dark:text-zinc-100">{m.name}</span>
                <span className="shrink-0 text-xs text-zinc-500">{amount(m.stock, m.unit)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
};

/**
 * Wastage: where stock went other than into dishes. What was thrown away and why, and what
 * the daily counts found missing.
 *
 * @param {{ storeId: string, overview: object, version: number, onWaste: (material: object) => void }} props
 *        version changes whenever stock changed, so the list reloads
 */
export const InvWastage = ({ storeId, overview, version, onWaste }) => {
  const canManage = Boolean(overview.canManage);
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/stores/${storeId}/inventory/advanced/losses`, { params: { days } });
      setData(res.data.data);
      setError('');
    } catch (err) {
      setError(errorText(err, 'Could not load wastage'));
    }
  }, [storeId, days]);
  useEffect(() => { load(); }, [load, version]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5" role="group" aria-label="Period">
          {RANGES.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)}
              className={`px-3 h-9 rounded-full text-xs font-semibold border ${days === value ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900' : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'}`}>
              {label}
            </button>
          ))}
        </div>
        <Button onClick={() => setPicking(true)} className="!bg-none !bg-red-600 hover:!bg-red-700 !text-white !border-red-600">Record wastage</Button>
      </div>
      {error && <p role="alert" className={`${card} px-4 py-2.5 text-sm text-red-600 dark:text-red-400`}>{error}</p>}

      {canManage && <dl className="grid grid-cols-2 gap-3">
        {[
          ['Thrown away', data ? rupees(data.wasteValue) : '—', 'Expired, spoiled, spilled, burnt'],
          ['Missing in counts', data ? rupees(data.shortfallValue) : '—', 'Used or lost without being recorded'],
        ].map(([label, value, hint]) => (
          <div key={label} className={`${card} px-4 py-3`}>
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</dd>
            <dd className="text-[11px] text-zinc-400">{hint}</dd>
          </div>
        ))}
      </dl>}

      <section className={card}>
        {data === null ? (
          <p className="px-5 py-5 text-sm text-zinc-500">{error ? 'Nothing to show.' : 'Loading…'}</p>
        ) : data.entries.length === 0 ? (
          <Empty title={`Nothing lost in the last ${days} days`}>Wastage you record and differences found in counts are listed here.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.entries.map(e => (
              <li key={e.id} className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <p className="text-sm text-zinc-900 dark:text-zinc-100">
                    <span className="font-semibold">{e.name}</span>{' '}
                    <span className="text-zinc-500 tabular-nums">· {e.quantity > 0 ? '+' : ''}{amount(e.quantity, e.unit)}</span>
                  </p>
                  <p className="text-xs text-zinc-500">{e.reason || '—'} · {dayAndTime(e.createdAt)}{e.actorName ? ` · ${e.actorName}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  {canManage && e.value !== null && e.quantity < 0 && <span className="text-sm tabular-nums text-zinc-900 dark:text-zinc-100">{rupees(Math.abs(e.value))}</span>}
                  <Tag tone={e.type === 'WASTE' ? 'EXPIRED' : e.quantity < 0 ? 'LOW' : 'OK'}>{e.type === 'WASTE' ? 'Thrown away' : e.quantity < 0 ? 'Count: short' : 'Count: extra'}</Tag>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {picking && <PickIngredient materials={overview.materials} onClose={() => setPicking(false)} onPick={(m) => { setPicking(false); onWaste(m); }} />}
    </div>
  );
};
