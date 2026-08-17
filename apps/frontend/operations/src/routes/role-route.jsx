import React from "react"
import { Outlet } from "react-router-dom"
import { ShieldAlert, Lock } from "lucide-react"
import { useAuth } from "../context/auth-context.jsx"

export default function RoleRoute({ allowedRoles = [] }) {
  const { user } = useAuth()

  if (!user || (allowedRoles.length > 0 && !allowedRoles.includes(user.role))) {
    return (
      <div className="p-8 mx-auto my-12 text-center space-y-4 h-full flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto">
          <ShieldAlert className="h-8 w-8 text-zinc-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Access Restricted</h2>
          <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
            Your role (<span className="text-zinc-300 font-medium">{user?.role || "Staff"}</span>) does not have permission to view this route.
          </p>
        </div>
        <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-600">
          <Lock className="h-3.5 w-3.5" />
          Contact your administrator if you believe this is an error
        </div>
      </div>
    )
  }

  return <Outlet />
}