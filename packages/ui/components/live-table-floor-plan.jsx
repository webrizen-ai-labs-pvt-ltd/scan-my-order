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
  UserGroupIcon
} from 'hugeicons-react';

// Status configurations
export const TABLE_STATUS_CONFIG = {
  AVAILABLE: {
    label: 'Available',
    color: '#10B981',
    bgColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    dotColor: 'bg-emerald-500',
    svgGrad: 'grad-available',
    description: 'Clean and ready for guests'
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
    description: 'In kitchen preparation'
  },
  READY: {
    label: 'Food Ready',
    color: '#8B5CF6',
    bgColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
    dotColor: 'bg-purple-500',
    svgGrad: 'grad-ready',
    description: 'Ready on kitchen pass'
  },
  SERVED: {
    label: 'Served',
    color: '#06B6D4',
    bgColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
    dotColor: 'bg-cyan-500',
    svgGrad: 'grad-served',
    description: 'Dining in progress'
  },
  BILL_REQUESTED: {
    label: 'Bill Requested',
    color: '#EAB308',
    bgColor: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
    dotColor: 'bg-yellow-500',
    svgGrad: 'grad-bill',
    description: 'Bill called / payment pending'
  },
  ATTENTION: {
    label: 'Waiter Called',
    color: '#EF4444',
    bgColor: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 animate-pulse',
    dotColor: 'bg-red-500',
    svgGrad: 'grad-attention',
    description: 'Needs staff assistance'
  }
};

// Computes geometric positions for restaurant tables
function computeFloorLayout(tables = []) {
  if (!tables || tables.length === 0) return [];

  // Floor layout zones
  const positions = [
    // Left Window Booths
    { x: 120, y: 120, shape: 'booth', capacity: 4, zone: 'Window Booths' },
    { x: 120, y: 250, shape: 'booth', capacity: 4, zone: 'Window Booths' },
    { x: 120, y: 380, shape: 'booth', capacity: 4, zone: 'Window Booths' },
    { x: 120, y: 510, shape: 'booth', capacity: 4, zone: 'Window Booths' },

    // Main Dining Hall - Row 1
    { x: 310, y: 130, shape: 'round-4', capacity: 4, zone: 'Main Dining' },
    { x: 470, y: 130, shape: 'square-4', capacity: 4, zone: 'Main Dining' },
    { x: 630, y: 130, shape: 'round-4', capacity: 4, zone: 'Main Dining' },

    // Main Dining Hall - Row 2
    { x: 310, y: 280, shape: 'square-4', capacity: 4, zone: 'Main Dining' },
    { x: 470, y: 280, shape: 'round-4', capacity: 4, zone: 'Main Dining' },
    { x: 630, y: 280, shape: 'square-4', capacity: 4, zone: 'Main Dining' },

    // Main Dining Hall - Row 3
    { x: 310, y: 430, shape: 'round-2', capacity: 2, zone: 'Main Dining' },
    { x: 470, y: 430, shape: 'square-4', capacity: 4, zone: 'Main Dining' },
    { x: 630, y: 430, shape: 'round-2', capacity: 2, zone: 'Main Dining' },

    // Right Banquet & VIP Suites
    { x: 860, y: 140, shape: 'rectangle-6', capacity: 6, zone: 'VIP Banquet' },
    { x: 860, y: 280, shape: 'rectangle-6', capacity: 6, zone: 'VIP Banquet' },

    // Right Bar Lounge High-Tops
    { x: 830, y: 440, shape: 'round-2', capacity: 2, zone: 'Bar Lounge' },
    { x: 940, y: 440, shape: 'round-2', capacity: 2, zone: 'Bar Lounge' },
    { x: 830, y: 530, shape: 'round-2', capacity: 2, zone: 'Bar Lounge' },
    { x: 940, y: 530, shape: 'round-2', capacity: 2, zone: 'Bar Lounge' }
  ];

  return tables.map((tbl, index) => {
    let layout;
    if (index < positions.length) {
      layout = positions[index];
    } else {
      // Dynamic fallback grid for stores with > 19 tables
      const extraIdx = index - positions.length;
      const col = extraIdx % 4;
      const row = Math.floor(extraIdx / 4);
      layout = {
        x: 260 + col * 150,
        y: 110 + (row % 3) * 140,
        shape: col % 2 === 0 ? 'square-4' : 'round-4',
        capacity: 4,
        zone: 'Dining Extension'
      };
    }

    return {
      ...tbl,
      x: layout.x,
      y: layout.y,
      shape: layout.shape,
      capacity: layout.capacity,
      zone: layout.zone
    };
  });
}

