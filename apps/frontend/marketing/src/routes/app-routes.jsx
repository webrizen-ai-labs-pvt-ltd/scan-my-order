import React from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "../context/auth-context.jsx"
import MarketingLayout from "../layouts/marketing-layout.jsx"

import HomePage from "../pages/home-page.jsx"
import AuthenticationPage from "../pages/authentication-page.jsx"
import OnboardingPage from "../pages/onboarding-page.jsx"

export default function AppRoutes() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Standalone Authentication & Onboarding Routes */}
          <Route path="/authentication" element={<AuthenticationPage />} />
          <Route path="/login" element={<Navigate to="/authentication" replace />} />
          <Route path="/signup" element={<Navigate to="/authentication" replace />} />
          <Route path="/onboarding" element={<OnboardingPage />} />

          {/* Marketing Layout Main Page */}
          <Route element={<MarketingLayout />}>
            <Route path="/" element={<HomePage />} />
            {/* Redirect all old sub-pages directly to homepage or authentication */}
            <Route path="/features" element={<Navigate to="/#features" replace />} />
            <Route path="/pricing" element={<Navigate to="/#pricing" replace />} />
            <Route path="/about" element={<Navigate to="/" replace />} />
            <Route path="/contact" element={<Navigate to="/authentication" replace />} />
            <Route path="/privacy" element={<Navigate to="/" replace />} />
            <Route path="/terms" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
