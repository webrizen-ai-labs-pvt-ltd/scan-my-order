import { Link } from 'react-router-dom';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent, Button } from '@smo/ui';
import { faqs } from '../data/site';
import { SectionHeading } from '../components/section-heading';
import { Reveal } from '../components/reveal';

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-24 container mx-auto px-4 py-20 md:px-8 md:py-28">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
        <div>
          <SectionHeading
            align="left"
            eyebrow="FAQ"
            title="Questions owners ask us first."
            body="Can’t find what you need? We answer every message personally during beta."
          />
          <Reveal delay={0.1} className="mt-8">
            <Button asChild variant="outline">
              <Link to="/contact">Ask a question</Link>
            </Button>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <Accordion type="single" collapsible className="soft-border bg-card px-5 shadow-soft-in dark:shadow-soft-in-dark sm:px-7">
            {faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`faq-${i}`} className="last:border-b-0">
                <AccordionTrigger className="min-h-[56px] py-4 text-left text-base hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
