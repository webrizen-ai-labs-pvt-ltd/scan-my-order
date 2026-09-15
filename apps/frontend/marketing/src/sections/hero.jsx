import { Link } from 'react-router-dom';
import { ArrowRight01Icon } from 'hugeicons-react';
import { Button } from '@smo/ui';
import { Reveal } from '../components/reveal';
import { HeroStage } from '../components/hero-stage';
import { Parallax } from '../components/parallax';

const PROOF = ['No app install for guests', 'No commission on orders', 'Runs in any browser'];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Depth layers behind the content */}
      <Parallax speed={14} className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-20%] h-[60rem] w-[60rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl dark:bg-primary/[0.07]" />
      </Parallax>
      <Parallax speed={-8} className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute right-[-10%] top-[30%] h-[28rem] w-[28rem] rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-400/10" />
      </Parallax>

      <div className="container mx-auto grid items-center gap-12 px-4 pb-20 pt-14 md:px-8 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:pb-28 lg:pt-24">
        <div className="text-center lg:text-left">
          <Reveal immediate>
            <span className="glass sheen inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium depth-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Now in beta · Free for early adopters
            </span>
          </Reveal>

          <Reveal immediate delay={0.05}>
            <h1 className="mt-7 font-elsie text-[2.6rem] leading-[1.05] text-balance sm:text-6xl xl:text-7xl">
              The restaurant OS your guests{' '}
              <span className="relative inline-block text-transparent bg-clip-text bg-gradient-to-br from-yellow-500 via-amber-500 to-yellow-700 dark:from-yellow-300 dark:via-amber-300 dark:to-yellow-500">
                scan into.
              </span>
            </h1>
          </Reveal>

          <Reveal immediate delay={0.1}>
            <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground text-pretty md:text-lg lg:mx-0">
              QR menus, POS, kitchen display and payments — one live system, one subscription. Bring
              your own payment gateway and keep every rupee your guests spend.
            </p>
          </Reveal>

          <Reveal
            immediate
            delay={0.15}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
          >
            <Button asChild size="lg" className="w-full depth-2 sm:w-auto">
              <Link to="/contact">
                Apply for onboarding
                <ArrowRight01Icon />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full depth-1 sm:w-auto">
              <Link to="/pricing">See pricing</Link>
            </Button>
          </Reveal>

          <Reveal immediate delay={0.2}>
            <ul className="mt-9 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground lg:justify-start">
              {PROOF.map((p) => (
                <li key={p} className="inline-flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
                  {p}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal immediate delay={0.2} y={30} className="relative">
          <HeroStage />
        </Reveal>
      </div>
    </section>
  );
}
