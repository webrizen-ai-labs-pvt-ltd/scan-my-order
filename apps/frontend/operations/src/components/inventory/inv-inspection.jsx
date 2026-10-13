import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@smo/ui';
import { CheckmarkCircle02Icon, Loading03Icon, PrinterIcon } from 'hugeicons-react';
import api from '../../lib/api';
import { card, errorText, fullDay, primary } from './inv-format';
import { Tag } from './inv-shared';
import { printInspectionPack } from './inspection-print';

const RANGES = [[7, '7 days'], [30, '30 days'], [90, '90 days']];
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * What an inspector would notice in the records, most serious first.
 * Each finding says what is wrong and where to put it right.
 */
function findings(pack) {
  const list = [];
  const add = (level, text, tab, action) => list.push({ level, text, tab, action });

  const expiredLots = pack.stock.flatMap(m => m.lots.filter(l => l.state === 'EXPIRED'));
  if (expiredLots.length > 0) add('EXPIRED', `${count(expiredLots.length, 'lot of expired stock is', 'lots of expired stock are')} still on the shelves.`, 'today', 'Deal with it');

  const expiredLicences = pack.licences.filter(l => l.state === 'EXPIRED');
  if (expiredLicences.length > 0) add('EXPIRED', `${expiredLicences.map(l => l.name).join(', ')} ${expiredLicences.length === 1 ? 'has' : 'have'} expired.`, 'licences', 'Update');
  if (!pack.licences.some(l => l.kind === 'FSSAI')) add('EXPIRED', 'Your FSSAI licence is not on record.', 'licences', 'Add it');

  if (pack.hygiene.checks.length === 0) add('LOW', 'No daily hygiene checks are set up.', 'checks', 'Set up');
  else {
    // Today isn't over, so it can't have been missed yet
    const days = pack.hygiene.days.filter(d => d.expected > 0 && d.day !== pack.hygiene.today);
    const missed = days.filter(d => d.done === 0).length;
    const partial = days.filter(d => d.done > 0 && d.done < d.expected).length;
    if (missed > 0) add('LOW', `No hygiene checks were recorded on ${count(missed, 'day', 'days')} out of ${days.length}.`, 'checks', 'Do today’s');
    if (partial > 0) add('LOW', `Hygiene checks were only partly done on ${count(partial, 'day', 'days')}.`, 'checks', 'Do today’s');
    const unexplained = pack.hygiene.days.flatMap(d => d.entries).filter(e => !e.ok && !e.note).length;
    if (unexplained > 0) add('LOW', `${count(unexplained, 'problem was', 'problems were')} recorded without saying what was done about it.`, 'checks', 'Open checks');
  }

  const soon = pack.licences.filter(l => l.state === 'SOON');
  if (soon.length > 0) add('LOW', `${soon.map(l => l.name).join(', ')} ${soon.length === 1 ? 'expires' : 'expire'} within 30 days.`, 'licences', 'Renew');
  const noNumber = pack.licences.filter(l => !l.number).length;
  if (noNumber > 0) add('LOW', `${count(noNumber, 'licence has', 'licences have')} no number recorded.`, 'licences', 'Add');

  const noFssai = pack.suppliers.filter(s => !s.fssaiNumber).length;
  if (pack.suppliers.length === 0) add('LOW', 'No suppliers are on record, so stock can’t be traced to where it came from.', 'suppliers', 'Add suppliers');
  else if (noFssai > 0) add('LOW', `${noFssai} of ${count(pack.suppliers.length, 'supplier has', 'suppliers have')} no FSSAI licence number.`, 'suppliers', 'Add numbers');

  const noBill = pack.deliveries.filter(d => !d.billNumber && d.supplierName).length;
  if (noBill > 0) add('LOW', `${noBill} of ${count(pack.deliveries.length, 'delivery has', 'deliveries have')} no bill number.`, 'receive', null);
  const noSupplier = pack.deliveries.filter(d => !d.supplierName).length;
  if (noSupplier > 0) add('LOW', `${count(noSupplier, 'delivery was', 'deliveries were')} received without naming the supplier.`, 'receive', null);

  const undated = pack.stock.flatMap(m => m.lots.filter(l => l.state === 'NO_DATE' && l.kind === 'RECEIVED')).length;
  if (undated > 0) add('LOW', `${count(undated, 'lot was', 'lots were')} received without a use-by date. Give those ingredients a shelf life under Stock.`, 'stock', 'Open Stock');

  return list;
}

