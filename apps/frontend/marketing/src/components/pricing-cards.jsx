import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Tick02Icon } from 'hugeicons-react';
import { Button } from '@smo/ui';
import { cn } from '@smo/ui/lib/utils';
import { pricing } from '../data/site';
import { RevealGroup, RevealItem } from '../components/reveal';

const formatINR = (n) => n.toLocaleString('en-IN');

function IntervalToggle({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Billing interval" className="inline-flex soft-border bg-card p-1">
      {pricing.intervals.map((i) => {
        const active = value === i.key;
        return (
          <button
            key={i.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(i.key)}
            className={cn(
              'relative min-h-[40px] px-4 text-sm font-medium transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {i.label}
            {i.hint && (
              <span className={cn('ml-2 text-[11px]', active ? 'text-primary-foreground/70' : 'text-yellow-700 dark:text-yellow-400')}>
                {i.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Price({ plan, interval }) {
  if (!plan.price) {
    return (
      <div className="mt-6">
        <span className="font-elsie text-4xl">Custom</span>
        <p className="mt-1 text-xs text-muted-foreground">Volume pricing for 6+ stores</p>
      </div>
    );
  }
  const amount = plan.price[interval];
  const perMonth = interval === 'YEARLY' ? Math.round(amount / 12) : amount;
  return (
    <div className="mt-6">
      <div className="flex items-baseline gap-1">
        <span className="font-elsie text-4xl tabular-nums">
          {pricing.currency}
          {formatINR(perMonth)}
        </span>
        <span className="text-sm text-muted-foreground">/ month{plan.perStore ? ' / store' : ''}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
        {interval === 'YEARLY'
          ? `Billed ${pricing.currency}${formatINR(amount)} yearly`
          : `Or ${pricing.currency}${formatINR(plan.price.YEARLY)} / year — 2 months free`}
      </p>
    </div>
  );
}

export function PricingCards({ className }) {
  const [interval, setInterval] = useState('MONTHLY');

  return (
    <div className={className}>
      <div className="flex justify-center">
        <IntervalToggle value={interval} onChange={setInterval} />
      </div>

      <RevealGroup className="mt-10 grid gap-5 lg:grid-cols-3" stagger={0.08}>
        {pricing.plans.map((plan) => (
          <RevealItem
            key={plan.key}
            className={cn(
              'relative flex flex-col p-7 soft-border bg-card shadow-soft-in dark:shadow-soft-in-dark',
              plan.highlighted && 'border-yellow-500/60 ring-1 ring-yellow-500/40 lg:-my-3 lg:py-10'
            )}
          >
            {plan.badge && (
              <span className="absolute -top-3 left-7 bg-primary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
                {plan.badge}
              </span>
            )}
            <h3 className="text-lg font-semibold">{plan.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>

            <Price plan={plan} interval={interval} />

            <Button asChild className="mt-6 w-full" variant={plan.highlighted ? 'default' : 'outline'}>
              <Link to="/contact">{plan.cta}</Link>
            </Button>

            <ul className="mt-7 space-y-2.5 border-t pt-6 text-sm">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Tick02Icon size={16} className="mt-0.5 shrink-0 text-yellow-700 dark:text-yellow-400" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
          </RevealItem>
        ))}
      </RevealGroup>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Prices exclude GST. {pricing.betaNote}
      </p>
    </div>
  );
}
