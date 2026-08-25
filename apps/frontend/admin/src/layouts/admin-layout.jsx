import React from 'react';
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
  UserGroupIcon, 
  Invoice01Icon, 
  Settings01Icon, 
  Building04Icon, 
  Home01Icon, 
  ArrowRight01Icon 
} from 'hugeicons-react';

export const AdminLayout = () => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: DashboardSquare01Icon },
    { name: 'Brands', path: '/brands', icon: Building04Icon },
    { name: 'Stores', path: '/stores', icon: Store01Icon },
    { name: 'Users', path: '/users', icon: UserGroupIcon },
    { name: 'Billing', path: '/billing', icon: Invoice01Icon },
    { name: 'Settings', path: '/settings', icon: Settings01Icon },
  ];

  const routeConfig = {
    "": { label: "Dashboard", icon: DashboardSquare01Icon },
    "brands": { label: "Brands", icon: Building04Icon },
    "users": { label: "User Management", icon: UserGroupIcon },
    "stores": { label: "Store Directory", icon: Store01Icon },
    "settings": { label: "Settings", icon: Settings01Icon },
    "billing": { label: "Billing", icon: Invoice01Icon },
  };

  const getBreadcrumbs = () => {
    const paths = location.pathname.split("/").filter(Boolean);
    
    if (paths.length === 0) {
      return [{ name: "Home", href: "/", isLast: true }];
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
              <img src="/logo.png" alt="Logo" className="h-8 w-auto dark:invert" />
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-semibold text-white">Scan My Order</span>
                <span className="truncate text-[10px] text-zinc-400">Admin OS</span>
              </div>
            </Link>
          </SidebarHeader>

          <SidebarContent className="p-2 pt-4">
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
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
                <span className="text-sm font-medium truncate text-zinc-900 dark:text-zinc-100">{user?.name || 'Admin'}</span>
                <span className="text-xs text-zinc-500 truncate">{user?.email}</span>
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
          <header className="relative flex h-16 shrink-0 items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/60 px-4 backdrop-blur-xl">
            <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-yellow-500/20 to-transparent" />
            
            <div className="flex items-center gap-3">
              <SidebarTrigger className="hover:bg-zinc-800! rounded-lg transition-colors" />
              <Separator orientation="vertical" className="h-5 border-zinc-800" />
              
              <Breadcrumb>
                <BreadcrumbList className="flex items-center gap-1.5">
                  <BreadcrumbItem>
                    <BreadcrumbLink 
                      render={<Link to="/" />}
                      className="group flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      <Home01Icon className="h-3.5 w-3.5 group-hover:text-yellow-400 transition-colors" />
                    </BreadcrumbLink>
                  </BreadcrumbItem>

                  {breadcrumbs.map((crumb) => (
                    <React.Fragment key={crumb.href}>
                      <BreadcrumbSeparator>
                        <ArrowRight01Icon className="h-3 w-3 text-zinc-600" />
                      </BreadcrumbSeparator>
                      <BreadcrumbItem>
                        {crumb.isLast ? (
                          <BreadcrumbPage className="flex items-center gap-1.5">
                            {crumb.icon && <crumb.icon className="h-3.5 w-3.5 text-yellow-400" />}
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

          <div className="w-full p-6 md:p-8">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};