import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@smo/ui';
import { SquareLock02Icon, Alert02Icon, Clock01Icon } from 'hugeicons-react';
import { planFeature } from '@smo/shared/plans';
import { useEntitlements } from '../../lib/entitlements';
import { useAuthStore } from '../../store/authStore';

const day = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const days = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** Shown in place of a page whose feature isn't in the brand's plan */
export const UpgradeRequired = ({ feature }) => {
  const { user } = useAuthStore();
  const plan = useEntitlements(s => s.plan);
  const info = planFeature(feature);
  const isOwner = user?.role === 'TENANT_ADMIN';

  return (
    <div className="mx-auto max-w-lg px-6 py-16 flex flex-col items-center text-center gap-3">
      <span className="size-12 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500">
        <SquareLock02Icon size={22} />
      </span>
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{info?.label || 'This feature'} isn’t in your plan</h1>
      <p className="text-sm text-zinc-500">
        {info?.description ? `${info.description}. ` : ''}
        {plan ? `Your brand is on ${plan.name}, which doesn’t include it.` : 'Your current plan doesn’t include it.'}
      </p>
      {isOwner ? (
        <Button asChild className="mt-2 !bg-amber-400 hover:!bg-amber-500 !text-zinc-950">
          <Link to="/dashboard/subscriptions">See plans that include it</Link>
        </Button>
      ) : (
        <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">Ask the owner to upgrade the plan under Subscription.</p>
      )}
    </div>
  );
};

/**
 * One line across the top of the dashboard when the subscription needs attention:
 * a trial counting down, a plan in its grace period, or one that has ended.
 */
export const SubscriptionBanner = () => {
  const { user } = useAuthStore();
  const { loaded, state, daysLeft, periodEnd, isTrial, plan } = useEntitlements();
  if (!loaded || !plan || user?.role === 'SUPER_ADMIN') return null;

  const isOwner = user?.role === 'TENANT_ADMIN';
  const what = isTrial ? 'free trial' : `${plan.name} subscription`;
  let tone;
  let Icon = Clock01Icon;
  let text;

  if (state === 'LOCKED') {
    tone = 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900';
    Icon = Alert02Icon;
    text = `Your ${what} has ended. New orders are switched off until it is renewed; everything else still works.`;
  } else if (state === 'GRACE') {
    tone = 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900';
    Icon = Alert02Icon;
    text = `Your ${what} ended on ${day(periodEnd)}. Orders stop in ${days(daysLeft)} unless it is renewed.`;
  } else if (state === 'TRIAL') {
    tone = 'bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900';
    text = `Free trial: ${days(daysLeft)} left with every feature. Pick a plan before ${day(periodEnd)} to keep taking orders.`;
  } else if (state === 'ACTIVE' && daysLeft !== null && daysLeft <= 5) {
    tone = 'bg-zinc-50 text-zinc-800 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-800';
    text = `Your ${what} ends in ${days(daysLeft)}, on ${day(periodEnd)}.`;
  } else {
    return null;
  }

  return (
    <div role="status" className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-sm ${tone}`}>
      <Icon size={16} className="shrink-0" />
      <span className="min-w-0 flex-1">{text}</span>
      {isOwner
        ? <Link to="/dashboard/subscriptions" className="font-semibold underline underline-offset-2 whitespace-nowrap">{state === 'TRIAL' ? 'See plans' : 'Renew now'}</Link>
        : <span className="whitespace-nowrap opacity-80">Please tell the owner.</span>}
    </div>
  );
};
