import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring, useReducedMotion } from 'framer-motion';
import { cn } from '@smo/ui/lib/utils';

/**
 * Scroll-linked depth layer. `speed` is a small percentage of the section
 * height the layer drifts as it crosses the viewport — keep it within ±15
 * and apply it to decorative layers only, never to body copy.
 */
export function Parallax({ children, speed = 10, className, style, ...props }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const raw = useTransform(scrollYProgress, [0, 1], [`${speed}%`, `${-speed}%`]);
  const y = useSpring(raw, { stiffness: 120, damping: 30, mass: 0.4 });

  return (
    <motion.div
      ref={ref}
      style={reduce ? style : { y, ...style }}
      className={cn('will-change-transform', className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
