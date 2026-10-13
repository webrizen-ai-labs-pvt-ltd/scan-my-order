import React, { useState } from 'react';
import { Button } from '@smo/ui';
import { CheckmarkCircle02Icon, Loading03Icon } from 'hugeicons-react';
import api from '../../lib/api';
import { amount, card, day, errorText, eyebrow, field, lotDeadline, primary, rupees, unit } from './inv-format';
import { Tag } from './inv-shared';

const Section = ({ title, hint, count, children }) => (
  <section className={card}>
    <header className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}{count !== undefined && <span className="ml-1.5 font-normal text-zinc-400 tabular-nums">{count}</span>}</h2>
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </header>
    {children}
  </section>
);

/**
 * Today: what needs doing in the store room right now. Expired stock to deal with, stock to use
 * first, what is running low, and a handful of ingredients to count.
 *
 * @param {{ storeId: string, overview: object, onChanged: (message?: string) => void, onWaste: (material: object, lot: object) => void,
 *           onReceive: () => void }} props
 */
export const InvToday = ({ storeId, overview, onChanged, onWaste, onReceive }) => {
  const { attention, totals, materials } = overview;
  const [counts, setCounts] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [countResult, setCountResult] = useState(null);
  const materialOf = (id) => materials.find(m => m.id === id);
  const entered = Object.entries(counts).filter(([, v]) => v !== '' && Number(v) >= 0);

  const markUsed = async (entry) => {
    setBusy(entry.lotId);
    setError('');
    try {
      await api.post(`/stores/${storeId}/inventory/advanced/lots/${entry.lotId}/used`);
      onChanged(`${entry.name}: marked as already used.`);
    } catch (err) {
      setError(errorText(err, 'Could not update the lot'));
    } finally {
      setBusy(null);
    }
  };

  const saveCounts = async () => {
    setBusy('counts');
    setError('');
    try {
      const res = await api.post(`/stores/${storeId}/inventory/advanced/counts`, { counts: entered.map(([materialId, counted]) => ({ materialId, counted: Number(counted) })) });
      setCountResult(res.data.data.results);
      setCounts({});
      onChanged();
    } catch (err) {
      setError(errorText(err, 'Could not save the counts'));
    } finally {
      setBusy(null);
    }
  };

  const nothingToDo = attention.expired.length === 0 && attention.soon.length === 0 && attention.low.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Stock value', rupees(totals.stockValue), totals.withoutCost > 0 ? `${totals.withoutCost} ${totals.withoutCost === 1 ? 'item has' : 'items have'} no price yet` : `${totals.materials} ingredients`],
          ['Expired, still on the shelf', attention.expired.length, attention.expired.length > 0 ? `${rupees(totals.expiredValue)} to deal with` : 'Nothing expired'],
          ['Use first', attention.soon.length, 'Use-by date within 3 days'],
          ['Running low', attention.low.length, attention.low.length > 0 ? 'Order or receive more' : 'All above their level'],
        ].map(([label, value, hint]) => (
          <div key={label} className={`${card} px-4 py-3`}>
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</dd>
            <dd className="text-[11px] text-zinc-400">{hint}</dd>
          </div>
        ))}
      </dl>

      {error && <p role="alert" className={`${card} px-4 py-2.5 text-sm text-red-600 dark:text-red-400`}>{error}</p>}

      {nothingToDo && (
        <div className={`${card} px-6 py-8 flex flex-col items-center text-center gap-1.5`}>
          <CheckmarkCircle02Icon size={28} className="text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Nothing needs attention</p>
          <p className="text-sm text-zinc-500">No expired stock, nothing with a use-by date in the next 3 days, and nothing running low.</p>
        </div>
      )}

      {attention.expired.length > 0 && (
        <Section title="Expired" count={attention.expired.length} hint="Throw it away, or say it was already used if the shelf is empty.">
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {attention.expired.map(e => (
              <li key={e.lotId} className="px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{e.name} <span className="font-normal text-zinc-500">· {amount(e.remaining, e.unit)}</span></p>
                  <p className="text-xs text-zinc-500">
                    <Tag tone="EXPIRED">{lotDeadline(e)}</Tag>
                    {e.supplierName && <span className="ml-2">from {e.supplierName}</span>}
                    {e.value ? <span className="ml-2 tabular-nums">{rupees(e.value)}</span> : null}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={busy === e.lotId} onClick={() => markUsed(e)} title="The shelf is empty: this was used before it expired">
                    {busy === e.lotId ? <Loading03Icon size={14} className="animate-spin" /> : 'Already used'}
                  </Button>
                  <Button size="sm" className="!bg-none !bg-red-600 hover:!bg-red-700 !text-white !border-red-600" onClick={() => onWaste(materialOf(e.materialId), materialOf(e.materialId)?.lots.find(l => l.id === e.lotId))}>
                    Throw away
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {attention.soon.length > 0 && (
        <Section title="Use first" count={attention.soon.length} hint="Use-by date within 3 days. Cook with these before opening newer stock.">
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {attention.soon.map(e => (
              <li key={e.lotId} className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <p className="text-sm text-zinc-900 dark:text-zinc-100"><span className="font-semibold">{e.name}</span> <span className="text-zinc-500">· {amount(e.remaining, e.unit)}</span></p>
                <Tag tone="SOON">{lotDeadline(e)}</Tag>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {attention.low.length > 0 && (
        <Section title="Running low" count={attention.low.length} hint="At or below the level you set for each ingredient.">
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {attention.low.map(l => (
              <li key={l.materialId} className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <p className="text-sm text-zinc-900 dark:text-zinc-100">
                  <span className="font-semibold">{l.name}</span>{' '}
                  <span className="text-zinc-500">· {l.stock <= 0 ? 'none left' : `${amount(l.stock, l.unit)} left`}{l.threshold > 0 ? ` (level ${amount(l.threshold, l.unit)})` : ''}</span>
                </p>
                {l.stock <= 0 ? <Tag tone="EXPIRED">Out of stock</Tag> : <Tag tone="LOW">Low</Tag>}
              </li>
            ))}
          </ul>
          <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button size="sm" variant="outline" onClick={onReceive}>Receive a delivery</Button>
          </div>
        </Section>
      )}

      <Section
        title="Today’s count"
        hint={attention.countedToday > 0 ? `${attention.countedToday} counted today.` : 'A few items a day keeps stock honest. No full stock-take needed.'}
      >
        {attention.toCount.length === 0 ? (
          <p className="px-5 py-5 text-sm text-zinc-500">{attention.countedToday > 0 ? 'Today’s count is done. Thank you.' : 'Nothing to count yet. Items appear here once there is stock.'}</p>
        ) : (
          <>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {attention.toCount.map(c => (
                <li key={c.materialId} className="px-5 py-2.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{c.name}</p>
                    <p className="text-xs text-zinc-500">System says {amount(c.stock, c.unit)} · {c.lastCountedAt ? `last counted ${day(c.lastCountedAt)}` : 'never counted'}</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="sr-only">Counted {c.name}</span>
                    <input
                      className={`${field} w-28 text-right tabular-nums`}
                      type="number" inputMode="decimal" min="0" step="any"
                      placeholder="Counted"
                      value={counts[c.materialId] ?? ''}
                      onChange={e => setCounts(prev => ({ ...prev, [c.materialId]: e.target.value }))}
                    />
                    <span className="w-10">{unit(c.unit)}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">Enter what is physically there. Leave blank what you didn’t count.</p>
              <Button size="sm" disabled={entered.length === 0 || busy === 'counts'} onClick={saveCounts} className={primary}>
                {busy === 'counts' ? <Loading03Icon size={14} className="animate-spin" /> : `Save ${entered.length || ''} ${entered.length === 1 ? 'count' : 'counts'}`.replace('  ', ' ')}
              </Button>
            </div>
          </>
        )}
        {countResult && (
          <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800">
            <p className={`${eyebrow} mb-1.5`}>Saved just now</p>
            <ul className="flex flex-col gap-1 text-sm">
              {countResult.map(r => (
                <li key={r.materialId} className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-zinc-900 dark:text-zinc-100">{r.name}: {amount(r.counted, r.unit)}</span>
                  <span className={`text-xs tabular-nums ${r.difference < 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-500'}`}>
                    {r.difference === 0 ? 'Matches the system' : r.difference < 0
                      ? `${amount(Math.abs(r.difference), r.unit)} short${r.value ? ` (${rupees(Math.abs(r.value))})` : ''}`
                      : `${amount(r.difference, r.unit)} more than expected`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </div>
  );
};
