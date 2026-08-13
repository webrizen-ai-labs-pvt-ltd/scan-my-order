import { useState } from "react";
import { OrderStatus } from "@repo/types";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@repo/ui";
import { RefreshCw, Clock, Bell } from "lucide-react";

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
      id: "ORD-903",
      itemsCount: 7,
      total: 184.0,
      status: OrderStatus.COMPLETED,
      elapsedMinutes: 34,
    },
  },
  { id: "t5", tableNumber: "T-05", seats: 4, isOccupied: false },
  {
    id: "t6",
    tableNumber: "T-06",
    seats: 4,
    isOccupied: true,
    activeOrder: {
      id: "ORD-904",
      itemsCount: 2,
      total: 32.0,
      status: OrderStatus.PREPARING,
      elapsedMinutes: 4,
    },
  },
  { id: "t7", tableNumber: "T-07", seats: 8, isOccupied: false },
  {
    id: "t8",
    tableNumber: "T-08",
    seats: 2,
    isOccupied: true,
    activeOrder: {
      id: "ORD-905",
      itemsCount: 4,
      total: 67.5,
      status: OrderStatus.PENDING,
      elapsedMinutes: 1,
    },
  },
];

export function App() {
  const [tables, setTables] = useState<TableStatus[]>(initialTables);
  const [selectedTable, setSelectedTable] = useState<TableStatus | null>(null);

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING:
        return <Badge variant="warning">New Order</Badge>;
      case OrderStatus.PREPARING:
        return <Badge variant="info">Preparing</Badge>;
      case OrderStatus.READY:
        return <Badge variant="success">Ready to Serve</Badge>;
      case OrderStatus.COMPLETED:
        return <Badge variant="secondary">Dining / Served</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const occupiedCount = tables.filter((t) => t.isOccupied).length;
  const readyCount = tables.filter((t) => t.activeOrder?.status === OrderStatus.READY).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
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
          <Badge variant="outline" className="text-slate-300 border-slate-700">
            {occupiedCount} / {tables.length} Tables Occupied
          </Badge>
          {readyCount > 0 && (
            <Badge variant="success" className="animate-pulse flex items-center gap-1">
              <Bell className="w-3 h-3" /> {readyCount} Orders Ready
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTables([...initialTables])}
            className="border-slate-700 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
        </div>
      </header>

      {/* Main Floor Grid */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {tables.map((table) => {
            return (
              <Card
                key={table.id}
                onClick={() => setSelectedTable(table)}
                className={`cursor-pointer transition-all hover:scale-[1.02] ${
                  table.isOccupied
                    ? table.activeOrder?.status === OrderStatus.READY
                      ? "border-emerald-500/60 bg-emerald-950/20 shadow-lg shadow-emerald-500/10"
                      : "border-slate-700 bg-slate-900/80"
                    : "border-slate-800/80 bg-slate-900/30 hover:border-slate-700"
                }`}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-white font-bold">
                      {table.tableNumber}
                    </CardTitle>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {table.seats} Seats
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {table.isOccupied && table.activeOrder ? (
                    <div className="space-y-2 mt-2">
                      <div className="flex items-center justify-between">
                        {getStatusBadge(table.activeOrder.status)}
                        <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {table.activeOrder.elapsedMinutes}m
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800/80 text-slate-300">
                        <span>{table.activeOrder.itemsCount} items</span>
                        <span className="font-mono font-bold text-emerald-400">
                          ${table.activeOrder.total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center">
                      <Badge variant="outline" className="text-slate-500 border-slate-800">
                        Vacant
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Table Details Modal */}
        <Dialog open={!!selectedTable} onOpenChange={(open) => !open && setSelectedTable(null)}>
          <DialogContent className="bg-slate-900 border-slate-800 text-white">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <DialogTitle className="text-lg text-white font-bold">
                  {selectedTable?.tableNumber} Details
                </DialogTitle>
                {selectedTable?.isOccupied && selectedTable.activeOrder ? (
                  getStatusBadge(selectedTable.activeOrder.status)
                ) : (
                  <Badge variant="outline">Vacant</Badge>
                )}
              </div>
              <DialogDescription className="text-slate-400">
                Capacity: {selectedTable?.seats} guests
              </DialogDescription>
            </DialogHeader>

            {selectedTable?.isOccupied && selectedTable.activeOrder ? (
              <div className="space-y-4 py-2">
                <Card className="bg-slate-950 border-slate-800 p-4">
                  <div className="flex justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                    <span>Order: {selectedTable.activeOrder.id}</span>
                    <span>Elapsed: {selectedTable.activeOrder.elapsedMinutes} mins</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm font-bold text-white">Total Bill</span>
                    <span className="text-lg font-mono font-bold text-emerald-400">
                      ${selectedTable.activeOrder.total.toFixed(2)}
                    </span>
                  </div>
                </Card>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                    onClick={() => {
                      if (selectedTable) {
                        setTables((prev) =>
                          prev.map((t) =>
                            t.id === selectedTable.id
                              ? {
                                  ...t,
                                  activeOrder: t.activeOrder
                                    ? { ...t.activeOrder, status: OrderStatus.COMPLETED }
                                    : undefined,
                                }
                              : t
                          )
                        );
                        setSelectedTable(null);
                      }
                    }}
                  >
                    Mark as Served
                  </Button>
                  <Button
                    variant="outline"
                    className="border-slate-700"
                    onClick={() => {
                      if (selectedTable) {
                        setTables((prev) =>
                          prev.map((t) =>
                            t.id === selectedTable.id
                              ? { ...t, isOccupied: false, activeOrder: undefined }
                              : t
                          )
                        );
                        setSelectedTable(null);
                      }
                    }}
                  >
                    Close Table
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center space-y-3">
                <p className="text-sm text-slate-400">This table is currently vacant.</p>
                <Button
                  className="bg-blue-600 hover:bg-blue-500 text-white"
                  onClick={() => {
                    if (selectedTable) {
                      setTables((prev) =>
                        prev.map((t) =>
                          t.id === selectedTable.id
                            ? {
                                ...t,
                                isOccupied: true,
                                activeOrder: {
                                  id: `ORD-${Math.floor(100 + Math.random() * 900)}`,
                                  itemsCount: 1,
                                  total: 25.0,
                                  status: OrderStatus.PENDING,
                                  elapsedMinutes: 0,
                                },
                              }
                            : t
                        )
                      );
                      setSelectedTable(null);
                    }
                  }}
                >
                  Seat Guests
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

export default App;
