import { motion, useReducedMotion } from 'framer-motion';
import { Cancel01Icon } from 'hugeicons-react';
import { replaces } from '../data/site';

/**
 * A tilted ribbon that scrolls the list of tools one subscription replaces.
 * Duplicated once so the marquee loops seamlessly; static under reduced motion.
 */
export function ReplacesStrip() {
  const reduce = useReducedMotion();
  const items = [...replaces, ...replaces];

  return (
    <section className="relative -my-4 overflow-hidden py-10" aria-label="Tools Scan My Order replaces">
      <div className="scene">
        <div className="glass sheen depth-2 mx-[-4%] flex items-center gap-8 py-4 [transform:rotateX(8deg)_rotateZ(-1.5deg)] [transform-origin:50%_50%]">
          <p className="hidden shrink-0 pl-[6%] text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">
            Replaces
          </p>
          <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
            <motion.ul
              className="flex w-max gap-10 pr-10"
              animate={reduce ? undefined : { x: ['0%', '-50%'] }}
              transition={{ duration: 28, ease: 'linear', repeat: Infinity }}
            >
              {items.map((tool, i) => (
                <li key={`${tool}-${i}`} className="inline-flex items-center gap-2 whitespace-nowrap text-sm" aria-hidden={i >= replaces.length}>
                  <Cancel01Icon size={14} className="text-yellow-700 dark:text-yellow-400" aria-hidden="true" />
                  <span className="line-through decoration-primary/70 decoration-[1.5px]">{tool}</span>
                </li>
              ))}
            </motion.ul>
          </div>
        </div>
      </div>
    </section>
  );
}
