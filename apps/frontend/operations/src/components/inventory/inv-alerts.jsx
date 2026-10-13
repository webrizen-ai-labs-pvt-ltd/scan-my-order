import React, { useState } from 'react';
import { Button } from '@smo/ui';
import { CheckmarkCircle02Icon } from 'hugeicons-react';
import { card } from './inv-format';
import { Tag } from './inv-shared';

const HIDE_DAYS = 7;
const HIDE_MS = HIDE_DAYS * 86400000;
const SEVERITY = { HIGH: ['EXPIRED', 'Act on it'], MEDIUM: ['LOW', 'Look into it'], INFO: ['OK', 'Good to know'] };
const GO_TO = { wastage: 'Open Wastage', 'food-cost': 'Open Food cost', receive: 'Receive', stock: 'Open Stock', checks: 'Open checks' };
const storageKey = (storeId) => `smo-inv-alerts-hidden:${storeId}`;

/** Alerts this person hid on this device, and until when: { [alertId]: time } */
function readHidden(storeId) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(storeId)) || '{}');
    return Object.fromEntries(Object.entries(saved).filter(([, until]) => until > Date.now()));
  } catch {
    return {};
  }
}

/**
 * Alerts hidden on this device stay out of the way for a week, then come back if they still hold.
 * @returns {{ shown: object[], hidden: object[], hide: (id: string) => void, showAll: () => void }}
 */
export function useAlertList(storeId, alerts) {
  const [hiddenIds, setHiddenIds] = useState(() => readHidden(storeId));
  const save = (next) => {
    setHiddenIds(next);
    try { localStorage.setItem(storageKey(storeId), JSON.stringify(next)); } catch { /* private window: hidden for this visit only */ }
  };
  return {
    shown: alerts.filter(a => !hiddenIds[a.id]),
    hidden: alerts.filter(a => hiddenIds[a.id]),
    hide: (id) => save({ ...hiddenIds, [id]: Date.now() + HIDE_MS }),
    showAll: () => save({}),
  };
}

/** One alert: what the records show, the figures behind it, and what to do */
export const AlertRow = ({ alert, onGoTo, onHide }) => (
  <li className="px-5 py-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        <span className="mr-2 align-middle"><Tag tone={SEVERITY[alert.severity][0]}>{SEVERITY[alert.severity][1]}</Tag></span>
        {alert.title}
      </p>
      <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-300">{alert.text}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{alert.advice}</p>
    </div>
    <div className="flex items-center gap-2">
      {onHide && <button type="button" onClick={() => onHide(alert.id)} className="text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100">Hide for a week</button>}
      {GO_TO[alert.tab] && <Button size="sm" variant="outline" onClick={() => onGoTo(alert.tab)}>{GO_TO[alert.tab]}</Button>}
    </div>
  </li>
);

/**
 * Alerts: what the stock, delivery, wastage and hygiene records say when read together.
 * Each one names the figures it comes from, so it can be checked.
 *
 * @param {{ storeId: string, insights: object|null, failed: boolean, onGoTo: (tab: string) => void }} props
 */
export const InvAlerts = ({ storeId, insights, failed, onGoTo }) => {
  const { shown, hidden, hide, showAll } = useAlertList(storeId, insights?.alerts || []);

  if (!insights) return <p className={`${card} px-5 py-5 text-sm ${failed ? 'text-red-600 dark:text-red-400' : 'text-zinc-500'}`}>{failed ? 'Could not work out the alerts. Try Refresh.' : 'Reading the records…'}</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500 max-w-2xl">
        Worked out from your own records of the last {insights.windowDays} days: counts, deliveries, wastage, recipes and hygiene checks. The more of those you keep, the more these can tell you.
      </p>

      <section className={card}>
        {shown.length === 0 ? (
          <div className="px-6 py-8 flex flex-col items-center text-center gap-1.5">
            <CheckmarkCircle02Icon size={28} className="text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{hidden.length > 0 ? 'Nothing else to show' : 'Nothing stands out'}</p>
            <p className="text-sm text-zinc-500 max-w-md">
              {hidden.length > 0 ? 'Every alert is hidden for now.' : 'No repeated shortfalls, no price jumps, no stock being thrown away or about to run out.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {shown.map(a => <AlertRow key={a.id} alert={a} onGoTo={onGoTo} onHide={hide} />)}
          </ul>
        )}
      </section>

      {hidden.length > 0 && (
        <p className="text-xs text-zinc-500">
          {hidden.length} hidden on this device for up to {HIDE_DAYS} days.{' '}
          <button type="button" onClick={showAll} className="font-medium underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100">Show {hidden.length === 1 ? 'it' : 'them'} again</button>
        </p>
      )}
    </div>
  );
};
