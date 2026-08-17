import React from "react"
import { Link } from "react-router-dom"
import { UtensilsCrossed, ArrowLeft } from "lucide-react"

export default function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 py-16 space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
        <UtensilsCrossed className="w-8 h-8" />
      </div>
      <div className="space-y-2">
        <h1 className="text-6xl font-black text-white tracking-tight">404</h1>
        <h2 className="text-2xl font-bold text-slate-200">Page Not Found</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          The page you are looking for might have been moved, removed, or is temporarily unavailable.
        </p>
      </div>
      <Link
        to="/"
        className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-sm flex items-center gap-2 hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Home Page
      </Link>
    </div>
  )
}
