import { SectionHeading } from '../components/section-heading';
import { PricingCards } from '../components/pricing-cards';

export function Pricing({ id = 'pricing' }) {
  return (
    <section id={id} className="scroll-mt-24 relative">
      <div className="container mx-auto px-4 py-20 md:px-8 md:py-28">
        <SectionHeading
          eyebrow="Pricing"
          title="Priced per store. Never per order."
          body="Add unlimited staff, tables and menu items. You only pay for the locations you run."
        />
        <PricingCards className="mt-10" />
      </div>
    </section>
  );
}
