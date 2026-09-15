import { motion, useReducedMotion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1];

/**
 * Fade-and-rise a block into view once it scrolls into the viewport.
 * Renders the final state immediately when the user prefers reduced motion.
 * Pass `immediate` for above-the-fold content so it animates on mount
 * rather than waiting on an IntersectionObserver callback.
 */
export function Reveal({ children, delay = 0, y = 18, immediate = false, className, as = 'div', ...props }) {
  const reduce = useReducedMotion();
  const Comp = motion[as] ?? motion.div;
  const visible = { opacity: 1, y: 0 };

  return (
    <Comp
      initial={reduce ? false : { opacity: 0, y }}
      animate={reduce || !immediate ? undefined : visible}
      whileInView={reduce || immediate ? undefined : visible}
      viewport={{ once: true, margin: '-64px' }}
      transition={{ duration: 0.45, delay, ease: EASE }}
      className={className}
      {...props}
    >
      {children}
    </Comp>
  );
}

/** Staggers direct children wrapped in <RevealItem>. */
export function RevealGroup({ children, className, stagger = 0.06, as = 'div', ...props }) {
  const reduce = useReducedMotion();
  const Comp = motion[as] ?? motion.div;
  return (
    <Comp
      initial={reduce ? false : 'hidden'}
      whileInView={reduce ? undefined : 'show'}
      viewport={{ once: true, margin: '-64px' }}
      variants={{ show: { transition: { staggerChildren: stagger } } }}
      className={className}
      {...props}
    >
      {children}
    </Comp>
  );
}

export function RevealItem({ children, className, as = 'div', ...props }) {
  const Comp = motion[as] ?? motion.div;
  return (
    <Comp
      variants={{
        hidden: { opacity: 0, y: 16, scale: 0.98 },
        show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: EASE } },
      }}
      className={className}
      {...props}
    >
      {children}
    </Comp>
  );
}
