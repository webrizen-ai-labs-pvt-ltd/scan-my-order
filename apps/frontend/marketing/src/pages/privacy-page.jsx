import React from "react"

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8 text-slate-300">
      <div className="border-b border-slate-800 pb-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Privacy Policy</h1>
        <p className="text-xs text-amber-400 mt-2">Last Updated: August 16, 2026 • Webrizen AI Labs Pvt Ltd</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">1. Introduction</h2>
        <p className="text-sm leading-relaxed">
          Webrizen AI Labs Pvt Ltd ("Company", "we", "our", or "us") operates the Scan My Order platform, including our point-of-sale systems, QR menu rendering engine, and associated applications. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or utilize our restaurant technology services.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">2. Information We Collect</h2>
        <p className="text-sm leading-relaxed">
          We collect personal and operational data necessary to process dining orders, maintain staff authentication, and handle subscription billing:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li><strong>Restaurant Merchant Data:</strong> Business name, store address, contact email, phone number, menu items, prices, and PhonePe subscription billing credentials.</li>
          <li><strong>Staff Authentication Credentials:</strong> Username, role assignments (Owner, Manager, Waiter, Kitchen), hashed passwords, and WebAuthn passkey public keys.</li>
          <li><strong>Diner Order Data:</strong> Table numbers, order items, modifier selections, timestamps, and payment transaction IDs processed through integrated payment gateways.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">3. How We Use Your Information</h2>
        <p className="text-sm leading-relaxed">
          We use collected information to:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>Dispatch customer table orders to kitchen displays (KDS) and POS terminals in sub-second latency.</li>
          <li>Process subscription billing and payouts via PhonePe PG.</li>
          <li>Monitor platform performance, security threats, and system uptime.</li>
          <li>Provide customer support and software updates.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">4. Data Security & Storage</h2>
        <p className="text-sm leading-relaxed">
          We enforce industry-standard security safeguards including TLS 1.3 transport encryption, password hashing via bcrypt, WebAuthn cryptographic authentication, and strict multi-tenant database isolation.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">5. Contact Us</h2>
        <p className="text-sm leading-relaxed">
          If you have questions about this Privacy Policy, please contact our Data Protection Officer at <strong>privacy@webrizen.ai</strong>.
        </p>
      </section>
    </div>
  )
}
