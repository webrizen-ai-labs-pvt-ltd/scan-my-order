import React, { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@smo/ui';
import {
  Tick02Icon, AlertCircleIcon, Loading03Icon, DropletIcon, Invoice01Icon, SpoonAndForkIcon,
  CleaningBucketIcon, CustomerService01Icon,
} from 'hugeicons-react';
import waiterImg from '@smo/shared/assets/images/waiter-sm.png';

const CALL_TYPES = [
  { id: 'WATER', label: 'Water', desc: 'Refill or a fresh bottle', icon: DropletIcon },
  { id: 'BILL', label: 'Bill', desc: 'Ready to pay', icon: Invoice01Icon },
  { id: 'CUTLERY', label: 'Cutlery', desc: 'Spoons, forks, napkins', icon: SpoonAndForkIcon },
  { id: 'CLEAN_TABLE', label: 'Clean table', desc: 'Clear plates, wipe up', icon: CleaningBucketIcon },
  { id: 'CALL_WAITER', label: 'Something else', desc: 'Menu help, anything', icon: CustomerService01Icon },
];

const labelFor = (type) => (type === 'CALL_WAITER' ? 'Assistance' : CALL_TYPES.find(c => c.id === type)?.label || 'Assistance');

/** Seconds since the request was sent, ticking */
function useElapsed(since) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!since) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  return since ? Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000)) : 0;
}

const formatElapsed = (s) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`);

/** Request sent → Waiter assigned → On the way */
const Steps = ({ call }) => {
  const acknowledged = call.status === 'ACKNOWLEDGED';
  const steps = [
    { label: 'Request sent', done: true },
    { label: call.assignedWaiterName ? `${call.assignedWaiterName} notified` : 'Finding a waiter', done: Boolean(call.assignedWaiterName) || acknowledged },
    { label: 'On the way to your table', done: acknowledged },
  ];
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => {
        const current = !s.done && (i === 0 || steps[i - 1].done);
        return (
          <li key={s.label} className="flex items-center gap-3">
            <span className={`size-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold ${s.done
              ? 'bg-emerald-500 text-white'
              : current
                ? 'border-2 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                : 'border border-zinc-300 dark:border-zinc-700 text-zinc-400'}`}>
              {s.done ? <Tick02Icon size={13} /> : current ? <Loading03Icon size={12} className="animate-spin" /> : i + 1}
            </span>
            <span className={`text-sm ${s.done || current ? 'text-zinc-900 dark:text-zinc-100 font-medium' : 'text-zinc-400'}`}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
};

/**
 * Bottom sheet for calling a waiter to the table. State comes from useWaiterCall.
 *
 * @param {{ open: boolean, onClose: Function, tableNumber: string|number, accentColor?: string,
 *           call: ReturnType<typeof import('../hooks/use-waiter-call').useWaiterCall> }} props
 */
export const CallWaiterModal = ({ open, onClose, tableNumber, accentColor = '#059669', call }) => {
  const { activeCall, send, cancel, sending, cancelling, error, setError } = call;
  const [type, setType] = useState('WATER');
  const [note, setNote] = useState('');
  const elapsed = useElapsed(activeCall?.createdAt);

  useEffect(() => { if (open) setError(''); }, [open, setError]);

  const submit = async () => {
    if (await send({ type, note })) setNote('');
  };

  const acknowledged = activeCall?.status === 'ACKNOWLEDGED';
  const escalated = !acknowledged && activeCall?.escalationLevel >= 2;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="bottom" className="mx-auto w-full max-w-md rounded-t-3xl border-zinc-200 bg-white p-0 dark:border-zinc-800 dark:bg-zinc-950 pb-[env(safe-area-inset-bottom)]">
        {/* Header with the waiter peeking in */}
        <SheetHeader className="relative px-5 pt-5 pb-4 text-left border-b border-zinc-100 dark:border-zinc-900">
          <img src={waiterImg} alt="" aria-hidden="true" className="absolute right-12 -top-14 w-28 select-none pointer-events-none" draggable="false" />
          <span className="text-xs font-medium text-zinc-500">Table {tableNumber}</span>
          <SheetTitle className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {activeCall ? (acknowledged ? 'On the way!' : 'Calling a waiter…') : 'How can we help?'}
          </SheetTitle>
          <SheetDescription className="text-sm text-zinc-500 pr-24">
            {activeCall
              ? `${labelFor(activeCall.type)} · asked ${formatElapsed(elapsed)} ago`
              : 'Pick what you need and a waiter will come to your table.'}
          </SheetDescription>
        </SheetHeader>

        <div className="px-5 py-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
              <AlertCircleIcon size={16} className="shrink-0" /> {error}
            </div>
          )}

          {activeCall ? (
            <>
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
                <Steps call={activeCall} />
                {activeCall.note && <p className="mt-4 text-sm text-zinc-500 italic">“{activeCall.note}”</p>}
              </div>

              <p className={`text-sm ${escalated ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-500'}`}>
                {acknowledged
                  ? `${activeCall.assignedWaiterName || 'Your waiter'} has seen your request and is heading to table ${tableNumber}.`
                  : escalated
                    ? 'Everyone is busy right now, so the floor manager has been alerted too. You\'re first in line.'
                    : 'If nobody responds within a minute, the next free waiter is called automatically.'}
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={cancel}
                  disabled={cancelling}
                  className="h-12 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm font-medium text-rose-600 disabled:opacity-60"
                >
                  {cancelling ? <Loading03Icon size={16} className="mx-auto animate-spin" /> : 'Cancel request'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-12 rounded-xl bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Back to menu
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="What do you need?">
                {CALL_TYPES.map((t, i) => {
                  const on = type === t.id;
                  const Icon = t.icon;
                  const wide = i === CALL_TYPES.length - 1 && CALL_TYPES.length % 2 === 1;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setType(t.id)}
                      style={on ? { borderColor: accentColor, backgroundColor: `${accentColor}12` } : undefined}
                      className={`rounded-2xl border p-3 text-left transition-colors ${wide ? 'col-span-2 flex items-center gap-3' : 'flex flex-col gap-2'} ${on
                        ? ''
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'}`}
                    >
                      <span
                        className="size-9 rounded-xl flex items-center justify-center shrink-0"
                        style={on ? { backgroundColor: accentColor, color: '#fff' } : undefined}
                      >
                        <Icon size={19} className={on ? '' : 'text-zinc-500'} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t.label}</span>
                        <span className="block text-xs text-zinc-500 truncate">{t.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                maxLength={100}
                placeholder="Add a note (optional)"
                aria-label="Note for the waiter"
                className="h-11 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-sm outline-none focus:border-zinc-400"
              />

              <button
                type="button"
                onClick={submit}
                disabled={sending}
                style={{ backgroundColor: accentColor }}
                className="h-12 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-70"
              >
                {sending ? <><Loading03Icon size={17} className="animate-spin" /> Calling…</> : 'Call waiter'}
              </button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CallWaiterModal;
