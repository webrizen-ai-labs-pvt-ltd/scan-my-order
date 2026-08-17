import React from "react"
import HeroSection from "../components/hero-section"
import TrustedBySection from "../components/trusted-by-section"
import BentoFeaturesSection from "../components/bento-features-section"
import WhyUsFeaturesSection from "../components/why-us-features-section"
import StatsSection from "../components/stats-section"
import TimelineSection from "../components/timeline-section"
import PricingSection from "../components/pricing-section"
import FaqSection from "../components/faq-section"

export default function HomePage() {
  return (
    <div className="space-y-12 bg-zinc-950 text-zinc-100">
      {/* 1. Hero Section */}
      <HeroSection />

      {/* 2. Trusted By Restaurant Logos */}
      <TrustedBySection />

      {/* 3. Interactive Bento Grid Features Showcase */}
      <BentoFeaturesSection />

      {/* 5. Key Metrics Stats */}
      <StatsSection />

      {/* 6. Onboarding Timeline */}
      <TimelineSection />

      {/* 7. Interactive Pricing Section */}
      <PricingSection />

      {/* 8. Interactive FAQs Section */}
      <FaqSection />
    </div>
  )
}
