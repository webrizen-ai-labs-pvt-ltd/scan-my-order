import React, { useState, useMemo, useRef } from 'react';
import {
  AlertCircleIcon,
  CheckmarkBadge01Icon,
  Clock01Icon,
  Restaurant01Icon,
  Tick02Icon,
  Cancel01Icon,
  Layers01Icon,
  GridIcon,
  ZoomInAreaIcon,
  ZoomOutAreaIcon,
  RefreshIcon,
  UserGroupIcon,
  Calendar01Icon,
  Call02Icon,
  PlusSignIcon,
  InformationCircleIcon,
  ArrowRight01Icon
} from 'hugeicons-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button
} from '@smo/ui';

// Status configurations
export const TABLE_STATUS_CONFIG = {
  AVAILABLE: {
    label: 'Available',
    color: '#10B981',
    bgColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    dotColor: 'bg-emerald-500',
    svgGrad: 'grad-available',
    description: 'Clean & ready for walk-ins or bookings'
  },
  OCCUPIED: {
    label: 'Occupied',
    color: '#3B82F6',
    bgColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    dotColor: 'bg-blue-500',
    svgGrad: 'grad-occupied',
    description: 'Guests seated & ordering'
  },
  PROCESSING: {
    label: 'Cooking',
    color: '#F59E0B',
    bgColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    dotColor: 'bg-amber-500',
    svgGrad: 'grad-processing',
    description: 'Order in kitchen preparation'
  },
  READY: {
    label: 'Food Ready',
    color: '#8B5CF6',
    bgColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
    dotColor: 'bg-purple-500',
    svgGrad: 'grad-ready',
    description: 'Plates hot & ready on pass'
  },
  SERVED: {
    label: 'Served',
    color: '#06B6D4',
    bgColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
    dotColor: 'bg-cyan-500',
    svgGrad: 'grad-served',
    description: 'Dining course in progress'
  },
  BILL_REQUESTED: {
    label: 'Bill Requested',
    color: '#EAB308',
    bgColor: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
    dotColor: 'bg-yellow-500',
    svgGrad: 'grad-bill',
    description: 'Bill called / payment pending'
  },
  RESERVED: {
    label: 'Reserved',
    color: '#EC4899',
    bgColor: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30',
    dotColor: 'bg-pink-500',
    svgGrad: 'grad-reserved',
    description: 'Pre-booked reservation window'
  },
  ATTENTION: {
    label: 'Waiter Called',
    color: '#EF4444',
    bgColor: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 animate-pulse',
    dotColor: 'bg-red-500',
    svgGrad: 'grad-attention',
    description: 'Customer requests staff assistance'
  }
};

/**
 * Renders a realistic architectural dining chair with curved cushioned backrest and seat pad.
 * In floor view: rotation=0 means backrest at top, seat pointing down toward table.
 */
const RealisticChair = ({ x, y, rotation = 0, isOccupied = false, accentColor = '#3b82f6' }) => {
  return (
    <g transform={`translate(${x}, ${y}) rotate(${rotation})`} className="chair-element">
      {/* Soft ambient floor shadow */}
      <ellipse cx="0" cy="2" rx="9" ry="6.5" fill="rgba(0,0,0,0.55)" filter="url(#chair-drop-shadow)" />

      {/* Cushioned Seat Base */}
      <rect
        x="-9.5"
        y="-8"
        width="19"
        height="14.5"
        rx="4.5"
        fill={isOccupied ? "url(#chair-seat-occupied)" : "url(#chair-seat-cushion)"}
        stroke="#1c1917"
        strokeWidth="0.8"
      />

      {/* Fine upholstery seam line */}
      <rect
        x="-7.5"
        y="-6.5"
        width="15"
        height="11"
        rx="3.5"
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="0.6"
      />

      {/* Ergonomic Curved Backrest (Solid Walnut Rail / Dark Steel Frame) */}
      <path
        d="M -11,-7 Q 0,-13 11,-7 C 11.2,-5 9.5,-4 8,-5.2 Q 0,-10 -8,-5.2 C -9.5,-4 -11.2,-5 -11,-7 Z"
        fill={isOccupied ? accentColor : "url(#chair-rail-wood)"}
        stroke="#0c0a09"
        strokeWidth="1"
      />

      {/* Subtle backrest highlight */}
      <path
        d="M -8.5,-7.5 Q 0,-11.5 8.5,-7.5"
        fill="none"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="0.8"
        strokeLinecap="round"
      />

      {/* Diner dot / avatar if seated */}
      {isOccupied && (
        <circle cx="0" cy="-1.5" r="3" fill="#ffffff" opacity="0.85" />
      )}
    </g>
  );
};

/**
 * Computes exact chair positions around a table according to its seating capacity N.
 * Guarantees exactly N chairs are generated for every table.
 */
