import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/home-page'
import { Navbar } from './components/navbar'
import { Footer } from './components/footer'
import { ScrollManager } from './components/scroll-manager'

const PricingPage = lazy(() => import('./pages/pricing-page'))
const ContactPage = lazy(() => import('./pages/contact-page'))
const NotFoundPage = lazy(() => import('./pages/not-found-page'))

function App() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <ScrollManager />
      <Navbar />
      <main id="main">
        <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  )
}

export default App
