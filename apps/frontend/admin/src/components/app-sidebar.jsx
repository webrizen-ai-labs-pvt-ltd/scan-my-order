import React from "react"
import { NavLink, useLocation, Link, useNavigate } from "react-router-dom"
import { LayoutDashboard, Users, Store, Settings, Landmark } from "lucide-react"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui"
import { logoWhite } from "@repo/ui/assets"
import { useAuth } from "../context/auth-context.jsx"

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const navItems = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Users", path: "/dashboard/users", icon: Users },
    { label: "Stores", path: "/dashboard/stores", icon: Store },
    { label: "Subscriptions", path: "/dashboard/subscriptions", icon: Landmark },
    { label: "Settings", path: "/dashboard/settings", icon: Settings },
  ]

  const handleLogout = async (e) => {
    e.preventDefault()
    await logout()
    navigate("/authentication")
  }

  const displayName = user?.name || "System Admin"
  const displayEmail = user?.email || "admin@scanmyorder.com"
  const displayAvatar = user?.avatar || "https://i.pinimg.com/736x/37/38/9d/37389de7d25c8162cbb084a11cb5f218.jpg"
  const displayInitials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "AD"

  return (
    <Sidebar collapsible="icon" className="border-r border-zinc-800 bg-zinc-900">
      <SidebarHeader className="p-3.5 flex flex-row items-center gap-3 border-b border-zinc-800">
        <img src={logoWhite} alt="Scan My Order" className="h-8 w-auto object-contain" />
        <div className="flex flex-col overflow-hidden">
          <span className="truncate text-sm font-semibold text-white">Scan My Order</span>
          <span className="truncate text-[10px] text-zinc-400">Admin OS</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navItems.map((item) => {
              const Icon = item.icon
              const isExact = item.path === "/dashboard"
              const isActive = isExact
                ? location.pathname === "/dashboard"
                : location.pathname.startsWith(item.path)

              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={isActive}>
                    <NavLink to={item.path} className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-zinc-800 relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-yellow-500/50 to-transparent" />
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 border border-zinc-700 bg-zinc-800">
              <AvatarImage src={displayAvatar} alt={displayName} />
              <AvatarFallback className="bg-indigo-600 text-white text-xs font-semibold">
                {displayInitials}
              </AvatarFallback>
            </Avatar>
            <div className="text-xs">
              <p className="font-semibold text-zinc-200 truncate max-w-30">{displayName}</p>
              <p className="text-zinc-500 truncate max-w-30">{displayEmail}</p>
            </div>
          </div>
        </div>
        <div className="w-full grid md:grid-cols-2 gap-2 border-t border-zinc-800/50 pt-3">
          <Link to="/report" className="h-8 w-full flex justify-center items-center text-center text-xs bg-white/10 cursor-pointer hover:bg-white/20 transition-colors rounded-l-lg">Report</Link>
          <button onClick={handleLogout} className="h-8 w-full flex justify-center items-center text-center text-xs bg-white/10 cursor-pointer hover:bg-white/20 transition-colors rounded-r-lg text-zinc-200 hover:text-white">Logout</button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