function generateChairsForTable(capacity, shape, width, height, isOccupied, statusColor) {
  const chairs = [];
  const N = Math.max(1, parseInt(capacity, 10) || 4);

  // Round Table: for capacity <= 5 or when shape is round
  if (shape === 'round' || (!shape.includes('rectangle') && N <= 5)) {
    const R = N <= 2 ? 30 : N === 3 ? 34 : N === 4 ? 38 : 42;
    const chairDistance = R + 11;
    for (let i = 0; i < N; i++) {
      // Angle in degrees starting at 12 o'clock (0 deg)
      const deg = (i * 360) / N;
      const rad = (deg * Math.PI) / 180;
      const x = chairDistance * Math.sin(rad);
      const y = -chairDistance * Math.cos(rad);
      chairs.push({
        id: `chair-${i}`,
        x,
        y,
        rotation: deg,
        isOccupied,
        statusColor
      });
    }
  } else {
    // Rectangular / Square Table: for capacity >= 6, or square tables
    const W = width || (N <= 4 ? 56 : Math.max(86, Math.ceil(N / 2) * 26 + 10));
    const H = height || (N <= 4 ? 56 : 54);

    if (N === 4 && W === H) {
      // 4-person Square Table: 1 chair on each side
      chairs.push({ id: 'chair-0', x: 0, y: -H / 2 - 11, rotation: 0, isOccupied, statusColor });
      chairs.push({ id: 'chair-1', x: W / 2 + 11, y: 0, rotation: 90, isOccupied, statusColor });
      chairs.push({ id: 'chair-2', x: 0, y: H / 2 + 11, rotation: 180, isOccupied, statusColor });
      chairs.push({ id: 'chair-3', x: -W / 2 - 11, y: 0, rotation: 270, isOccupied, statusColor });
    } else {
      // Rectangular Table (e.g. 6, 7, 8, 10, 12 covers)
      const hasLeftHead = N >= 7;
      const hasRightHead = N >= 8;
      const headChairsCount = (hasLeftHead ? 1 : 0) + (hasRightHead ? 1 : 0);
      const sideChairsTotal = N - headChairsCount;
      const topCount = Math.ceil(sideChairsTotal / 2);
      const bottomCount = Math.floor(sideChairsTotal / 2);

      // Top Side Chairs
      for (let i = 0; i < topCount; i++) {
        const x = -W / 2 + ((i + 0.5) * W) / topCount;
        chairs.push({
          id: `chair-top-${i}`,
          x,
          y: -H / 2 - 11,
          rotation: 0,
          isOccupied,
          statusColor
        });
      }

      // Bottom Side Chairs
      for (let i = 0; i < bottomCount; i++) {
        const x = -W / 2 + ((i + 0.5) * W) / bottomCount;
        chairs.push({
          id: `chair-bottom-${i}`,
          x,
          y: H / 2 + 11,
          rotation: 180,
          isOccupied,
          statusColor
        });
      }

      // Left Head Chair
      if (hasLeftHead) {
        chairs.push({
          id: 'chair-left',
          x: -W / 2 - 11,
          y: 0,
          rotation: 270,
          isOccupied,
          statusColor
        });
      }

      // Right Head Chair
      if (hasRightHead) {
        chairs.push({
          id: 'chair-right',
          x: W / 2 + 11,
          y: 0,
          rotation: 90,
          isOccupied,
          statusColor
        });
      }
    }
  }

  return chairs;
}

/**
 * Computes geometric positions for restaurant tables evenly across the canvas
 */
function computeFloorLayout(tables = []) {
  if (!tables || tables.length === 0) return [];

  const n = tables.length;
  const cols = n <= 4 ? Math.max(n, 2) : n <= 8 ? 4 : n <= 15 ? 5 : 6;
  const colWidth = 1000 / cols;
  const rowHeight = 150;
  const startX = 60 + colWidth / 2;
  const startY = 105;

  return tables.map((tbl, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = startX + col * colWidth;
    const y = startY + row * rowHeight;
    const capacity = parseInt(tbl.capacity, 10) || 4;
    const shape = tbl.shape || (capacity <= 5 ? 'round' : 'rectangle');

    // Determine tabletop width & height
    let w = 56;
    let h = 54;
    if (shape === 'round') {
      const r = capacity <= 2 ? 30 : capacity === 3 ? 34 : capacity === 4 ? 38 : 42;
      w = r * 2;
      h = r * 2;
    } else {
      w = capacity <= 4 ? 56 : Math.max(86, Math.ceil(capacity / 2) * 26 + 10);
      h = 54;
    }

    return {
      ...tbl,
      x,
      y,
      width: w,
      height: h,
      shape,
      capacity
    };
  });
}

/**
 * Custom Realistic SVG Table Element with Exact Chairs & Surface Information
 */
