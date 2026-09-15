import { features } from '../data/site';
import { SectionHeading } from '../components/section-heading';
import { RevealGroup, RevealItem } from '../components/reveal';
import { BentoGrid, BentoGridItem } from '../components/bento-grid';
import { FeatureIcon } from '../components/feature-icon';

export function Features() {
  return (
    <section id="features" className="scroll-mt-24 border-t bg-yellow-50/40 dark:bg-zinc-900/40">
      <div className="container mx-auto px-4 py-20 md:px-8 md:py-28">
        <SectionHeading
          eyebrow="Everything in one place"
          title="Front of house, kitchen and back office — on one engine."
          body="Every surface reads and writes the same order. Confirm a ticket at the counter and it is already on the kitchen screen."
        />

        <RevealGroup className="mt-12">
          <BentoGrid className="md:grid-cols-2 xl:grid-cols-4 gap-4">
            {features.map((f) => (
              <BentoGridItem key={f.title} colSpan={f.colSpan} className="group">
                <RevealItem className="flex h-full flex-col p-6">
                  <FeatureIcon name={f.icon} />
                  <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground text-pretty">{f.body}</p>
                </RevealItem>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 bg-yellow-400/0 blur-2xl transition-colors duration-300 group-hover:bg-yellow-400/20"
                />
              </BentoGridItem>
            ))}
          </BentoGrid>
        </RevealGroup>
      </div>
    </section>
  );
}
