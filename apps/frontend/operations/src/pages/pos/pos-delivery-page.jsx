import React from 'react';
import { Motorbike01Icon, CheckmarkCircle02Icon } from 'hugeicons-react';

const PLANNED = [
  'Zomato & Swiggy orders land in the POS next to dine-in and takeaway',
  'Accept or reject with prep time, straight from this screen',
  'Tickets go to the kitchen display automatically',
  'Menu and item availability stay in sync with the platforms',
  'Aggregator sales included in daily reports',
];

/**
 * Placeholder for food-delivery aggregator orders (Zomato / Swiggy).
 */
export const PosDeliveryPage = () => (
  <div className="h-full overflow-y-auto">
    <div className="max-w-xl mx-auto px-4 py-12 flex flex-col items-center text-center gap-5">
      <div className="relative">
        <div className="size-20 rounded-3xl bg-amber-400 text-amber-950 flex items-center justify-center shadow-lg">
          <Motorbike01Icon size={40} />
        </div>
        <span className="absolute -top-2 -right-3 px-2 py-0.5 rounded-full bg-zinc-900 text-amber-400 text-[10px] font-black uppercase tracking-wider dark:bg-zinc-100 dark:text-zinc-900">
          Soon
        </span>
      </div>

      <div>
        <h1 className="text-2xl font-black text-stone-900 dark:text-zinc-50">Zomato & Swiggy orders</h1>
        <p className="mt-2 text-sm text-stone-500 dark:text-zinc-400">
          Delivery orders from food apps, managed in the same POS as the rest of your restaurant. Coming soon.
        </p>
      </div>

      <ul className="w-full text-left rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-stone-100 dark:divide-zinc-800">
        {PLANNED.map(item => (
          <li key={item} className="flex items-start gap-3 px-4 py-3 text-sm text-stone-700 dark:text-zinc-300">
            <CheckmarkCircle02Icon size={18} className="text-amber-500 shrink-0 mt-0.5" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  </div>
);
