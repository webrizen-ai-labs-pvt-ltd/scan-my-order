import React from "react"
import { NavLink, useLocation, Link, useNavigate } from "react-router-dom"
import {
  LayoutDashboard,
  UtensilsCrossed,
  Clock,
  Grid,
  ChefHat,
  CreditCard,
  Users,
  Settings,
  SlidersHorizontal,
} from "lucide-react"
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

  const userRole = user?.role || "WAITER"

  // Defined sidebar navigation items with role-based permissions
  const navItems = [
    {
      label: "Overview",
      path: "/dashboard",
      icon: LayoutDashboard,
      roles: ["OWNER", "MANAGER", "WAITER", "KITCHEN"],
      exact: true,
    },
    {
      label: "POS Terminal",
      path: "/dashboard/pos",
      icon: UtensilsCrossed,
      roles: ["OWNER", "MANAGER", "WAITER"],
    },
    {
      label: "Live Orders",
      path: "/dashboard/live-orders",
      icon: Clock,
      roles: ["OWNER", "MANAGER", "WAITER"],
    },
    {
      label: "Table Floor Plan",
      path: "/dashboard/tables",
      icon: Grid,
      roles: ["OWNER", "MANAGER", "WAITER"],
    },
    {
      label: "Kitchen KDS",
      path: "/dashboard/kds",
      icon: ChefHat,
      roles: ["OWNER", "MANAGER", "KITCHEN"],
    },
    {
      label: "Store Setup",
      path: "/dashboard/store-setup",
      icon: SlidersHorizontal,
      roles: ["OWNER", "MANAGER"],
    },
    {
      label: "Staff Accounts",
      path: "/dashboard/staff",
      icon: Users,
      roles: ["OWNER", "MANAGER"],
    },
    {
      label: "Subscriptions",
      path: "/dashboard/subscriptions",
      icon: CreditCard,
      roles: ["OWNER"],
    },
    {
      label: "Settings",
      path: "/dashboard/settings",
      icon: Settings,
      roles: ["OWNER", "MANAGER", "WAITER", "KITCHEN"],
    },
  ]

  // Filter links dynamically based on user role
  const visibleNavItems = navItems.filter((item) => item.roles.includes(userRole))

  const handleLogout = async (e) => {
    e.preventDefault()
    await logout()
    navigate("/authentication")
  }

  const displayName = user?.name || "Store Staff"
  const displayEmail = user?.email || "staff@restaurant.com"
  const displayAvatar = user?.avatar || "https://i.pinimg.com/736x/37/38/9d/37389de7d25c8162cbb084a11cb5f218.jpg"
  const displayInitials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "ST"

  return (
    <Sidebar collapsible="icon" className="border-r border-zinc-800 bg-zinc-900">
      <SidebarHeader className="p-3.5 flex flex-row items-center gap-3 border-b border-zinc-800">
        <img src={logoWhite} alt="Scan My Order Operations" className="h-8 w-auto object-contain" />
        <div className="flex flex-col overflow-hidden">
          <span className="truncate text-sm font-semibold text-white">Scan My Order</span>
          <span className="truncate text-[10px] text-amber-400 font-mono">Operations OS</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {visibleNavItems.map((item) => {
              const Icon = item.icon
              const isActive = item.exact
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
        <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-amber-500/40 to-transparent" />
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3 overflow-hidden w-full">
            <Avatar className="h-8 w-8 shrink-0 border border-zinc-700 bg-zinc-800">
              <AvatarImage src={displayAvatar} alt={displayName} />
              <AvatarFallback className="bg-amber-500 text-zinc-950 font-bold text-xs">
                {displayInitials}
              </AvatarFallback>
            </Avatar>
            <div className="text-xs overflow-hidden relative w-full">
              <p className="font-semibold text-zinc-200 truncate max-w-28">{displayName}</p>
              <p className="text-[10px] text-zinc-400 truncate max-w-28">{displayEmail}</p>
              <div className="flex items-center gap-1.5 absolute top-0 right-0 bg-white/20 rounded-full px-2 py-1 backdrop-blur-3xl text-[10px]">
                {userRole}
              </div>
            </div>
          </div>
        </div>
        <div className="w-full grid grid-cols-2 gap-2 border-t border-zinc-800/50 pt-3">
          <Link
            to="/dashboard/support"
            className="h-8 w-full flex justify-center items-center text-center text-xs bg-white/10 cursor-pointer hover:bg-white/20 transition-colors rounded-l-lg text-zinc-300"
          >
            Support
          </Link>
          <button
            onClick={handleLogout}
            className="h-8 w-full flex justify-center items-center text-center text-xs bg-white/10 cursor-pointer hover:bg-white/20 transition-colors rounded-r-lg text-zinc-200 hover:text-red-400"
          >
            Logout
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
