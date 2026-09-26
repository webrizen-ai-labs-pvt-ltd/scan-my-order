import React from 'react';
import { AlertCircleIcon, CheckmarkCircle02Icon } from 'hugeicons-react';

/** Success / error line. `msg` is { text, error } */
export const Notice = ({ msg }) => (msg?.text ? (
  <div role={msg.error ? 'alert' : 'status'} className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 border ${msg.error
    ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'}`}>
    {msg.error ? <AlertCircleIcon size={16} className="shrink-0" /> : <CheckmarkCircle02Icon size={16} className="shrink-0" />}
    {msg.text}
  </div>
) : null);

/** A titled card made of rows. `actions` sit in the header, `footer` in a bar at the bottom. */
export const Panel = ({ title, description, actions, children, footer }) => (
  <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
    <header className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        {description && <p className="text-sm text-zinc-500 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </header>
    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">{children}</div>
    {footer && <footer className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-end gap-3">{footer}</footer>}
  </section>
);

/** One setting: label and explanation on the left, controls on the right (stacked on small screens) */
export const Row = ({ label, hint, children }) => (
  <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] gap-x-10 gap-y-3">
    <div>
      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</div>
      {hint && <div className="text-xs text-zinc-500 mt-1 leading-relaxed">{hint}</div>}
    </div>
    <div className="min-w-0">{children}</div>
  </div>
);

/**
 * Section list: a row of tabs on small screens, a sticky column on large ones.
 * @param {{ tabs: {id,label,hint?,icon}[], active: string, onChange: Function }} props
 */
export const SectionNav = ({ tabs, active, onChange, label = 'Sections' }) => (
  <nav aria-label={label} className="lg:sticky lg:top-4">
    <ul className="flex lg:flex-col gap-1 overflow-x-auto">
      {tabs.map(t => {
        const Icon = t.icon;
        const on = active === t.id;
        return (
          <li key={t.id} className="shrink-0">
            <button
              type="button"
              onClick={() => onChange(t.id)}
              aria-current={on ? 'page' : undefined}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left ${on
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
            >
              {Icon && <Icon size={17} className={on ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'} />}
              <span className="flex flex-col">
                <span className="text-sm font-medium">{t.label}</span>
                {t.hint && <span className="hidden lg:block text-[11px] text-zinc-500">{t.hint}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  </nav>
);

/** Two-column page body: section nav + content */
export const SectionLayout = ({ nav, children }) => (
  <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-6 items-start">
    {nav}
    <div className="min-w-0">{children}</div>
  </div>
);

/** Label/value pair for summary strips */
export const Stat = ({ icon: Icon, label, children }) => (
  <div>
    <dt className="text-xs text-zinc-500 flex items-center gap-1">{Icon && <Icon size={12} />} {label}</dt>
    <dd className="font-medium text-zinc-900 dark:text-zinc-100">{children}</dd>
  </div>
);
