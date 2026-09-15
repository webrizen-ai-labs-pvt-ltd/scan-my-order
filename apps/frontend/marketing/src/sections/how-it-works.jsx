import { Link } from 'react-router-dom';
import { ArrowRight01Icon } from 'hugeicons-react';
import { Button } from '@smo/ui';
import { steps } from '../data/site';
import { SectionHeading } from '../components/section-heading';
import { Reveal, RevealGroup, RevealItem } from '../components/reveal';

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 container mx-auto px-4 py-20 md:px-8 md:py-28">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
        <div>
          <SectionHeading
            align="left"
            eyebrow="How it works"
            title="Live in an afternoon, not a quarter."
            body="No hardware to buy, no integrations to wire. Three steps and your first table is taking orders."
          />
          <Reveal delay={0.1} className="mt-8">
            <Button asChild>
              <Link to="/contact">
                Start onboarding
                <ArrowRight01Icon />
              </Link>
            </Button>
          </Reveal>
        </div>

        <RevealGroup as="ol" className="relative grid gap-6" stagger={0.1}>
          {/* Vertical connector */}
          <div aria-hidden="true" className="absolute left-6 top-8 bottom-8 hidden w-px bg-border sm:block" />
          {steps.map((s) => (
            <RevealItem as="li" key={s.step} className="relative flex gap-5 sm:gap-8">
              <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center bg-primary font-elsie text-lg text-primary-foreground shadow-soft-in">
                {s.step}
              </span>
              <div className="soft-border bg-card shadow-soft-in dark:shadow-soft-in-dark flex-1 p-5 sm:p-6">
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground text-pretty">{s.body}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
