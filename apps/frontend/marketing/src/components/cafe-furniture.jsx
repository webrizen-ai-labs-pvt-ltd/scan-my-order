import { At, Slab, Disc, Upright, M } from './iso';

/*
 * Cafe props built from the iso primitives. Each component is placed by the
 * caller with <At>; local coordinates start at the prop's own origin.
 */

export function Cup({ r = 2.8 }) {
  return (
    <>
      <Disc r={r * 1.6} d={0.5} material={M.ceramic} slices={2} />
      <At x={r * 0.6} y={r * 0.6} z={0.5}>
        <Disc r={r} d={4.2} material={M.ceramic} slices={7}>
          <div className="absolute inset-[16%] rounded-full bg-[#3b2214] shadow-[inset_0_0.15em_0.3em_rgba(0,0,0,0.55)]" />
        </Disc>
      </At>
    </>
  );
}

export function Plate() {
  return (
    <>
      <Disc r={5} d={0.6} material={M.ceramic} slices={2} />
      <At x={2.2} y={2.6} z={0.6}>
        <Slab w={5.6} h={3.2} d={1.8} radius={1.6} material={M.pastry} />
      </At>
    </>
  );
}

/** Small tabletop QR stand: a steel foot with a card leaning on it. */
export function QrStand({ children }) {
  return (
    <>
      <Slab w={7} h={2.2} d={0.5} radius={0.4} material={M.steel} />
      <At x={0} y={1.6} z={0.5}>
        <Upright w={7} h={5.5}>{children}</Upright>
      </At>
    </>
  );
}

/** Bistro chair: seat on four legs with a backrest along its back (y = 0) edge. */
export function Chair() {
  const legs = [
    [0.5, 0.5],
    [8.5, 0.5],
    [0.5, 8.5],
    [8.5, 8.5],
  ];
  return (
    <>
      {legs.map(([x, y]) => (
        <At key={`${x}-${y}`} x={x} y={y} z={0}>
          <Slab w={1} h={1} d={11} material={M.steel} />
        </At>
      ))}
      <At x={0} y={0} z={11}>
        <Slab w={10} h={10} d={1.6} radius={1.5} material={M.cushion} />
      </At>
      <At x={0} y={0} z={12.6}>
        <Slab w={10} h={1.2} d={11} radius={0.6} material={M.walnut} />
      </At>
    </>
  );
}

/** Service counter with an espresso machine, a cup stack and an order screen. */
export function Counter({ screen }) {
  return (
    <>
      <Slab w={46} h={14} d={14} radius={1.5} material={M.walnut}>
        <div className="h-full w-full bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_0,transparent_18%,transparent_82%,rgba(0,0,0,0.12))]" />
      </Slab>

      {/* Espresso machine */}
      <At x={30} y={2.5} z={14}>
        <Slab w={11} h={9} d={7} radius={0.8} material={M.steel} />
      </At>
      <At x={30} y={2.5} z={21}>
        <Slab w={11} h={9} d={1.6} radius={0.8} material={M.phone} />
      </At>
      <At x={33} y={11} z={14}>
        <Slab w={5} h={2} d={3} material={M.phone} />
      </At>

      {/* Cup stack */}
      <At x={22} y={7} z={14}>
        <Disc r={2.2} d={2.4} material={M.ceramic} slices={4} />
      </At>
      <At x={22.3} y={7.3} z={16.4}>
        <Disc r={1.9} d={2.2} material={M.ceramic} slices={4} />
      </At>

      {/* Order screen */}
      <At x={3} y={5} z={14}>
        <Slab w={16} h={4} d={0.8} material={M.steel} />
      </At>
      <At x={3} y={6.5} z={14.8}>
        <Upright w={16} h={11}>{screen}</Upright>
      </At>
    </>
  );
}

export function Plant() {
  return (
    <>
      <Disc r={4.2} d={6.5} material={M.clay} slices={8}>
        <div className="absolute inset-[12%] rounded-full bg-[#2c1e14]" />
      </Disc>
      {[0, 45, 90, 135].map((deg, i) => (
        <At key={deg} x={0.7} y={4.2} z={6} rotate={deg}>
          <Upright w={7} h={i % 2 ? 9 : 11}>
            <div
              className="mx-auto h-full w-[70%] rounded-[100%_0_100%_0] shadow-[inset_-0.2em_-0.2em_0.4em_rgba(0,0,0,0.25)]"
              style={{ background: 'linear-gradient(160deg, #56a86a, #2f7040 70%)' }}
            />
          </Upright>
        </At>
      ))}
    </>
  );
}
