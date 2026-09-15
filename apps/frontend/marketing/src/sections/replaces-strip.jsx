import { Cancel01Icon } from 'hugeicons-react';
import { replaces } from '../data/site';
import { Reveal } from '../components/reveal';

export function ReplacesStrip() {
  return (
    <section className="border-y bg-yellow-50/60 dark:bg-zinc-900/60">
      <Reveal className="container mx-auto flex flex-col items-center gap-4 px-4 py-8 md:flex-row md:justify-between md:px-8">
        <p className="text-sm font-medium text-muted-foreground">One subscription replaces</p>
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm">
          {replaces.map((tool) => (
            <li key={tool} className="inline-flex items-center gap-1.5">
              <Cancel01Icon size={14} className="text-yellow-700 dark:text-yellow-400" aria-hidden="true" />
              <span className="line-through decoration-yellow-500/70 decoration-[1.5px]">{tool}</span>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
