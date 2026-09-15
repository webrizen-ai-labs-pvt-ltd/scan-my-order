import { CheckmarkCircle02Icon, ShieldKeyIcon } from 'hugeicons-react';
import { byoak } from '../data/site';
import { Reveal, RevealGroup, RevealItem } from '../components/reveal';

function FlowNode({ label, sub, accent = false }) {
  return (
    <div
      className={
        accent
          ? 'bg-primary px-4 py-3 text-primary-foreground shadow-soft-in'
          : 'soft-border bg-card px-4 py-3 shadow-soft-in dark:shadow-soft-in-dark'
      }
    >
      <p className="text-sm font-semibold">{label}</p>
      <p className={accent ? 'text-xs text-primary-foreground/70' : 'text-xs text-muted-foreground'}>{sub}</p>
    </div>
  );
}

function Arrow() {
  return (
    <span aria-hidden="true" className="flex items-center justify-center text-muted-foreground">
      <svg width="40" height="16" viewBox="0 0 40 16" fill="none" className="rotate-90 sm:rotate-0">
        <path d="M0 8h36M30 2l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Byoak() {
  return (
    <section className="border-y bg-zinc-950 text-zinc-50 dark:bg-zinc-900">
      <div className="container mx-auto grid items-center gap-12 px-4 py-20 md:px-8 md:py-28 lg:grid-cols-2 lg:gap-16">
        <div>
          <Reveal>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-yellow-400">
              <ShieldKeyIcon size={16} aria-hidden="true" />
              {byoak.eyebrow}
            </p>
            <h2 className="mt-4 font-elsie text-3xl leading-tight text-balance md:text-5xl">{byoak.title}</h2>
            <p className="mt-5 max-w-lg text-base text-zinc-300 text-pretty md:text-lg">{byoak.body}</p>
          </Reveal>

          <RevealGroup as="ul" className="mt-8 grid gap-3 sm:grid-cols-2">
            {byoak.points.map((pt) => (
              <RevealItem as="li" key={pt} className="flex items-start gap-2.5 text-sm text-zinc-200">
                <CheckmarkCircle02Icon size={18} className="mt-0.5 shrink-0 text-yellow-400" aria-hidden="true" />
                {pt}
              </RevealItem>
            ))}
          </RevealGroup>
        </div>

        {/* Money flow diagram */}
        <Reveal delay={0.1} className="text-zinc-900 dark:text-zinc-50">
          <div className="border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-950/40 sm:p-8">
            <p className="mb-5 text-xs font-medium uppercase tracking-wider text-zinc-400">Where the money goes</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
              <FlowNode label="Guest pays" sub="UPI · Card · Wallet" />
              <Arrow />
              <FlowNode label="Your Razorpay" sub="Your keys, your account" accent />
              <Arrow />
              <FlowNode label="Your bank" sub="100% of the bill" />
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-5 text-sm dark:border-zinc-700">
              <span className="text-zinc-400">Platform commission on this order</span>
              <span className="font-elsie text-2xl text-yellow-400">₹0</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
