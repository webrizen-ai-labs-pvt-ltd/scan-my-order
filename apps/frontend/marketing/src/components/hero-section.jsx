import React from "react"
import { Link } from "react-router-dom"
import { Button } from "@repo/ui"
import { hero } from "../enums"
import { useAuth } from "../context/auth-context.jsx"

export default function HeroSection() {
  const { isAuthenticated } = useAuth()
  const targetLink = isAuthenticated ? "/onboarding" : "/authentication"

  return (
    <section className="h-screen w-full grid grid-cols-6 bg-zinc-950 relative font-sans">
      {hero.map((item, index) => {
        const opacity = 0.1 + index * 0.1

        return (
          <div
            key={index}
            className="w-full h-full"
            style={{ backgroundColor: `rgba(244, 244, 245, ${opacity})` }}
          >
            <img src={item.url} alt="" className="w-full h-full object-cover" />
          </div>
        )
      })}
      <div className="container mx-auto absolute bottom-0 left-0 right-0 h-[85vh] rounded-t-full flex flex-col items-center justify-end border-t border-zinc-800/10 overflow-hidden pb-10 group/container">
        <div className="absolute inset-0 flex">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((strip, index) => (
            <div
              key={index}
              className="flex-1 h-full bg-zinc-950 transition-all duration-300 hover:bg-transparent"
            />
          ))}
        </div>

        <div className="size-150 bg-yellow-500 blur-[190px] rounded-full absolute top-auto -bottom-160 left-0 right-0 mx-auto" />

        <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full bg-zinc-900 border border-zinc-800 backdrop-blur-md z-10">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          <span className="text-xs font-medium text-zinc-300 tracking-wide uppercase">The All-in-One Restaurant POS</span>
        </div>

        <div className="text-center max-w-5xl px-6 relative z-10">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-zinc-100 mb-6 leading-tight">
            Change Dining with{" "}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-yellow-400 to-amber-600">Instant QR Orders </span>
            & Smart POS Hub
          </h1>

          <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            Replace cluttered counters and lost tickets with one seamless platform. From frictionless QR menus to a smart Kitchen Display System, take complete control of your floor.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 z-10">
          <Link to={targetLink}>
            <Button size="lg" className="rounded-full">
              Start Restaurant Onboarding
            </Button>
          </Link>
          <Link to={targetLink}>
            <Button variant="link" size="lg" className="rounded-full">
              Authenticate Account
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
