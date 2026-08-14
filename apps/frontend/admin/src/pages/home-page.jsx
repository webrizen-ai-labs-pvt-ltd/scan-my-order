import React from "react"
import { Link } from "react-router-dom"
import { Button } from "@repo/ui"
import { logoWhite } from "@repo/ui/assets"

export default function HomePage() {
  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between relative">

      <img src="https://i.pinimg.com/736x/b0/c9/7b/b0c97b311781a0875920679fd969fd0d.jpg" alt="Background" className="absolute inset-0 w-auto h-full object-cover top-0 left-0 grayscale invert border-y-6 border-r-6 rounded-r-3xl" />

      <div className="absolute inset-0 object-cover top-auto bottom-0 left-auto right-0 size-125 bg-linear-to-tl from-yellow-500/50 to-transparent blur-[190px]" />

      <header className="px-6 py-4 flex items-center justify-between relative">
        <div className="p-3.5 flex flex-row items-center gap-3 ">
          <img src={logoWhite} alt="Scan My Order" className="h-8 w-auto object-contain" />
          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-sm font-semibold text-white">Scan My Order</span>
            <span className="truncate text-[10px] text-zinc-400">Admin OS</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline">
            <Link to="/authentication">Sign In</Link>
          </Button>
          <Button asChild>
            <Link to="/dashboard">
              Go to Dashboard
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-6 md:p-12 max-w-3xl mx-auto gap-10 relative">
        <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
          <span className="inline-block w-2 h-2 bg-zinc-400 rounded-full" />
          Multi-Platform POS & QR Dining Management
        </div>

        <div className="space-y-4">
          <h1 className="text-2xl sm:text-3xl font-normal text-zinc-900 dark:text-zinc-100 leading-snug tracking-tight">
            Centralized Control for Restaurant Operations
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl">
            Manage user permissions, store configurations, QR dining workflows, and real-time operational analytics across your multi-location dining ecosystem.
          </p>
        </div>

        <div className="space-y-6 pt-4">
          <div className="border-t border-zinc-200 dark:border-zinc-800">
            <div className="py-4">
              <div className="flex items-baseline gap-3">
                <span className="text-xs text-zinc-400 font-mono">01</span>
                <div>
                  <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                    Role-Based Access
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Enforce granular permissions across Admin, Owner, Manager, Waiter, and Kitchen roles.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800">
            <div className="py-4">
              <div className="flex items-baseline gap-3">
                <span className="text-xs text-zinc-400 font-mono">02</span>
                <div>
                  <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                    Multi-Store Orchestration
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Configure store branding, color schemes, font styles, and digital menu availability.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800">
            <div className="py-4">
              <div className="flex items-baseline gap-3">
                <span className="text-xs text-zinc-400 font-mono">03</span>
                <div>
                  <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                    Live Monitoring
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Stream real-time audit logs, active sessions, and system health metrics.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-zinc-400 dark:text-zinc-500 font-mono pt-2">
          v1.5.2 — Webrizen AI Labs work.
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-zinc-500 relative">
        © {new Date().getFullYear()} Scan My Order • Webrizen AI Labs Pvt Ltd. All rights reserved.
      </footer>
    </div>
  )
}
