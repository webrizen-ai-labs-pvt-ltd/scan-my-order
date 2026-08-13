import { useState } from "react";
import { UserRole } from "@repo/types";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
} from "@repo/ui";
import {
  LayoutDashboard,
  QrCode,
  Users,
  Settings,
  TrendingUp,
  DollarSign,
  Coffee,
  ShieldCheck,
  Building2,
  FileSpreadsheet,
  Plus,
} from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  isAvailable: boolean;
}

const initialMenuItems: MenuItem[] = [
  { id: "m1", name: "Truffle Ribeye Steak", category: "Mains", price: 38.5, isAvailable: true },
  { id: "m2", name: "Artisanal Burrata Bowl", category: "Starters", price: 16.0, isAvailable: true },
  { id: "m3", name: "Smoked Woodside Burger", category: "Mains", price: 21.0, isAvailable: true },
  { id: "m4", name: "Matcha Lava Cake", category: "Desserts", price: 12.5, isAvailable: true },
  { id: "m5", name: "Cold Brew Tonic", category: "Beverages", price: 6.5, isAvailable: false },
];

export function App() {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItems);
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [newItemName, setNewItemName] = useState<string>("");
  const [newItemCategory, setNewItemCategory] = useState<string>("Mains");
  const [newItemPrice, setNewItemPrice] = useState<string>("18.00");

  const handleAddItem = () => {
    if (!newItemName.trim()) return;
    const item: MenuItem = {
      id: `m${Date.now()}`,
      name: newItemName,
      category: newItemCategory,
      price: parseFloat(newItemPrice) || 15.0,
      isAvailable: true,
    };
    setMenuItems((prev) => [item, ...prev]);
    setNewItemName("");
    setIsAddOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 antialiased font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-800/80 bg-slate-900/60 backdrop-blur-xl flex flex-col justify-between hidden md:flex">
        <div>
          <div className="p-6 flex items-center gap-3 border-b border-slate-800/60">
            <img
              src="/logo-white.png"
              alt="Scan My Order Logo"
              className="h-10 w-10 rounded-xl object-contain shadow-lg shadow-blue-500/20"
            />
            <div>
              <h1 className="font-bold text-base tracking-tight text-white leading-tight">
                Scan My Order
              </h1>
              <p className="text-xs text-blue-400 font-medium">Admin Portal (3000)</p>
            </div>
          </div>

          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => setActiveTab("overview")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "overview"
                  ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" /> Global Overview
            </button>
            <button
              onClick={() => setActiveTab("menu")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "menu"
                  ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Coffee className="w-4 h-4" /> Menu Catalog
            </button>
            <button
              onClick={() => setActiveTab("staff")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "staff"
                  ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Users className="w-4 h-4" /> Staff & Permissions
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "reports"
                  ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" /> Financial Reports
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "settings"
                  ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Settings className="w-4 h-4" /> Store Settings
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800/60">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40">
            <div className="w-9 h-9 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-300 text-xs">
              AD
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-200 truncate">
                Admin Console
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                Role: {UserRole.OWNER}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Banner */}
        <div className="bg-gradient-to-r from-blue-950/60 to-slate-900/60 p-6 rounded-2xl border border-blue-500/20 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold border border-blue-500/20 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Administrative Master Hub
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Scan My Order - Admin Web Hub
            </h2>
            <p className="text-sm text-slate-300 mt-1">
              Powered by shared <span className="text-blue-400 font-semibold font-mono">@repo/ui</span> shadcn components.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success">● Server: Port 3000</Badge>
          </div>
        </div>

        {/* Metric Cards using @repo/ui Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-900/70 border-slate-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="uppercase font-bold text-[11px] tracking-wider text-slate-400">
                  Monthly Revenue
                </CardDescription>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <CardTitle className="text-2xl text-white font-bold">$84,320.00</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                <TrendingUp className="w-3.5 h-3.5" /> +14.2% vs last month
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="uppercase font-bold text-[11px] tracking-wider text-slate-400">
                  Active Outlets
                </CardDescription>
                <Building2 className="w-4 h-4 text-blue-400" />
              </div>
              <CardTitle className="text-2xl text-white font-bold">3 Branches</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400">Downtown, Midtown & Wharf</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="uppercase font-bold text-[11px] tracking-wider text-slate-400">
                  Total Staff
                </CardDescription>
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <CardTitle className="text-2xl text-white font-bold">24 Employees</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400">Roles: Owner, Waiter, Kitchen</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="uppercase font-bold text-[11px] tracking-wider text-slate-400">
                  QR Menu Scans
                </CardDescription>
                <QrCode className="w-4 h-4 text-amber-400" />
              </div>
              <CardTitle className="text-2xl text-white font-bold">1,482 Scans</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-amber-400">Avg 94.2% order conversion</p>
            </CardContent>
          </Card>
        </div>

        {/* Tab Content Area */}
        <Tabs defaultValue="menu" className="w-full">
          <div className="flex items-center justify-between">
            <TabsList className="bg-slate-900 border border-slate-800">
              <TabsTrigger value="menu">Menu Items Catalog</TabsTrigger>
              <TabsTrigger value="activity">Recent Activity</TabsTrigger>
            </TabsList>

            {/* Dialog Component for Adding Menu Item */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                  <Plus className="w-4 h-4 mr-1.5" /> Add Menu Item
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800 text-white">
                <DialogHeader>
                  <DialogTitle>Add New Menu Item</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Create a dish to instantly publish to Guest QR Menus (Port 3002).
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                      Dish Name
                    </label>
                    <Input
                      placeholder="e.g., Truffle Gnocchi"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                        Category
                      </label>
                      <Input
                        placeholder="Mains, Starters..."
                        value={newItemCategory}
                        onChange={(e) => setNewItemCategory(e.target.value)}
                        className="bg-slate-950 border-slate-800 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                        Price ($)
                      </label>
                      <Input
                        type="number"
                        placeholder="18.00"
                        value={newItemPrice}
                        onChange={(e) => setNewItemPrice(e.target.value)}
                        className="bg-slate-950 border-slate-800 text-white"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddOpen(false)} className="border-slate-700">
                    Cancel
                  </Button>
                  <Button onClick={handleAddItem} className="bg-blue-600 hover:bg-blue-500 text-white">
                    Publish Dish
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <TabsContent value="menu" className="mt-4">
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white">Live Catalog Table</CardTitle>
                <CardDescription className="text-slate-400">
                  Manage dishes, real-time availability, and category pricing.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-950/60">
                    <TableRow className="border-slate-800">
                      <TableHead className="text-slate-400 font-semibold">Item Name</TableHead>
                      <TableHead className="text-slate-400 font-semibold">Category</TableHead>
                      <TableHead className="text-slate-400 font-semibold">Price</TableHead>
                      <TableHead className="text-slate-400 font-semibold">Availability</TableHead>
                      <TableHead className="text-right text-slate-400 font-semibold pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {menuItems.map((item) => (
                      <TableRow key={item.id} className="border-slate-800/80 hover:bg-slate-800/40">
                        <TableCell className="font-medium text-white">{item.name}</TableCell>
                        <TableCell className="text-slate-300">{item.category}</TableCell>
                        <TableCell className="font-mono text-emerald-400 font-semibold">
                          ${item.price.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {item.isAvailable ? (
                            <Badge variant="success">Available</Badge>
                          ) : (
                            <Badge variant="destructive">Sold Out</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setMenuItems((prev) =>
                                prev.map((m) =>
                                  m.id === item.id ? { ...m, isAvailable: !m.isAvailable } : m
                                )
                              );
                            }}
                            className="text-xs text-slate-400 hover:text-white"
                          >
                            Toggle Status
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <Card className="bg-slate-900/60 border-slate-800 p-6 text-center text-slate-400">
              <p className="text-sm">Real-time audit log stream connected to WebSocket backend.</p>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default App;
