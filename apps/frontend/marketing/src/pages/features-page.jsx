import React from "react"
import { Link } from "react-router-dom"
import {
  QrCode,
  Monitor,
  Flame,
  Building2,
  CreditCard,
  Sliders,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Layers,
  BarChart3
} from "lucide-react"

export default function FeaturesPage() {
  const featuresList = [
    {
      icon: QrCode,
      tag: "QR DINING ENGINE",
      title: "Contactless QR Ordering & Digital Menu",
      description:
        "Give your diners instant access to high-resolution visual menus directly on their smartphones without downloading any app.",
      bullets: [
        "Unique QR codes generated per dining table & location",
        "High-definition dish photography with customizable modifiers & add-ons",
        "Dietary indicators (Vegan, Vegetarian, Gluten-Free, Spicy Level)",
        "Direct cart placement and instant kitchen order dispatch"
      ],
      badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/20"
    },
    {
      icon: Monitor,
      tag: "POS TERMINAL HUB",
      title: "High-Performance POS for Waiters & Cashiers",
      description:
        "A lightning-fast point-of-sale interface optimized for touch devices, tablets, and desktop computers.",
      bullets: [
        "Interactive graphical table floor plan layout",
        "Dine-in, takeaway, and delivery order type switching",
        "Split-billing, discount applications, and tax calculations",
        "Passcode-protected manager overrides and void actions"
      ],
      badgeColor: "text-orange-400 bg-orange-500/10 border-orange-500/20"
    },
    {
      icon: Flame,
      tag: "KITCHEN DISPLAY SYSTEM",
      title: "Real-Time KDS Ticket Management",
      description:
        "Replace noisy thermal paper printers with silent, synchronized digital kitchen displays.",
      bullets: [
        "Color-coded prep timers (Green: New, Yellow: In Prep, Red: Delayed)",
        "Station-based order filtering (Grill, Fryer, Bar, Pantry)",
        "One-tap bump ticket status completion and audio alerts",
        "Historical order prep time metrics and staff analytics"
      ],
      badgeColor: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20"
    },
    {
      icon: Building2,
      tag: "MULTI-STORE MANAGEMENT",
      title: "Centralized Multi-Location Control",
      description:
        "Manage multiple restaurant outlets, regional pricing, and staff roles from a single master dashboard.",
      bullets: [
        "Hierarchical permissions (Super Admin, Store Owner, Manager, Waiter, Kitchen)",
        "Global & store-specific menu item synchronization",
        "Centralized sales reporting and revenue comparison",
        "Cross-store inventory audit trails"
      ],
      badgeColor: "text-blue-400 bg-blue-500/10 border-blue-500/20"
    },
    {
      icon: CreditCard,
      tag: "PAYMENT INTEGRATION",
      title: "Seamless PhonePe & UPI Settlement",
      description:
        "Accept digital payments directly at the table or cashier desk with instant status confirmation.",
      bullets: [
        "Native PhonePe PG SDK integration for subscription & order checkout",
        "Dynamic UPI QR code generation on bills",
        "Automated daily reconciliation & settlement reporting",
        "Zero hidden gateway fees with transparent pricing"
      ],
      badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    },
    {
      icon: Sliders,
      tag: "INVENTORY & ANALYTICS",
      title: "Menu Item & Ingredient Controls",
      description:
        "Stay in total control of ingredient availability and prevent order cancellation issues.",
      bullets: [
        "Instant item stock toggle (In-Stock / Out-of-Stock)",
        "Peak-hour surge menu adjustments",
        "Best-selling item analytics and revenue trend graphs",
        "CSV & PDF data export capabilities"
      ],
      badgeColor: "text-purple-400 bg-purple-500/10 border-purple-500/20"
    }
  ]

  return (
    <div className="space-y-20 py-12">
      {/* Header Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
          <Layers className="w-3.5 h-3.5" /> Full Feature Suite
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
          Everything You Need to Run a Modern Restaurant
        </h1>
        <p className="text-slate-400 text-lg max-w-3xl mx-auto leading-relaxed">
          Scan My Order connects front-of-house service, kitchen operations, and back-office management into one seamless cloud platform.
        </p>
      </section>

      {/* Grid of Core Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featuresList.map((item, idx) => {
            const Icon = item.icon
            return (
              <div
                key={idx}
                className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 transition-all duration-300 flex flex-col justify-between space-y-6 shadow-lg group"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${item.badgeColor}`}>
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                  <ul className="space-y-2 pt-2 border-t border-slate-800/80">
                    {item.bullets.map((b, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-2.5 text-xs text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Interactive Flow Diagram */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-slate-900 border border-slate-800 space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">How The Order Lifecycle Works</h2>
            <p className="text-slate-400 text-sm">Automated end-to-end synchronization from table scan to meal delivery.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center">1</div>
              <h4 className="text-white font-bold text-sm">Guest Scans QR</h4>
              <p className="text-xs text-slate-400">Diner opens camera, scans table QR code, and explores menu.</p>
            </div>

            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center">2</div>
              <h4 className="text-white font-bold text-sm">Instant Dispatch</h4>
              <p className="text-xs text-slate-400">Order is instantly sent to KDS screen & POS floor map.</p>
            </div>

            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-yellow-500/20 text-yellow-400 font-bold flex items-center justify-center">3</div>
              <h4 className="text-white font-bold text-sm">Kitchen Prepares</h4>
              <p className="text-xs text-slate-400">Chefs prepare food using color-coded timer alerts.</p>
            </div>

            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center">4</div>
              <h4 className="text-white font-bold text-sm">Serve & Settle</h4>
              <p className="text-xs text-slate-400">Waiter serves order and guest settles via PhonePe UPI or POS cashier.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <h2 className="text-3xl font-bold text-white">Experience Scan My Order Today</h2>
        <div className="flex justify-center gap-4">
          <Link
            to="/pricing"
            className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-sm flex items-center gap-2 hover:from-amber-400 hover:to-orange-400 transition-all"
          >
            Check Pricing Plans <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  )
}
