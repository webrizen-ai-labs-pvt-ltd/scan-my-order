import React, { useState } from "react"
import { ChevronDown, HelpCircle, Sparkles } from "lucide-react"

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0)

  const faqs = [
    {
      q: "Do I need to purchase dedicated POS hardware or tablets?",
      a: "No special hardware required! Scan My Order runs on any modern web browser across iPads, Android tablets, laptops, smartphones, or desktop POS terminals.",
    },
    {
      q: "How does the PhonePe payment gateway integration work?",
      a: "Scan My Order integrates directly with PhonePe PG Sandbox & Production APIs. When customers scan their table QR code and complete payment via UPI/Cards, funds are verified automatically in real-time and settled into your account.",
    },
    {
      q: "What is Tatkal Rush Mode and how does it help during rush hours?",
      a: "Tatkal Rush Mode is a one-click operational queue toggle. During sudden lunch or dinner surges, it enforces a strict First-Come, First-Served order token queue so your kitchen staff can prep orders in chronological order without getting overwhelmed.",
    },
    {
      q: "How does waiter approval prevent unpaid or fake orders?",
      a: "For postpaid dining, guests submit orders via QR code, but cooking tickets are not sent to the Kitchen Display System (KDS) until a waiter verifies the order on their handheld screen.",
    },
    {
      q: "Is there any long-term contract or setup fee?",
      a: "No long-term lock-in! All subscriptions are pay-as-you-go. You can upgrade, downgrade, or cancel your plan anytime from your Operations dashboard.",
    },
    {
      q: "How long does it take to get our restaurant onboarded?",
      a: "You can be live with digital QR menus and POS billing in less than 24 hours. Our onboarding team helps you upload menu items, configure dining tables, and link payment gateways in minutes.",
    },
  ]

  const toggleFaq = (index) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section id="faq" className="py-20 bg-zinc-950 border-t border-zinc-900 relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Support & FAQs
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-100">
            Frequently Asked <span className="text-transparent bg-clip-text bg-linear-to-r from-yellow-400 to-amber-500">Questions</span>
          </h2>
          <p className="text-zinc-400 text-base md:text-lg font-light leading-relaxed">
            Everything you need to know about setting up ScanMyOrder for your restaurant floor.
          </p>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx
            return (
              <div
                key={idx}
                className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                >
                  <span className="text-base font-bold text-zinc-100 flex items-center gap-3">
                    <HelpCircle className="w-5 h-5 text-amber-400 shrink-0" />
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-zinc-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-amber-400" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-0 border-t border-zinc-800/60 text-xs sm:text-sm text-zinc-400 leading-relaxed font-light pl-14">
                    {faq.a}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
