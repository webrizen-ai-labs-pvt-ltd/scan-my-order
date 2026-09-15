import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { ArrowRight01Icon } from 'hugeicons-react';
import { Button } from '@smo/ui';
import { Reveal } from '../components/reveal';
import { ProductMock } from '../components/product-mock';

// WebGL background — heavy, so split from the main bundle.
const WebThreads = lazy(() => import('../components/web-threads'));

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden">
      {/* Ambient background */}
      {!reduce && (
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-50 dark:opacity-40">
          <Suspense fallback={null}>
            <WebThreads
              color1="#EAB308"
              color2="#FDE68A"
              color3="#FFFFFF"
              threadCount={5}
              speed={0.12}
              brightness={0.35}
              glow={0.015}
              grainIntensity={0.03}
              mouseInteraction={false}
            />
          </Suspense>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 -z-10 glow-bg" />

      <div className="container mx-auto grid items-center gap-14 px-4 pb-24 pt-16 md:px-8 md:pt-24 lg:grid-cols-2 lg:gap-10 lg:pb-32">
        <div className="text-center lg:text-left">
          <Reveal immediate>
            <span className="inline-flex items-center gap-2 border border-yellow-900/20 bg-yellow-900/10 px-3.5 py-1.5 text-xs font-medium backdrop-blur-sm dark:border-yellow-100/30 dark:bg-yellow-100/15">
              <span className="h-1.5 w-1.5 bg-yellow-500" aria-hidden="true" />
              Now in beta · Free for early adopters
            </span>
          </Reveal>

          <Reveal immediate delay={0.05}>
            <h1 className="mt-6 font-elsie text-4xl leading-[1.1] text-balance sm:text-5xl md:text-6xl xl:text-7xl">
              Curated restaurant management{' '}
              <span className="relative inline-block">
                platform
                <svg
                  aria-hidden="true"
                  className="absolute -bottom-1 left-0 w-full"
                  viewBox="0 0 200 20"
                  fill="none"
                >
                  <path
                    d="M2 15C50 5 150 5 198 15"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="text-yellow-400/70"
                  />
                </svg>
              </span>{' '}
              that scales with you.
            </h1>
          </Reveal>

          <Reveal immediate delay={0.1}>
            <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground text-pretty md:text-lg lg:mx-0">
              QR menus, POS, kitchen display and payments in one subscription. Bring your own payment
              gateway and keep every rupee your guests spend.
            </p>
          </Reveal>

          <Reveal immediate delay={0.15} className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start sm:justify-center">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/contact">
                Apply for onboarding
                <ArrowRight01Icon />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link to="/pricing">See pricing</Link>
            </Button>
          </Reveal>

          <Reveal immediate delay={0.2}>
            <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground lg:justify-start">
              <li>No app install for guests</li>
              <li>No commission on orders</li>
              <li>Runs in any browser</li>
            </ul>
          </Reveal>
        </div>

        <Reveal immediate delay={0.15} y={24} className="px-4 pt-6 sm:px-8 lg:px-0">
          <ProductMock />
        </Reveal>
      </div>

      {/* Wave divider into the next section */}
      <div className="pointer-events-none absolute bottom-0 left-0 w-full overflow-hidden leading-none" aria-hidden="true">
        <svg viewBox="0 0 1200 120" className="block h-[50px] w-full md:h-[90px]" preserveAspectRatio="none">
          <path
            className="fill-background"
            d="M0,120 L0,80 Q100,20 200,80 Q300,20 400,80 Q500,20 600,80 Q700,20 800,80 Q900,20 1000,80 Q1100,20 1200,80 L1200,120 Z"
          />
          <path
            className="fill-yellow-50 dark:fill-zinc-900"
            fillOpacity="0.6"
            d="M0,120 L0,95 Q150,45 300,95 Q450,45 600,95 Q750,45 900,95 Q1050,45 1200,95 L1200,120 Z"
          />
        </svg>
      </div>
    </section>
  );
}
