import React from "react"

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8 text-slate-300">
      <div className="border-b border-slate-800 pb-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Terms of Service</h1>
        <p className="text-xs text-amber-400 mt-2">Effective Date: August 16, 2026 • Webrizen AI Labs Pvt Ltd</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">1. Agreement to Terms</h2>
        <p className="text-sm leading-relaxed">
          By registering for or using Scan My Order, you agree to be bound by these Terms of Service. If you do not agree to these terms, you must not access or use our services.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">2. Merchant Responsibilities</h2>
        <p className="text-sm leading-relaxed">
          As a restaurant merchant, you are responsible for maintaining the confidentiality of your staff login credentials, accurately configuring menu pricing and taxes, and complying with all local food safety and liquor licensing regulations.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">3. Subscriptions & Billing</h2>
        <p className="text-sm leading-relaxed">
          Subscriptions are billed on a recurring monthly or annual basis depending on your selected tier. Billing is processed securely through PhonePe PG. You may cancel your subscription at any time prior to the next billing cycle.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">4. Service Availability & Support</h2>
        <p className="text-sm leading-relaxed">
          We strive to maintain 99.99% service availability for live POS and QR ordering systems. Scheduled maintenance windows will be communicated to merchant account owners in advance.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">5. Governing Law</h2>
        <p className="text-sm leading-relaxed">
          These terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law principles.
        </p>
      </section>
    </div>
  )
}
