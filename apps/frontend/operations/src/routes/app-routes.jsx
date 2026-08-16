import React from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import ProtectedRoute from "./protected-route.jsx"
import RoleRoute from "./role-route.jsx"

import HomePage from "../pages/home-page.jsx"
import AuthenticationPage from "../pages/authentication-page.jsx"
import DashboardLayout from "../layouts/dashboard-layout.jsx"

// Dashboard Child Pages
import DashboardOverviewPage from "../pages/dashboard/dashboard-overview-page.jsx"
import PosTerminalPage from "../pages/dashboard/pos-terminal-page.jsx"
import LiveOrdersPage from "../pages/dashboard/live-orders-page.jsx"
import TablesManagementPage from "../pages/dashboard/tables-management-page.jsx"
import KdsDisplayPage from "../pages/dashboard/kds-display-page.jsx"
import StoreSetupPage from "../pages/dashboard/store-setup-page.jsx"
import StaffManagementPage from "../pages/dashboard/staff-management-page.jsx"
import SubscriptionsPage from "../pages/dashboard/subscriptions-page.jsx"
import SettingsPage from "../pages/dashboard/settings-page.jsx"

import NotFoundPage from "../pages/not-found-page.jsx"

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/authentication" element={<AuthenticationPage />} />
        <Route path="/login" element={<Navigate to="/authentication" replace />} />

        {/* Protected Dashboard Parent Layout & Role-Guarded Child Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            {/* Overview - All Operations Roles */}
            <Route index element={<DashboardOverviewPage />} />

            {/* WAITER & Above */}
            <Route element={<RoleRoute allowedRoles={["OWNER", "MANAGER", "WAITER"]} />}>
              <Route path="pos" element={<PosTerminalPage />} />
              <Route path="live-orders" element={<LiveOrdersPage />} />
              <Route path="tables" element={<TablesManagementPage />} />
            </Route>

            {/* KITCHEN & Above */}
            <Route element={<RoleRoute allowedRoles={["OWNER", "MANAGER", "KITCHEN"]} />}>
              <Route path="kds" element={<KdsDisplayPage />} />
            </Route>

            {/* MANAGER & OWNER */}
            <Route element={<RoleRoute allowedRoles={["OWNER", "MANAGER"]} />}>
              <Route path="store-setup" element={<StoreSetupPage />} />
              <Route path="menu" element={<Navigate to="/dashboard/store-setup?tab=menu" replace />} />
              <Route path="staff" element={<StaffManagementPage />} />
            </Route>

            {/* ALL LOGGED IN USERS */}
            <Route path="settings" element={<SettingsPage />} />

            {/* OWNER ONLY */}
            <Route element={<RoleRoute allowedRoles={["OWNER"]} />}>
              <Route path="subscriptions" element={<SubscriptionsPage />} />
            </Route>
          </Route>
        </Route>

        {/* Fallback 404 Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
