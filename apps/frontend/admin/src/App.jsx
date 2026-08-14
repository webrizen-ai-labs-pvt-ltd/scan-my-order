import React from "react"
import { AuthProvider } from "./context/auth-context.jsx"
import AppRoutes from "./routes/app-routes.jsx"

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