/**
 * Inspection pack: the records an inspector asks for, checked for gaps first and then printed
 * (or saved as a PDF) as one document.
 *
 * @param {{ storeId: string, version: number, onGoTo: (tab: string) => void }} props
 */
export const InvInspection = ({ storeId, version, onGoTo }) => {
  const [days, setDays] = useState(30);
  const [pack, setPack] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/stores/${storeId}/inventory/advanced/inspection-pack`, { params: { days } });
      setPack(res.data.data);
      setError('');
    } catch (err) {
      setError(errorText(err, 'Could not prepare the inspection pack'));
    } finally {
      setLoading(false);
    }
  }, [storeId, days]);
  useEffect(() => { load(); }, [load, version]);

  const issues = useMemo(() => (pack ? findings(pack) : []), [pack]);

  if (pack === null) return <p className={`${card} px-5 py-5 text-sm ${error ? 'text-red-600 dark:text-red-400' : 'text-zinc-500'}`}>{error || 'Putting the records together…'}</p>;
  const hygieneDays = pack.hygiene.days.filter(d => d.done > 0).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5" role="group" aria-label="Period">
          {RANGES.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)}
              className={`px-3 h-9 rounded-full text-xs font-semibold border ${days === value ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900' : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'}`}>
              {label}
            </button>
          ))}
          {loading && <Loading03Icon size={15} className="ml-1 animate-spin text-zinc-400" />}
        </div>
        <Button onClick={() => printInspectionPack(pack)} className={primary}><PrinterIcon size={15} className="mr-1.5" /> Print or save as PDF</Button>
      </div>
      {error && <p role="alert" className={`${card} px-4 py-2.5 text-sm text-red-600 dark:text-red-400`}>{error}</p>}

      <section className={card}>
        <header className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Before an inspector sees it</h2>
          <p className="text-xs text-zinc-500">Gaps in the records from {fullDay(pack.since)} to today, most serious first.</p>
        </header>
        {issues.length === 0 ? (
          <div className="px-6 py-8 flex flex-col items-center text-center gap-1.5">
            <CheckmarkCircle02Icon size={28} className="text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">No gaps found</p>
            <p className="text-sm text-zinc-500">Licences, suppliers, stock and hygiene records are complete for this period.</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {issues.map((issue, i) => (
              <li key={i} className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <p className="min-w-0 flex-1 text-sm text-zinc-900 dark:text-zinc-100">
                  <span className="mr-2"><Tag tone={issue.level}>{issue.level === 'EXPIRED' ? 'Serious' : 'Gap'}</Tag></span>
                  {issue.text}
                </p>
                {issue.action && <Button size="sm" variant="outline" onClick={() => onGoTo(issue.tab)}>{issue.action}</Button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <header className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">What the document contains</h2>
        </header>
        <dl className="grid grid-cols-2 sm:grid-cols-3">
          {[
            ['Licences and certificates', pack.licences.length, 'with numbers and validity'],
            ['Suppliers', pack.suppliers.length, 'with their FSSAI numbers'],
            ['Ingredients in stock', pack.stock.length, 'each lot with its use-by date'],
            ['Deliveries received', pack.deliveries.length, 'supplier, bill and items'],
            ['Wastage entries', pack.wastage.length, 'what was thrown away and why'],
            ['Days of hygiene checks', hygieneDays, `out of the last ${pack.days}`],
          ].map(([label, value, hint]) => (
            <div key={label} className="px-5 py-3">
              <dt className="text-xs text-zinc-500">{label}</dt>
              <dd className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</dd>
              <dd className="text-[11px] text-zinc-400">{hint}</dd>
            </div>
          ))}
        </dl>
      </section>
      <p className="text-xs text-zinc-500">The printed document shows the records as they are, including the gaps above. It is a record of what was entered here, not a certificate.</p>
    </div>
  );
};
