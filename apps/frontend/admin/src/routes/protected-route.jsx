import React from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "../context/auth-context.jsx"

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
          <p className="text-xs text-zinc-400 font-medium">Verifying administrator credentials...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/authentication" state={{ from: location }} replace />
  }

  return <Outlet />
}