const SvgTableElement = ({ table, isSelected, onSelect }) => {
  const cfg = TABLE_STATUS_CONFIG[table.status] || TABLE_STATUS_CONFIG.AVAILABLE;
  const isAttention = table.status === 'ATTENTION' || table.hasWaiterCall;
  const isReady = table.status === 'READY';
  const isBill = table.status === 'BILL_REQUESTED';
  const isReserved = table.status === 'RESERVED';
  const isOccupied = ['OCCUPIED', 'PROCESSING', 'READY', 'SERVED', 'BILL_REQUESTED', 'ATTENTION'].includes(table.status);

  const capacity = table.capacity || 4;
  const isRound = table.shape === 'round';
  const R = capacity <= 2 ? 30 : capacity === 3 ? 34 : capacity === 4 ? 38 : 42;
  const W = table.width || (capacity <= 4 ? 56 : Math.max(86, Math.ceil(capacity / 2) * 26 + 10));
  const H = table.height || (capacity <= 4 ? 56 : 54);

  // Generate exact chairs matching capacity
  const chairs = useMemo(() => {
    return generateChairsForTable(capacity, table.shape, W, H, isOccupied, cfg.color);
  }, [capacity, table.shape, W, H, isOccupied, cfg.color]);

  // Glow filters based on status
  const glowId = isAttention
    ? 'url(#glow-red)'
    : isReady
      ? 'url(#glow-purple)'
      : isBill
        ? 'url(#glow-gold)'
        : isReserved
          ? 'url(#glow-pink)'
          : isSelected
            ? 'url(#glow-selected)'
            : 'none';

  return (
    <g
      id={`table-node-${table.tableNumber}`}
      transform={`translate(${table.x}, ${table.y})`}
      className="cursor-pointer select-none"
      onClick={() => onSelect(table)}
    >
      <title>{`Table ${table.tableNumber} · ${cfg.label} (${capacity} seats)`}</title>

      {/* Pulsing Alert Radar for WAITER CALL */}
      {isAttention && (
        <>
          <circle cx="0" cy="0" r={isRound ? R + 4 : W / 2 + 4} stroke="#EF4444" strokeWidth="2.5" fill="none" opacity="0.8">
            <animate attributeName="r" values={`${isRound ? R : W / 2};${isRound ? R + 26 : W / 2 + 30};${isRound ? R + 44 : W / 2 + 50}`} dur="1.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.85;0.35;0" dur="1.8s" repeatCount="indefinite" />
          </circle>
        </>
      )}

      {/* Luminous Pulsing Halo for BILL REQUESTED */}
      {isBill && (
        <circle cx="0" cy="0" r={isRound ? R + 4 : W / 2 + 4} stroke="#EAB308" strokeWidth="2" fill="none" opacity="0.8">
          <animate attributeName="r" values={`${isRound ? R : W / 2};${isRound ? R + 18 : W / 2 + 20}`} dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;0" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Selected Dashed Orbital Halo */}
      {isSelected && (
        <circle
          cx="0"
          cy="0"
          r={isRound ? R + 18 : Math.max(W, H) / 2 + 18}
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeDasharray="4 3"
          fill="none"
          opacity="0.85"
        >
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="18s" repeatCount="indefinite" />
        </circle>
      )}

      {/* 1. Realistic Chairs Placed Around Table (Exactly N Chairs) */}
      <g className="table-chairs-group">
        {chairs.map((chair) => (
          <RealisticChair
            key={chair.id}
            x={chair.x}
            y={chair.y}
            rotation={chair.rotation}
            isOccupied={chair.isOccupied}
            accentColor={cfg.color}
          />
        ))}
      </g>

      {/* 2. Physical Table Top with Architectural Depth */}
      <g className="table-top-group">
        {isRound ? (
          <>
            {/* Table Floor Cast Shadow */}
            <circle cx="0" cy="5" r={R} fill="rgba(0,0,0,0.6)" filter="url(#table-floor-shadow)" />

            {/* Solid Wood Beveled Rim */}
            <circle
              cx="0"
              cy="0"
              r={R}
              fill="url(#walnut-dark-wood)"
              stroke="#18181b"
              strokeWidth="1.2"
              filter={glowId}
            />

            {/* Ambient LED Status Ring */}
            <circle
              cx="0"
              cy="0"
              r={R - 2}
              fill="url(#tabletop-slate-surface)"
              stroke={cfg.color}
              strokeWidth={isSelected ? 3 : 2}
            />

            {/* Fine Specular Inner Rim */}
            <circle cx="0" cy="0" r={R - 4} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
          </>
        ) : (
          <>
            {/* Table Floor Cast Shadow */}
            <rect
              x={-W / 2}
              y={-H / 2 + 5}
              width={W}
              height={H}
              rx="8"
              fill="rgba(0,0,0,0.6)"
              filter="url(#table-floor-shadow)"
            />

            {/* Solid Wood Beveled Rim */}
            <rect
              x={-W / 2}
              y={-H / 2}
              width={W}
              height={H}
              rx="8"
              fill="url(#walnut-dark-wood)"
              stroke="#18181b"
              strokeWidth="1.2"
              filter={glowId}
            />

            {/* Ambient LED Status Ring */}
            <rect
              x={-W / 2 + 2}
              y={-H / 2 + 2}
              width={W - 4}
              height={H - 4}
              rx="6"
              fill="url(#tabletop-slate-surface)"
              stroke={cfg.color}
              strokeWidth={isSelected ? 3 : 2}
            />

            {/* Fine Specular Inner Rim */}
            <rect
              x={-W / 2 + 4}
              y={-H / 2 + 4}
              width={W - 8}
              height={H - 8}
              rx="5"
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="0.8"
            />
          </>
        )}
      </g>

      {/* 3. Surface Architectural Information Display */}
      <g className="table-info-display pointer-events-none">
        {/* Table Number Pill */}
        <g transform="translate(0, -7)">
          <rect
            x="-18"
            y="-9"
            width="36"
            height="18"
            rx="5"
            fill="#09090b"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="0.8"
          />
          <text
            x="0"
            y="0.5"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#ffffff"
            fontSize="10.5"
            fontWeight="900"
            letterSpacing="0.4"
          >
            T{table.tableNumber}
          </text>
        </g>

        {/* Capacity Label */}
        <text
          x="0"
          y="7"
          textAnchor="middle"
          fill="#a1a1aa"
          fontSize="7.5"
          fontWeight="600"
          letterSpacing="0.2"
        >
          {capacity} seats
        </text>

        {/* Live Sub-Badge: Status / Order / Reservation */}
        {isReserved && table.activeReservation ? (
          <g transform="translate(0, 18)">
            <rect
              x="-35"
              y="-7"
              width="70"
              height="14"
              rx="4"
              fill="rgba(236,72,153,0.3)"
              stroke="#EC4899"
              strokeWidth="0.8"
            />
            <text
              x="0"
              y="0.5"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#F472B6"
              fontSize="7.5"
              fontWeight="800"
            >
              {new Date(table.activeReservation.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {table.activeReservation.guestName?.split(' ')[0]}
            </text>
          </g>
        ) : table.currentOrder ? (
          <g transform="translate(0, 18)">
            <rect
              x="-30"
              y="-7"
              width="60"
              height="14"
              rx="4"
              fill="rgba(59,130,246,0.25)"
              stroke={cfg.color}
              strokeWidth="0.8"
            />
            <text
              x="0"
              y="0.5"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#93C5FD"
              fontSize="7.5"
              fontWeight="800"
            >
              ₹{Math.round(table.currentOrder.totalAmount).toLocaleString('en-IN')} • {cfg.label}
            </text>
          </g>
        ) : table.nextReservation ? (
          <g transform="translate(0, 18)">
            <rect
              x="-32"
              y="-6.5"
              width="64"
              height="13"
              rx="3.5"
              fill="rgba(236,72,153,0.15)"
              stroke="rgba(236,72,153,0.6)"
              strokeWidth="0.6"
              strokeDasharray="2 1"
            />
            <text
              x="0"
              y="0.5"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#F472B6"
              fontSize="7"
              fontWeight="700"
            >
              Next: {new Date(table.nextReservation.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </text>
          </g>
        ) : (
          <g transform="translate(0, 18)">
            <circle cx="-16" cy="0" r="2.5" fill="#10B981" />
            <text
              x="-10"
              y="0.5"
              textAnchor="start"
              dominantBaseline="central"
              fill="#10B981"
              fontSize="7.5"
              fontWeight="700"
            >
              Available
            </text>
          </g>
        )}

        {/* Top-Right Status Badge Indicator */}
        {isAttention ? (
          <g transform={`translate(${isRound ? R - 6 : W / 2 - 4}, ${isRound ? -R + 6 : -H / 2 + 4})`}>
            <circle cx="0" cy="0" r="7.5" fill="#EF4444" stroke="#ffffff" strokeWidth="1.2" />
            <text x="0" y="3" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="bold">!</text>
          </g>
        ) : isBill ? (
          <g transform={`translate(${isRound ? R - 6 : W / 2 - 4}, ${isRound ? -R + 6 : -H / 2 + 4})`}>
            <circle cx="0" cy="0" r="7.5" fill="#EAB308" stroke="#ffffff" strokeWidth="1.2" />
            <text x="0" y="3" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold">₹</text>
          </g>
        ) : isReady ? (
          <g transform={`translate(${isRound ? R - 6 : W / 2 - 4}, ${isRound ? -R + 6 : -H / 2 + 4})`}>
            <circle cx="0" cy="0" r="7.5" fill="#8B5CF6" stroke="#ffffff" strokeWidth="1.2" />
            <text x="0" y="2.5" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold">✓</text>
          </g>
        ) : isReserved ? (
          <g transform={`translate(${isRound ? R - 6 : W / 2 - 4}, ${isRound ? -R + 6 : -H / 2 + 4})`}>
            <circle cx="0" cy="0" r="7.5" fill="#EC4899" stroke="#ffffff" strokeWidth="1.2" />
            <text x="0" y="2.5" textAnchor="middle" fill="#ffffff" fontSize="7" fontWeight="bold">R</text>
          </g>
        ) : null}
      </g>
    </g>
  );
};

export const LiveTableFloorPlan = ({
  floorStatus,
  onSelectTable,
  onResolveWaiterCall,
  onOpenPOS,
  onSeatReservation,
  onBookTable,
  className = ''
}) => {
  const [selectedTable, setSelectedTable] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [viewMode, setViewMode] = useState('floor'); // 'floor' | 'schedule' | 'grid'
  const [zoomLevel, setZoomLevel] = useState(1);
  const containerRef = useRef(null);

  const tables = floorStatus?.tables || [];
  const layoutTables = useMemo(() => computeFloorLayout(tables), [tables]);

  // Compute status summary counts
  const statusCounts = useMemo(() => {
    const counts = {
      ALL: tables.length,
      AVAILABLE: 0,
      RESERVED: 0,
      OCCUPIED: 0,
      PROCESSING: 0,
      READY: 0,
      SERVED: 0,
      BILL_REQUESTED: 0,
      ATTENTION: 0
    };
    tables.forEach((t) => {
      if (counts[t.status] !== undefined) {
        counts[t.status]++;
      } else {
        counts.AVAILABLE++;
      }
    });
    return counts;
  }, [tables]);

  // Filtered tables
  const displayedTables = useMemo(() => {
    if (filterStatus === 'ALL') return layoutTables;
    return layoutTables.filter((t) => t.status === filterStatus);
  }, [layoutTables, filterStatus]);

  const handleTableClick = (table) => {
    setSelectedTable(table);
    if (onSelectTable) onSelectTable(table);
  };

  return (
    <div className={`flex flex-col bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden ${className}`}>
      {/* Top Header & Interactive Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Restaurant01Icon size={20} />
          </div>
          <div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              Live Restaurant Floor
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live Sync
              </span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Architectural floor plan with realistic tables, exact seating chairs & reservation schedule.
            </p>
          </div>
        </div>

        {/* View Switcher: Floor vs Schedule vs Grid */}
        <div className="flex items-center gap-2">
          {/* Zoom controls (only in Floor mode) */}
          {viewMode === 'floor' && (
            <div className="flex items-center bg-zinc-200/80 dark:bg-zinc-800/80 rounded-lg p-0.5 border border-zinc-300/60 dark:border-zinc-700/60">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.15))}
                className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded text-zinc-600 dark:text-zinc-300 transition-colors"
                title="Zoom Out"
              >
                <ZoomOutAreaIcon size={16} />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="px-2 text-xs font-medium text-zinc-600 dark:text-zinc-300"
                title="Reset Zoom"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.15))}
                className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded text-zinc-600 dark:text-zinc-300 transition-colors"
                title="Zoom In"
              >
                <ZoomInAreaIcon size={16} />
              </button>
            </div>
          )}

          {/* 3-way view switcher */}
          <div className="flex bg-zinc-200/80 dark:bg-zinc-800/80 rounded-lg p-0.5 border border-zinc-300/60 dark:border-zinc-700/60">
            <button
              onClick={() => setViewMode('floor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'floor'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
            >
              <Layers01Icon size={14} />
              Floor Plan
            </button>
            <button
              onClick={() => setViewMode('schedule')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'schedule'
                  ? 'bg-white dark:bg-zinc-900 text-pink-600 dark:text-pink-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
            >
              <Calendar01Icon size={14} />
              Reservations Schedule
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'grid'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
            >
              <GridIcon size={14} />
              Grid View
            </button>
          </div>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex items-center gap-1.5 px-5 py-2.5 overflow-x-auto border-b border-zinc-100 dark:border-zinc-800/60 bg-white dark:bg-zinc-950 scrollbar-none">
        <span className="text-xs font-semibold text-zinc-400 mr-1 shrink-0">Filter:</span>
        <button
          onClick={() => setFilterStatus('ALL')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors shrink-0 ${filterStatus === 'ALL'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-transparent shadow-sm'
              : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
        >
          All ({statusCounts.ALL})
        </button>

        {Object.entries(TABLE_STATUS_CONFIG).map(([statusKey, cfg]) => {
          const count = statusCounts[statusKey] || 0;
          const isActive = filterStatus === statusKey;
          return (
            <button
              key={statusKey}
              onClick={() => setFilterStatus(statusKey)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all shrink-0 ${isActive
                  ? 'ring-2 ring-offset-1 ring-zinc-500 ' + cfg.bgColor
                  : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
            >
              <span className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
              <span>{cfg.label}</span>
              <span className="text-[10px] font-bold opacity-75">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="relative flex-1 min-h-[540px] overflow-hidden" ref={containerRef}>
        {tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
              <Restaurant01Icon size={32} className="text-zinc-400" />
            </div>
            <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">No tables configured</h4>
            <p className="text-xs text-zinc-500 max-w-sm">
              Add tables in your Store Settings to activate the live architectural floor plan and QR dine-in tracking.
            </p>
          </div>
        ) : viewMode === 'floor' ? (
          /* Architectural Floor Plan SVG */
          <div className="w-full h-full min-h-[540px] flex items-center justify-center p-2 bg-[#0c0a09] relative select-none overflow-auto">
            <div
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'center center',
                transition: 'transform 0.15s ease-out'
              }}
              className="w-full max-w-[1100px]"
            >
              <svg
                viewBox="0 0 1100 660"
                className="w-full h-auto drop-shadow-2xl rounded-xl"
                style={{ background: '#0c0a09' }}
              >
                <defs>
                  {/* Luxury Parquet Hardwood Floor Tile Pattern */}
                  <pattern id="floor-hardwood-pattern" width="64" height="64" patternUnits="userSpaceOnUse">
                    {/* Planks Background */}
                    <rect width="64" height="64" fill="#14110f" />
                    {/* Staggered Planks Outline */}
                    <line x1="0" y1="32" x2="64" y2="32" stroke="#1f1b18" strokeWidth="0.8" />
                    <line x1="32" y1="0" x2="32" y2="32" stroke="#1f1b18" strokeWidth="0.8" />
                    <line x1="64" y1="32" x2="64" y2="64" stroke="#1f1b18" strokeWidth="0.8" />
                    <line x1="0" y1="64" x2="64" y2="64" stroke="#1f1b18" strokeWidth="0.8" />
                    {/* Subtle Woodgrain Grain Lines */}
                    <line x1="4" y1="8" x2="28" y2="8" stroke="#191512" strokeWidth="0.5" strokeDasharray="3 4" />
                    <line x1="36" y1="44" x2="60" y2="44" stroke="#191512" strokeWidth="0.5" strokeDasharray="4 5" />
                  </pattern>

                  {/* Table Ambient Floor Shadow */}
                  <filter id="table-floor-shadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="6" />
                    <feOffset dx="0" dy="5" result="offsetblur" />
                    <feComponentTransfer>
                      <feFuncA type="linear" slope="0.55" />
                    </feComponentTransfer>
                    <feMerge>
                      <feMergeNode />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  {/* Chair Drop Shadow */}
                  <filter id="chair-drop-shadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" />
                  </filter>

                  {/* Realistic Dark Walnut Wood Tabletop Gradient */}
                  <linearGradient id="walnut-dark-wood" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#382417" />
                    <stop offset="35%" stopColor="#291a10" />
                    <stop offset="70%" stopColor="#1e130c" />
                    <stop offset="100%" stopColor="#140c08" />
                  </linearGradient>

                  {/* Architectural Matte Carbon Slate Surface */}
                  <radialGradient id="tabletop-slate-surface" cx="45%" cy="40%" r="65%">
                    <stop offset="0%" stopColor="#27272a" />
                    <stop offset="60%" stopColor="#18181b" />
                    <stop offset="100%" stopColor="#09090b" />
                  </radialGradient>

                  {/* Chair Seat Cushion Gradient (Neutral Leather) */}
                  <linearGradient id="chair-seat-cushion" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#3f3f46" />
                    <stop offset="60%" stopColor="#27272a" />
                    <stop offset="100%" stopColor="#18181b" />
                  </linearGradient>

                  {/* Chair Seat Cushion Gradient (Occupied) */}
                  <linearGradient id="chair-seat-occupied" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#1e293b" />
                    <stop offset="100%" stopColor="#0f172a" />
                  </linearGradient>

                  {/* Chair Curved Backrest Rail Wood */}
                  <linearGradient id="chair-rail-wood" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#291a10" />
                    <stop offset="50%" stopColor="#452c1c" />
                    <stop offset="100%" stopColor="#291a10" />
                  </linearGradient>

                  {/* Status Halos & Glows */}
                  <filter id="glow-red" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  <filter id="glow-gold" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  <filter id="glow-purple" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  <filter id="glow-pink" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  <filter id="glow-selected" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Hardwood Parquet Canvas */}
                <rect
                  x="0"
                  y="0"
                  width="1100"
                  height={Math.max(480, Math.ceil(displayedTables.length / (displayedTables.length <= 4 ? Math.max(displayedTables.length, 2) : displayedTables.length <= 8 ? 4 : displayedTables.length <= 15 ? 5 : 6)) * 150 + 70)}
                  fill="url(#floor-hardwood-pattern)"
                  rx="16"
                />

                {/* Ambient Floor Lighting Vignette (Spotlight in center of floor) */}
                <rect
                  x="0"
                  y="0"
                  width="1100"
                  height={Math.max(480, Math.ceil(displayedTables.length / (displayedTables.length <= 4 ? Math.max(displayedTables.length, 2) : displayedTables.length <= 8 ? 4 : displayedTables.length <= 15 ? 5 : 6)) * 150 + 70)}
                  fill="none"
                  rx="16"
                  stroke="#292524"
                  strokeWidth="2"
                />

                {/* Architectural Wall Perimeter Outline */}
                <rect
                  x="14"
                  y="14"
                  width="1072"
                  height={Math.max(480, Math.ceil(displayedTables.length / (displayedTables.length <= 4 ? Math.max(displayedTables.length, 2) : displayedTables.length <= 8 ? 4 : displayedTables.length <= 15 ? 5 : 6)) * 150 + 70) - 28}
                  rx="14"
                  fill="none"
                  stroke="#3f3f46"
                  strokeWidth="1.5"
                  strokeDasharray="8 6"
                />

                {/* Architectural Service Pass & Bar Area at Top-Right */}
                <g transform="translate(860, 26)">
                  <rect x="0" y="0" width="180" height="24" rx="4" fill="#1c1917" stroke="#44403c" strokeWidth="1" />
                  <text x="90" y="15" textAnchor="middle" fill="#78716c" fontSize="9" fontWeight="700" letterSpacing="1.2">
                    KITCHEN PASS / BAR
                  </text>
                </g>

                {/* Render All Realistic SVG Tables with Exact Chairs */}
                {displayedTables.map((tbl) => (
                  <SvgTableElement
                    key={tbl.id || tbl.tableNumber}
                    table={tbl}
                    isSelected={selectedTable?.id === tbl.id}
                    onSelect={handleTableClick}
                  />
                ))}
              </svg>
            </div>
          </div>
        ) : viewMode === 'schedule' ? (
          /* Reservations Schedule & Timeline View */
          <div className="p-6 bg-zinc-50/50 dark:bg-zinc-950 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Calendar01Icon size={18} className="text-pink-600" />
                  Today's Table Schedule & Booking Timeline
                </h4>
                <p className="text-xs text-zinc-500">
                  Overview of all dining reservations, booked slots, and table availability for today.
                </p>
              </div>

              {onBookTable && (
                <button
                  onClick={() => onBookTable(null)}
                  className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white font-semibold text-xs rounded-xl shadow-sm gap-1.5 flex items-center transition-colors"
                >
                  <PlusSignIcon size={14} /> New Reservation
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tables.map((table) => {
                const todayReservations = table.upcomingReservations || [];
                const hasBookings = todayReservations.length > 0;
                const activeRes = table.activeReservation;

                return (
                  <div
                    key={table.id}
                    className={`p-4 rounded-2xl border transition-all bg-white dark:bg-zinc-900 ${activeRes
                        ? 'border-pink-300 dark:border-pink-800/80 shadow-sm'
                        : 'border-zinc-200 dark:border-zinc-800'
                      }`}
                  >
                    {/* Header */}
                    <div
                      onClick={() => handleTableClick(table)}
                      className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3 cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-800 text-white flex flex-col items-center justify-center font-black text-xs leading-none">
                          <span className="text-[7px] text-zinc-400 font-bold uppercase">Table</span>
                          {table.tableNumber}
                        </div>
                        <div>
                          <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 block group-hover:text-primary transition-colors">
                            Table {table.tableNumber}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            Capacity: {table.capacity} seats • {table.shape === 'round' ? 'Round' : 'Rectangular'}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${TABLE_STATUS_CONFIG[table.status]?.bgColor
                          }`}
                      >
                        {TABLE_STATUS_CONFIG[table.status]?.label}
                      </span>
                    </div>

                    {/* Today's Schedule */}
                    <div className="mt-3 space-y-2">
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Today's Bookings ({todayReservations.length})
                      </span>

                      {hasBookings ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {todayReservations.map((res) => {
                            const isCurrent = res.id === activeRes?.id;
                            const startTime = new Date(res.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            const endTime = new Date(res.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                            return (
                              <div
                                key={res.id}
                                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${isCurrent
                                    ? 'bg-pink-500/10 border-pink-500/30 text-pink-700 dark:text-pink-300'
                                    : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                                  }`}
                              >
                                <div>
                                  <div className="font-bold flex items-center gap-1.5">
                                    <span>{res.guestName}</span>
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/40 dark:bg-zinc-900/40 font-semibold">
                                      {res.partySize || table.capacity} covers
                                    </span>
                                  </div>
                                  <div className="text-[11px] opacity-80 mt-0.5 flex items-center gap-2">
                                    <span>{startTime} - {endTime}</span>
                                    <span>•</span>
                                    <a href={`tel:${res.guestPhone}`} className="hover:underline font-medium">
                                      {res.guestPhone}
                                    </a>
                                  </div>
                                </div>

                                {res.status === 'CONFIRMED' && onSeatReservation && (
                                  <button
                                    onClick={() => onSeatReservation(res.id, table.id)}
                                    className="h-7 text-[11px] px-2.5 bg-pink-600 hover:bg-pink-700 text-white font-semibold rounded-lg shrink-0 transition-colors flex items-center justify-center"
                                  >
                                    Seat
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-4 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs">
                          No bookings scheduled today
                        </div>
                      )}
                    </div>

                    {/* Footer Quick Action */}
                    <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                      <button
                        onClick={() => handleTableClick(table)}
                        className="text-primary hover:underline font-semibold"
                      >
                        Inspect Details →
                      </button>

                      {onBookTable && (
                        <button
                          onClick={() => onBookTable(table)}
                          className="text-pink-600 hover:text-pink-700 dark:text-pink-400 font-semibold flex items-center gap-1"
                        >
                          <PlusSignIcon size={12} /> Book Slot
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Table Grid Cards View */
          <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 bg-zinc-50/50 dark:bg-zinc-950">
            {displayedTables.map((tbl) => {
              const cfg = TABLE_STATUS_CONFIG[tbl.status] || TABLE_STATUS_CONFIG.AVAILABLE;
              const isSelected = selectedTable?.id === tbl.id;
              return (
                <div
                  key={tbl.id || tbl.tableNumber}
                  onClick={() => handleTableClick(tbl)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col items-center justify-between gap-2 bg-white dark:bg-zinc-900 ${isSelected
                      ? 'ring-2 ring-primary border-transparent shadow-md'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                >
                  <div className="w-full flex items-center justify-between">
                    <span className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">
                      Table {tbl.tableNumber}
                    </span>
                    <span className={`w-2.5 h-2.5 rounded-full ${cfg.dotColor} ${tbl.status === 'ATTENTION' ? 'animate-ping' : ''}`} />
                  </div>

                  {/* SVG Table graphic inside card */}
                  <div className="w-20 h-20 my-1 flex items-center justify-center pointer-events-none">
                    <svg viewBox="-55 -55 110 110" className="w-full h-full overflow-visible">
                      <SvgTableElement
                        table={{ ...tbl, x: 0, y: 0 }}
                        isSelected={isSelected}
                        onSelect={() => { }}
                      />
                    </svg>
                  </div>

                  <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold border ${cfg.bgColor}`}>
                    {cfg.label}
                  </span>

                  <div className="w-full text-xs text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                    <span>{tbl.capacity} seats</span>
                    {tbl.currentOrder ? (
                      <span className="font-bold text-zinc-900 dark:text-zinc-200">
                        ₹{Math.round(tbl.currentOrder.totalAmount).toLocaleString('en-IN')}
                      </span>
                    ) : tbl.activeReservation ? (
                      <span className="font-bold text-pink-600 dark:text-pink-400">
                        Reserved
                      </span>
                    ) : (
                      <span className="text-zinc-400">Available</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Table Overview Modal Dialog (For All Tabs: Floor Plan, Schedule, Grid) */}
      <Dialog
        open={Boolean(selectedTable)}
        onOpenChange={(open) => {
          if (!open) setSelectedTable(null);
        }}
      >
        <DialogContent className="sm:max-w-[620px] max-h-[88vh] overflow-y-auto p-0 gap-0 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl rounded-2xl">
          {selectedTable && (
            <div className="flex flex-col">
              {/* Modal Header */}
              <div className="p-6 pb-4 border-b border-zinc-100 dark:border-zinc-800 flex items-start gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black text-xl text-white shadow-md shrink-0"
                  style={{ backgroundColor: TABLE_STATUS_CONFIG[selectedTable.status]?.color || '#10B981' }}
                >
                  <span className="text-[10px] font-bold uppercase opacity-80 leading-none">Table</span>
                  {selectedTable.tableNumber}
                </div>

                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-xl font-black text-zinc-900 dark:text-zinc-50">
                      Table {selectedTable.tableNumber}
                    </DialogTitle>
                    {selectedTable.activePin && (
                      <span className="text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 rounded-full font-bold">
                        PIN: {selectedTable.activePin}
                      </span>
                    )}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${TABLE_STATUS_CONFIG[selectedTable.status]?.bgColor
                        }`}
                    >
                      {TABLE_STATUS_CONFIG[selectedTable.status]?.label}
                    </span>
                  </div>
                  <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Capacity: {selectedTable.capacity || 4} chairs • {selectedTable.shape === 'round' ? 'Round table' : 'Rectangular table'} • {TABLE_STATUS_CONFIG[selectedTable.status]?.description}
                  </DialogDescription>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                {/* Active Waiter Call Alert */}
                {selectedTable.hasWaiterCall && selectedTable.activeWaiterCalls?.length > 0 && (
                  <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400">
                    <div className="flex items-center gap-2.5 text-xs">
                      <AlertCircleIcon size={20} className="shrink-0 animate-bounce text-red-500" />
                      <div>
                        <span className="font-bold block">Active Customer Assistance Call</span>
                        <span className="opacity-90">Type: {selectedTable.activeWaiterCalls[0].type}</span>
                      </div>
                    </div>
                    {onResolveWaiterCall && (
                      <Button
                        onClick={() => onResolveWaiterCall(selectedTable.activeWaiterCalls[0].id)}
                        variant="link"
                      >
                        Resolve Call
                      </Button>
                    )}
                  </div>
                )}

                {/* Active Dining Order Breakdown */}
                {selectedTable.currentOrder ? (
                  <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200/80 dark:border-zinc-800 text-xs">
                      <div className="flex items-center gap-2">
                        <Restaurant01Icon size={16} className="text-blue-500" />
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">
                          Active Dining Order
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold text-[10px]">
                          {selectedTable.currentOrder.status}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        Origin: <span className="font-semibold text-zinc-600 dark:text-zinc-300">{selectedTable.currentOrder.origin}</span>
                      </span>
                    </div>

                    {/* Items list with individual prices */}
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {selectedTable.currentOrder.items?.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-white dark:hover:bg-zinc-800/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">{item.name}</span>
                            <span className="text-[11px] font-semibold text-zinc-400 px-1.5 py-0.2 bg-zinc-200/60 dark:bg-zinc-800 rounded">
                              x{item.quantity}
                            </span>
                          </div>
                          <span className="font-bold text-zinc-700 dark:text-zinc-300">
                            ₹{((item.priceAtOrder || 0) * (item.quantity || 1)).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Total Amount in Rupee (Clean & Accurate) */}
                    <div className="pt-3 border-t border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-zinc-500 block">Total Bill Amount</span>
                        <span className="text-[11px] text-zinc-400">
                          {selectedTable.currentOrder.itemsCount || selectedTable.currentOrder.items?.length || 0} total items
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-zinc-900 dark:text-zinc-50 block">
                          ₹{Number(selectedTable.currentOrder.totalAmount).toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          {selectedTable.currentOrder.paymentModel === 'PREPAID' ? 'Prepaid Order' : 'Postpaid Dining'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                    <Restaurant01Icon size={16} />
                    <span>No active dining order on Table {selectedTable.tableNumber}. Ready for guests.</span>
                  </div>
                )}

                {/* Today's Booking Schedule Timeline */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <Calendar01Icon size={15} className="text-pink-600" />
                      Today's Booking Timeline ({(selectedTable.upcomingReservations || []).length})
                    </h5>
                    {onBookTable && (
                      <Button
                        onClick={() => {
                          const tbl = selectedTable;
                          setSelectedTable(null);
                          onBookTable(tbl);
                        }}
                      > Book Slot
                      </Button>
                    )}
                  </div>

                  {(selectedTable.upcomingReservations || []).length > 0 ? (
                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                      {selectedTable.upcomingReservations.map((res) => {
                        const startTime = new Date(res.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const endTime = new Date(res.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const isCurrent = res.id === selectedTable.activeReservation?.id;

                        return (
                          <div
                            key={res.id}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${isCurrent
                                ? 'bg-pink-500/10 border-pink-500/30 text-pink-800 dark:text-pink-300'
                                : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200'
                              }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold flex items-center gap-2">
                                <span className="truncate">{res.guestName}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-white dark:bg-zinc-800 font-semibold text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-700">
                                  {res.partySize || selectedTable.capacity} Guests
                                </span>
                                {isCurrent && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-pink-500 text-white font-bold uppercase tracking-wider">
                                    Current
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-zinc-700 dark:text-zinc-300">{startTime} - {endTime}</span>
                                <span>•</span>
                                <a href={`tel:${res.guestPhone}`} className="text-primary hover:underline">
                                  {res.guestPhone}
                                </a>
                              </div>
                              {res.notes && (
                                <div className="text-[10px] italic text-zinc-400 mt-1 truncate">"{res.notes}"</div>
                              )}
                            </div>

                            {res.status === 'CONFIRMED' && onSeatReservation && (
                              <button
                                onClick={() => {
                                  onSeatReservation(res.id, selectedTable.id);
                                  setSelectedTable(null);
                                }}
                                className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white font-semibold rounded-lg text-xs transition-colors shrink-0 shadow-sm"
                              >
                                Seat Guests
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4 bg-zinc-50/50 dark:bg-zinc-900/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs flex items-center justify-center gap-2">
                      <InformationCircleIcon size={15} />
                      <span>No reservations scheduled for Table {selectedTable.tableNumber} today. Table is available for walk-ins.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/80 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
                <button
                  onClick={() => setSelectedTable(null)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold transition-colors"
                >
                  Close
                </button>

                <div className="flex items-center gap-2">
                  {onBookTable && (
                    <Button
                      onClick={() => {
                        const tbl = selectedTable;
                        setSelectedTable(null);
                        onBookTable(tbl);
                      }}
                      variant="secondary" 
                      className="rounded-r-none"
                    >
                      Book This Table
                    </Button>
                  )}

                  {onOpenPOS && (
                    <Button
                      onClick={() => {
                        const num = selectedTable.tableNumber;
                        setSelectedTable(null);
                        onOpenPOS(num);
                      }}
                      className="rounded-l-none"
                    >
                      <Restaurant01Icon size={14} />
                      {selectedTable.currentOrder ? 'Manage in POS' : 'Punch Order in POS'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