// Custom SVG Table Component
const SvgTableElement = ({ table, isSelected, onSelect }) => {
  const cfg = TABLE_STATUS_CONFIG[table.status] || TABLE_STATUS_CONFIG.AVAILABLE;
  const isAttention = table.status === 'ATTENTION' || table.hasWaiterCall;
  const isReady = table.status === 'READY';
  const isBill = table.status === 'BILL_REQUESTED';

  const glowId = isAttention
    ? 'url(#glow-red)'
    : isReady
      ? 'url(#glow-purple)'
      : isSelected
        ? 'url(#glow-selected)'
        : 'url(#shadow-subtle)';

  // Renders the specific SVG table silhouette with chairs
  const renderTableShape = () => {
    switch (table.shape) {
      case 'round-2': {
        const r = 26;
        return (
          <g className="table-shape-group">
            {/* Top Chair */}
            <rect x="-14" y={-r - 14} width="28" height="10" rx="4" fill="#3f3f46" stroke="#27272a" strokeWidth="1.5" />
            {/* Bottom Chair */}
            <rect x="-14" y={r + 4} width="28" height="10" rx="4" fill="#3f3f46" stroke="#27272a" strokeWidth="1.5" />
            {/* Table Top */}
            <circle
              cx="0"
              cy="0"
              r={r}
              fill={`url(#${cfg.svgGrad})`}
              stroke={cfg.color}
              strokeWidth={isSelected ? 3 : 2}
              filter={glowId}
            />
            {/* Inner rim highlight */}
            <circle cx="0" cy="0" r={r - 4} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          </g>
        );
      }

      case 'round-4': {
        const r = 32;
        return (
          <g className="table-shape-group">
            {/* 4 Chairs (Top, Bottom, Left, Right) */}
            <rect x="-16" y={-r - 14} width="32" height="10" rx="4" fill="#3f3f46" stroke="#27272a" strokeWidth="1.5" />
            <rect x="-16" y={r + 4} width="32" height="10" rx="4" fill="#3f3f46" stroke="#27272a" strokeWidth="1.5" />
            <rect x={-r - 14} y="-16" width="10" height="32" rx="4" fill="#3f3f46" stroke="#27272a" strokeWidth="1.5" />
            <rect x={r + 4} y="-16" width="10" height="32" rx="4" fill="#3f3f46" stroke="#27272a" strokeWidth="1.5" />
            {/* Table Top */}
            <circle
              cx="0"
              cy="0"
              r={r}
              fill={`url(#${cfg.svgGrad})`}
              stroke={cfg.color}
              strokeWidth={isSelected ? 3 : 2}
              filter={glowId}
            />
            <circle cx="0" cy="0" r={r - 4} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          </g>
        );
      }

      case 'rectangle-6': {
        const w = 96;
        const h = 54;
        return (
          <g className="table-shape-group">
            {/* Top 3 Chairs */}
            <rect x="-42" y={-h / 2 - 12} width="24" height="9" rx="3" fill="#3f3f46" stroke="#27272a" strokeWidth="1.5" />
            <rect x="-12" y={-h / 2 - 12} width="24" height="9" rx="3" fill="#3f3f46" stroke="#27272a" strokeWidth="1.5" />
            <rect x="18" y={-h / 2 - 12} width="24" height="9" rx="3" fill="#3f3f46" stroke="#27272a" strokeWidth="1.5" />
            {/* Bottom 3 Chairs */}
            <rect x="-42" y={h / 2 + 3} width="24" height="9" rx="3" fill="#3f3f46" stroke="#27272a" strokeWidth="1.5" />
            <rect x="-12" y={h / 2 + 3} width="24" height="9" rx="3" fill="#3f3f46" stroke="#27272a" strokeWidth="1.5" />
            <rect x="18" y={h / 2 + 3} width="24" height="9" rx="3" fill="#3f3f46" stroke="#27272a" strokeWidth="1.5" />
            {/* Table Top */}
            <rect
              x={-w / 2}
              y={-h / 2}
              width={w}
              height={h}
              rx="8"
              fill={`url(#${cfg.svgGrad})`}
              stroke={cfg.color}
              strokeWidth={isSelected ? 3 : 2}
              filter={glowId}
            />
            <rect
              x={-w / 2 + 4}
              y={-h / 2 + 4}
              width={w - 8}
              height={h - 8}
              rx="6"
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1"
            />
          </g>
        );
      }

      case 'booth': {
        const w = 68;
        const h = 58;
        return (
          <g className="table-shape-group">
            {/* Left Banquette Backrest */}
            <path
              d={`M ${-w / 2 - 12} ${-h / 2 - 6} Q ${-w / 2 - 18} 0 ${-w / 2 - 12} ${h / 2 + 6} L ${-w / 2 - 4} ${h / 2 + 6} L ${-w / 2 - 4} ${-h / 2 - 6} Z`}
              fill="#27272a"
              stroke="#18181b"
              strokeWidth="1.5"
            />
            {/* Top & Bottom Booth Seats */}
            <rect x={-w / 2 + 2} y={-h / 2 - 12} width={w - 4} height="9" rx="3" fill="#3f3f46" stroke="#27272a" strokeWidth="1.5" />
            <rect x={-w / 2 + 2} y={h / 2 + 3} width={w - 4} height="9" rx="3" fill="#3f3f46" stroke="#27272a" strokeWidth="1.5" />
            {/* Center Table */}
            <rect
              x={-w / 2}
              y={-h / 2}
              width={w}
              height={h}
              rx="6"
              fill={`url(#${cfg.svgGrad})`}
              stroke={cfg.color}
              strokeWidth={isSelected ? 3 : 2}
              filter={glowId}
            />
            <rect
              x={-w / 2 + 4}
              y={-h / 2 + 4}
              width={w - 8}
              height={h - 8}
              rx="4"
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1"
            />
          </g>
        );
      }

      case 'square-4':
      default: {
        const size = 56;
        return (
          <g className="table-shape-group">
            {/* 4 Chairs */}
            <rect x="-15" y={-size / 2 - 12} width="30" height="9" rx="3" fill="#3f3f46" stroke="#27272a" strokeWidth="1.5" />
            <rect x="-15" y={size / 2 + 3} width="30" height="9" rx="3" fill="#3f3f46" stroke="#27272a" strokeWidth="1.5" />
            <rect x={-size / 2 - 12} y="-15" width="9" height="30" rx="3" fill="#3f3f46" stroke="#27272a" strokeWidth="1.5" />
            <rect x={size / 2 + 3} y="-15" width="9" height="30" rx="3" fill="#3f3f46" stroke="#27272a" strokeWidth="1.5" />
            {/* Table Top */}
            <rect
              x={-size / 2}
              y={-size / 2}
              width={size}
              height={size}
              rx="8"
              fill={`url(#${cfg.svgGrad})`}
              stroke={cfg.color}
              strokeWidth={isSelected ? 3 : 2}
              filter={glowId}
            />
            <rect
              x={-size / 2 + 4}
              y={-size / 2 + 4}
              width={size - 8}
              height={size - 8}
              rx="5"
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1"
            />
          </g>
        );
      }
    }
  };

  return (
    <g
      id={`table-node-${table.tableNumber}`}
      transform={`translate(${table.x}, ${table.y})`}
      className="cursor-pointer select-none transition-opacity hover:opacity-80"
      onClick={() => onSelect(table)}
    >
      <title>{`Table ${table.tableNumber} · ${cfg.label} (${table.capacity} seats)`}</title>
      {/* Animated Radar Pulse Rings for ATTENTION / Waiter Call */}
      {isAttention && (
        <>
          <circle cx="0" cy="0" r="34" stroke="#EF4444" strokeWidth="2.5" fill="none" opacity="0.8">
            <animate attributeName="r" values="32;58;72" dur="1.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.85;0.35;0" dur="1.8s" repeatCount="indefinite" />
          </circle>
          <circle cx="0" cy="0" r="34" stroke="#EF4444" strokeWidth="1.5" fill="none" opacity="0.6">
            <animate attributeName="r" values="32;46;62" dur="1.8s" begin="0.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.65;0.25;0" dur="1.8s" begin="0.6s" repeatCount="indefinite" />
          </circle>
        </>
      )}

      {/* Gentle Violet Pulse for READY food */}
      {isReady && (
        <circle cx="0" cy="0" r="34" stroke="#8B5CF6" strokeWidth="2" fill="none" opacity="0.75">
          <animate attributeName="r" values="32;48;58" dur="2.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.75;0.2;0" dur="2.2s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Selected Dashed Halo */}
      {isSelected && (
        <circle cx="0" cy="0" r="44" stroke="#ffffff" strokeWidth="2" strokeDasharray="4 3" fill="none" opacity="0.85">
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="20s" repeatCount="indefinite" />
        </circle>
      )}

      {/* The physical table SVG */}
      {renderTableShape()}

      {/* Table Label & Details in Center */}
      <g className="pointer-events-none">
        {/* Table Number */}
        <text
          x="0"
          y={table.currentOrder ? -4 : 4}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffffff"
          fontSize="14"
          fontWeight="800"
          letterSpacing="0.5"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
        >
          {table.tableNumber}
        </text>

        {/* Small badge / sub-label */}
        {table.currentOrder && (
          <text
            x="0"
            y="11"
            textAnchor="middle"
            dominantBaseline="central"
            fill="rgba(255,255,255,0.85)"
            fontSize="9"
            fontWeight="600"
          >
            ₹{Math.round(table.currentOrder.totalAmount / 100)}
          </text>
        )}

        {/* Status Indicator Icon Badge in Top-Right Corner */}
        {isAttention ? (
          <g transform="translate(18, -20)">
            <circle cx="0" cy="0" r="8" fill="#EF4444" stroke="#ffffff" strokeWidth="1.5" />
            <text x="0" y="3.5" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">!</text>
          </g>
        ) : isBill ? (
          <g transform="translate(18, -20)">
            <circle cx="0" cy="0" r="8" fill="#EAB308" stroke="#ffffff" strokeWidth="1.5" />
            <text x="0" y="3.5" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold">₹</text>
          </g>
        ) : isReady ? (
          <g transform="translate(18, -20)">
            <circle cx="0" cy="0" r="8" fill="#8B5CF6" stroke="#ffffff" strokeWidth="1.5" />
            <text x="0" y="3" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold">✓</text>
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
  className = ''
}) => {
  const [selectedTable, setSelectedTable] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [viewMode, setViewMode] = useState('floor'); // 'floor' | 'grid'
  const [zoomLevel, setZoomLevel] = useState(1);
  const containerRef = useRef(null);

  const tables = floorStatus?.tables || [];
  const layoutTables = useMemo(() => computeFloorLayout(tables), [tables]);

  // Compute status summary counts
  const statusCounts = useMemo(() => {
    const counts = {
      ALL: tables.length,
      AVAILABLE: 0,
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
              Real-time architectural view of {tables.length} tables & customer activity.
            </p>
          </div>
        </div>

        {/* View Switcher & Zoom Controls */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
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
                onClick={() => setZoomLevel((z) => Math.min(1.5, z + 0.15))}
                className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded text-zinc-600 dark:text-zinc-300 transition-colors"
                title="Zoom In"
              >
                <ZoomInAreaIcon size={16} />
              </button>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex bg-zinc-200/80 dark:bg-zinc-800/80 rounded-lg p-0.5 border border-zinc-300/60 dark:border-zinc-700/60">
            <button
              onClick={() => setViewMode('floor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'floor'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              <Layers01Icon size={14} />
              Floor Plan
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'grid'
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
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors shrink-0 ${
            filterStatus === 'ALL'
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
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all shrink-0 ${
                isActive
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
      <div className="relative flex-1 min-h-[520px] overflow-hidden" ref={containerRef}>
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
          /* SVG Architectural Floor Plan */
          <div className="w-full h-full min-h-[540px] flex items-center justify-center p-2 bg-[#09090b] relative select-none overflow-auto">
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
                style={{ background: '#09090b' }}
              >
                <defs>
                  {/* Floor Tile Pattern */}
                  <pattern id="floor-tile-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#18181b" strokeWidth="0.8" />
                    <circle cx="20" cy="20" r="0.8" fill="#27272a" />
                  </pattern>

                  {/* Wood Planks Pattern for Bar / Pass */}
                  <pattern id="wood-pattern" width="60" height="12" patternUnits="userSpaceOnUse">
                    <rect width="60" height="12" fill="#1c1917" stroke="#292524" strokeWidth="0.5" />
                  </pattern>

                  {/* Gradients for Table Statuses */}
                  <radialGradient id="grad-available" cx="40%" cy="40%" r="65%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="70%" stopColor="#059669" />
                    <stop offset="100%" stopColor="#047857" />
                  </radialGradient>

                  <radialGradient id="grad-occupied" cx="40%" cy="40%" r="65%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="70%" stopColor="#2563EB" />
                    <stop offset="100%" stopColor="#1D4ED8" />
                  </radialGradient>

                  <radialGradient id="grad-processing" cx="40%" cy="40%" r="65%">
                    <stop offset="0%" stopColor="#F59E0B" />
                    <stop offset="70%" stopColor="#D97706" />
                    <stop offset="100%" stopColor="#B45309" />
                  </radialGradient>

                  <radialGradient id="grad-ready" cx="40%" cy="40%" r="65%">
                    <stop offset="0%" stopColor="#A78BFA" />
                    <stop offset="70%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#7C3AED" />
                  </radialGradient>

                  <radialGradient id="grad-served" cx="40%" cy="40%" r="65%">
                    <stop offset="0%" stopColor="#22D3EE" />
                    <stop offset="70%" stopColor="#06B6D4" />
                    <stop offset="100%" stopColor="#0891B2" />
                  </radialGradient>

                  <radialGradient id="grad-bill" cx="40%" cy="40%" r="65%">
                    <stop offset="0%" stopColor="#FDE047" />
                    <stop offset="70%" stopColor="#EAB308" />
                    <stop offset="100%" stopColor="#CA8A04" />
                  </radialGradient>

                  <radialGradient id="grad-attention" cx="40%" cy="40%" r="65%">
                    <stop offset="0%" stopColor="#F87171" />
                    <stop offset="70%" stopColor="#EF4444" />
                    <stop offset="100%" stopColor="#DC2626" />
                  </radialGradient>

                  {/* Glow Filters */}
                  <filter id="glow-red" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  <filter id="glow-purple" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
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

                  <filter id="shadow-subtle" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.5" />
                  </filter>
                </defs>

                {/* Floor Tile Canvas */}
                <rect x="0" y="0" width="1100" height="660" fill="url(#floor-tile-pattern)" rx="16" />

                {/* Outer Architectural Walls & Perimeter */}
                <rect
                  x="12"
                  y="12"
                  width="1076"
                  height="636"
                  rx="14"
                  fill="none"
                  stroke="#27272a"
                  strokeWidth="3"
                />

                {/* Corner Architectural Accents */}
                <path d="M 12 40 L 40 12 M 1060 12 L 1088 40 M 12 620 L 40 648 M 1060 648 L 1088 620" stroke="#3f3f46" strokeWidth="2" />

                {/* Zone 1: Window / Terrace Booths (Left) */}
                <g id="zone-window">
                  <rect x="24" y="24" width="180" height="570" rx="10" fill="#18181b" fillOpacity="0.4" stroke="#27272a" strokeDasharray="3 3" strokeWidth="1" />
                  <text x="36" y="52" fill="#71717a" fontSize="11" fontWeight="700" letterSpacing="1.2">
                    WINDOW BOOTHS
                  </text>
                  {/* Decorative window glass slats */}
                  <line x1="24" y1="180" x2="24" y2="210" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                  <line x1="24" y1="310" x2="24" y2="340" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                  <line x1="24" y1="440" x2="24" y2="470" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                </g>

                {/* Zone 2: Main Dining Room (Center) */}
                <g id="zone-main">
                  <text x="470" y="52" textAnchor="middle" fill="#71717a" fontSize="12" fontWeight="800" letterSpacing="2">
                    MAIN DINING HALL
                  </text>
                </g>

                {/* Zone 3: VIP / Banquet Suite (Top Right) */}
                <g id="zone-vip">
                  <rect x="760" y="24" width="316" height="350" rx="10" fill="#18181b" fillOpacity="0.3" stroke="#27272a" strokeDasharray="4 4" strokeWidth="1" />
                  <text x="778" y="52" fill="#71717a" fontSize="11" fontWeight="700" letterSpacing="1.2">
                    EXECUTIVE BANQUET
                  </text>
                </g>

                {/* Zone 4: Kitchen Pass & Pickup Counter (Bottom Right) */}
                <g id="zone-kitchen">
                  <rect x="760" y="560" width="316" height="74" rx="8" fill="#18181b" stroke="#3f3f46" strokeWidth="2" />
                  <rect x="766" y="566" width="304" height="24" rx="4" fill="#27272a" stroke="#3f3f46" strokeWidth="1" />
                  <text x="918" y="582" textAnchor="middle" fill="#f59e0b" fontSize="10" fontWeight="bold" letterSpacing="1">
                    KITCHEN PASS & DISPATCH
                  </text>
                  {/* Heat lamp warm indicators */}
                  <circle cx="830" cy="610" r="8" fill="#f59e0b" fillOpacity="0.3" stroke="#f59e0b" strokeWidth="1" />
                  <circle cx="918" cy="610" r="8" fill="#f59e0b" fillOpacity="0.3" stroke="#f59e0b" strokeWidth="1" />
                  <circle cx="1006" cy="610" r="8" fill="#f59e0b" fillOpacity="0.3" stroke="#f59e0b" strokeWidth="1" />
                </g>

                {/* Zone 5: Cocktail & Beverage Bar (Bottom Left) */}
                <g id="zone-bar">
                  <path d="M 230 634 L 230 580 Q 230 560 250 560 L 380 560" fill="none" stroke="#52525b" strokeWidth="6" strokeLinecap="round" />
                  <text x="305" y="594" textAnchor="middle" fill="#71717a" fontSize="10" fontWeight="700" letterSpacing="1">
                    BEVERAGE BAR
                  </text>
                </g>

                {/* Zone 6: Main Entrance & Welcome Area (Bottom Center) */}
                <g id="zone-entrance" transform="translate(500, 620)">
                  {/* Welcome mat */}
                  <rect x="-45" y="-12" width="90" height="26" rx="4" fill="#18181b" stroke="#27272a" strokeWidth="1" />
                  {/* Double Swing Doors Arc */}
                  <path d="M -40 14 A 20 20 0 0 1 -20 -6" fill="none" stroke="#71717a" strokeWidth="1.5" strokeDasharray="2 2" />
                  <path d="M 40 14 A 20 20 0 0 0 20 -6" fill="none" stroke="#71717a" strokeWidth="1.5" strokeDasharray="2 2" />
                  <text x="0" y="4" textAnchor="middle" fill="#a1a1aa" fontSize="9" fontWeight="bold" letterSpacing="1">
                    ENTRANCE
                  </text>
                </g>

                {/* Render the Table SVGs */}
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
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-3 bg-white dark:bg-zinc-900 ${
                    isSelected
                      ? 'ring-2 ring-primary border-transparent shadow-md'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-base text-zinc-900 dark:text-zinc-100">
                      T-{tbl.tableNumber}
                    </span>
                    <span className={`w-2.5 h-2.5 rounded-full ${cfg.dotColor} ${tbl.status === 'ATTENTION' ? 'animate-ping' : ''}`} />
                  </div>

                  <div>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${cfg.bgColor}`}>
                      {cfg.label}
                    </span>
                  </div>

                  <div className="text-xs text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                    <span>{tbl.capacity} seats</span>
                    {tbl.currentOrder && (
                      <span className="font-bold text-zinc-900 dark:text-zinc-200">
                        ₹{Math.round(tbl.currentOrder.totalAmount / 100)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Table Inspection Drawer / Modal */}
      {selectedTable && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-5 bg-zinc-50 dark:bg-zinc-900/70">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {/* Left: Table Overview */}
            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black text-xl text-white shadow-md"
                style={{ backgroundColor: TABLE_STATUS_CONFIG[selectedTable.status]?.color || '#10B981' }}
              >
                <span className="text-[10px] font-bold uppercase opacity-80 leading-none">Table</span>
                {selectedTable.tableNumber}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    Table {selectedTable.tableNumber}
                  </h4>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      TABLE_STATUS_CONFIG[selectedTable.status]?.bgColor
                    }`}
                  >
                    {TABLE_STATUS_CONFIG[selectedTable.status]?.label}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {selectedTable.zone || 'Dining Area'} · Capacity: {selectedTable.capacity || 4} seats ·{' '}
                  {TABLE_STATUS_CONFIG[selectedTable.status]?.description}
                </p>
              </div>
            </div>

            {/* Middle: Active Waiter Call or Order Status */}
            {selectedTable.hasWaiterCall && selectedTable.activeWaiterCalls?.length > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400">
                <AlertCircleIcon size={20} className="shrink-0 animate-bounce" />
                <div className="text-xs">
                  <div className="font-bold">Active Assistance Call</div>
                  <div>Customer requested: {selectedTable.activeWaiterCalls[0].type}</div>
                </div>
                {onResolveWaiterCall && (
                  <button
                    onClick={() => onResolveWaiterCall(selectedTable.activeWaiterCalls[0].id)}
                    className="ml-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-xs transition-colors"
                  >
                    Resolve Call
                  </button>
                )}
              </div>
            )}

            {/* Right: Quick Action Buttons */}
            <div className="flex items-center gap-2 self-end md:self-center">
              {onOpenPOS && (
                <button
                  onClick={() => onOpenPOS(selectedTable.tableNumber)}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl text-xs transition-colors shadow-sm"
                >
                  {selectedTable.currentOrder ? 'Manage in POS' : 'Punch Order in POS'}
                </button>
              )}
              <button
                onClick={() => setSelectedTable(null)}
                className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 rounded-lg text-xs"
                title="Close"
              >
                <Cancel01Icon size={16} />
              </button>
            </div>
          </div>

          {/* Active Order Breakdown */}
          {selectedTable.currentOrder && (
            <div className="mt-4 pt-4 border-t border-zinc-200/60 dark:border-zinc-800 flex flex-wrap gap-4 text-xs">
              <div className="bg-white dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 flex-1 min-w-[200px]">
                <span className="text-zinc-500 text-[11px] block mb-1">Active Order Items:</span>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {selectedTable.currentOrder.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between font-medium text-zinc-800 dark:text-zinc-200">
                      <span>{item.name}</span>
                      <span className="text-zinc-500">x{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 w-48 flex flex-col justify-between">
                <div>
                  <span className="text-zinc-500 text-[11px] block">Total Amount</span>
                  <span className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                    ₹{Math.round(selectedTable.currentOrder.totalAmount / 100)}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-2">
                  Origin: <span className="font-semibold text-zinc-600 dark:text-zinc-300">{selectedTable.currentOrder.origin}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
