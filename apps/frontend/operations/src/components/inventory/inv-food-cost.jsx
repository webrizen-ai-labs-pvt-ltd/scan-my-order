import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../lib/api';
import { card, errorText, eyebrow, rupees } from './inv-format';
import { Empty, Tag } from './inv-shared';

// Above this share of the selling price, a dish is worth a second look
const HIGH_COST_PERCENT = 40;

/**
 * Food cost: what each dish costs to make, from its recipe and the last price paid for each
 * ingredient. Dishes are listed with the most expensive to make (as a share of price) first.
 *
 * @param {{ storeId: string, version: number }} props version changes whenever stock or prices changed
 */
export const InvFoodCost = ({ storeId, version }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/stores/${storeId}/inventory/advanced/food-cost`);
      setData(res.data.data);
      setError('');
    } catch (err) {
      setError(errorText(err, 'Could not load food cost'));
    }
  }, [storeId]);
  useEffect(() => { load(); }, [load, version]);

  const dishes = useMemo(() => [...(data?.dishes || [])].sort((a, b) => (
    // Dishes that can't be costed yet go last
    (a.costPercent === null) - (b.costPercent === null) || (b.costPercent ?? 0) - (a.costPercent ?? 0) || a.name.localeCompare(b.name)
  )), [data]);
  const costed = dishes.filter(d => d.costPercent !== null);
  const average = costed.length > 0 ? Math.round((costed.reduce((sum, d) => sum + d.costPercent, 0) / costed.length) * 10) / 10 : null;
  const high = costed.filter(d => d.costPercent > HIGH_COST_PERCENT).length;
  const uncosted = dishes.length - costed.length;

  if (error) return <p role="alert" className={`${card} px-4 py-2.5 text-sm text-red-600 dark:text-red-400`}>{error}</p>;
  if (data === null) return <p className={`${card} px-5 py-5 text-sm text-zinc-500`}>Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Average food cost', average === null ? '—' : `${average}%`, 'Of the selling price, across costed dishes'],
          [`Above ${HIGH_COST_PERCENT}%`, high, high > 0 ? 'Check the price or the recipe' : 'No dish costs too much to make'],
          ['Can’t be costed yet', uncosted, uncosted > 0 ? 'An ingredient has no price' : 'Every recipe has prices'],
          ['Dishes without a recipe', data.withoutRecipe, 'Not counted here'],
        ].map(([label, value, hint]) => (
          <div key={label} className={`${card} px-4 py-3`}>
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</dd>
            <dd className="text-[11px] text-zinc-400">{hint}</dd>
          </div>
        ))}
      </dl>

      <section className={card}>
        {dishes.length === 0 ? (
          <Empty title="No dish has a recipe yet">Give a dish a recipe (which ingredients, how much) in the menu editor, and its cost appears here.</Empty>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_6rem_6rem_6rem_7.5rem] gap-3 px-5 py-2 border-b border-zinc-200 dark:border-zinc-800">
              {['Dish', 'Price', 'Cost', 'Margin', 'Food cost'].map((h, i) => <span key={h} className={`${eyebrow} ${i > 0 ? 'text-right' : ''}`}>{h}</span>)}
            </div>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {dishes.map(d => (
                <li key={d.id} className="px-5 py-2.5 grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_6rem_6rem_6rem_7.5rem] gap-x-3 gap-y-0.5 items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{d.name}</p>
                    <p className="text-xs text-zinc-500 truncate">
                      {d.missingCosts.length > 0 ? `No price for ${d.missingCosts.join(', ')}` : `${d.category ? `${d.category} · ` : ''}${d.ingredients} ${d.ingredients === 1 ? 'ingredient' : 'ingredients'}`}
                    </p>
                    <p className="sm:hidden text-xs text-zinc-500 tabular-nums">Sells at {rupees(d.price)}{d.margin !== null ? ` · costs ${rupees(d.cost)} · keeps ${rupees(d.margin)}` : ''}</p>
                  </div>
                  <span className="hidden sm:block text-sm text-right tabular-nums text-zinc-600 dark:text-zinc-400">{rupees(d.price)}</span>
                  <span className="hidden sm:block text-sm text-right tabular-nums text-zinc-600 dark:text-zinc-400">{d.missingCosts.length > 0 ? '—' : rupees(d.cost)}</span>
                  <span className={`hidden sm:block text-sm text-right tabular-nums ${d.margin !== null && d.margin < 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100'}`}>{d.margin === null ? '—' : rupees(d.margin)}</span>
                  <span className="text-right">
                    {d.costPercent === null
                      ? <Tag>Needs prices</Tag>
                      : <Tag tone={d.costPercent > 100 ? 'EXPIRED' : d.costPercent > HIGH_COST_PERCENT ? 'LOW' : 'OK'}>{d.costPercent}%{d.costPercent > 100 ? ' · Sells at a loss' : d.costPercent > HIGH_COST_PERCENT ? ' · High' : ''}</Tag>}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <p className="text-xs text-zinc-500">Costs use the last price paid for each ingredient when a delivery was received.</p>
    </div>
  );
};
