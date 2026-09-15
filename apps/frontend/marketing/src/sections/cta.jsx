import { Link } from 'react-router-dom';
import { ArrowRight01Icon } from 'hugeicons-react';
import { Button } from '@smo/ui';
import { links } from '../data/site';
import { Reveal } from '../components/reveal';

export function Cta() {
  return (
    <section className="container mx-auto px-4 pb-24 md:px-8 md:pb-32">
      <Reveal className="relative overflow-hidden bg-primary px-6 py-14 text-primary-foreground sm:px-12 md:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 bg-white/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 bg-yellow-900/20 blur-3xl"
        />
        <div className="relative mx-auto max-w-2xl text-center">
          <h2 className="font-elsie text-3xl leading-tight text-balance md:text-5xl">
            Put a QR on the table this week.
          </h2>
          <p className="mt-4 text-base text-primary-foreground/75 text-pretty md:text-lg">
            Beta seats are limited and free. Tell us about your restaurant and we’ll set you up personally.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/contact">
                Apply for onboarding
                <ArrowRight01Icon />
              </Link>
            </Button>
            <Button asChild size="lg" variant="link" className="w-full text-primary-foreground sm:w-auto">
              <a href={links.admin}>Already onboarded? Sign in</a>
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
