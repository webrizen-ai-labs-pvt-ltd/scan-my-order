import React from "react"
import { timelineData, stepCoordinates } from "../enums"

export default function TimelineSection() {
  return (
    <section id="setup" className="bg-zinc-950 py-12 md:py-24 lg:p-24 relative overflow-hidden min-h-screen lg:h-screen flex items-center border-t border-zinc-900">
      <div className="container mx-auto px-6 lg:px-12 grid lg:grid-cols-2 items-center gap-8 lg:gap-0 h-full">

        <div className="w-full space-y-6 lg:space-y-8 z-10 relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/50 border border-zinc-800 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="text-zinc-300 text-xs font-medium uppercase tracking-widest">
              Fast Onboarding
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-100 leading-tight">
            From zero to <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-linear-to-br from-amber-400 to-amber-600">
              taking live orders.
            </span>
          </h2>

          <p className="text-zinc-400 leading-relaxed text-base sm:text-lg font-light max-w-md">
            Ditch the heavy manuals and complex installations. We've streamlined the setup process so you can get your POS and digital menu live before your next lunch rush.
          </p>
        </div>

        <div className="w-full h-full relative z-10">
          {/* Mobile: Simplified timeline */}
          <div className="lg:hidden space-y-6 py-4">
            {timelineData.map((step, index) => (
              <div key={step.id} className="relative pl-10">
                {/* Vertical line */}
                {index !== timelineData.length - 1 && (
                  <div className="absolute left-[11px] top-6 bottom-[-24px] w-px bg-linear-to-b from-amber-500/50 to-transparent"></div>
                )}
                {/* Node */}
                <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                </div>
                <div className="space-y-2">
                  <span className="text-amber-500/70 font-mono text-xs block">{step.id}</span>
                  <h3 className="text-zinc-100 font-medium text-lg tracking-tight">
                    <span className="text-zinc-400 font-light">{step.subtitle} </span>
                    {step.title}
                  </h3>
                  <p className="text-zinc-400 text-sm leading-relaxed font-light">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: Original SVG timeline */}
          <div className="hidden lg:block w-full h-full relative">
            <svg
              viewBox="0 0 100 100"
              className="absolute inset-0 w-full h-full pointer-events-none"
              preserveAspectRatio="none"
            >
              <defs>
                <filter id="ambient-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur1" />
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur2" />
                  <feMerge>
                    <feMergeNode in="blur2" />
                    <feMergeNode in="blur1" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                <linearGradient id="stair-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fde047" />
                  <stop offset="50%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
              </defs>

              <path
                d="M 5 2 L 5 28 L 15 28 L 15 54 L 25 54 L 25 80 L 35 80"
                stroke="url(#stair-gradient)"
                strokeWidth="0.8"
                fill="none"
                filter="url(#ambient-glow)"
                className="opacity-30"
                vectorEffect="non-scaling-stroke"
              />

              <path
                d="M 5 2 L 5 28 L 15 28 L 15 54 L 25 54 L 25 80 L 35 80"
                stroke="url(#stair-gradient)"
                strokeWidth="0.25"
                fill="none"
                vectorEffect="non-scaling-stroke"
              />

              {stepCoordinates.map((coord, i) => (
                <circle
                  key={`node-${i}`}
                  cx={coord.x}
                  cy={coord.y}
                  r="1"
                  fill="#fde047"
                  filter="url(#ambient-glow)"
                  className={i === 3 ? "opacity-100" : "opacity-80"}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>

            {timelineData.map((step, index) => (
              <div
                key={step.id}
                className="absolute flex flex-col gap-3 group"
                style={{
                  top: `${stepCoordinates[index].y}%`,
                  left: `${stepCoordinates[index].x + 4}%`,
                  width: `${85 - stepCoordinates[index].x}%`,
                }}
              >
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4 -mt-2">
                  <span className="text-amber-500/50 font-mono text-sm group-hover:text-amber-400 transition-colors duration-300">
                    {step.id}
                  </span>
                  <h3 className="text-zinc-100 font-medium text-xl sm:text-2xl tracking-tight">
                    <span className="text-zinc-400 font-light">{step.subtitle} </span>
                    {step.title}
                  </h3>
                </div>
                <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-sm font-light">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="hidden md:grid h-screen w-full md:grid-cols-6 bg-zinc-950/20 absolute left-0 items-end z-0">
          {[1, 2, 3, 4, 5, 6].map((item, index) => {
            const opacity = 0.1 + index * 0.1
            const height = 100 - index * 10

            return (
              <div
                key={index}
                className="w-full"
                style={{
                  background: `linear-gradient(to top, rgba(251, 191, 36, ${opacity}), rgba(245, 158, 11, ${opacity * 0.7}), rgba(217, 119, 6, ${opacity * 0.4}))`,
                  height: `${height}%`,
                }}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}
