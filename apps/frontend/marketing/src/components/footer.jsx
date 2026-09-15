import { Link } from 'react-router-dom';
import { Mail01Icon } from 'hugeicons-react';
import { footerColumns, links } from '../data/site';
import { Brand } from './brand';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative border-t border-border/60 bg-background/60 backdrop-blur-xl">
      <div className="container mx-auto grid gap-10 px-4 py-14 md:grid-cols-[1.5fr_1fr_1fr] md:px-8">
        <div>
          <Brand />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground text-pretty">
            QR menus, POS, kitchen display and payments for independent restaurants — one subscription,
            no commission.
          </p>
          <a
            href={`mailto:${links.contactEmail}`}
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 text-sm hover:text-yellow-700 dark:hover:text-yellow-400"
          >
            <Mail01Icon size={16} aria-hidden="true" />
            {links.contactEmail}
          </a>
        </div>

        {footerColumns.map((col) => (
          <nav key={col.heading} aria-label={col.heading}>
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{col.heading}</h3>
            <ul className="mt-4 space-y-1">
              {col.items.map((item) => (
                <li key={item.label}>
                  {item.to ? (
                    <Link to={item.to} className="inline-flex min-h-[40px] items-center text-sm hover:text-yellow-700 dark:hover:text-yellow-400">
                      {item.label}
                    </Link>
                  ) : (
                    <a href={item.href} className="inline-flex min-h-[40px] items-center text-sm hover:text-yellow-700 dark:hover:text-yellow-400">
                      {item.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t">
        <div className="container mx-auto flex flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-8">
          <p>© {year} Webrizen AI Labs Pvt Ltd. All rights reserved.</p>
          <p>Scan My Order is part of the Webrizen ecosystem.</p>
        </div>
      </div>
    </footer>
  );
}
