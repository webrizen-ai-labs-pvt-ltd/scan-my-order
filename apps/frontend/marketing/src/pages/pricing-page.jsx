import { Link } from 'react-router-dom';
import { Button } from '@smo/ui';
import { pricing, faqs } from '../data/site';
import { SectionHeading } from '../components/section-heading';
import { PricingCards } from '../components/pricing-cards';
import { Reveal } from '../components/reveal';
import { Byoak } from '../sections/byoak';
import { Cta } from '../sections/cta';
import { usePageMeta } from '../lib/use-page-meta';

// Plan × capability matrix for the comparison table.
const COMPARISON = [
  { label: 'Stores included', values: ['1', 'Up to 5', 'Unlimited'] },
  { label: 'QR menus, POS, KDS', values: [true, true, true] },
  { label: 'Live floor plan', values: [true, true, true] },
  { label: 'Inventory & recipes', values: [true, true, true] },
  { label: 'Waiter calls & feedback', values: [true, true, true] },
  { label: 'Store-manager roles', values: [false, true, true] },
  { label: 'Promo codes', values: [false, true, true] },
  { label: 'Table reservations', values: [false, true, true] },
  { label: 'Custom domain for menus', values: [false, false, true] },
  { label: 'Dedicated onboarding', values: [false, false, true] },
  { label: 'Support', values: ['Email', 'Priority', 'SLA-backed'] },
];

function Cell({ value }) {
  if (value === true) {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center bg-yellow-400/25 text-yellow-800 dark:text-yellow-300" aria-label="Included">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 6.5l2.5 2.5L10 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (value === false) return <span className="text-muted-foreground" aria-label="Not included">—</span>;
  return <span>{value}</span>;
}

const PRICING_FAQS = faqs.filter((f) => /pric|pay|API key|stop paying/i.test(f.q + f.a)).slice(0, 4);

export default function PricingPage() {
  usePageMeta({
    title: 'Pricing — Scan My Order',
    description: 'Flat per-store pricing for QR menus, POS and kitchen display. No commission on orders.',
  });

  return (
    <>
      <section className="container mx-auto px-4 pt-16 pb-20 md:px-8 md:pt-24 md:pb-28">
        <SectionHeading
          eyebrow="Pricing"
          title="Priced per store. Never per order."
          body="Add unlimited staff, tables and menu items. You only pay for the locations you run, and payments settle straight to your own gateway."
        />
        <PricingCards className="mt-12" />
      </section>

      {/* Comparison */}
      <section className="border-t bg-yellow-50/40 dark:bg-zinc-900/40">
        <div className="container mx-auto px-4 py-20 md:px-8 md:py-28">
          <SectionHeading eyebrow="Compare" title="What’s in each plan." />
          <Reveal className="mt-12 overflow-x-auto soft-border bg-card shadow-soft-in dark:shadow-soft-in-dark">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Feature comparison across plans</caption>
              <thead>
                <tr className="border-b text-left">
                  <th scope="col" className="px-5 py-4 font-medium text-muted-foreground">Capability</th>
                  {pricing.plans.map((p) => (
                    <th key={p.key} scope="col" className="px-5 py-4 font-semibold">
                      {p.name}
                      {p.highlighted && (
                        <span className="ml-2 bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                          Popular
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.label} className="border-b last:border-b-0 even:bg-muted/30">
                    <th scope="row" className="px-5 py-3.5 text-left font-normal">{row.label}</th>
                    {row.values.map((v, i) => (
                      <td key={i} className="px-5 py-3.5">
                        <Cell value={v} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      <Byoak />

      {/* Objection-handling FAQs */}
      <section className="container mx-auto px-4 py-20 md:px-8 md:py-28">
        <SectionHeading eyebrow="Before you decide" title="Common billing questions." />
        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
          {PRICING_FAQS.map((f, i) => (
            <Reveal key={f.q} delay={i * 0.05} className="soft-border bg-card p-6 shadow-soft-in dark:shadow-soft-in-dark">
              <h3 className="font-semibold">{f.q}</h3>
              <p className="mt-2 text-sm text-muted-foreground text-pretty">{f.a}</p>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-10 text-center">
          <Button asChild variant="link">
            <Link to="/#faq">Read all FAQs</Link>
          </Button>
        </Reveal>
      </section>

      <Cta />
    </>
  );
}
