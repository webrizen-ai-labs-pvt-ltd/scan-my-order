import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Task01Icon, ShoppingCart01Icon, Restaurant01Icon } from 'hugeicons-react';

const TABS = [
  { to: '/dashboard/waiter', end: true, label: 'Queue', Icon: Task01Icon },
  { to: '/dashboard/waiter/pos', end: false, label: 'Take Order', Icon: ShoppingCart01Icon },
];

export const Waiter = () => {
  return (
    <div className="flex h-[calc(100dvh-5rem)] flex-col overflow-hidden bg-zinc-50 text-zinc-900 select-none [-webkit-tap-highlight-color:transparent] dark:bg-zinc-950 dark:text-zinc-100">

      <main className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>

      <nav aria-label="Waiter sections" className="shrink-0 border-t border-zinc-200/70 bg-white/90 backdrop-blur-md px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] dark:border-zinc-800/70 dark:bg-zinc-950/90">
        <div className="flex items-stretch gap-1">
          {TABS.map(({ to, end, label, Icon }) => (
            <NavLink key={to} to={to} end={end} className="flex-1 touch-manipulation">
              {({ isActive }) => (
                <span className={`flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition-all duration-150 active:scale-[0.96] ${isActive ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' : 'text-zinc-500 active:bg-zinc-100 dark:text-zinc-400 dark:active:bg-zinc-900'}`}>
                  <Icon className="h-6 w-6" />
                  <span className="text-[11px] font-semibold leading-none">{label}</span>
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};