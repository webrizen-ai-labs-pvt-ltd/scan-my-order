import { CheckmarkCircle02Icon, ShieldKeyIcon } from 'hugeicons-react';
import { cn } from '@smo/ui/lib/utils';
import { byoak } from '../data/site';
import { Reveal, RevealGroup, RevealItem } from '../components/reveal';
import { Tilt, TiltLayer } from '../components/tilt';
import { Parallax } from '../components/parallax';

function FlowNode({ label, sub, accent = false, depth }) {
  return (
    <TiltLayer depth={depth}>
      <div
        className={cn(
          'rounded-2xl px-4 py-3 sheen',
          accent
            ? 'bg-primary text-primary-foreground glow'
            : 'border border-white/10 bg-white/[0.06] text-zinc-50 backdrop-blur-md'
        )}
      >
        <p className="text-sm font-semibold">{label}</p>
        <p className={cn('text-xs', accent ? 'text-primary-foreground/70' : 'text-zinc-400')}>{sub}</p>
      </div>
    </TiltLayer>
  );
}

function Arrow() {
  return (
    <span aria-hidden="true" className="flex items-center justify-center text-zinc-500">
      <svg width="40" height="16" viewBox="0 0 40 16" fill="none" className="rotate-90 sm:rotate-0">
        <path d="M0 8h36M30 2l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Byoak() {
  return (
    <section className="relative isolate overflow-hidden bg-zinc-950 text-zinc-50">
      {/* Depth: a lit grid floor receding into the dark */}
      <Parallax speed={8} className="pointer-events-none absolute inset-0 -z-10 scene">
        <div className="grid-floor absolute inset-x-[-20%] bottom-[-10%] top-[40%] opacity-70 [transform:rotateX(70deg)] [transform-origin:50%_100%]" />
        <div className="absolute left-1/2 top-[55%] h-[30rem] w-[50rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      </Parallax>

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

        {/* Money-flow diagram as a floating glass slab */}
        <Reveal delay={0.1}>
          <Tilt max={7} lift={20}>
            <div className="rounded-[var(--radius)] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl depth-3 sheen sm:p-8">
              <p className="mb-5 text-xs font-medium uppercase tracking-wider text-zinc-400">Where the money goes</p>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
                <FlowNode label="Guest pays" sub="UPI · Card · Wallet" depth={16} />
                <Arrow />
                <FlowNode label="Your Razorpay" sub="Your keys, your account" accent depth={40} />
                <Arrow />
                <FlowNode label="Your bank" sub="100% of the bill" depth={16} />
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5 text-sm">
                <span className="text-zinc-400">Platform commission on this order</span>
                <TiltLayer depth={30}>
                  <span className="font-elsie text-3xl text-yellow-400 drop-shadow-[0_8px_20px_rgba(234,179,8,0.5)]">₹0</span>
                </TiltLayer>
              </div>
            </div>
          </Tilt>
        </Reveal>
      </div>
    </section>
  );
}
