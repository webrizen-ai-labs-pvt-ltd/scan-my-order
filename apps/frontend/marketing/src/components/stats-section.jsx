import React from "react"
import { statsData } from "../enums"

export default function StatsSection() {
  return (
    <section className="bg-zinc-950 border-t border-zinc-900 py-16">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-14 lg:gap-y-0">
          {statsData.map((stat, index) => (
            <div key={index} className="relative flex flex-col items-center text-center">
              {index !== statsData.length - 1 && (
                <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 w-px h-16 bg-zinc-800/80"></div>
              )}

              {index % 2 === 0 && (
                <div className="hidden md:block lg:hidden absolute right-0 top-1/2 -translate-y-1/2 w-px h-16 bg-zinc-800/80"></div>
              )}

              <h4 className="text-5xl md:text-6xl font-bold text-zinc-100 mb-3 tracking-tight">
                {stat.value}
              </h4>
              <p className="text-zinc-400 text-sm md:text-base font-light tracking-wide">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
