import React, { useState, useEffect, useRef } from "react"
import { Link } from "react-router-dom"
import { Check, Sparkles, ShieldCheck, ArrowRight } from "lucide-react"
import { useAuth } from "../context/auth-context.jsx"

const PRIMARY_API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(/\/$/, "")
const FALLBACK_API_URL = "http://127.0.0.1:8000/api"

// Exact database plans from live backend
const DEFAULT_RAW_PLANS = [
  {
    id: "2822ac06-6e6a-4bd5-a3cf-6e6f039508ad",
    name: "Basic Starter Plan (Monthly)",
    code: "BASIC_MONTHLY",
    description: "Ideal for small cafes and single-location dining establishments getting started with QR ordering.",
    price: 999,
    currency: "INR",
    interval: "MONTHLY",
    features: "QR Digital Menu, Table QR Scanning, Order Ticket Generation, Basic Analytics",
    status: "ACTIVE",
  },
  {
    id: "1f6f96be-7ae8-41de-b58a-e10190c1beb4",
    name: "Basic Starter Plan (Yearly)",
    code: "BASIC_YEARLY",
    description: "Annual starter plan with 2 months free. Perfect for single-location cafes.",
    price: 9999,
    currency: "INR",
    interval: "YEARLY",
    features: "QR Digital Menu, Table QR Scanning, Order Ticket Generation, Basic Analytics, 2 Months Free Savings",
    status: "ACTIVE",
  },
  {
    id: "e58cfc0f-7f0b-427d-9302-9b8f6ca2af34",
    name: "Professional POS Plan (Monthly)",
    code: "PRO_MONTHLY",
    description: "Comprehensive solution for active restaurants requiring multi-outlet management, KDS, and staff accounts.",
    price: 2499,
    currency: "INR",
    interval: "MONTHLY",
    features: "Multi-Store Management, Kitchen Display System (KDS), Waiter & Manager Accounts, Live Inventory & Allergens",
    status: "ACTIVE",
  },
  {
    id: "2f3ac44b-93a8-407c-967f-d37b156c2192",
    name: "Professional POS Plan (Yearly)",
    code: "PRO_YEARLY",
    description: "Annual professional plan with 2 months free. Includes full KDS and staff management.",
    price: 24999,
    currency: "INR",
    interval: "YEARLY",
    features: "Multi-Store Management, Kitchen Display System (KDS), Waiter & Manager Accounts, Live Inventory & Allergens, Priority Support, 2 Months Free",
    status: "ACTIVE",
  },
  {
    id: "eeb30c52-590a-4ab3-a199-2ab71c35a9e4",
    name: "Enterprise Chain Plan (Monthly)",
    code: "ENTERPRISE_MONTHLY",
    description: "Unlimited scale for restaurant chains, franchises, and enterprise dining operators.",
    price: 4998,
    currency: "INR",
    interval: "MONTHLY",
    features: "Multi-Outlet Chain Management, Custom Branding & Themes, Full KDS & POS Suite, PhonePe Gateway Integration, Dedicated Manager",
    status: "ACTIVE",
  },
  {
    id: "87f9ae9e-9e74-4e04-9afc-1868d6d7d3a7",
    name: "Enterprise Chain Plan (Yearly)",
    code: "ENTERPRISE_YEARLY",
    description: "Annual enterprise plan for restaurant chains with dedicated account management and 24/7 support.",
    price: 49999,
    currency: "INR",
    interval: "YEARLY",
    features: "Multi-Outlet Chain Management, Custom Branding & Themes, Full KDS & POS Suite, PhonePe Gateway Integration, Dedicated Account Manager, 24/7 Phone Support, 2 Months Free",
    status: "ACTIVE",
  },
]

function parseFeatures(raw) {
  if (Array.isArray(raw)) return raw
  if (typeof raw !== "string") return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // not JSON
  }
  return raw.split(",").map((f) => f.trim()).filter(Boolean)
}

async function fetchDynamicPlans() {
  // 1. Try primary configured API URL
  try {
    const res = await fetch(`${PRIMARY_API_URL}/subscriptions/plans`)
    if (res.ok) {
      const json = await res.json()
      const data = json?.data || json || []
      if (Array.isArray(data) && data.length > 0) return data
    }
  } catch (err) {
    console.warn("Primary API URL fetch failed, trying 127.0.0.1 fallback...", err)
  }

  // 2. Try 127.0.0.1 fallback URL
  try {
    const res = await fetch(`${FALLBACK_API_URL}/subscriptions/plans`)
    if (res.ok) {
      const json = await res.json()
      const data = json?.data || json || []
      if (Array.isArray(data) && data.length > 0) return data
    }
  } catch (err) {
    console.warn("Fallback API URL fetch failed, using default database plans cache", err)
  }

  // 3. Fallback to cached default database plans
  return DEFAULT_RAW_PLANS
}

