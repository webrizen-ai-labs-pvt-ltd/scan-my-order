import { problems } from '../data/site';
import { SectionHeading } from '../components/section-heading';
import { RevealGroup, RevealItem } from '../components/reveal';
import { Tilt, TiltLayer } from '../components/tilt';
import { Panel } from '../components/panel';

export function ProblemSolution() {
  return (
    <section className="container mx-auto px-4 py-20 md:px-8 md:py-28">
      <SectionHeading
        eyebrow="The problem"
        title="Running a restaurant shouldn’t mean running four pieces of software."
        body="Most independent restaurants stitch together a QR menu, a POS, a kitchen screen and a delivery aggregator — then pay each of them, and lose margin in between."
      />

      <RevealGroup className="mt-14 grid gap-5 md:grid-cols-3">
        {problems.map((p, i) => (
          <RevealItem key={p.title}>
            <Tilt max={6} lift={12} className="h-full">
              <Panel depth={2} className="flex h-full flex-col p-7">
                <TiltLayer depth={24}>
                  <span className="font-elsie text-4xl text-primary drop-shadow-[0_6px_14px_hsl(var(--primary)/0.45)]">0{i + 1}</span>
                </TiltLayer>
                <TiltLayer depth={12}>
                  <h3 className="mt-5 text-lg font-semibold">{p.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground text-pretty">{p.body}</p>
                </TiltLayer>
              </Panel>
            </Tilt>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
