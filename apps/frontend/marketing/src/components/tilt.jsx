import { useRef } from 'react';
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { cn } from '@smo/ui/lib/utils';

const SPRING = { stiffness: 180, damping: 22, mass: 0.6 };

/**
 * Pointer-driven 3D tilt with a specular highlight that tracks the cursor.
 *
 * Decorative: the rotation is clamped to a few degrees so nothing leaves its
 * hit box, content stays in normal flow, and the whole effect is dropped
 * under `prefers-reduced-motion`.
 */
export function Tilt({
  children,
  className,
  max = 7,
  lift = 10,
  glare = true,
  as = 'div',
  ...props
}) {
  const reduce = useReducedMotion();
  const ref = useRef(null);

  // -0.5 … 0.5 across the element.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const active = useMotionValue(0);

  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [max, -max]), SPRING);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-max, max]), SPRING);
  const z = useSpring(useTransform(active, [0, 1], [0, lift]), SPRING);

  const glareX = useTransform(px, (v) => `${(v + 0.5) * 100}%`);
  const glareY = useTransform(py, (v) => `${(v + 0.5) * 100}%`);
  const glareOpacity = useSpring(active, SPRING);
  const glareBg = useMotionTemplate`radial-gradient(28rem circle at ${glareX} ${glareY}, hsl(var(--primary) / 0.16), transparent 45%)`;

  if (reduce) {
    const Static = as;
    return (
      <Static className={className} {...props}>
        {children}
      </Static>
    );
  }

  const Comp = motion[as] ?? motion.div;

  const handleMove = (e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleEnter = () => active.set(1);
  const handleLeave = () => {
    // Always reverse every property, even if the pointer left fast.
    active.set(0);
    px.set(0);
    py.set(0);
  };

  return (
    <Comp
      ref={ref}
      onPointerMove={handleMove}
      onPointerEnter={handleEnter}
      onPointerLeave={handleLeave}
      style={{ rotateX, rotateY, z, transformPerspective: 900, transformStyle: 'preserve-3d' }}
      className={cn('relative will-change-transform', className)}
      {...props}
    >
      {children}
      {glare && (
        <motion.span
          aria-hidden="true"
          style={{ background: glareBg, opacity: glareOpacity }}
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
        />
      )}
    </Comp>
  );
}

/** Pushes a child toward the viewer inside a `<Tilt>`; ignored when flattened. */
export function TiltLayer({ children, depth = 24, className, ...props }) {
  const reduce = useReducedMotion();
  return (
    <div
      className={cn('relative', className)}
      style={reduce ? undefined : { transform: `translateZ(${depth}px)`, transformStyle: 'preserve-3d' }}
      {...props}
    >
      {children}
    </div>
  );
}
