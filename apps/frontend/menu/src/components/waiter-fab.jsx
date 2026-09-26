import React, { useCallback, useEffect, useRef, useState } from 'react';
import waiterImg from '@smo/shared/assets/images/waiter-sm.png';
import './waiter-fab.css';

const NUDGES_KEY = 'smo_waiter_nudges';
const TAPPED_KEY = 'smo_waiter_tapped';
const MAX_NUDGES = 4; // per visit, so he never gets annoying
const NUDGE_EVERY_MS = 25000;
const TYPING_MS = 700;
const SHOW_MS = 4500;

const session = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning! ☀️ Tap me if you need anything.';
  if (h < 17) return 'Hi there! 👋 Tap me if you need anything.';
  return 'Good evening! 🌙 Tap me if you need anything.';
};

const NUDGES = [
  'Need water? Just tap me 💧',
  'Can’t decide? I can help with the menu 🍽️',
  'Ready for the bill? I’ll bring it 🧾',
  'I’m right here whenever you need me ✋',
];

const statusLine = (call, tableNumber) => {
  if (call.status === 'ACKNOWLEDGED') return `On my way to table ${tableNumber}! 🏃`;
  if (call.escalationLevel >= 2) return 'Hang tight, getting you help! 🙏';
  return 'Coming right up! ⏳';
};

/**
 * The waiter character in the bottom-right corner of the menu column. Tapping him calls a waiter.
 * He greets guests, drops the odd hint and reports on an open request through a speech bubble.
 * Slides away while `hidden` (e.g. the cart bar is showing) so nothing overlaps.
 *
 * @param {{ hidden: boolean, activeCall: object|null, onClick: Function, tableNumber?: string|number,
 *           accentColor?: string }} props
 */
export const WaiterFab = ({ hidden, activeCall, onClick, tableNumber, accentColor = '#059669' }) => {
  const [bubble, setBubble] = useState(null); // { text, typing, id }
  const [waving, setWaving] = useState(0);
  const timers = useRef([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  /** Typing dots, then the line; `hold` = how long it stays (null keeps it up) */
  const say = useCallback((text, hold = SHOW_MS) => {
    clearTimers();
    const id = Date.now();
    setBubble({ text, typing: true, id });
    setWaving(w => w + 1);
    later(() => setBubble({ text, typing: false, id }), TYPING_MS);
    if (hold) later(() => setBubble(null), TYPING_MS + hold);
  }, []);

  useEffect(() => clearTimers, []);

  // Status of an open request, spoken whenever it changes
  const statusText = activeCall ? statusLine(activeCall, tableNumber) : null;
  useEffect(() => {
    if (hidden) return;
    if (statusText) say(statusText, null);
    else setBubble(null);
  }, [statusText, hidden, say]);

  // Idle: a greeting, then an occasional nudge, until the guest has tapped him once
  useEffect(() => {
    if (hidden || activeCall) return undefined;
    const nudge = () => {
      const count = parseInt(session.get(NUDGES_KEY) || '0', 10);
      if (session.get(TAPPED_KEY) === '1' || count >= MAX_NUDGES) return false;
      session.set(NUDGES_KEY, String(count + 1));
      say(count === 0 ? greeting() : NUDGES[(count - 1) % NUDGES.length]);
      return true;
    };
    const first = setTimeout(nudge, 1500);
    const interval = setInterval(() => { if (!nudge()) clearInterval(interval); }, NUDGE_EVERY_MS);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, [hidden, activeCall, say]);

  useEffect(() => { if (hidden) { clearTimers(); setBubble(null); } }, [hidden]);

  const open = () => {
    session.set(TAPPED_KEY, '1');
    onClick();
  };

  const acknowledged = activeCall?.status === 'ACKNOWLEDGED';
  const dotColor = acknowledged ? '#10b981' : accentColor;
  const label = activeCall
    ? (acknowledged ? 'Waiter is on the way. Open request' : 'Waiter is being called. Open request')
    : 'Call a waiter';

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md transition-transform duration-300 ease-out motion-reduce:transition-none ${hidden ? 'translate-y-[120%]' : 'translate-y-0'}`}
      aria-hidden={hidden}
    >
      <div className="relative ml-auto w-[112px]">
        {bubble && (
          <button
            key={bubble.id}
            type="button"
            onClick={open}
            tabIndex={-1}
            className="waiter-bubble pointer-events-auto absolute bottom-[50px] right-[96px] w-max max-w-[190px] rounded-2xl rounded-br-md border border-zinc-200 bg-white px-3 py-2 text-left text-xs font-semibold leading-snug text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {/* tail pointing at his face */}
            <span aria-hidden="true" className="absolute -right-[5px] bottom-2 size-2.5 rotate-45 border-r border-t border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900" />
            {bubble.typing ? (
              <span className="flex items-center gap-1 py-1" aria-label="typing">
                {[0, 1, 2].map(i => <span key={i} className="waiter-dot size-1.5 rounded-full bg-zinc-400" />)}
              </span>
            ) : (
              <span role="status" className="relative flex items-start gap-1.5">
                {activeCall && <span className="mt-1 size-1.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />}
                {bubble.text}
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={open}
          tabIndex={hidden ? -1 : 0}
          aria-label={label}
          title={label}
          className="pointer-events-auto group relative block w-full rounded-t-3xl pb-[env(safe-area-inset-bottom)] outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <span className="waiter-bob block">
            <span key={waving} className={`block ${waving ? 'waiter-wave' : ''}`}>
              <img
                src={waiterImg}
                alt=""
                draggable="false"
                className="w-full select-none transition-transform duration-150 group-hover:-translate-y-1 group-active:scale-[0.94] motion-reduce:transition-none"
              />
            </span>
          </span>
          {activeCall && (
            <span className="absolute right-3 top-2 flex size-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:animate-none" style={{ backgroundColor: dotColor }} />
              <span className="relative inline-flex size-3 rounded-full ring-2 ring-white dark:ring-zinc-950" style={{ backgroundColor: dotColor }} />
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
