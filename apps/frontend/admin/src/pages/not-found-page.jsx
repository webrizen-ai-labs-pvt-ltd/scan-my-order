import React from "react"
import { Link } from "react-router-dom"
import { Button, Card, CardContent } from "@repo/ui"
import { ArrowLeft, Home, Search, Compass } from "lucide-react"

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03),transparent_70%)] pointer-events-none" />
      
      {/* Large faded 404 in background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <span className="text-[200px] md:text-[300px] font-bold text-zinc-900/50 leading-none">
          404
        </span>
      </div>

      <Card className="relative w-full max-w-md bg-zinc-900/80 backdrop-blur-sm border-zinc-800 text-zinc-100 text-center overflow-hidden">
        {/* Gradient accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-zinc-400 to-transparent" />
        
        <CardContent className="pt-12 pb-12 px-8 space-y-6">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center mx-auto">
            <Compass className="h-8 w-8 text-zinc-400" />
          </div>

          {/* Main heading */}
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-white tracking-tight">
              Page Not Found
            </h1>
            <p className="text-sm text-zinc-500 leading-relaxed max-w-sm mx-auto">
              The page you're looking for doesn't exist or has been moved to a different location.
            </p>
          </div>

          {/* Quick actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button 
              asChild 
              className="bg-white hover:bg-zinc-200 text-zinc-900 font-medium gap-2 text-sm"
            >
              <Link to="/dashboard">
                <Home className="h-4 w-4" /> Dashboard
              </Link>
            </Button>
            <Button 
              asChild 
              variant="ghost" 
              className="text-zinc-400 hover:text-white hover:bg-zinc-800 gap-2 text-sm"
            >
              <Link to="/">
                <ArrowLeft className="h-4 w-4" /> Go Home
              </Link>
            </Button>
          </div>

          {/* Search hint */}
          <div className="pt-4 border-t border-zinc-800">
            <p className="text-xs text-zinc-600 flex items-center justify-center gap-1.5">
              <Search className="h-3 w-3" />
              Try searching or navigate from the dashboard
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}