import { cn } from '@smo/ui/lib/utils';
import { features } from '../data/site';
import { SectionHeading } from '../components/section-heading';
import { RevealGroup, RevealItem } from '../components/reveal';
import { Tilt, TiltLayer } from '../components/tilt';
import { Panel } from '../components/panel';
import { FeatureIcon } from '../components/feature-icon';
import { Parallax } from '../components/parallax';

const SPAN = { 1: '', 2: 'md:col-span-2', 3: 'md:col-span-2 xl:col-span-3', 4: 'md:col-span-2 xl:col-span-4' };

export function Features() {
  return (
    <section id="features" className="scroll-mt-24 relative overflow-hidden py-20 md:py-28">
      <Parallax speed={-10} className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[-10%] top-[20%] h-[36rem] w-[36rem] rounded-full bg-primary/10 blur-3xl dark:bg-primary/[0.06]" />
      </Parallax>

      <div className="container mx-auto px-4 md:px-8">
        <SectionHeading
          eyebrow="Everything in one place"
          title="Front of house, kitchen and back office — on one engine."
          body="Every surface reads and writes the same order. Confirm a ticket at the counter and it is already on the kitchen screen."
        />

        <RevealGroup className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" stagger={0.05}>
          {features.map((f) => (
            <RevealItem key={f.title} className={cn(SPAN[f.colSpan ?? 1])}>
              <Tilt max={6} lift={12} className="h-full">
                <Panel depth={2} className="group relative flex h-full flex-col overflow-hidden p-6">
                  {/* Depth accent: a light pooling in the corner, pushed back in Z */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/0 blur-2xl transition-colors duration-500 group-hover:bg-primary/25"
                  />
                  <TiltLayer depth={28}>
                    <FeatureIcon name={f.icon} />
                  </TiltLayer>
                  <TiltLayer depth={14}>
                    <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground text-pretty">{f.body}</p>
                  </TiltLayer>
                </Panel>
              </Tilt>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
