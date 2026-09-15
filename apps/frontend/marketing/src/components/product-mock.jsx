import { motion, useReducedMotion } from 'framer-motion';
import { QrCodeIcon, ChefHatIcon, WaiterIcon, Tick02Icon } from 'hugeicons-react';
import { cn } from '@smo/ui/lib/utils';

const TICKETS = [
  { id: '#1042', table: 'T7', items: ['2× Paneer Tikka', '1× Garlic Naan'], status: 'PROCESSING', age: '4m' },
  { id: '#1041', table: 'T3', items: ['1× Dal Makhani', '2× Jeera Rice'], status: 'READY', age: '9m' },
  { id: '#1040', table: 'T12', items: ['3× Masala Chai'], status: 'SERVED', age: '14m' },
];

const STATUS = {
  PROCESSING: 'bg-yellow-400/25 text-yellow-900 dark:text-yellow-200',
  READY: 'bg-emerald-400/20 text-emerald-800 dark:text-emerald-200',
  SERVED: 'bg-zinc-400/20 text-zinc-700 dark:text-zinc-300',
};

const MENU = [
  { name: 'Butter Chicken', price: '₹340' },
  { name: 'Veg Biryani', price: '₹260' },
  { name: 'Gulab Jamun', price: '₹120' },
];

function Float({ children, className, delay = 0, drift = 6 }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      animate={reduce ? undefined : { y: [0, -drift, 0] }}
      transition={{ duration: 6, delay, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Illustrative composition of the three surfaces guests and staff see:
 * kitchen tickets, the guest QR menu, and a live waiter call.
 */
export function ProductMock({ className }) {
  return (
    <div className={cn('relative mx-auto w-full max-w-xl pb-8 pt-4', className)} aria-hidden="true">
      {/* Kitchen display board */}
      <div className="soft-border bg-card shadow-soft-in dark:shadow-soft-in-dark p-4 sm:ml-12 sm:p-5">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ChefHatIcon size={18} className="text-yellow-700 dark:text-yellow-400" />
            Kitchen · Main Street
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 bg-emerald-500" />
            </span>
            Live
          </span>
        </div>

        <ul className="mt-3 grid gap-2.5">
          {TICKETS.map((t) => (
            <li key={t.id} className="soft-border bg-background/60 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">
                  {t.id} <span className="text-muted-foreground">· Table {t.table}</span>
                </span>
                <span className={cn('px-2 py-0.5 text-[10px] font-semibold tracking-wide', STATUS[t.status])}>
                  {t.status}
                </span>
              </div>
              <div className="mt-1.5 flex items-end justify-between">
                <p className="text-xs text-muted-foreground leading-5">{t.items.join(' · ')}</p>
                <span className="text-[10px] text-muted-foreground">{t.age}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Guest phone menu */}
      <Float className="absolute bottom-8 -left-1 w-[40%] min-w-[150px] sm:left-0" delay={0.4}>
        <div className="soft-border bg-card shadow-soft-in dark:shadow-soft-in-dark p-3">
          <div className="flex items-center gap-2 border-b pb-2">
            <QrCodeIcon size={16} className="text-yellow-700 dark:text-yellow-400" />
            <span className="text-[11px] font-semibold">Table 7 · Menu</span>
          </div>
          <ul className="mt-2 space-y-2">
            {MENU.map((m) => (
              <li key={m.name} className="flex items-center justify-between text-[11px]">
                <span className="truncate">{m.name}</span>
                <span className="ml-2 font-medium tabular-nums">{m.price}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 bg-primary px-3 py-2 text-center text-[11px] font-semibold text-primary-foreground">
            Pay ₹720 · UPI
          </div>
        </div>
      </Float>

      {/* Waiter call toast */}
      <Float className="absolute -right-2 top-0 sm:-right-4" delay={1.2} drift={5}>
        <div className="soft-border bg-card shadow-soft-in dark:shadow-soft-in-dark flex items-center gap-2.5 px-3 py-2">
          <span className="inline-flex h-7 w-7 items-center justify-center bg-yellow-400/25 text-yellow-800 dark:text-yellow-300">
            <WaiterIcon size={16} />
          </span>
          <div className="leading-tight">
            <p className="text-[11px] font-semibold">Table 12 needs help</p>
            <p className="text-[10px] text-muted-foreground">Just now</p>
          </div>
        </div>
      </Float>

      {/* Stock auto-hide badge */}
      <Float className="absolute -bottom-3 right-2 sm:right-0" delay={2} drift={4}>
        <div className="soft-border bg-card shadow-soft-in dark:shadow-soft-in-dark flex items-center gap-2 px-3 py-1.5 text-[11px]">
          <Tick02Icon size={14} className="text-emerald-600 dark:text-emerald-400" />
          Stock synced · 2 items hidden
        </div>
      </Float>
    </div>
  );
}
