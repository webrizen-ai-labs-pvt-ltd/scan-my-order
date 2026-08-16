import React from "react"
import { Outlet, useLocation, Link } from "react-router-dom"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbLink,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  BreadcrumbSeparator,
  Separator,
  Kbd,
} from "@repo/ui"
import { Home, ChevronRight, Command } from "lucide-react"
import { AppSidebar } from "../components/app-sidebar.jsx"

export default function DashboardLayout() {
  const location = useLocation()

  // Route metadata for custom labels and icons
  const routeConfig = {
    "": { label: "Home", icon: Home },
    "dashboard": { label: "Dashboard", icon: Command },
    "pos": { label: "POS Terminal" },
    "live-orders": { label: "Live Orders" },
    "tables": { label: "Tables" },
    "kds": { label: "Kitchen KDS" },
    "menu": { label: "Digital Menu" },
    "staff": { label: "Staff Accounts" },
    "subscriptions": { label: "Subscriptions" },
    "settings": { label: "Settings" },
  }

  const getBreadcrumbs = () => {
    const paths = location.pathname.split("/").filter(Boolean)

    if (paths.length === 0) {
      return [{ name: "Home", href: "/", isLast: true }]
    }

    const breadcrumbs = paths.map((path, index) => {
      const config = routeConfig[path.toLowerCase()]
      const formattedName =
        config?.label ||
        path
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(" ")

      const href = "/" + paths.slice(0, index + 1).join("/")

      return {
        name: formattedName,
        href,
        isLast: index === paths.length - 1,
        icon: config?.icon,
      }
    })

    return breadcrumbs
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="relative flex h-16 shrink-0 items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/60 px-4 backdrop-blur-xl">
          <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-amber-500/20 to-transparent" />

          <div className="flex items-center gap-3">
            <SidebarTrigger className="hover:bg-zinc-800! rounded-lg transition-colors" />
            <Separator orientation="vertical" className="h-5 border-zinc-800" />

            <Breadcrumb>
              <BreadcrumbList className="flex items-center gap-1.5">
                {/* Home breadcrumb with icon */}
                <BreadcrumbItem>
                  <BreadcrumbLink
                    render={<Link to="/" />}
                    className="group flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    <Home className="h-3.5 w-3.5 group-hover:text-amber-400 transition-colors" />
                  </BreadcrumbLink>
                </BreadcrumbItem>

                {breadcrumbs.map((crumb) => (
                  <React.Fragment key={crumb.href}>
                    <BreadcrumbSeparator>
                      <ChevronRight className="h-3 w-3 text-zinc-600" />
                    </BreadcrumbSeparator>
                    <BreadcrumbItem>
                      {crumb.isLast ? (
                        <BreadcrumbPage className="flex items-center gap-1.5">
                          {crumb.icon && <crumb.icon className="h-3.5 w-3.5 text-amber-400" />}
                          <span className="text-xs font-semibold text-zinc-100 bg-zinc-800/80 px-2 py-1 rounded-md border border-zinc-700/50">
                            {crumb.name}
                          </span>
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          render={<Link to={crumb.href} />}
                          className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          {crumb.icon && <crumb.icon className="h-3.5 w-3.5" />}
                          <span className="text-xs font-medium">{crumb.name}</span>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* Keyboard shortcut hint */}
          <div className="hidden md:flex items-center gap-2 text-[10px] text-zinc-500">
            <span className="hidden lg:inline">Toggle Sidebar</span>
            <div className="flex items-center gap-1">
              <Kbd className="px-1.5 py-0.5 text-[10px] bg-zinc-800 border border-zinc-700 rounded shadow-inner">
                ⌘
              </Kbd>
              <span className="text-zinc-600">+</span>
              <Kbd className="px-1.5 py-0.5 text-[10px] bg-zinc-800 border border-zinc-700 rounded shadow-inner">
                B
              </Kbd>
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-6 md:p-8 bg-zinc-950/50">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
