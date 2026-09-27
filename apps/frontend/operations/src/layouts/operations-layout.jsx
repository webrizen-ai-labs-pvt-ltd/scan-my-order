import React, { useMemo, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
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
  Analytics01Icon,
  Settings02Icon,
  ArrowDown01Icon,
  CashierIcon,
  ChartLineData01Icon,
  Logout01Icon,
  Invoice03Icon,
  NoteEditIcon,
  ChartIncreaseIcon,
  Activity01Icon
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

  // The sidebar is organised into categories. A group with `label: null` renders as
  // plain top-level items; a group with `collapsible: true` renders as a single
  // clickable row that expands to reveal its items. Groups with no visible items
  // for the current role are dropped entirely.
  const navGroups = useMemo(() => {
    const role = user?.role;
    const isSuperOrTenantAdmin = role === 'SUPER_ADMIN' || role === 'TENANT_ADMIN';
    const isManager = role === 'STORE_MANAGER' || isSuperOrTenantAdmin;
    const isCashier = role === 'CASHIER' || isManager;
    const isKitchen = role === 'KITCHEN_STAFF' || isManager;
    const isWaiter = role === 'WAITER' || isManager;

    const groups = [
      {
        key: 'primary',
        label: null,
        items: [
          { name: 'Dashboard', path: '/dashboard', icon: DashboardSquare01Icon, show: true },
        ],
      },
      {
        key: 'cashier',
        label: 'Cashier',
        icon: CashierIcon,
        collapsible: true,
        items: [
          { name: 'POS', path: '/dashboard/pos', icon: Store01Icon, show: isCashier },
          { name: 'Reservations', path: '/dashboard/reservations', icon: Calendar01Icon, show: isCashier || isWaiter },
          { name: 'Order History', path: '/dashboard/orders', icon: Invoice01Icon, show: isCashier },
        ],
      },
      {
        key: 'floor',
        label: 'Floor Management',
        icon: RestaurantIcon,
        collapsible: true,
        items: [
          { name: 'KDS & KOT', path: '/dashboard/kds', icon: Pot02Icon, show: isKitchen },
          { name: 'Waiter Panel', path: '/dashboard/waiter', icon: Dish01Icon, show: isWaiter },
          { name: 'Inventory', path: '/dashboard/inventory', icon: DeliveryTruck01Icon, show: isManager },
        ],
      },
      {
        key: 'setup',
        label: 'Store Setup & Payments',
        icon: Settings02Icon,
        collapsible: true,
        items: [
          { name: 'Store Setup', path: '/dashboard/stores', icon: Store02Icon, show: isManager },
          { name: 'Brand Setup', path: '/dashboard/brand', icon: Building02Icon, show: isSuperOrTenantAdmin },
          { name: 'Employee Management', path: '/dashboard/employees', icon: UserGroupIcon, show: isSuperOrTenantAdmin },
          { name: 'Subscription', path: '/dashboard/subscriptions', icon: CreditCardIcon, show: isSuperOrTenantAdmin },
          { name: 'Settings', path: '/dashboard/settings', icon: Settings01Icon, show: true },
        ],
      },
      {
        key: 'reports',
        label: 'Reports',
        icon: ChartLineData01Icon,
        collapsible: true,
        items: [
          { name: 'Sales', path: '/dashboard/sales', icon: ChartIncreaseIcon, show: isManager },
          { name: 'Table Analytics', path: '/dashboard/table-analytics', icon: Analytics01Icon, show: isSuperOrTenantAdmin },
          { name: 'Invoices', path: '/dashboard/invoices', icon: Invoice03Icon, show: isCashier },
          { name: 'Dues', path: '/dashboard/dues', icon: NoteEditIcon, show: isCashier },
          { name: 'Audit Log', path: '/dashboard/audit', icon: Activity01Icon, show: isManager },
        ],
      },
    ];

    return groups
      .map(group => ({ ...group, items: group.items.filter(item => item.show) }))
      .filter(group => group.items.length > 0);
  }, [user?.role]);

  const isItemActive = (path) =>
    location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path));

  // Open/closed state for collapsible groups. A group not yet toggled by the user
  // (`undefined`) auto-opens whenever one of its routes is active.
  const [openGroups, setOpenGroups] = useState({});
  const isGroupOpen = (group) =>
    openGroups[group.key] !== undefined
      ? openGroups[group.key]
      : group.items.some(item => isItemActive(item.path));
  const toggleGroup = (group) =>
    setOpenGroups(prev => ({ ...prev, [group.key]: !isGroupOpen(group) }));

  // Every row shares one height, font size and icon column so the list lines up
  const rowClass = (isActive) =>
    `flex h-9 w-full min-w-0 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors ${isActive
      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-semibold'
      : 'font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/70 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100'
    }`;

  const routeConfig = {
    "dashboard": { label: "Dashboard", icon: DashboardSquare01Icon },
    "employees": { label: "Employee Management", icon: UserGroupIcon },
    "table-analytics": { label: "Table Analytics", icon: Analytics01Icon },
    "pos": { label: "POS", icon: Store01Icon },
    "reservations": { label: "Table Reservations", icon: Calendar01Icon },
    "kds": { label: "KDS & KOT", icon: Pot02Icon },
    "waiter": { label: "Waiter View", icon: Dish01Icon },
    "orders": { label: "Order History", icon: Invoice01Icon },
    "inventory": { label: "Inventory Management", icon: DeliveryTruck01Icon },
    "stores": { label: "Store Setup", icon: Store02Icon },
    "brand": { label: "Brand Setup", icon: Building02Icon },
    "subscriptions": { label: "Subscription", icon: CreditCardIcon },
    "settings": { label: "Settings", icon: Settings01Icon },
    "invoices": { label: "Invoices", icon: Invoice03Icon },
    "dues": { label: "Dues", icon: NoteEditIcon },
    "sales": { label: "Sales", icon: ChartIncreaseIcon },
    "record-payment": { label: "Record payment" },
    "audit": { label: "Audit Log", icon: Activity01Icon },
  };

  const getBreadcrumbs = () => {
    const paths = location.pathname.split("/").filter(Boolean);

    if (paths.length === 0 || (paths.length === 1 && paths[0] === 'dashboard')) {
      return [{ name: "Dashboard", href: "/dashboard", isLast: true }];
    }

    const breadcrumbs = paths.map((path, index) => {
      const config = routeConfig[path.toLowerCase()];
      // Record ids (orders, sessions…) read better as a short reference
      const isId = /^[a-z0-9]{20,}$/i.test(path);
      const formattedName = config?.label || (isId ? `#${path.slice(-6).toUpperCase()}` : path
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" "));

      // Keep ?store= and similar so parent pages open on the same store
      const href = "/" + paths.slice(0, index + 1).join("/") + (index > 0 ? location.search : "");

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

          <SidebarContent className="gap-0 px-2 py-2 no-scrollbar">
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {navGroups.map((group) => {
                    // Plain top-level links (e.g. Dashboard)
                    if (!group.collapsible) {
                      return group.items.map((item) => {
                        const isActive = isItemActive(item.path);
                        return (
                          <SidebarMenuItem key={item.path}>
                            <SidebarMenuButton asChild isActive={isActive} tooltip={item.name} className="h-9 p-0">
                              <Link to={item.path} className={rowClass(isActive)}>
                                <item.icon size={18} variant={isActive ? 'solid' : 'stroke'} className="shrink-0" />
                                <span className="truncate">{item.name}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      });
                    }

                    // Collapsible category: one row that expands into its links
                    const open = isGroupOpen(group);
                    const hasActiveChild = group.items.some(item => isItemActive(item.path));
                    return (
                      <SidebarMenuItem key={group.key}>
                        <SidebarMenuButton
                          isActive={hasActiveChild && !open}
                          tooltip={group.label}
                          onClick={() => toggleGroup(group)}
                          aria-expanded={open}
                          className={`${rowClass(hasActiveChild && !open)} p-0 px-2.5`}
                        >
                          <group.icon size={18} variant={hasActiveChild ? 'solid' : 'stroke'} className="shrink-0" />
                          <span className="min-w-0 flex-1 truncate text-left" title={group.label}>{group.label}</span>
                          <ArrowDown01Icon
                            size={15}
                            className={`shrink-0 text-zinc-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                          />
                        </SidebarMenuButton>

                        {open && (
                          <SidebarMenuSub className="mx-0 ml-[1.1rem] mt-0.5 mb-1 gap-0.5 border-l border-zinc-200 pl-2 pr-0 dark:border-zinc-800">
                            {group.items.map((item) => {
                              const isActive = isItemActive(item.path);
                              return (
                                <SidebarMenuSubItem key={item.path}>
                                  <SidebarMenuSubButton asChild isActive={isActive} className="h-8 p-0">
                                    <Link to={item.path} title={item.name} className={`${rowClass(isActive)} h-8 gap-2 px-2`}>
                                      <item.icon size={16} variant={isActive ? 'solid' : 'stroke'} className="shrink-0" />
                                      <span className="truncate">{item.name}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          {/* Compact footer: profile, theme and logout on one row */}
          <SidebarFooter className="border-t border-zinc-200 p-2 dark:border-zinc-800">
            <div className="flex items-center gap-2 rounded-lg p-1.5">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={user?.profilePhoto || ''} alt={user?.name || 'User'} />
                <AvatarFallback className="bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100" title={user?.name}>{user?.name || 'Staff'}</span>
                <span className="truncate text-[10px] uppercase tracking-wide text-zinc-500">{user?.role?.replace('_', ' ')}</span>
              </div>
              <AnimatedThemeToggler className="size-8 shrink-0" />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                aria-label="Log out"
                title="Log out"
                className="size-8 shrink-0 text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <Logout01Icon size={17} />
              </Button>
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
