import { Link } from 'react-router-dom';
import { ArrowRight01Icon } from 'hugeicons-react';
import { Button } from '@smo/ui';
import { links } from '../data/site';
import { Reveal } from '../components/reveal';
import { Tilt, TiltLayer } from '../components/tilt';

export function Cta() {
  return (
    <section className="container mx-auto px-4 pb-24 md:px-8 md:pb-32">
      <Reveal className="scene">
        <Tilt max={4} lift={16} className="relative overflow-hidden rounded-[var(--radius)] bg-primary px-6 py-14 text-primary-foreground glow depth-3 sheen sm:px-12 md:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 bg-white/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 bg-yellow-900/20 blur-3xl"
        />
        <TiltLayer depth={30} className="relative mx-auto max-w-2xl text-center">
          <h2 className="font-elsie text-3xl leading-tight text-balance md:text-5xl">
            Put a QR on the table this week.
          </h2>
          <p className="mt-4 text-base text-primary-foreground/75 text-pretty md:text-lg">
            Beta seats are limited and free. Tell us about your restaurant and we’ll set you up personally.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full depth-2 sm:w-auto">
              <Link to="/contact">
                Apply for onboarding
                <ArrowRight01Icon />
              </Link>
            </Button>
            <Button asChild size="lg" variant="link" className="w-full text-primary-foreground sm:w-auto">
              <a href={links.admin}>Already onboarded? Sign in</a>
            </Button>
          </div>
        </TiltLayer>
        </Tilt>
      </Reveal>
    </section>
  );
}
