import React from "react"
import { Link } from "react-router-dom"
import { Button, Card, CardContent } from "@repo/ui"

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-slate-100 text-center">
        <CardContent className="pt-8 pb-8 space-y-4">
          <h1 className="text-6xl font-extrabold text-indigo-500">404</h1>
          <h2 className="text-xl font-bold text-white">Page Not Found</h2>
          <p className="text-sm text-slate-400">The page you are looking for does not exist or has been moved.</p>
          <Button asChild className="bg-indigo-600 hover:bg-indigo-500 text-white mt-4">
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
