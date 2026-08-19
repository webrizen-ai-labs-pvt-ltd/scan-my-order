import React from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import HomePage from "./pages/home-page.jsx"
import StoreMenuPage from "./pages/store-menu-page.jsx"
import CustomerAuthPage from "./pages/customer-auth-page.jsx"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route path="/auth" element={<CustomerAuthPage />} />

        <Route path="/:slug" element={<StoreMenuPage />} />
      </Routes>
    </BrowserRouter>
  )
}
