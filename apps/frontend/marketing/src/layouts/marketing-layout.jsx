import { Outlet } from "react-router-dom"
import ScrollToTop from "../components/scroll-to-top.jsx"
import NavigationBar from "../components/navigation-bar.jsx"
import Footer from "../components/footer.jsx"

export default function MarketingLayout() {

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-white selection:text-zinc-950">
      <ScrollToTop />

      <NavigationBar />

      <main className="flex-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  )
}