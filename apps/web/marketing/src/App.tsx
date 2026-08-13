import {
  Sparkles,
  QrCode,
  Smartphone,
  Tablet,
  LayoutDashboard,
  ShieldCheck,
  ChevronRight,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

export function App() {
  const apps = [
    {
      title: "Admin Web Hub",
      port: "3000",
      description: "Complete restaurant configuration, staff permissions, and revenue analytics.",
      icon: LayoutDashboard,
      color: "from-blue-500 to-indigo-600",
    },
    {
      title: "Operations & Floor POS",
      port: "3001",
      description: "Live floor management, table occupancy map, and order cashiering.",
      icon: ShieldCheck,
      color: "from-emerald-500 to-teal-600",
    },
    {
      title: "QR Customer Menu",
      port: "3002",
      description: "Mobile-first instant ordering with visual dietary filters & direct kitchen sync.",
      icon: QrCode,
      color: "from-amber-500 to-orange-600",
    },
    {
      title: "Kitchen Display (KDS)",
      port: "8081",
      description: "Expo tablet app with item checklists, ticket timers, and station routing.",
      icon: Tablet,
      color: "from-red-500 to-pink-600",
    },
    {
      title: "Staff Handheld POS",
      port: "8082",
      description: "Waiter companion mobile app for tableside orders and payment processing.",
      icon: Smartphone,
      color: "from-violet-500 to-purple-600",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500 selection:text-white">
      {/* Navigation */}
      <nav className="border-b border-slate-800/80 bg-slate-900/40 backdrop-blur sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo-white.png"
              alt="Scan My Order Logo"
              className="w-10 h-10 rounded-xl object-contain shadow-lg shadow-blue-500/20"
            />
            <div>
              <span className="font-extrabold text-base text-white tracking-tight">
                Scan My Order
              </span>
              <span className="ml-2 text-xs font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Marketing (Port 3003)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="http://localhost:3000"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:text-white border border-slate-700 transition-all"
            >
              Admin (3000) <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="http://localhost:3002"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all"
            >
              Demo QR Menu (3002) <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 pt-20 pb-16 max-w-5xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" /> The Modern Multi-App Restaurant Operating System
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
          One Monorepo. <br />
          <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
            Every Touchpoint in Dining.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          From guest QR smartphone scans to kitchen tablet tickets and owner financial analytics—all orchestrated in real-time with Turborepo, Prisma, and NativeWind v4.
        </p>
      </section>

      {/* App Grid Showcase */}
      <section className="px-6 py-12 max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-white">Full Application Ecosystem</h2>
          <p className="text-xs text-slate-400 mt-1">Concurrently running across assigned ports</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {apps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white shadow-lg`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-xs font-mono font-bold text-slate-300 border border-slate-700">
                      Port {item.port}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">{item.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready for dev
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default App;
