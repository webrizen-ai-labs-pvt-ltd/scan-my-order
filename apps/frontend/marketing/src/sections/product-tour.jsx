import { QrCodeIcon, ChefHatIcon, Invoice01Icon } from 'hugeicons-react';
import { cn } from '@smo/ui/lib/utils';
import { SectionHeading } from '../components/section-heading';
import { Reveal, RevealGroup, RevealItem } from '../components/reveal';
import { Tilt, TiltLayer } from '../components/tilt';
import { Panel } from '../components/panel';

/* ---------- Screen content (illustrative, uses real order states) ---------- */

const MENU = [
  { name: 'Butter Chicken', price: '₹340', tag: 'Chef’s pick' },
  { name: 'Veg Biryani', price: '₹260' },
  { name: 'Garlic Naan', price: '₹60' },
  { name: 'Gulab Jamun', price: '₹120' },
];

const TICKETS = [
  { id: '#1042', table: 'T7', items: '2× Paneer Tikka · 1× Garlic Naan', status: 'PROCESSING', age: '4m' },
  { id: '#1041', table: 'T3', items: '1× Dal Makhani · 2× Jeera Rice', status: 'READY', age: '9m' },
  { id: '#1040', table: 'T12', items: '3× Masala Chai', status: 'SERVED', age: '14m' },
];

const STATUS = {
  PROCESSING: 'bg-primary/20 text-yellow-900 dark:text-yellow-200',
  READY: 'bg-emerald-400/20 text-emerald-800 dark:text-emerald-200',
  SERVED: 'bg-zinc-400/20 text-zinc-700 dark:text-zinc-300',
};

const TABLES = [
  ['T1', 'seated'], ['T2', 'free'], ['T3', 'ready'], ['T4', 'ordering'],
  ['T5', 'free'], ['T6', 'seated'], ['T7', 'ordering'], ['T8', 'bill'],
  ['T9', 'free'], ['T10', 'seated'], ['T11', 'free'], ['T12', 'call'],
];

const TABLE_STYLE = {
  free: 'border-dashed border-border text-muted-foreground',
  seated: 'bg-foreground/[0.06] border-transparent',
  ordering: 'bg-primary/20 border-primary/40',
  ready: 'bg-emerald-400/20 border-emerald-500/40',
  bill: 'bg-sky-400/20 border-sky-500/40',
  call: 'bg-red-400/20 border-red-500/40 animate-pulse',
};

function ScreenHeader({ icon: Icon, title, meta }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 pb-3 dark:border-white/5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon size={18} className="text-yellow-700 dark:text-yellow-400" aria-hidden="true" />
        {title}
      </div>
      <span className="text-[11px] text-muted-foreground">{meta}</span>
    </div>
  );
}

function GuestMenu() {
  return (
    <>
      <ScreenHeader icon={QrCodeIcon} title="Table 7 · Menu" meta="Guest view" />
      <ul className="mt-3 space-y-2">
        {MENU.map((m) => (
          <li key={m.name} className="flex items-center justify-between rounded-xl bg-foreground/[0.04] px-3 py-2 text-xs">
            <span>
              {m.name}
              {m.tag && <span className="ml-2 rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-semibold">{m.tag}</span>}
            </span>
            <span className="font-medium tabular-nums">{m.price}</span>
          </li>
        ))}
      </ul>
      <TiltLayer depth={30} className="mt-3">
        <div className="rounded-xl bg-primary px-3 py-2.5 text-center text-xs font-semibold text-primary-foreground depth-1">
          Pay ₹720 · UPI
        </div>
      </TiltLayer>
    </>
  );
}

function Pos() {
  return (
    <>
      <ScreenHeader icon={Invoice01Icon} title="Floor · Main Street" meta="Staff view" />
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {TABLES.map(([t, s]) => (
          <div key={t} className={cn('flex aspect-square items-center justify-center rounded-lg border text-[10px] font-semibold', TABLE_STYLE[s])}>
            {t}
          </div>
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[9.5px] text-muted-foreground">
        <li><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />Ordering</li>
        <li><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />Ready</li>
        <li><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-sky-500" />Bill</li>
        <li><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500" />Call</li>
      </ul>
    </>
  );
}

function Kds() {
  return (
    <>
      <ScreenHeader
        icon={ChefHatIcon}
        title="Kitchen"
        meta={
          <span className="inline-flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        }
      />
      <ul className="mt-3 space-y-2">
        {TICKETS.map((t) => (
          <li key={t.id} className="rounded-xl bg-foreground/[0.04] p-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold">
                {t.id} <span className="text-muted-foreground">· {t.table}</span>
              </span>
              <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wide', STATUS[t.status])}>{t.status}</span>
            </div>
            <div className="mt-1 flex items-end justify-between">
              <p className="text-[10.5px] text-muted-foreground">{t.items}</p>
              <span className="text-[9.5px] text-muted-foreground">{t.age}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---------- Section ---------- */

const SCREENS = [
  { key: 'menu', label: 'Guest', caption: 'Scan → browse → pay', Screen: GuestMenu, pose: 'lg:[transform:perspective(1400px)_rotateY(22deg)_translateZ(-40px)] lg:origin-right' },
  { key: 'pos', label: 'Floor', caption: 'Live table map', Screen: Pos, pose: 'lg:[transform:perspective(1400px)_translateZ(40px)] lg:-mt-6' },
  { key: 'kds', label: 'Kitchen', caption: 'Tickets in real time', Screen: Kds, pose: 'lg:[transform:perspective(1400px)_rotateY(-22deg)_translateZ(-40px)] lg:origin-left' },
];

export function ProductTour() {
  return (
    <section id="product" className="scroll-mt-24 relative overflow-hidden py-20 md:py-28">
      <div className="container mx-auto px-4 md:px-8">
        <SectionHeading
          eyebrow="One order, three screens"
          title="What the guest taps, the kitchen sees."
          body="A single order flows from the table to the floor to the pass. Nobody types it twice."
        />

        <RevealGroup className="mt-14 grid gap-6 lg:grid-cols-3 lg:gap-4" stagger={0.12}>
          {SCREENS.map(({ key, label, caption, Screen, pose }) => (
            <RevealItem key={key}>
              <div className={cn('flat-3d transition-transform duration-500', pose)}>
                <Tilt max={6} lift={16}>
                  <Panel depth={3} className="p-4 sm:p-5">
                    <Screen />
                  </Panel>
                </Tilt>
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{label}</span> · {caption}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>

        {/* Connector: the "order" travelling across the three screens */}
        <Reveal className="mx-auto mt-10 hidden max-w-3xl items-center gap-3 text-[11px] text-muted-foreground lg:flex">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/60 to-primary" />
          <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-medium">order #1042</span>
          <span className="h-px flex-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />
        </Reveal>
      </div>
    </section>
  );
}
