import { useState } from "react";
import { UserRole } from "@repo/types";
import {
  UtensilsCrossed,
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
} from "lucide-react";

export function App() {
  const [activeTab, setActiveTab] = useState<string>("overview");

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 antialiased font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-800/80 bg-slate-900/60 backdrop-blur-xl flex flex-col justify-between hidden md:flex">
        <div>
          <div className="p-6 flex items-center gap-3 border-b border-slate-800/60">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
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
              Store configuration, employee access controls, and cross-platform POS analytics.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700 text-xs font-mono text-emerald-400">
              ● Server: Port 3000
            </span>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-400">Monthly Revenue</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-white mt-2">$84,320.00</p>
            <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3.5 h-3.5" /> +14.2% vs last month
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-400">Active Outlets</span>
              <Building2 className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-white mt-2">3 Branches</p>
            <p className="text-xs text-slate-400 mt-1">Downtown, Midtown & Wharf</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-400">Total Staff</span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-bold text-white mt-2">24 Employees</p>
            <p className="text-xs text-slate-400 mt-1">Roles: Owner, Waiter, Kitchen</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-400">QR Menu Scans</span>
              <QrCode className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-white mt-2">1,482 Scans</p>
            <p className="text-xs text-amber-400 mt-1">Avg 94.2% order conversion</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
