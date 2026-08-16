import React from "react"
import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "../context/auth-context.jsx"

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="h-screen bg-zinc-950 flex items-center justify-center text-zinc-400 text-xs">
        Authenticating Operations session...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/authentication" replace />
  }

  return <Outlet />
}
