import React from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import ProtectedRoute from "./protected-route.jsx"

import HomePage from "../pages/home-page.jsx"
import AuthenticationPage from "../pages/authentication-page.jsx"
import DashboardLayout from "../layouts/dashboard-layout.jsx"
import DashboardPage from "../pages/dashboard-page.jsx"

// User Management Child Pages
import UsersListPage from "../pages/users/users-list-page.jsx"
import UserCreatePage from "../pages/users/user-create-page.jsx"
import UserEditPage from "../pages/users/user-edit-page.jsx"

// Store Management Child Pages
import StoresListPage from "../pages/stores/stores-list-page.jsx"
import StoreOnboardPage from "../pages/stores/store-onboard-page.jsx"
import StoreManagePage from "../pages/stores/store-manage-page.jsx"

// Digital Menu Item Management Child Pages
import MenuItemCreatePage from "../pages/stores/menu-item-create-page.jsx"
import MenuItemEditPage from "../pages/stores/menu-item-edit-page.jsx"

// Subscription & PhonePe Child Pages
import SubscriptionsListPage from "../pages/subscriptions/subscriptions-list-page.jsx"
import PlanCreatePage from "../pages/subscriptions/plan-create-page.jsx"
import PlanEditPage from "../pages/subscriptions/plan-edit-page.jsx"
import StoreSubscriptionAssignPage from "../pages/subscriptions/store-subscription-assign-page.jsx"

import SettingsPage from "../pages/settings-page.jsx"
import NotFoundPage from "../pages/not-found-page.jsx"

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/authentication" element={<AuthenticationPage />} />
        <Route path="/login" element={<Navigate to="/authentication" replace />} />

        {/* Protected Dashboard Parent Layout & Child Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardPage />} />

            {/* User Management Routes */}
            <Route path="users" element={<UsersListPage />} />
            <Route path="users/new" element={<UserCreatePage />} />
            <Route path="users/:id/edit" element={<UserEditPage />} />

            {/* Store Management & Onboarding Routes */}
            <Route path="stores" element={<StoresListPage />} />
            <Route path="stores/onboard" element={<StoreOnboardPage />} />
            <Route path="stores/:id/manage" element={<StoreManagePage />} />

            {/* Digital Menu Items Routes */}
            <Route path="stores/:id/menu/new" element={<MenuItemCreatePage />} />
            <Route path="stores/:id/menu/:itemId/edit" element={<MenuItemEditPage />} />

            {/* Subscriptions & PhonePe Routes */}
            <Route path="subscriptions" element={<SubscriptionsListPage />} />
            <Route path="subscriptions/plans/new" element={<PlanCreatePage />} />
            <Route path="subscriptions/plans/:id/edit" element={<PlanEditPage />} />
            <Route path="subscriptions/assign" element={<StoreSubscriptionAssignPage />} />

            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* Fallback 404 Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
