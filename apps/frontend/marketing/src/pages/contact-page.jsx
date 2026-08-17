import React, { useState } from "react"
import { Mail, Phone, MapPin, Send, CheckCircle2, Sparkles, Clock } from "lucide-react"

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    restaurantName: "",
    outlets: "1",
    message: ""
  })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="space-y-16 py-12">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" /> Book a Personalized Demo
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
          Let’s Transform Your Dining Experience
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Have questions about onboarding your restaurant? Our specialist team will guide you through setup in under 24 hours.
        </p>
      </section>

      {/* Main Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          
          {/* Contact Details Column */}
          <div className="lg:col-span-2 space-y-8 bg-slate-900/60 p-8 rounded-3xl border border-slate-800">
            <h3 className="text-2xl font-bold text-white">Get in Touch</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Fill out the form and our product team will get back to you within 2 business hours.
            </p>

            <div className="space-y-6 pt-4 text-sm">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white">Email Us</h4>
                  <p className="text-slate-400 text-xs mt-0.5">sales@webrizen.ai • support@webrizen.ai</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white">Direct Sales Line</h4>
                  <p className="text-slate-400 text-xs mt-0.5">+91 (1800) 890-3420 (Mon - Sat, 9am - 8pm IST)</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white">Headquarters</h4>
                  <p className="text-slate-400 text-xs mt-0.5">Webrizen AI Labs Pvt Ltd, Tech Park Phase 2, India</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white">Fast Onboarding</h4>
                  <p className="text-slate-400 text-xs mt-0.5">Same-day QR menu generation and staff training</p>
                </div>
              </div>
            </div>
          </div>

          {/* Form Column */}
          <div className="lg:col-span-3 bg-slate-900 p-8 sm:p-10 rounded-3xl border border-slate-800 shadow-xl">
            {submitted ? (
              <div className="py-16 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-white">Demo Request Received!</h3>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                  Thank you, <strong>{formData.name}</strong>. An account specialist will contact you shortly at <strong>{formData.email}</strong> to set up your customized Scan My Order demo.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-4 px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
                >
                  Submit Another Request
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <h3 className="text-xl font-bold text-white">Schedule Your Platform Demo</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Your Full Name *</label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Email Address *</label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="rahul@restaurant.com"
                      className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Phone Number *</label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+91 98765 43210"
                      className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Restaurant / Business Name *</label>
                    <input
                      type="text"
                      name="restaurantName"
                      required
                      value={formData.restaurantName}
                      onChange={handleChange}
                      placeholder="The Royal Bistro"
                      className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Number of Outlets</label>
                  <select
                    name="outlets"
                    value={formData.outlets}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500"
                  >
                    <option value="1">1 Location (Single Outlet)</option>
                    <option value="2-5">2 to 5 Outlets</option>
                    <option value="6-15">6 to 15 Outlets</option>
                    <option value="15+">15+ Outlets (Enterprise Chain)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Tell Us About Your Requirements</label>
                  <textarea
                    name="message"
                    rows="4"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Tell us about your current POS setup, seating capacity, or specific features you need..."
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500 resize-none"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-base shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all"
                >
                  <Send className="w-5 h-5" /> Request Live Demo
                </button>
              </form>
            )}
          </div>

        </div>
      </section>
    </div>
  )
}
