import React, { useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@smo/ui';
import { Notification03Icon, NotificationOff03Icon, Loading03Icon } from 'hugeicons-react';
import { usePushNotifications } from '../hooks/use-push-notifications';

const Switch = ({ checked, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-amber-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
  >
    <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
  </button>
);

const Row = ({ title, hint, children }) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <span className="min-w-0">
      <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</span>
      <span className="block text-xs text-zinc-500">{hint}</span>
    </span>
    {children}
  </div>
);

/**
 * Bell button for the menu header and the sheet behind it, where a guest manages what this
 * restaurant may send to their phone: alerts about their own orders, and (separately) offers.
 *
 * @param {{ storeId: string, storeName?: string }} props
 */
export const NotificationSettings = ({ storeId, storeName }) => {
  const [open, setOpen] = useState(false);
  const { isSupported, permission, isSubscribed, loading, error, subscribe, unsubscribe, offers, setOffers } = usePushNotifications(storeId);
  const place = storeName || 'this restaurant';
  const on = isSupported && permission === 'granted' && isSubscribed;
  const blocked = isSupported && permission === 'denied';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Notifications"
        aria-label={on ? 'Notifications are on. Open notification settings' : 'Notifications are off. Open notification settings'}
        className="relative flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        {on ? <Notification03Icon size={16} /> : <NotificationOff03Icon size={16} />}
        {on && <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950" />}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="w-full sm:max-w-md mx-auto p-6 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-t-3xl">
          <SheetTitle className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50">Notifications</SheetTitle>
          <p className="text-sm text-zinc-500">Choose what {place} can send to this phone.</p>

          {!isSupported ? (
            <p className="mt-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 text-sm text-zinc-600 dark:text-zinc-400">
              This browser can’t show notifications. On an iPhone, first add this page to your Home Screen (Share → Add to Home Screen), then open it from there.
            </p>
          ) : blocked ? (
            <p className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
              Notifications are blocked for this site on this phone. To turn them on, tap the lock icon next to the web address, open <strong>Permissions</strong> or <strong>Site settings</strong>, and set Notifications to <strong>Allow</strong>. Then come back here.
            </p>
          ) : (
            <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
              <Row title="Order alerts" hint={on ? 'On. We tell you when your food is cooking and ready.' : 'Off. Turn on to know when your food is ready.'}>
                {loading
                  ? <Loading03Icon size={20} className="animate-spin text-zinc-400 shrink-0" />
                  : <Switch checked={on} label="Order alerts" onChange={(next) => (next ? subscribe({ offers }) : unsubscribe())} />}
              </Row>
              <Row
                title={`Offers from ${place}`}
                hint={!on ? 'Turn on order alerts first.' : offers ? 'On. You’ll get deals and news, at most once a day.' : 'Off. You only hear about your own orders.'}
              >
                <Switch checked={on && offers} disabled={!on || loading} label={`Offers from ${place}`} onChange={setOffers} />
              </Row>
            </div>
          )}

          {error && !blocked && !on && (
            <p role="alert" className="mt-2 rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-300">{error}</p>
          )}

          {isSupported && !blocked && !on && !error && (
            <p className="mt-2 text-xs text-zinc-500">Your phone will ask you to allow notifications when you turn this on.</p>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};
