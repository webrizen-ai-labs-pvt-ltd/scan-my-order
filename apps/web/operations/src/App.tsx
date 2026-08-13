import { useState } from "react";
import { OrderStatus, PaymentStatus } from "@repo/types";
import { RefreshCw } from "lucide-react";

interface TableStatus {
  id: string;
  tableNumber: string;
  seats: number;
  isOccupied: boolean;
  activeOrder?: {
    id: string;
    itemsCount: number;
    total: number;
    status: OrderStatus;
    elapsedMinutes: number;
  };
}

const initialTables: TableStatus[] = [
  {
    id: "t1",
    tableNumber: "T-01",
    seats: 2,
    isOccupied: true,
    activeOrder: {
      id: "ORD-901",
      itemsCount: 3,
      total: 48.5,
      status: OrderStatus.PREPARING,
      elapsedMinutes: 8,
    },
  },
  {
    id: "t2",
    tableNumber: "T-02",
    seats: 4,
    isOccupied: true,
    activeOrder: {
      id: "ORD-902",
      itemsCount: 5,
      total: 112.0,
      status: OrderStatus.READY,
      elapsedMinutes: 18,
    },
  },
  { id: "t3", tableNumber: "T-03", seats: 2, isOccupied: false },
  {
    id: "t4",
    tableNumber: "T-04",
    seats: 6,
    isOccupied: true,
    activeOrder: {
      id: "ORD-904",
      itemsCount: 7,
      total: 185.0,
      status: OrderStatus.PENDING,
      elapsedMinutes: 2,
    },
  },
  { id: "t5", tableNumber: "T-05", seats: 4, isOccupied: false },
  {
    id: "t6",
    tableNumber: "T-06",
    seats: 8,
    isOccupied: true,
    activeOrder: {
      id: "ORD-906",
      itemsCount: 4,
      total: 94.0,
      status: OrderStatus.PREPARING,
      elapsedMinutes: 14,
    },
  },
];

export function App() {
  const [tables] = useState<TableStatus[]>(initialTables);
  const [filter, setFilter] = useState<"all" | "occupied" | "vacant">("all");

  const filteredTables = tables.filter((t) => {
    if (filter === "occupied") return t.isOccupied;
    if (filter === "vacant") return !t.isOccupied;
    return true;
  });

  const getStatusBadge = (status?: OrderStatus) => {
    if (!status) return null;
    switch (status) {
      case OrderStatus.PENDING:
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
            Pending
          </span>
        );
      case OrderStatus.PREPARING:
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/40 animate-pulse">
            Cooking
          </span>
        );
      case OrderStatus.READY:
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            Ready
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-800 text-slate-400">
            Completed
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-800/80 px-6 flex items-center justify-between bg-slate-900/40 backdrop-blur sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <img
            src="/logo-white.png"
            alt="Scan My Order Logo"
            className="h-10 w-10 rounded-xl object-contain shadow-lg shadow-emerald-500/20"
          />
          <div>
            <h1 className="font-bold text-base text-white">Operations & Live Floor</h1>
            <p className="text-xs text-emerald-400 font-mono">Port 3001 • Real-time Floor Map</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            {(["all", "occupied", "vacant"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilter(mode)}
                className={`px-3 py-1 rounded text-xs font-semibold capitalize transition-all ${
                  filter === mode
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <button className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-slate-700/50">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Floor Grid */}
      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Occupancy Rate</p>
              <p className="text-2xl font-bold text-white mt-1">66.7%</p>
            </div>
            <span className="text-xs font-mono text-emerald-400">4 / 6 Tables Busy</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Active Kitchen Queue</p>
              <p className="text-2xl font-bold text-white mt-1">3 Orders</p>
            </div>
            <span className="text-xs font-mono text-blue-400">Avg. 11 min prep</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Floor Open Tabs</p>
              <p className="text-2xl font-bold text-white mt-1">$439.50</p>
            </div>
            <span className="text-xs font-mono text-emerald-400">Payment: {PaymentStatus.UNPAID}</span>
          </div>
        </div>

        {/* Interactive Floor Map */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTables.map((table) => (
            <div
              key={table.id}
              className={`p-5 rounded-2xl border transition-all ${
                table.isOccupied
                  ? "bg-slate-900/90 border-slate-700 shadow-lg"
                  : "bg-slate-900/30 border-slate-800/60 opacity-60 border-dashed"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-lg font-extrabold text-white font-mono">
                    {table.tableNumber}
                  </span>
                  <p className="text-xs text-slate-400">{table.seats} Seats Capacity</p>
                </div>
                {table.isOccupied ? (
                  getStatusBadge(table.activeOrder?.status)
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-400">
                    Vacant
                  </span>
                )}
              </div>

              {table.isOccupied && table.activeOrder ? (
                <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Active Order #{table.activeOrder.id}</span>
                    <span className="font-mono text-slate-400">
                      {table.activeOrder.elapsedMinutes}m ago
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-mono">
                      {table.activeOrder.itemsCount} items
                    </span>
                    <span className="text-base font-bold text-emerald-400 font-mono">
                      ${table.activeOrder.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 pt-3 border-t border-slate-800/60 text-center py-4">
                  <p className="text-xs text-slate-500">Ready for QR Guest Seating</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default App;
