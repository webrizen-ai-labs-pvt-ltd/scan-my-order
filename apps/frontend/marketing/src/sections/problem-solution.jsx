import { problems } from '../data/site';
import { SectionHeading } from '../components/section-heading';
import { RevealGroup, RevealItem } from '../components/reveal';
import { SoftCard } from '../components/soft-card';

export function ProblemSolution() {
  return (
    <section className="container mx-auto px-4 py-20 md:px-8 md:py-28">
      <SectionHeading
        eyebrow="The problem"
        title="Running a restaurant shouldn’t mean running four pieces of software."
        body="Most independent restaurants stitch together a QR menu, a POS, a kitchen screen and a delivery aggregator — then pay each of them, and lose margin in between."
      />

      <RevealGroup className="mt-12 grid gap-5 md:grid-cols-3">
        {problems.map((p, i) => (
          <RevealItem key={p.title}>
            <SoftCard className="h-full">
              <span className="font-elsie text-3xl text-yellow-600/70 dark:text-yellow-400/70">0{i + 1}</span>
              <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground text-pretty">{p.body}</p>
            </SoftCard>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
