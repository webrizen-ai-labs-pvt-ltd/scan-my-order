import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Tick02Icon } from 'hugeicons-react';
import { Button } from '@smo/ui';
import { cn } from '@smo/ui/lib/utils';
import { pricing } from '../data/site';
import { RevealGroup, RevealItem } from '../components/reveal';
import { Tilt, TiltLayer } from '../components/tilt';
import { Panel } from '../components/panel';

const formatINR = (n) => n.toLocaleString('en-IN');

// The highlighted plan sits forward in Z; neighbours angle toward it.
const POSE = {
  left: 'lg:[transform:perspective(1600px)_rotateY(8deg)_translateZ(-30px)] lg:origin-right',
  center: 'lg:[transform:perspective(1600px)_translateZ(30px)]',
  right: 'lg:[transform:perspective(1600px)_rotateY(-8deg)_translateZ(-30px)] lg:origin-left',
};

function IntervalToggle({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Billing interval" className="glass sheen depth-1 inline-flex rounded-full p-1">
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
              'relative min-h-[40px] rounded-full px-4 text-sm font-medium transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'bg-primary text-primary-foreground depth-1' : 'text-muted-foreground hover:text-foreground'
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
  const poses = ['left', 'center', 'right'];

  return (
    <div className={className}>
      <div className="flex justify-center">
        <IntervalToggle value={interval} onChange={setInterval} />
      </div>

      <RevealGroup className="mt-12 grid gap-6 lg:grid-cols-3 lg:gap-4" stagger={0.08}>
        {pricing.plans.map((plan, i) => (
          <RevealItem key={plan.key}>
            <div className={cn('h-full', POSE[poses[i]])}>
              <Tilt max={5} lift={plan.highlighted ? 20 : 12} className="h-full">
                <Panel
                  depth={plan.highlighted ? 3 : 2}
                  className={cn(
                    'relative flex h-full flex-col p-7',
                    plan.highlighted && 'border-primary/50 glow ring-1 ring-primary/40'
                  )}
                >
                  {plan.badge && (
                    <TiltLayer depth={40} className="absolute -top-3 left-7">
                      <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground depth-1">
                        {plan.badge}
                      </span>
                    </TiltLayer>
                  )}
                  <TiltLayer depth={16}>
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
                    <Price plan={plan} interval={interval} />
                  </TiltLayer>

                  <TiltLayer depth={28} className="mt-6">
                    <Button asChild className="w-full depth-1" variant={plan.highlighted ? 'default' : 'outline'}>
                      <Link to="/contact">{plan.cta}</Link>
                    </Button>
                  </TiltLayer>

                  <ul className="mt-7 space-y-2.5 border-t border-border/60 pt-6 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Tick02Icon size={16} className="mt-0.5 shrink-0 text-yellow-700 dark:text-yellow-400" aria-hidden="true" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </Panel>
              </Tilt>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>

      <p className="mt-8 text-center text-xs text-muted-foreground">Prices exclude GST. {pricing.betaNote}</p>
    </div>
  );
}
