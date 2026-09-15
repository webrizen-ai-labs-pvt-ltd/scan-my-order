import { motion, useReducedMotion } from 'framer-motion';
import { QrCodeIcon, ChefHatIcon, Wallet01Icon } from 'hugeicons-react';
import { cn } from '@smo/ui/lib/utils';
import { Tilt } from './tilt';
import { At, Slab, Disc, Upright, Shadow, M, useUnit } from './iso';
import { Cup, Plate, QrStand, Chair, Counter, Plant } from './cafe-furniture';

/* ------------------------------------------------------------------ *
 * Screen content — real HTML so it stays crisp at any size.
 * Sizes are in `em`; the stage sets 1em = 1.75u.
 * ------------------------------------------------------------------ */

const QR = [
  '1111111010111111',
  '1000001001100001',
  '1011101110101101',
  '1011101011101101',
  '1011101100101101',
  '1000001010100001',
  '1111111010111111',
  '0000000110000000',
  '1010111001101011',
  '0110010110011100',
  '1101101010110110',
  '0000000101101001',
  '1111111011010110',
  '1000001101110001',
  '1011101011101011',
  '1011101110010101',
];

function QrGlyph({ className }) {
  return (
    <div className={cn('grid grid-cols-[repeat(16,1fr)] gap-[1px]', className)} aria-hidden="true">
      {QR.flatMap((row, y) =>
        row.split('').map((c, x) => (
          <span key={`${x}-${y}`} className={c === '1' ? 'bg-zinc-900' : 'bg-transparent'} style={{ aspectRatio: '1' }} />
        ))
      )}
    </div>
  );
}

function TentCard() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[0.15em] rounded-[0.3em] border border-amber-200/70 bg-[#fffaf0] p-[0.25em] text-zinc-900 shadow-[0_0.2em_0.5em_rgba(0,0,0,0.25)]">
      <QrGlyph className="w-[58%]" />
      <p className="text-[0.36em] font-bold uppercase tracking-[0.1em]">Scan to order</p>
    </div>
  );
}

