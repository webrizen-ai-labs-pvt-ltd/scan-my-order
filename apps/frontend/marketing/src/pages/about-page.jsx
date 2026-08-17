import React from "react"
import { Link } from "react-router-dom"
import { Sparkles, UtensilsCrossed, Shield, Cpu, Target, Award, ArrowRight } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="space-y-20 py-12">
      {/* Hero Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" /> Webrizen AI Labs Innovation
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight max-w-4xl mx-auto">
          Reinventing Restaurant Technology for the AI Era
        </h1>
        <p className="text-slate-300 text-lg max-w-3xl mx-auto leading-relaxed">
          Scan My Order was born out of a simple vision: eliminate paper-based restaurant friction and give dining room teams real-time operational superpowers.
        </p>
      </section>

      {/* Mission & Story Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-white">Our Mission</h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              At Webrizen AI Labs, we build high-speed, reliable, and delightful software for the hospitality industry. Traditional point-of-sale systems were clunky, locked behind proprietary hardware, and completely disconnected from guest smartphones.
            </p>
            <p className="text-slate-400 text-sm leading-relaxed">
              Scan My Order bridges that gap by connecting diners directly to the kitchen display in under a second. Our platform allows restaurant owners to reduce labor overhead, boost table turnover, and increase average order values by up to 22%.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
            <h3 className="text-xl font-bold text-white">Why Modern Restaurants Choose Us</h3>
            <div className="space-y-4 text-xs sm:text-sm">
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-white">Sub-Second Sync Architecture</h4>
                  <p className="text-slate-400">Order changes, menu item toggles, and table status updates propagate in real time across all POS and KDS terminals.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-white">Bank-Grade Security & WebAuthn</h4>
                  <p className="text-slate-400">Store owner and manager accounts are guarded by passkeys (WebAuthn) and encrypted sessions.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 text-yellow-400 flex items-center justify-center shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-white">Continuous Innovation</h4>
                  <p className="text-slate-400">Regular updates delivered automatically without downtime or costly maintenance fees.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stat Bar */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-10 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 text-center grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-amber-400">5M+</div>
            <div className="text-xs text-slate-400 mt-1">QR Orders Dispatched</div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-orange-400">500+</div>
            <div className="text-xs text-slate-400 mt-1">Restaurant Outlets</div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-yellow-400">99.99%</div>
            <div className="text-xs text-slate-400 mt-1">System Availability</div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400">24/7</div>
            <div className="text-xs text-slate-400 mt-1">Engineering Support</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <h2 className="text-3xl font-bold text-white">Join the QR Dining Revolution</h2>
        <div className="flex justify-center gap-4">
          <Link
            to="/contact"
            className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-sm flex items-center gap-2"
          >
            Get In Touch With Our Team <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  )
}
