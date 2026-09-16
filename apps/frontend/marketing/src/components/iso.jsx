import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@smo/ui/lib/utils';

/*
 * Tiny isometric toolkit. Every dimension is in "units" (u): the stage is
 * 100u × 100u and `--u` is set to (stage width / 100) px, so scenes scale
 * with their container. z is "up" — the stage is tilted by the caller.
 */

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Measures the stage and exposes `--u`. */
export function useUnit() {
  const ref = useRef(null);
  const [unit, setUnit] = useState(4);
  useIso(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setUnit(el.clientWidth / 100);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, unit];
}

const u = (n) => `calc(var(--u) * ${n})`;

/** Positions a child in stage space (x,y on the floor, z up), preserving 3D. */
export function At({ x = 0, y = 0, z = 0, rotate = 0, className, children, style }) {
  return (
    <div
      className={cn('absolute left-0 top-0 flat-3d', className)}
      style={{
        transform: `translate3d(${u(x)}, ${u(y)}, ${u(z)}) rotateZ(${rotate}deg)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Solid box: w along x, h along y, d thick (z). Its footprint sits at the
 * parent's origin with the bottom on z=0. Faces are shaded by material vars:
 * --m-top, --m-light (faces toward the key light), --m-dark.
 * `children` render on the top face.
 */
export function Slab({ w, h, d, material, radius = 0, className, children, faceClassName }) {
  const face = cn('absolute left-0 top-0', faceClassName);
  const r = u(radius);
  return (
    <div className={cn('absolute left-0 top-0 flat-3d', className)} style={{ width: u(w), height: u(h), ...material }}>
      {/* top */}
      <div
        className={cn(face, 'overflow-hidden')}
        style={{ width: u(w), height: u(h), transform: `translateZ(${u(d)})`, background: 'var(--m-top)', borderRadius: r }}
      >
        {children}
      </div>
      {/* front (y = h) */}
      <div
        className={face}
        style={{ top: u(h), width: u(w), height: u(d), transformOrigin: 'top', transform: 'rotateX(90deg)', background: 'var(--m-light)' }}
      />
      {/* right (x = w) */}
      <div
        className={face}
        style={{ left: u(w), width: u(d), height: u(h), transformOrigin: 'left', transform: 'rotateY(-90deg)', background: 'var(--m-dark)' }}
      />
      {/* back (y = 0) */}
      <div
        className={face}
        style={{ width: u(w), height: u(d), transformOrigin: 'top', transform: 'rotateX(90deg)', background: 'var(--m-dark)' }}
      />
      {/* left (x = 0) */}
      <div
        className={face}
        style={{ width: u(d), height: u(h), transformOrigin: 'left', transform: 'rotateY(-90deg)', background: 'var(--m-light)' }}
      />
    </div>
  );
}

/** Solid cylinder built from stacked slices; `r` radius, `d` height. */
export function Disc({ r, d, material, slices, className, children }) {
  const n = slices ?? Math.max(4, Math.round(d * 2.5));
  return (
    <div className={cn('absolute left-0 top-0 flat-3d', className)} style={{ width: u(r * 2), height: u(r * 2), ...material }}>
      {Array.from({ length: n }, (_, i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-full"
          style={{
            transform: `translateZ(${u((d * i) / n)})`,
            background: 'conic-gradient(from 160deg, var(--m-light), var(--m-dark) 40%, var(--m-dark) 60%, var(--m-light))',
          }}
        />
      ))}
      <div
        className="absolute inset-0 overflow-hidden rounded-full"
        style={{ transform: `translateZ(${u(d)})`, background: 'var(--m-top)' }}
      >
        {children}
      </div>
    </div>
  );
}

/** Flat plane standing upright (its face points along -y). Content is HTML. */
export function Upright({ w, h, className, children, style }) {
  return (
    <div
      className={cn('absolute left-0 top-0 flat-3d', className)}
      style={{ width: u(w), height: u(h), transformOrigin: 'bottom', transform: 'rotateX(-90deg)', ...style }}
    >
      {children}
    </div>
  );
}

/** Soft contact shadow on the floor under a floating object. */
export function Shadow({ w, h, opacity = 0.35, blur = 10 }) {
  return (
    <div
      aria-hidden="true"
      className="absolute left-0 top-0 rounded-full"
      style={{
        width: u(w),
        height: u(h),
        background: `radial-gradient(closest-side, rgb(0 0 0 / ${opacity}), transparent)`,
        filter: `blur(${blur}px)`,
      }}
    />
  );
}

/* Materials — solid faces, lit from the front-left. */
export const M = {
  floor: { '--m-top': 'hsl(var(--card))', '--m-light': 'hsl(var(--border))', '--m-dark': 'hsl(var(--void))' },
  wood: { '--m-top': '#d9a96b', '--m-light': '#b98550', '--m-dark': '#8f6134' },
  steel: { '--m-top': '#c9ccd3', '--m-light': '#9ea3ad', '--m-dark': '#6f7480' },
  ceramic: { '--m-top': '#fbfaf6', '--m-light': '#e2ddd2', '--m-dark': '#bdb6a8' },
  coffee: { '--m-top': '#4a2c1a', '--m-light': '#4a2c1a', '--m-dark': '#4a2c1a' },
  card: { '--m-top': '#fffdf7', '--m-light': '#e8e2d2', '--m-dark': '#c8c0ad' },
  phone: { '--m-top': '#111114', '--m-light': '#2a2a30', '--m-dark': '#08080a' },
  screen: { '--m-top': '#17171b', '--m-light': '#2a2a30', '--m-dark': '#0b0b0d' },
  brand: { '--m-top': 'hsl(var(--primary))', '--m-light': '#c9931a', '--m-dark': '#9a6f0e' },
  glass: { '--m-top': 'rgb(var(--glass-bg))', '--m-light': 'rgb(var(--glass-brd))', '--m-dark': 'rgb(var(--glass-brd))' },
  walnut: { '--m-top': '#7a4f2e', '--m-light': '#5f3c22', '--m-dark': '#432914' },
  clay: { '--m-top': '#c9714b', '--m-light': '#a95a38', '--m-dark': '#7f4128' },
  leaf: { '--m-top': '#3f8f4f', '--m-light': '#2f7040', '--m-dark': '#21522e' },
  pastry: { '--m-top': '#e0a05a', '--m-light': '#c4823f', '--m-dark': '#9c6329' },
  cushion: { '--m-top': '#2b2b31', '--m-light': '#202024', '--m-dark': '#141417' },
};
