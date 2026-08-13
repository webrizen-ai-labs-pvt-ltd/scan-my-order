import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
} from "@repo/ui";
import {
  Sparkles,
  QrCode,
  Smartphone,
  Tablet,
  LayoutDashboard,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  ArrowRight,
} from "lucide-react";

export function App() {
  const apps = [
    {
      title: "Admin Web Hub",
      port: "3000",
      description: "Complete restaurant configuration, staff permissions, and revenue analytics.",
      icon: LayoutDashboard,
      color: "from-blue-500 to-indigo-600",
      url: "http://localhost:3000",
    },
    {
      title: "Operations & Floor POS",
      port: "3001",
      description: "Live floor management, table occupancy map, and order cashiering.",
      icon: ShieldCheck,
      color: "from-emerald-500 to-teal-600",
      url: "http://localhost:3001",
    },
    {
      title: "QR Customer Menu",
      port: "3002",
      description: "Mobile-first instant ordering with visual dietary filters & direct kitchen sync.",
      icon: QrCode,
      color: "from-amber-500 to-orange-600",
      url: "http://localhost:3002",
    },
    {
      title: "Kitchen Display (KDS)",
      port: "8081",
      description: "Expo tablet app with item checklists, ticket timers, and station routing.",
      icon: Tablet,
      color: "from-red-500 to-pink-600",
      url: "http://localhost:8081",
    },
    {
      title: "Staff Handheld POS",
      port: "8082",
      description: "Waiter companion mobile app for tableside orders and payment processing.",
      icon: Smartphone,
      color: "from-violet-500 to-purple-600",
      url: "http://localhost:8082",
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
              <Badge variant="info" className="ml-2">
                Marketing (Port 3003)
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a href="http://localhost:3000" target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" className="border-slate-700 text-xs">
                Admin (3000) <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </a>
            <a href="http://localhost:3002" target="_blank" rel="noreferrer">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white text-xs">
                Launch Guest Menu <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Header */}
      <header className="relative pt-20 pb-16 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 -z-10" />

        <div className="max-w-4xl mx-auto text-center space-y-6">
          <Badge variant="outline" className="px-3 py-1 text-blue-400 border-blue-500/30 bg-blue-500/10">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Next-Gen Restaurant Architecture
          </Badge>

          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[1.1]">
            One Monorepo. <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              Seven Synchronized Frontends.
            </span>
          </h1>

          <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Scan My Order orchestrates your entire restaurant lifecycle—from contactless guest QR ordering
            to real-time kitchen displays and multi-outlet management.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <a href="http://localhost:3000">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/25">
                Launch Admin Hub
              </Button>
            </a>
            <a href="http://localhost:3002">
              <Button size="lg" variant="outline" className="border-slate-700 hover:bg-slate-800 text-white">
                Experience QR Menu
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Services Grid */}
      <section className="py-12 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-white">Micro-Frontend Service Directory</h2>
          <p className="text-sm text-slate-400 mt-1">
            Independently deployable apps running concurrently on dedicated localhost ports.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apps.map((app) => {
            const Icon = app.icon;
            return (
              <Card
                key={app.port}
                className="bg-slate-900/60 border-slate-800/80 hover:border-slate-700 transition-all hover:scale-[1.01]"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${app.color} flex items-center justify-center text-white shadow-lg`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <Badge variant="info">Port {app.port}</Badge>
                  </div>
                  <CardTitle className="text-lg text-white font-bold mt-4">
                    {app.title}
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs leading-relaxed">
                    {app.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <a
                    href={app.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-xs font-semibold text-blue-400 hover:text-blue-300 gap-1"
                  >
                    Open Application <ChevronRight className="w-3 h-3" />
                  </a>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 px-6 text-center text-xs text-slate-500">
        <p>© 2026 Scan My Order Monorepo • Built with Turborepo, pnpm & @repo/ui</p>
      </footer>
    </div>
  );
}

export default App;
