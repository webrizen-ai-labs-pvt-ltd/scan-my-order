import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@smo/ui';
import { Loading03Icon, PlusSignIcon } from 'hugeicons-react';
import api from '../../lib/api';
import { card, errorText, eyebrow, field, primary, qty } from './inv-format';
import { Empty, Field, Modal, Tag } from './inv-shared';

const time = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const weekday = (day) => new Date(`${day}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' });

/** "0 to 5 °C", "-18 °C or colder", "60 °C or hotter" */
export function rangeText(check) {
  if (check.minValue !== null && check.maxValue !== null) return `${qty(check.minValue)} to ${qty(check.maxValue)} °C`;
  if (check.maxValue !== null) return `${qty(check.maxValue)} °C or colder`;
  if (check.minValue !== null) return `${qty(check.minValue)} °C or hotter`;
  return '';
}
/** Why a reading failed, in kitchen words */
const offBy = (check, value) => (check.maxValue !== null && value > check.maxValue ? 'too warm' : 'too cold');

/** Add a check, or change one's name and limits */
const CheckDialog = ({ storeId, check, onClose, onDone }) => {
  const [name, setName] = useState(check?.name || '');
  const [kind, setKind] = useState(check?.kind || 'CHECK');
  const [min, setMin] = useState(check?.minValue ?? '');
  const [max, setMax] = useState(check?.maxValue ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const temperature = kind === 'TEMPERATURE';
  const limitsProblem = temperature && (
    (min === '' && max === '') ? 'Give the lowest or the highest temperature allowed.'
      : (min !== '' && max !== '' && Number(min) > Number(max)) ? 'The lowest temperature is above the highest.' : ''
  );
  const valid = name.trim().length >= 3 && !limitsProblem;

  const submit = async () => {
    setBusy(true);
    setError('');
    const payload = { name: name.trim(), kind, ...(temperature ? { minValue: min === '' ? null : Number(min), maxValue: max === '' ? null : Number(max) } : {}) };
    try {
      if (check) await api.patch(`/stores/${storeId}/inventory/advanced/checks/${check.id}`, payload);
      else await api.post(`/stores/${storeId}/inventory/advanced/checks`, payload);
      onDone();
    } catch (err) {
      setError(errorText(err, 'Could not save the check'));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={check ? 'Change this check' : 'Add a check'}
      onClose={onClose}
      busy={busy}
      footer={(
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || busy} onClick={submit} className={primary}>
            {busy ? <Loading03Icon size={15} className="animate-spin" /> : 'Save'}
          </Button>
        </>
      )}
    >
      <Field label="What is checked">
        <input className={field} value={name} maxLength={100} autoFocus={!check} onChange={e => setName(e.target.value)} placeholder="Walk-in fridge temperature" />
      </Field>
      <fieldset disabled={Boolean(check)}>
        <legend className="mb-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">How it is answered</legend>
        <div className="grid grid-cols-2 gap-2">
          {[['CHECK', 'Fine or problem', 'A look: clean, stocked, in place.'], ['TEMPERATURE', 'A temperature', 'A reading that must stay in range.']].map(([id, label, hint]) => (
            <button key={id} type="button" aria-pressed={kind === id} onClick={() => setKind(id)}
              className={`rounded-lg border px-3 py-2 text-left disabled:opacity-60 ${kind === id ? 'border-zinc-900 dark:border-zinc-100' : 'border-zinc-200 dark:border-zinc-700 enabled:hover:border-zinc-400'}`}>
              <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</span>
              <span className="block text-xs text-zinc-500">{hint}</span>
            </button>
          ))}
        </div>
        {check && <p className="mt-1.5 text-xs text-zinc-500">This can’t change once a check has a history. Pause it and add a new one instead.</p>}
      </fieldset>
      {temperature && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Lowest allowed (°C)" optional>
            <input className={`${field} tabular-nums`} type="number" inputMode="decimal" step="any" value={min} onChange={e => setMin(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Highest allowed (°C)" optional>
            <input className={`${field} tabular-nums`} type="number" inputMode="decimal" step="any" value={max} onChange={e => setMax(e.target.value)} placeholder="5" />
          </Field>
          {limitsProblem && <p className="col-span-2 text-xs text-red-600 dark:text-red-400">{limitsProblem}</p>}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </Modal>
  );
};

/** One check for today: answer it, see who answered, say what was done if something was wrong */
const CheckRow = ({ check, busy, onLog }) => {
  const log = check.log;
  const [reading, setReading] = useState('');
  const [note, setNote] = useState(log?.note || '');
  const [redo, setRedo] = useState(false);
  useEffect(() => { setNote(log?.note || ''); setRedo(false); setReading(''); }, [log?.at, log?.note]);

  const temperature = check.kind === 'TEMPERATURE';
  const answering = !log || redo;
  const saveReading = () => { if (reading !== '') onLog({ value: Number(reading) }); };
  const saveNote = () => onLog(temperature ? { value: log.value, note } : { ok: false, note });

  return (
    <li className="px-5 py-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{check.name}</p>
          <p className="text-xs text-zinc-500">
            {temperature && <span>{rangeText(check)}</span>}
            {log && <span>{temperature ? ' · ' : ''}{log.actorName || 'Someone'}, {time(log.at)}</span>}
            {!log && !temperature && 'Not checked yet today'}
          </p>
        </div>

        {answering ? (
          temperature ? (
            <div className="flex items-center gap-2">
              <input className={`${field} w-24 text-right tabular-nums`} type="number" inputMode="decimal" step="any" placeholder="Reading" aria-label={`${check.name} in °C`}
                value={reading} onChange={e => setReading(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveReading(); }} />
              <span className="text-xs text-zinc-500">°C</span>
              <Button size="sm" variant="outline" disabled={busy || reading === ''} onClick={saveReading}>{busy ? <Loading03Icon size={14} className="animate-spin" /> : 'Save'}</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => onLog({ ok: false })}>Problem</Button>
              <Button size="sm" disabled={busy} onClick={() => onLog({ ok: true })} className="!bg-emerald-600 hover:!bg-emerald-700 !text-white">
                {busy ? <Loading03Icon size={14} className="animate-spin" /> : 'Fine'}
              </Button>
            </div>
          )
        ) : (
          <div className="flex items-center gap-2">
            {temperature
              ? <Tag tone={log.ok ? 'OK' : 'EXPIRED'}>{qty(log.value)} °C · {log.ok ? 'in range' : offBy(check, log.value)}</Tag>
              : <Tag tone={log.ok ? 'OK' : 'EXPIRED'}>{log.ok ? 'Fine' : 'Problem'}</Tag>}
            <button type="button" onClick={() => setRedo(true)} className="text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100">Redo</button>
          </div>
        )}
      </div>

      {log && !log.ok && !redo && (
        <div className="flex flex-wrap items-center gap-2">
          <input className={`${field} flex-1 min-w-48`} value={note} maxLength={200} onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && note.trim() !== (log.note || '')) saveNote(); }}
            placeholder="What was done about it? e.g. moved stock to the other fridge, called the technician" aria-label={`What was done about ${check.name}`} />
          <Button size="sm" variant="outline" disabled={busy || note.trim() === (log.note || '')} onClick={saveNote}>Save note</Button>
        </div>
      )}
    </li>
  );
};

/**
 * Hygiene checks: the handful of things a kitchen looks at every day (fridge temperatures,
 * clean surfaces, hand-wash, pests). Each takes one tap; the record builds itself.
 *
 * @param {{ storeId: string, canManage: boolean, onChanged: () => void }} props
 */
export const InvChecks = ({ storeId, canManage, onChanged }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState(null); // { check } or { check: null }

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/stores/${storeId}/inventory/advanced/checks`);
      setData(res.data.data);
    } catch (err) {
      setError(errorText(err, 'Could not load the checks'));
    }
  }, [storeId]);
  useEffect(() => { load(); }, [load]);

  const run = async (key, request) => {
    setBusy(key);
    setError('');
    try {
      await request();
      await load();
      onChanged();
    } catch (err) {
      setError(errorText(err, 'Could not save that'));
    } finally {
      setBusy(null);
    }
  };
  const log = (check, answer) => run(check.id, () => api.post(`/stores/${storeId}/inventory/advanced/checks/log`, { checkId: check.id, ...answer }));
  const setActive = (check, isActive) => run(check.id, () => api.patch(`/stores/${storeId}/inventory/advanced/checks/${check.id}`, { isActive }));

  if (data === null) return <p className={`${card} px-5 py-5 text-sm ${error ? 'text-red-600 dark:text-red-400' : 'text-zinc-500'}`}>{error || 'Loading…'}</p>;

  const done = data.checks.filter(c => c.log).length;
  const problems = data.checks.filter(c => c.log && !c.log.ok).length;
  const none = data.checks.length === 0 && data.paused.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {error && <p role="alert" className={`${card} px-4 py-2.5 text-sm text-red-600 dark:text-red-400`}>{error}</p>}

      {none ? (
        <section className={card}>
          <Empty title="No hygiene checks yet">
            {canManage
              ? 'Start with the standard list: fridge, freezer and hot-holding temperatures, hand-wash, surfaces, storage, uniforms, pests, bins and water. You can change it afterwards.'
              : 'Your manager hasn’t set up the daily checks yet.'}
          </Empty>
          {canManage && (
            <div className="pb-8 flex flex-wrap justify-center gap-2">
              <Button disabled={busy === 'standard'} onClick={() => run('standard', () => api.post(`/stores/${storeId}/inventory/advanced/checks/standard`))} className={primary}>
                {busy === 'standard' ? <Loading03Icon size={15} className="animate-spin" /> : 'Use the standard list'}
              </Button>
              <Button variant="outline" onClick={() => setDialog({ check: null })}>Write my own</Button>
            </div>
          )}
        </section>
      ) : (
        <>
          <section className={`${card} px-5 py-4 flex flex-wrap items-center justify-between gap-x-8 gap-y-4`}>
            <div>
              <p className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{done} of {data.checks.length}</p>
              <p className="text-sm text-zinc-500">
                {done === data.checks.length && data.checks.length > 0 ? 'All of today’s checks are done.' : 'checks done today'}
                {problems > 0 && <span className="text-red-600 dark:text-red-400"> · {problems} {problems === 1 ? 'problem' : 'problems'}</span>}
              </p>
            </div>
            <div>
              <p className={`${eyebrow} mb-1.5`}>Last 7 days</p>
              <ol className="flex gap-1.5">
                {[...data.history].reverse().map(h => {
                  const state = h.total === 0 ? 'none' : h.done === 0 ? 'missed' : h.done < h.total ? 'part' : h.problems > 0 ? 'problem' : 'full';
                  const label = { none: 'no checks then', missed: 'none done', part: `${h.done} of ${h.total} done`, problem: `all done, ${h.problems} with a problem`, full: 'all done' }[state];
                  return (
                    <li key={h.day} title={`${weekday(h.day)}: ${label}`} className="flex flex-col items-center gap-1">
                      <span aria-hidden="true" className={`flex size-7 items-center justify-center rounded-md border text-[11px] font-semibold tabular-nums ${{
                        none: 'border-dashed border-zinc-200 text-zinc-300 dark:border-zinc-800 dark:text-zinc-700',
                        missed: 'border-red-300 text-red-700 dark:border-red-500/40 dark:text-red-400',
                        part: 'border-amber-300 text-amber-700 dark:border-amber-500/40 dark:text-amber-400',
                        problem: 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100',
                        full: 'border-emerald-300 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400',
                      }[state]}`}>
                        {state === 'none' ? '–' : state === 'full' ? '✓' : state === 'problem' ? '!' : h.done}
                      </span>
                      <span className="text-[10px] text-zinc-400">{weekday(h.day).slice(0, 2)}</span>
                      <span className="sr-only">{label}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>

          <section className={card}>
            <header className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Today’s checks</h2>
              {canManage && (
                <div className="flex gap-2">
                  {editing && <Button size="sm" variant="outline" onClick={() => setDialog({ check: null })}><PlusSignIcon size={13} className="mr-1.5" /> Add a check</Button>}
                  <Button size="sm" variant="outline" onClick={() => setEditing(v => !v)}>{editing ? 'Done' : 'Change the list'}</Button>
                </div>
              )}
            </header>
            {editing ? (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {[...data.checks, ...data.paused].map(c => (
                  <li key={c.id} className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-3">
                    <div className={`min-w-0 flex-1 ${c.isActive ? '' : 'opacity-60'}`}>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{c.name}{!c.isActive && <span className="ml-2"><Tag>Paused</Tag></span>}</p>
                      <p className="text-xs text-zinc-500">{c.kind === 'TEMPERATURE' ? `Temperature · ${rangeText(c)}` : 'Fine or problem'}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setDialog({ check: c })}>Change</Button>
                      <Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => setActive(c, !c.isActive)}>{c.isActive ? 'Pause' : 'Resume'}</Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : data.checks.length === 0 ? (
              <Empty title="Every check is paused">Resume one under “Change the list”.</Empty>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.checks.map(c => <CheckRow key={c.id} check={c} busy={busy === c.id} onLog={(answer) => log(c, answer)} />)}
              </ul>
            )}
          </section>
          <p className="text-xs text-zinc-500">A check can be redone during the day; from tomorrow today’s answers are a record and can’t be changed.</p>
        </>
      )}

      {dialog && <CheckDialog storeId={storeId} check={dialog.check} onClose={() => setDialog(null)} onDone={() => { setDialog(null); load(); onChanged(); }} />}
    </div>
  );
};
