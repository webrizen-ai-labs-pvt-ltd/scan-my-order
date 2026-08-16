import React from "react"
import { Link } from "react-router-dom"
import { Button } from "@repo/ui"
import { ArrowLeft } from "lucide-react"

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center text-center p-6">
      <h1 className="text-6xl font-extrabold text-amber-400 mb-2 font-mono">404</h1>
      <h2 className="text-xl font-bold text-white mb-2">Page Not Found</h2>
      <p className="text-xs text-zinc-400 max-w-sm mb-6">
        The operations route you are trying to access does not exist or has been moved.
      </p>
      <Link to="/">
        <Button variant="outline" className="border-zinc-800 text-zinc-300 hover:bg-zinc-800 text-xs gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Return Home
        </Button>
      </Link>
    </div>
  )
}
