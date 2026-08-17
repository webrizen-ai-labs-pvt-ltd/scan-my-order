import React, { useState } from "react"
import { Link } from "react-router-dom"
import { Check, HelpCircle, Zap, ArrowRight, ShieldCheck, Sparkles } from "lucide-react"

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState("annual") // "monthly" | "annual"

  const plans = [
    {
      name: "Starter",
      tagline: "Ideal for boutique cafes, food trucks, and single-location eateries.",
      priceMonthly: 1499,
      priceAnnual: 1199,
      features: [
        "Up to 15 QR Dining Tables",
        "1 POS Terminal License",
        "Digital QR Menu Engine",
        "Basic KDS Kitchen Display",
        "Standard Email Support",
        "PhonePe Payment Integration"
      ],
      popular: false,
      ctaText: "Start Starter Plan"
    },
    {
      name: "Growth Pro",
      tagline: "Built for high-volume dining rooms and expanding multi-station kitchens.",
      priceMonthly: 3499,
      priceAnnual: 2799,
      features: [
        "Unlimited QR Dining Tables",
        "Up to 5 POS Terminal Licenses",
        "Multi-Station KDS Displays",
        "Role-Based Staff Permissions",
        "Advanced Analytics & Sales Reports",
        "Priority 24/7 Phone & Chat Support",
        "Custom Branding on Digital Menus",
        "PhonePe Auto-Settlement Integration"
      ],
      popular: true,
      ctaText: "Start 14-Day Free Trial"
    },
    {
      name: "Enterprise",
      tagline: "Custom solutions for restaurant chains, franchises, and hotel dining hubs.",
      priceMonthly: 7999,
      priceAnnual: 6399,
      features: [
        "Unlimited Stores & Locations",
        "Unlimited POS & KDS Terminals",
        "Dedicated Account Manager",
        "Custom API & ERP Integrations",
        "Multi-Property Financial Auditing",
        "Custom SLA & Guaranteed Uptime",
        "On-Site Staff Training & Setup"
      ],
      popular: false,
      ctaText: "Contact Enterprise Sales"
    }
  ]

  const faqs = [
    {
      q: "Is there a setup fee or long-term contract?",
      a: "No! All plans are pay-as-you-go with no long-term lock-in. You can upgrade, downgrade, or cancel your subscription at any time."
    },
    {
      q: "Do I need special hardware to run Scan My Order?",
      a: "No dedicated hardware is required. Scan My Order runs smoothly on any web browser, iPad, Android tablet, laptop, or desktop computer."
    },
    {
      q: "How does the PhonePe payment integration work?",
      a: "Scan My Order connects natively with PhonePe PG. Customer payments made via QR codes settle directly into your linked bank account."
    },
    {
      q: "Can I try Scan My Order before purchasing?",
      a: "Yes! We offer a full 14-day free trial on the Growth Pro plan with no credit card required."
    }
  ]

  return (
    <div className="space-y-20 py-12">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" /> Transparent Pricing
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
          Simple, Predictable Plans for Every Stage
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
          No hidden fees, no commission per order. Choose the plan that fits your dining room best.
        </p>

        {/* Billing Cycle Toggle */}
        <div className="pt-6 flex items-center justify-center gap-4">
          <span className={`text-sm ${billingCycle === "monthly" ? "text-white font-bold" : "text-slate-400"}`}>
            Monthly Billing
          </span>
          <button
            onClick={() => setBillingCycle(billingCycle === "monthly" ? "annual" : "monthly")}
            className="w-14 h-8 rounded-full bg-slate-800 p-1 border border-slate-700 relative transition-colors focus:outline-none"
            aria-label="Toggle Billing Cycle"
          >
            <div
              className={`w-6 h-6 rounded-full bg-amber-500 transition-transform ${
                billingCycle === "annual" ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
          <span className={`text-sm flex items-center gap-1.5 ${billingCycle === "annual" ? "text-white font-bold" : "text-slate-400"}`}>
            Annual Billing
            <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">
              Save 20%
            </span>
          </span>
        </div>
      </section>

      {/* Pricing Cards Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan, idx) => {
            const price = billingCycle === "annual" ? plan.priceAnnual : plan.priceMonthly
            return (
              <div
                key={idx}
                className={`p-8 rounded-3xl flex flex-col justify-between space-y-8 relative transition-all duration-300 ${
                  plan.popular
                    ? "bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-2 border-amber-500 shadow-2xl shadow-amber-500/10 scale-105"
                    : "bg-slate-900/60 border border-slate-800"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 font-extrabold text-[11px] uppercase tracking-wider px-3 py-1 rounded-full shadow-md">
                    Most Popular Choice
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">{plan.tagline}</p>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl sm:text-5xl font-black text-white">₹{price.toLocaleString()}</span>
                    <span className="text-slate-400 text-sm font-medium">/ month</span>
                  </div>

                  <div className="border-t border-slate-800 pt-6 space-y-3">
                    <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Included Features</p>
                    <ul className="space-y-2.5">
                      {plan.features.map((feat, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-2.5 text-xs text-slate-200">
                          <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <Link
                  to="/contact"
                  className={`w-full text-center py-3.5 rounded-xl text-sm font-bold transition-all shadow-lg ${
                    plan.popular
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-500/20"
                      : "bg-slate-800 hover:bg-slate-700 text-white"
                  }`}
                >
                  {plan.ctaText}
                </Link>
              </div>
            )
          })}
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-white">Frequently Asked Questions</h2>
          <p className="text-slate-400 text-sm">Have a question? We're here to help.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {faqs.map((faq, fIdx) => (
            <div key={fIdx} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <h4 className="text-white font-bold text-sm flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                {faq.q}
              </h4>
              <p className="text-slate-400 text-xs leading-relaxed pl-6">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