export default function PricingSection() {
  const [billingCycle, setBillingCycle] = useState("annual")
  const [plans, setPlans] = useState(DEFAULT_RAW_PLANS)
  const isMountedRef = useRef(true)

  const { isAuthenticated } = useAuth()
  const targetLink = isAuthenticated ? "/onboarding" : "/authentication"

  useEffect(() => {
    isMountedRef.current = true

    fetchDynamicPlans().then((data) => {
      if (isMountedRef.current && Array.isArray(data) && data.length > 0) {
        setPlans(data)
      }
    })

    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Filter plans based on selected billing cycle interval ("MONTHLY" or "YEARLY")
  const targetInterval = billingCycle === "annual" ? "YEARLY" : "MONTHLY"
  const activePlans = plans.filter(
    (p) => (p.status === "ACTIVE" || !p.status) && (p.interval || "").toUpperCase() === targetInterval
  )

  // Order plans by price ascending
  const sortedPlans = [...activePlans].sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0))

  return (
    <section id="pricing" className="py-16 md:py-24 bg-background border-t border-border font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-16 max-w-4xl mx-auto">
          <h3 className="text-3xl md:text-6xl font-extrabold text-zinc-900 tracking-tight mb-5">
            Predictable Plans <span className="bg-gradient-to-r from-[#fac314] to-amber-500 bg-clip-text text-transparent">Zero Surprise Fees.</span>
          </h3>
          <p className="text-xl text-zinc-600 max-w-2xl mx-auto">
            Select a pricing plan tailored specifically to your venue’s scale—whether you operate a single-outlet café, a busy fine-dining venue, or a multi-room hotel.
          </p>

          <div className="mt-10 flex justify-center">
            <div className="inline-flex bg-neutral-200 p-1 rounded-full border border-neutral-300">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
                  billingCycle === "monthly" ? "bg-white shadow text-neutral-900" : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                  billingCycle === "annual" ? "bg-white shadow text-neutral-900" : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                Annual <span className="bg-yellow-100 text-yellow-700 text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider border border-yellow-200">2 Months Free</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {sortedPlans.map((plan) => {
            const codeUpper = (plan.code || "").toUpperCase()
            const isPopular = codeUpper.includes("PRO")
            const isEnterprise = codeUpper.includes("ENTERPRISE")
            const isYearly = (plan.interval || "").toUpperCase() === "YEARLY"

            const displayName = plan.name.replace(/\s*\((Monthly|Yearly)\)\s*/i, "")
            const rawPrice = parseFloat(plan.price) || 0
            const monthlyPrice = isYearly ? Math.round(rawPrice / 12) : rawPrice

            const badgeText = isPopular ? "Most Popular" : isEnterprise ? "Multi-Outlet" : "Essential"
            const ctaText = isEnterprise ? "Contact Enterprise Sales" : "Get Started Now"
            const featuresList = parseFeatures(plan.features)

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all duration-200 ${
                  isPopular
                    ? "bg-neutral-900 text-white border-2 border-[#fac314]"
                    : "bg-neutral-100 text-neutral-900 border border-neutral-200"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#fac314] text-neutral-900 text-xs font-bold tracking-wider px-4 py-1.5 rounded-full uppercase flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    {badgeText}
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-2xl font-bold">{displayName}</h4>
                      <p className={`text-xs mt-1 leading-relaxed ${isPopular ? "text-neutral-400" : "text-neutral-500"}`}>
                        {plan.description}
                      </p>
                    </div>
                    {!isPopular && (
                      <span className="text-[11px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full bg-neutral-200 text-neutral-700">
                        {badgeText}
                      </span>
                    )}
                  </div>

                  <div className="my-8 pb-6 border-b border-neutral-200/40">
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-semibold">₹</span>
                      <span className="text-4xl lg:text-5xl font-extrabold tracking-tight">
                        {monthlyPrice.toLocaleString("en-IN")}
                      </span>
                      <span className={`text-sm font-medium ${isPopular ? "text-neutral-400" : "text-neutral-500"}`}>
                        / month
                      </span>
                    </div>
                    <p className={`text-xs mt-2 ${isPopular ? "text-neutral-400" : "text-neutral-500"}`}>
                      {isYearly
                        ? `Billed annually (₹${rawPrice.toLocaleString("en-IN")}/yr)`
                        : "Billed month-to-month"}
                    </p>
                  </div>

                  <div className="space-y-4 mb-8">
                    <p className={`text-xs font-bold uppercase tracking-wider ${isPopular ? "text-neutral-400" : "text-neutral-500"}`}>
                      What's Included:
                    </p>
                    {featuresList.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-sm">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            isPopular
                              ? "bg-[#fac314]/20 text-[#fac314]"
                              : "bg-emerald-500/10 text-emerald-600"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </div>
                        <span className={isPopular ? "text-neutral-200" : "text-neutral-700"}>
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  to={targetLink}
                  className={`w-full py-3.5 px-6 rounded-2xl text-center text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                    isPopular
                      ? "bg-[#fac314] hover:bg-[#eab308] text-neutral-900"
                      : "bg-neutral-900 hover:bg-neutral-800 text-white"
                  }`}
                >
                  <span>{ctaText}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )
          })}
        </div>

        <div className="mt-12 md:mt-16 bg-neutral-100 rounded-2xl border border-neutral-200 p-6 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/10 text-[#fac314] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h5 className="text-base font-bold text-neutral-900">Need a custom enterprise setup or hardware bundle?</h5>
              <p className="text-xs text-neutral-500 mt-0.5">We offer custom thermal printer setups, POS API webhooks, and multi-location discounts.</p>
            </div>
          </div>
          <Link
            to={targetLink}
            className="shrink-0 bg-white border border-neutral-300 hover:border-neutral-400 text-neutral-900 text-xs font-bold px-5 py-3 rounded-xl transition-colors"
          >
            Talk to an Expert
          </Link>
        </div>
      </div>
    </section>
  )
}