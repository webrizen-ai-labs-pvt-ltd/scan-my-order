import React from "react"
import { Outlet } from "react-router-dom"
import { useAuth } from "../context/auth-context.jsx"

export default function RoleRoute({ allowedRoles = [] }) {
  const { user } = useAuth()

  if (!user || (allowedRoles.length > 0 && !allowedRoles.includes(user.role))) {
    return (
      <div className="p-8 text-center bg-zinc-900 border border-zinc-800 rounded-xl space-y-3 my-8 max-w-lg mx-auto text-zinc-100">
        <h2 className="text-lg font-bold text-red-400">Access Restricted</h2>
        <p className="text-xs text-zinc-400">
          Your role (<strong className="text-zinc-200">{user?.role || "Staff"}</strong>) does not have permission to view this section.
        </p>
      </div>
    )
  }

  return <Outlet />
}
