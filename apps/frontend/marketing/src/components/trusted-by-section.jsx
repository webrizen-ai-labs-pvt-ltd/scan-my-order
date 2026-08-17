import React from "react"
import LogoCloud from "./logo-cloud"

export default function TrustedBySection() {
  return (
    <section className="py-2">
      <div className="container mx-auto flex flex-col md:text-left text-center justify-center mb-10 gap-4 md:px-0.5 px-3">
        <h2 className="text-3xl md:text-5xl font-bold text-zinc-100">Trusted by leading restaurants</h2>
        <p className="text-zinc-100/50 max-w-lg">Join thousands of restaurants who have transformed their dining experience with ScanMyOrder.</p>
      </div>
      <LogoCloud />
    </section>
  )
}
