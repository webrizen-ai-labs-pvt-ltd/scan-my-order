import { cn } from '@smo/ui/lib/utils';

const DEPTH = { 1: 'depth-1', 2: 'depth-2', 3: 'depth-3' };

/**
 * Frosted, edge-lit surface — the base material for every card on the site.
 * `depth` picks the elevation shadow tier (1–3).
 */
export function Panel({ className, depth = 2, glass = true, sheen = true, children, ...props }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius)]',
        glass ? 'glass' : 'border bg-card',
        sheen && 'sheen',
        DEPTH[depth],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
