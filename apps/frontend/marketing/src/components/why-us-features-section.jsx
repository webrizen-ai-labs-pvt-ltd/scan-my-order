import React from "react"
import { QrCode, Monitor, ShieldCheck, Flame, Star, CreditCard, Sparkles, CheckCircle2 } from "lucide-react"

export default function WhyUsFeaturesSection() {
  const coreFeatures = [
    {
      icon: QrCode,
      title: "Dynamic QR Digital Menus",
      description: "Guests scan table QR codes to view high-res visual menus on their phones with zero app downloads or logins.",
      tag: "Customer Experience",
    },
    {
      icon: Monitor,
      title: "Smart Kitchen KDS Display",
      description: "Automated routing sends appetizer, main, and beverage items directly to their respective kitchen stations with prep timers.",
      tag: "Kitchen Efficiency",
    },
    {
      icon: ShieldCheck,
      title: "Waiter Order Gatekeeping",
      description: "Waiters verify and approve postpaid orders from their handheld devices before kitchen staff start cooking. Zero food waste.",
      tag: "Waste Prevention",
    },
    {
      icon: Flame,
      title: "Tatkal Rush Hour Queue",
      description: "Instantly enforce a synchronized first-come-first-served token queue during peak dining rushes to prevent kitchen overload.",
      tag: "Peak Operations",
    },
    {
      icon: Star,
      title: "Automated Google Reputation",
      description: "Automated post-meal triggers prompt satisfied guests to leave 5-star Google reviews right after paying their bill.",
      tag: "Revenue & Growth",
    },
    {
      icon: CreditCard,
      title: "Direct PhonePe Auto-Settlement",
      description: "Native PhonePe PG integration allows instant UPI QR payments with real-time backend verification and automated ledger sync.",
      tag: "Financial Control",
    },
  ]

  return (
    <section id="why-us" className="py-20 bg-zinc-950 border-t border-zinc-900 relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Built for Modern Dining
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-100">
            Why Restaurants <span className="text-transparent bg-clip-text bg-linear-to-r from-yellow-400 to-amber-500">Upgrade to ScanMyOrder</span>
          </h2>
          <p className="text-zinc-400 text-base md:text-lg font-light leading-relaxed">
            From table seating to kitchen execution and payment settlement, replace outdated paper systems with a synchronized operations hub.
          </p>
        </div>

        {/* Features 6-Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {coreFeatures.map((feat, idx) => {
            const IconComponent = feat.icon
            return (
              <div
                key={idx}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-6 flex flex-col justify-between space-y-6 transition-colors"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
                      {feat.tag}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-zinc-100">{feat.title}</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed font-light">{feat.description}</p>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 flex items-center gap-1.5 text-[11px] text-zinc-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /> Active in All Plans
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
