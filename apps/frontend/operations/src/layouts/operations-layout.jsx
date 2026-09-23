import React, { useMemo } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  Button,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbLink,
  SidebarInset,
  SidebarTrigger,
  BreadcrumbSeparator,
  Separator,
  Kbd,
} from '@smo/ui';
import { AnimatedThemeToggler, Avatar, AvatarImage, AvatarFallback } from '@smo/ui';
import { useAuthStore } from '../store/authStore';
import {
  DashboardSquare01Icon,
  Store01Icon,
  Invoice01Icon,
  Home01Icon,
  ArrowRight01Icon,
  RestaurantIcon,
  Pot02Icon,
  Dish01Icon,
  DeliveryTruck01Icon,
  Settings01Icon,
  Store02Icon,
  CreditCardIcon,
  Building02Icon,
  Calendar01Icon,
  UserGroupIcon,
  Analytics01Icon
} from 'hugeicons-react';
import { StaffNotificationCenter } from '../components/staff-notification-center';

export const OperationsLayout = () => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = useMemo(() => {
    const role = user?.role;
    const isSuperOrTenantAdmin = role === 'SUPER_ADMIN' || role === 'TENANT_ADMIN';
    const isManager = role === 'STORE_MANAGER' || isSuperOrTenantAdmin;
    const isCashier = role === 'CASHIER' || isManager;
    const isKitchen = role === 'KITCHEN_STAFF' || isManager;
    const isWaiter = role === 'WAITER' || isManager;

    const items = [
      { name: 'Dashboard', path: '/dashboard', icon: DashboardSquare01Icon, show: true },
      { name: 'POS (Point of Sale)', path: '/dashboard/pos', icon: Store01Icon, show: isCashier },
      { name: 'Reservations', path: '/dashboard/reservations', icon: Calendar01Icon, show: isCashier || isWaiter },
      { name: 'KDS (Kitchen)', path: '/dashboard/kds', icon: Pot02Icon, show: isKitchen },
      { name: 'Waiter Panel', path: '/dashboard/waiter', icon: Dish01Icon, show: isWaiter },
      { name: 'Orders History', path: '/dashboard/orders', icon: Invoice01Icon, show: isCashier },
      { name: 'Employees', path: '/dashboard/employees', icon: UserGroupIcon, show: isSuperOrTenantAdmin },
      { name: 'Table Analytics', path: '/dashboard/table-analytics', icon: Analytics01Icon, show: isSuperOrTenantAdmin },
      { name: 'Inventory', path: '/dashboard/inventory', icon: DeliveryTruck01Icon, show: isManager },
      { name: 'Stores Setup', path: '/dashboard/stores', icon: Store02Icon, show: isManager },
      { name: 'Brand Setup', path: '/dashboard/brand', icon: Building02Icon, show: isSuperOrTenantAdmin },
      { name: 'Subscriptions', path: '/dashboard/subscriptions', icon: CreditCardIcon, show: isSuperOrTenantAdmin },
      { name: 'Settings', path: '/dashboard/settings', icon: Settings01Icon, show: true },
    ];

    return items.filter(item => item.show);
  }, [user?.role]);

  const routeConfig = {
    "dashboard": { label: "Dashboard", icon: DashboardSquare01Icon },
    "employees": { label: "Employees", icon: UserGroupIcon },
    "table-analytics": { label: "Table Analytics", icon: Analytics01Icon },
    "pos": { label: "Point of Sale", icon: Store01Icon },
    "reservations": { label: "Table Reservations", icon: Calendar01Icon },
    "kds": { label: "Kitchen Display", icon: Pot02Icon },
    "waiter": { label: "Waiter View", icon: Dish01Icon },
    "orders": { label: "Orders", icon: Invoice01Icon },
    "inventory": { label: "Inventory Management", icon: DeliveryTruck01Icon },
    "stores": { label: "Stores Setup", icon: Store02Icon },
    "brand": { label: "Brand Setup", icon: Building02Icon },
    "subscriptions": { label: "Subscriptions", icon: CreditCardIcon },
    "settings": { label: "Settings", icon: Settings01Icon },
  };

  const getBreadcrumbs = () => {
    const paths = location.pathname.split("/").filter(Boolean);

    if (paths.length === 0 || (paths.length === 1 && paths[0] === 'dashboard')) {
      return [{ name: "Dashboard", href: "/dashboard", isLast: true }];
    }

    const breadcrumbs = paths.map((path, index) => {
      const config = routeConfig[path.toLowerCase()];
      const formattedName = config?.label || path
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");

      const href = "/" + paths.slice(0, index + 1).join("/");

      return {
        name: formattedName,
        href,
        isLast: index === paths.length - 1,
        icon: config?.icon,
      };
    });

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 font-sans">
        <Sidebar className="border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
          <SidebarHeader className="p-3.5 flex flex-row items-center gap-3 border-b border-zinc-800">
            <Link to="/" className="flex items-center gap-3">
              <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-semibold text-zinc-900 dark:text-white">Scan My Order</span>
                <span className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">Operations OS</span>
              </div>
            </Link>
          </SidebarHeader>

          <SidebarContent className="p-2 pt-4">
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
                      <Link
                        to={item.path}
                        className={`flex items-center gap-3 px-3 py-2 rounded transition-all duration-200 ${isActive
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-medium'
                          : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100'
                          }`}
                      >
                        <item.icon size={18} variant={isActive ? "solid" : "stroke"} />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
            <div className="flex items-center gap-3 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 p-2 rounded-lg transition-colors w-full overflow-hidden">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={user?.profilePhoto || ''} alt={user?.name || 'User'} />
                <AvatarFallback className="bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col flex-1 overflow-hidden">
                <span className="text-sm font-medium truncate text-zinc-900 dark:text-zinc-100">{user?.name || 'Staff'}</span>
                <span className="text-[10px] text-zinc-500 truncate">{user?.role?.replace('_', ' ')}</span>
              </div>
            </div>
            <div className="w-full grid md:grid-cols-[1fr_auto] gap-2 items-center">
              <Button onClick={handleLogout} className="w-full">
                Logout
              </Button>
              <AnimatedThemeToggler className="size-10" />
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset>
          <header className="relative z-50 flex h-16 shrink-0 items-center justify-between gap-1.5 border-b border-zinc-200 bg-white/60 px-2 backdrop-blur-xl sm:gap-2 sm:px-3 lg:px-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-yellow-500/20 to-transparent" />

            {/* ───────────────────────── Left ───────────────────────── */}
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <SidebarTrigger className="shrink-0 rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800!" />

              <Separator
                orientation="vertical"
                className="hidden h-5 shrink-0 border-zinc-300 sm:block dark:border-zinc-800"
              />

              <Breadcrumb className="min-w-0 flex-1">
                <BreadcrumbList className="flex min-w-0 flex-nowrap items-center gap-1 sm:gap-1.5">
                  {/* Home — always visible */}
                  <BreadcrumbItem className="shrink-0">
                    <BreadcrumbLink
                      render={<Link to="/dashboard" />}
                      className="group flex items-center gap-1.5 text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                    >
                      <Home01Icon className="h-3.5 w-3.5 transition-colors group-hover:text-yellow-500 dark:group-hover:text-yellow-400" />
                    </BreadcrumbLink>
                  </BreadcrumbItem>

                  {breadcrumbs.map((crumb, i) => {
                    const isLast = i === breadcrumbs.length - 1;
                    const showSeparator = i > 0 || breadcrumbs.length > 1;

                    return (
                      <React.Fragment key={crumb.href}>
                        {showSeparator && (
                          <BreadcrumbSeparator
                            className={`shrink-0 ${isLast ? 'flex' : 'hidden sm:flex'}`}
                          >
                            <ArrowRight01Icon className="h-3 w-3 text-zinc-400 dark:text-zinc-600" />
                          </BreadcrumbSeparator>
                        )}

                        <BreadcrumbItem
                          className={`min-w-0 items-center ${isLast ? 'flex' : 'hidden sm:flex'}`}
                        >
                          {isLast ? (
                            <BreadcrumbPage className="flex min-w-0 items-center gap-1.5">
                              {crumb.icon && (
                                <crumb.icon className="h-3.5 w-3.5 shrink-0 text-yellow-600 dark:text-yellow-400" />
                              )}
                              <span
                                title={crumb.name}
                                className="max-w-[45vw] truncate rounded-md border border-zinc-200 bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-900 sm:max-w-[240px] lg:max-w-none dark:border-zinc-700/50 dark:bg-zinc-800/80 dark:text-zinc-100"
                              >
                                {crumb.name}
                              </span>
                            </BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink
                              render={<Link to={crumb.href} />}
                              className="flex min-w-0 items-center gap-1.5 text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                            >
                              {crumb.icon && <crumb.icon className="h-3.5 w-3.5 shrink-0" />}
                              <span className="truncate text-xs font-medium">{crumb.name}</span>
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                      </React.Fragment>
                    );
                  })}
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            {/* ───────────────────────── Right ──────────────────────── */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:gap-3 lg:pr-2">
              <StaffNotificationCenter />

              {user?.store ? (
                <>
                  <div className="hidden min-w-0 flex-col text-right sm:flex">
                    <span
                      title={user.store.name}
                      className="max-w-[120px] truncate text-sm font-semibold leading-tight text-zinc-900 lg:max-w-[200px] xl:max-w-[280px] dark:text-zinc-100"
                    >
                      {user.store.name}
                    </span>
                    <span
                      title={user.tenant?.name || 'Store'}
                      className="max-w-[120px] truncate text-[10px] font-medium uppercase leading-tight tracking-wider text-zinc-500 lg:max-w-[200px] xl:max-w-[280px] dark:text-zinc-400"
                    >
                      {user.tenant?.name || 'Store'}
                    </span>
                  </div>
                  <Avatar className="h-8 w-8 shrink-0 rounded-lg border border-zinc-200 shadow-sm sm:h-9 sm:w-9 dark:border-zinc-800">
                    <AvatarImage
                      src={user.tenant?.logo || ''}
                      alt={user.tenant?.name || 'Brand'}
                      className="object-cover"
                    />
                    <AvatarFallback className="rounded-lg bg-zinc-100 text-sm font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {(user.tenant?.name || user.store.name).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </>
              ) : user?.tenant ? (
                <>
                  <div className="hidden min-w-0 flex-col text-right sm:flex">
                    <span
                      title={user.tenant.name}
                      className="max-w-[120px] truncate text-sm font-semibold leading-tight text-zinc-900 lg:max-w-[200px] xl:max-w-[280px] dark:text-zinc-100"
                    >
                      {user.tenant.name}
                    </span>
                    <span className="text-[10px] font-medium uppercase leading-tight tracking-wider text-zinc-500 dark:text-zinc-400">
                      All Stores
                    </span>
                  </div>
                  <Avatar className="h-8 w-8 shrink-0 rounded-lg border border-zinc-200 shadow-sm sm:h-9 sm:w-9 dark:border-zinc-800">
                    <AvatarImage
                      src={user.tenant.logo || ''}
                      alt={user.tenant.name}
                      className="object-cover"
                    />
                    <AvatarFallback className="rounded-lg bg-zinc-100 text-sm font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {user.tenant.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </>
              ) : (
                <>
                  <div className="hidden min-w-0 flex-col text-right sm:flex">
                    <span className="truncate text-sm font-semibold leading-tight text-zinc-900 dark:text-zinc-100">
                      Global System
                    </span>
                    <span className="text-[10px] font-medium uppercase leading-tight tracking-wider text-zinc-500 dark:text-zinc-400">
                      Super Admin
                    </span>
                  </div>
                </>
              )}
            </div>
          </header>

          <div className={`w-full z-0 ${location.pathname.startsWith('/dashboard/pos') || location.pathname.startsWith('/dashboard/kds') ? 'p-0 md:p-3 h-[calc(100vh-4.05rem)] overflow-hidden flex flex-col' : 'p-0 md:p-8'}`}>
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};
