import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import Authentication from './pages/authentication.jsx'
import NotFound from './pages/not-found.jsx'
import '@smo/ui/globals.css'
import { ThemeProvider } from '@smo/ui'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider defaultTheme="system" storageKey="smo-theme">
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
