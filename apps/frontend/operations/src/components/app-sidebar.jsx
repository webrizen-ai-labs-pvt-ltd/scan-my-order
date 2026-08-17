import React, { useState, useEffect } from "react"
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
  Store,
  Building2,
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
import { fetchMyStoreApi } from "../services/store-api.js"

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, token, logout } = useAuth()

  const userRole = user?.role || "WAITER"

  // Store information state
  const [storeInfo, setStoreInfo] = useState(null)
  const [isStoreLoading, setIsStoreLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    setIsStoreLoading(true)
    fetchMyStoreApi(token)
      .then((res) => {
        if (res?.data) {
          setStoreInfo(res.data)
        }
      })
      .catch((err) => {
        console.error("Failed to load store info for sidebar:", err)
      })
      .finally(() => setIsStoreLoading(false))
  }, [token])

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

  // Store profile metadata
  const storeName = storeInfo?.name || (isStoreLoading ? "Loading Store..." : "My Restaurant Store")
  const storeTableCount = storeInfo?._count?.tables || 0
  const storeMenuCount = storeInfo?._count?.menuItems || 0

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

      <SidebarFooter className="border-t border-zinc-800 relative p-3 space-y-2.5">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

        {/* 1. STORE PROFILE CARD (JUST ABOVE THE ACTUAL USER PROFILE CARD) */}
        <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-2.5 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              {storeInfo?.brandingLogo ? (
                <img src={storeInfo.brandingLogo} alt={storeName} className="w-full h-full rounded-lg object-cover" />
              ) : (
                <Store className="w-3.5 h-3.5" />
              )}
            </div>
            <div className="overflow-hidden leading-tight">
              <p className="font-bold text-xs text-white truncate">{storeName}</p>
              <p className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate">
                {storeTableCount > 0 ? `${storeTableCount} Tables • ` : ""}
                {storeMenuCount > 0 ? `${storeMenuCount} Items` : "Active Outlet"}
              </p>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Store Operational" />
        </div>

        {/* 2. ACTUAL USER PROFILE CARD */}
        <div className="flex items-center justify-between w-full pt-1">
          <div className="flex items-center gap-2.5 overflow-hidden w-full">
            <Avatar className="h-8 w-8 shrink-0 border border-zinc-700 bg-zinc-800">
              <AvatarImage src={displayAvatar} alt={displayName} />
              <AvatarFallback className="bg-amber-500 text-zinc-950 font-bold text-xs">
                {displayInitials}
              </AvatarFallback>
            </Avatar>
            <div className="text-xs overflow-hidden relative w-full leading-tight">
              <div className="flex items-center gap-1.5 justify-between">
                <p className="font-semibold text-zinc-200 truncate max-w-28">{displayName}</p>
                <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md uppercase">
                  {userRole}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 truncate max-w-36 mt-0.5">{displayEmail}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full grid grid-cols-2 gap-2 border-t border-zinc-800/60 pt-2.5">
          <Link to="/report" className="h-8 w-full flex justify-center items-center text-center text-xs bg-white/10 cursor-pointer hover:bg-white/20 transition-colors rounded-l-lg">Report</Link>
          <button onClick={handleLogout} className="h-8 w-full flex justify-center items-center text-center text-xs bg-white/10 cursor-pointer hover:bg-white/20 transition-colors rounded-r-lg text-zinc-200 hover:text-white">Logout</button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
