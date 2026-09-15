import { cn } from '@smo/ui/lib/utils';
import { Reveal } from './reveal';

export function SectionHeading({ eyebrow, title, body, align = 'center', className }) {
  const centered = align === 'center';
  return (
    <Reveal className={cn('max-w-2xl', centered && 'mx-auto text-center', className)}>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-yellow-700 dark:text-yellow-400">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-3 font-elsie text-3xl leading-tight md:text-5xl text-balance">{title}</h2>
      {body && <p className="mt-4 text-base md:text-lg text-muted-foreground text-pretty">{body}</p>}
    </Reveal>
  );
}