function PhoneScreen() {
  return (
    <div className="flex h-full w-full flex-col bg-[#101013] p-[0.55em] text-zinc-100">
      <div className="mx-auto mb-[0.5em] h-[0.35em] w-[35%] rounded-full bg-zinc-800" />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[0.62em] text-zinc-400">Table 7</p>
          <p className="text-[0.8em] font-semibold leading-tight">Cafe Aroma</p>
        </div>
        <QrCodeIcon className="h-[1em] w-[1em] text-yellow-400" />
      </div>
      <ul className="mt-[0.6em] space-y-[0.35em]">
        {[
          ['Cappuccino', '₹180', true],
          ['Avocado toast', '₹320'],
          ['Blueberry muffin', '₹140'],
          ['Cold brew', '₹220'],
        ].map(([n, p, hot]) => (
          <li key={n} className="flex items-center justify-between rounded-[0.4em] bg-white/[0.06] px-[0.5em] py-[0.35em] text-[0.62em]">
            <span className="truncate">
              {n}
              {hot && <span className="ml-[0.4em] rounded-full bg-yellow-400/25 px-[0.4em] text-[0.8em] text-yellow-300">Popular</span>}
            </span>
            <span className="ml-[0.4em] tabular-nums text-zinc-300">{p}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto rounded-[0.5em] bg-yellow-400 py-[0.45em] text-center text-[0.66em] font-bold text-zinc-900">
        Pay ₹720 · UPI
      </div>
    </div>
  );
}

function KdsBoard() {
  const rows = [
    ['#1042', 'T7', 'Cappuccino ×2 · Toast', 'NEW', 'bg-yellow-400/25 text-yellow-200'],
    ['#1041', 'T3', 'Cold brew · Muffin', 'COOKING', 'bg-sky-400/20 text-sky-200'],
    ['#1040', 'T12', 'Latte ×3', 'READY', 'bg-emerald-400/20 text-emerald-200'],
  ];
  return (
    <div className="flex h-full w-full flex-col rounded-[0.5em] border border-white/10 bg-[#141418] p-[0.6em] text-zinc-100 shadow-[0_0.5em_1.2em_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between border-b border-white/10 pb-[0.4em]">
        <p className="inline-flex items-center gap-[0.35em] text-[0.72em] font-semibold">
          <ChefHatIcon className="h-[1em] w-[1em] text-yellow-400" /> Kitchen
        </p>
        <span className="inline-flex items-center gap-[0.3em] text-[0.58em] text-zinc-400">
          <span className="h-[0.45em] w-[0.45em] rounded-full bg-emerald-400" /> Live
        </span>
      </div>
      <ul className="mt-[0.45em] space-y-[0.3em]">
        {rows.map(([id, t, items, st, cls]) => (
          <li key={id} className="flex items-center justify-between rounded-[0.35em] bg-white/[0.05] px-[0.45em] py-[0.3em] text-[0.58em]">
            <span className="truncate">
              <b>{id}</b> <span className="text-zinc-400">· {t}</span> <span className="ml-[0.3em] text-zinc-300">{items}</span>
            </span>
            <span className={cn('ml-[0.4em] shrink-0 rounded-full px-[0.5em] py-[0.1em] text-[0.85em] font-semibold', cls)}>{st}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Ticket() {
  return (
    <div className="flex h-full w-full items-center gap-[0.5em] px-[0.6em] text-zinc-900">
      <span className="flex h-[1.6em] w-[1.6em] shrink-0 items-center justify-center rounded-[0.4em] bg-yellow-400">
        <ChefHatIcon className="h-[1em] w-[1em]" />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[0.66em] font-bold">#1042 · Table 7 → Kitchen</p>
        <p className="truncate text-[0.56em] text-zinc-500">2× Cappuccino · Avocado toast</p>
      </div>
    </div>
  );
}

function PaidChip() {
  return (
    <div className="flex h-full w-full items-center gap-[0.4em] px-[0.5em] text-zinc-900">
      <Wallet01Icon className="h-[1em] w-[1em] shrink-0" />
      <p className="truncate text-[0.62em] font-bold">₹720 settled · your account</p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Scene
 * ------------------------------------------------------------------ */

const FLOAT = (delay = 0, drift = 1.2) => ({
  animate: { z: [0, drift, 0] },
  transition: { duration: 4.5, delay, repeat: Infinity, ease: 'easeInOut' },
});

/**
 * Isometric diorama of the product in use: a cafe with a service counter,
 * a table with a small QR stand, a guest's phone scanning it, the resulting
 * ticket flying to the order screen, and the payment landing in the owner's
 * account.
 */
export function CafeScene({ className }) {
  const reduce = useReducedMotion();
  const [stageRef, unit] = useUnit();
  const px = (n) => n * unit;

  return (
    <div className={cn('relative mx-auto w-full max-w-[36rem]', className)} aria-hidden="true">
      <Tilt max={4} lift={0} glare={false} className="scene relative aspect-[5/4]">
        {/* Ambient light pool under the scene */}
        <div className="absolute inset-[10%] rounded-full bg-primary/20 blur-3xl dark:bg-primary/15" />

        <div
          ref={stageRef}
          className="absolute inset-x-0 top-0 aspect-square flat-3d"
          style={{
            '--u': `${unit}px`,
            fontSize: `${unit * 1.75}px`,
            transform: 'translate(-2%, -12%) scale3d(0.82, 0.82, 0.82) rotateX(57deg) rotateZ(-33deg)',
          }}
        >
          {/* Floor */}
          <At x={4} y={4} z={0}>
            <Slab w={92} h={92} d={4} radius={5} material={M.floor}>
              <div
                className="h-full w-full opacity-60"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, hsl(var(--foreground) / 0.08) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground) / 0.08) 1px, transparent 1px)',
                  backgroundSize: 'calc(var(--u) * 11.5) calc(var(--u) * 11.5)',
                }}
              />
            </Slab>
          </At>

          {/* Service counter along the back wall */}
          <At x={8} y={7} z={4}>
            <Counter screen={<KdsBoard />} />
          </At>

          {/* Plant in the back-right corner */}
          <At x={84} y={8} z={4}>
            <Plant />
          </At>

          {/* Table with two chairs */}
          <At x={26} y={36} z={4}>
            <Shadow w={48} h={48} opacity={0.3} blur={12} />
          </At>
          <At x={42} y={52} z={4}>
            <Disc r={8} d={1.5} material={M.steel} />
          </At>
          <At x={46.5} y={56.5} z={5.5}>
            <Disc r={3.5} d={16} material={M.steel} slices={10} />
          </At>
          <At x={30} y={40} z={21.5}>
            <Disc r={20} d={2.2} material={M.wood} slices={5}>
              <div className="h-full w-full rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.35),transparent_55%)]" />
            </Disc>
          </At>

          <At x={14} y={62} z={4} rotate={-40}>
            <Chair />
          </At>
          <At x={86} y={64} z={4} rotate={140}>
            <Chair />
          </At>

          {/* On the table: coffee, a pastry, and the small QR stand */}
          <At x={54} y={44} z={23.7}>
            <Cup />
          </At>
          <At x={34} y={46} z={23.7}>
            <Plate />
          </At>
          <At x={44} y={66} z={23.7} rotate={22}>
            <QrStand>
              <TentCard />
            </QrStand>
          </At>

          {/* Scan beam from the phone to the QR stand */}
          {!reduce && (
            <At x={44} y={76} z={24} rotate={22}>
              <Upright w={7} h={12}>
                <motion.div
                  className="h-full w-full [clip-path:polygon(50%_100%,0_0,100%_0)] bg-gradient-to-t from-yellow-300/80 via-yellow-300/20 to-transparent blur-[1.5px]"
                  animate={{ opacity: [0.2, 0.7, 0.2] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                />
              </Upright>
            </At>
          )}

          {/* Phone, held above the table, angled at the stand */}
          <At x={44} y={78} z={4}>
            <Shadow w={20} h={30} opacity={0.35} blur={12} />
          </At>
          <At x={44} y={92} z={28} rotate={22}>
            <motion.div className="flat-3d" {...(reduce ? {} : FLOAT(0.6, 1.5))}>
              <div className="flat-3d" style={{ transformOrigin: 'bottom', transform: 'rotateX(-62deg)' }}>
                <Slab w={12} h={24} d={1.2} radius={1.8} material={M.phone}>
                  <div className="h-full w-full p-[3%]">
                    <div className="h-full w-full overflow-hidden rounded-[1.1em] ring-1 ring-white/10">
                      <PhoneScreen />
                    </div>
                  </div>
                </Slab>
              </div>
            </motion.div>
          </At>

          {/* Ticket travelling from the phone to the counter screen */}
          <At x={0} y={0} z={0}>
            <motion.div
              className="flat-3d absolute left-0 top-0"
              initial={false}
              animate={
                reduce
                  ? { x: px(22), y: px(30), z: px(38), opacity: 1 }
                  : {
                      x: [px(40), px(34), px(24), px(12), px(12)],
                      y: [px(64), px(54), px(40), px(28), px(28)],
                      z: [px(30), px(38), px(42), px(38), px(38)],
                      opacity: [0, 1, 1, 1, 0],
                    }
              }
              transition={{ duration: 5, times: [0, 0.2, 0.6, 0.85, 1], repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.6 }}
            >
              <Upright w={24} h={6.5}>
                <div className="h-full w-full rounded-[0.6em] bg-[#fffdf7] shadow-[0_0.4em_1em_rgba(0,0,0,0.3)]">
                  <Ticket />
                </div>
              </Upright>
            </motion.div>
          </At>

          {/* Payment settled */}
          <At x={62} y={22} z={4}>
            <Shadow w={24} h={10} opacity={0.25} />
          </At>
          <At x={60} y={26} z={30}>
            <motion.div className="flat-3d" {...(reduce ? {} : FLOAT(1.8, 1))}>
              <Upright w={24} h={6}>
                <div className="h-full w-full rounded-full bg-yellow-400 shadow-[0_0.4em_1em_rgba(234,179,8,0.45)]">
                  <PaidChip />
                </div>
              </Upright>
            </motion.div>
          </At>
        </div>
      </Tilt>
    </div>
  );
}
