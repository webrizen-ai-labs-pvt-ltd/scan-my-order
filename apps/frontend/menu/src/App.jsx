import React from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import HomePage from "./pages/home-page.jsx"
import StoreMenuPage from "./pages/store-menu-page.jsx"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home Page: One line text */}
        <Route path="/" element={<HomePage />} />

        {/* Menu & Store Front using Slug */}
        <Route path="/:slug" element={<StoreMenuPage />} />
        <Route path="/store/:slug" element={<StoreMenuPage />} />
      </Routes>
    </BrowserRouter>
  )
}
