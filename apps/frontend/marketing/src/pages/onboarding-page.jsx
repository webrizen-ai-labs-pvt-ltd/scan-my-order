import React, { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import {
  User,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Building2,
  Palette,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  LogOut,
} from "lucide-react"
import { useAuth } from "../context/auth-context.jsx"
import { onboardStoreApi, fetchMyStoreApi } from "../services/auth-api.js"
import { logoWhite } from "@repo/ui/assets";
import { Button } from "@repo/ui"

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { user, token, isAuthenticated, isLoading: authLoading, logout } = useAuth()

  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState("")

  const [formData, setFormData] = useState(() => {
    const savedUserStr = localStorage.getItem("smo_marketing_user")
    const savedUser = savedUserStr ? JSON.parse(savedUserStr) : null
    const initialUser = user || savedUser

    return {
      name: "",
      description: "",
      cuisineType: "Multi-Cuisine",
      address: "",
      contactPhone: "",
      operatingHours: "10:00 AM - 11:00 PM",
      ownerName: initialUser?.name || "",
      ownerEmail: initialUser?.email || "",
      ownerPhone: initialUser?.phone || "",
      ownerRole: "OWNER",
      tableCount: "10",
      colorScheme: "zinc",
      fontStyle: "inter",
      brandingLogo: "",
    }
  })

  const [existingStore, setExistingStore] = useState(null)
  const [isCheckingStore, setIsCheckingStore] = useState(true)

  // Check if current user already has a store registered
  useEffect(() => {
    let isMounted = true
    const checkExistingStore = async () => {
      if (token) {
        try {
          const res = await fetchMyStoreApi(token)
          if (isMounted && res?.data && res.data.id) {
            setExistingStore(res.data)
            setIsSubmitted(true)
          }
        } catch (err) {
          console.warn("Failed to check existing store:", err)
        } finally {
          if (isMounted) setIsCheckingStore(false)
        }
      } else {
        if (isMounted) setIsCheckingStore(false)
      }
    }
    checkExistingStore()
    return () => {
      isMounted = false
    }
  }, [token])

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        ownerName: user.name || prev.ownerName,
        ownerEmail: user.email || prev.ownerEmail,
        ownerPhone: user.phone || prev.ownerPhone,
      }))
    }
  }, [user])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/authentication")
    }
  }, [authLoading, isAuthenticated, navigate])

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleNextStep = (e) => {
    e.preventDefault()
    setError("")
    if (currentStep === 1 && !formData.name.trim()) {
      setError("Please enter your restaurant name.")
      return
    }
    if (currentStep === 2 && (!formData.ownerName.trim() || !formData.ownerEmail.trim())) {
      setError("Please fill in owner name and email.")
      return
    }
    if (currentStep < 4) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handlePrevStep = () => {
    setError("")
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleFinalSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      if (!token) {
        throw new Error("Authentication token missing. Please sign in again.")
      }

      await onboardStoreApi(token, formData)
      setIsSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit store onboarding details. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading || isCheckingStore) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 gap-3">
        <LoaderCircle className="w-8 h-8 animate-spin text-zinc-300" />
        <p className="text-sm font-light">Verifying store registration status...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans relative">
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 border-b border-zinc-800 mb-8">
        <Link to="/" className="flex items-center gap-3">
          <img src={logoWhite} alt="Scan My Order" className="h-7 w-auto" />
          <span className="text-sm font-semibold text-white">Scan My Order</span>
        </Link>
        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-zinc-900 rounded-full border border-zinc-800 text-xs text-zinc-300">
              <User className="w-3.5 h-3.5 text-zinc-400" />
              <span className="max-w-[150px] truncate">{user.email || user.name}</span>
            </div>
          )}
          <Button
            onClick={() => {
              logout()
              navigate("/authentication")
            }}
            title="Logout of account"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </Button>
        </div>
      </div>

      <main className="max-w-3xl mx-auto w-full my-auto py-4">
        {isSubmitted ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 sm:p-12 text-center space-y-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-transparent via-emerald-400 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.03),transparent_70%)] pointer-events-none" />

            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-4 max-w-lg mx-auto">
                <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Application Received
                </span>

                <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                  {existingStore?.name ? `${existingStore.name} is Onboarded!` : "Onboarding Submitted Successfully!"}
                </h2>

                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 text-zinc-400 text-sm sm:text-base leading-relaxed font-light text-center">
                  "Thank you for onboarding! Our team is currently verifying your details. We will get back to you shortly."
                </div>
              </div>

              <div className="mt-8 p-6 rounded-2xl bg-zinc-950/60 border border-zinc-800">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    {existingStore?.name ? `Store Registered (${existingStore._count?.tables || 10} Tables)` : "Operations Dashboard"}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono uppercase border border-emerald-500/30">
                    Active Verification
                  </span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed max-w-sm mx-auto">
                  {existingStore?.name
                    ? `Store details for "${existingStore.name}" are safely stored in our system.`
                    : "Your operations dashboard is being provisioned. You'll receive an email notification once it's ready to access."}
                </p>
              </div>

              <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/"
                  className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-sm transition-all flex items-center justify-center gap-2 hover:gap-3"
                >
                  Return to Home <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => logout()}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-10 space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
                <span>Step {currentStep} of 4</span>
                <span className="text-zinc-200 font-bold">
                  {currentStep === 1 && "Restaurant Details"}
                  {currentStep === 2 && "Owner Details"}
                  {currentStep === 3 && "Branding & Seating"}
                  {currentStep === 4 && "Review & Submit"}
                </span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-zinc-300 transition-all duration-300 rounded-full"
                  style={{ width: `${(currentStep / 4) * 100}%` }}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-zinc-300" /> Restaurant Information
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1 font-light">
                    Enter basic details about your dining outlet or cafe.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Restaurant Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Spice Garden Bistro"
                      value={formData.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      className="w-full px-4 py-3 bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Cuisine Type</label>
                      <input
                        type="text"
                        placeholder="e.g. Italian, Indian, Cafe"
                        value={formData.cuisineType}
                        onChange={(e) => handleChange("cuisineType", e.target.value)}
                        className="w-full px-4 py-3 bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Operating Hours</label>
                      <input
                        type="text"
                        placeholder="e.g. 10:00 AM - 11:00 PM"
                        value={formData.operatingHours}
                        onChange={(e) => handleChange("operatingHours", e.target.value)}
                        className="w-full px-4 py-3 bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Outlet Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 123 Commercial Street, Indiranagar, Bengaluru"
                      value={formData.address}
                      onChange={(e) => handleChange("address", e.target.value)}
                      className="w-full px-4 py-3 bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Restaurant Description</label>
                    <textarea
                      placeholder="Brief overview of your menu, vibe, and specialties..."
                      value={formData.description}
                      onChange={(e) => handleChange("description", e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600 resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <User className="w-5 h-5 text-zinc-300" /> Owner Details
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1 font-light">
                    Provide contact information for the store owner or primary manager.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Owner Full Name *</label>
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={formData.ownerName}
                        onChange={(e) => handleChange("ownerName", e.target.value)}
                        className="w-full px-4 py-3 bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Owner Email *</label>
                      <input
                        type="email"
                        placeholder="owner@restaurant.com"
                        value={formData.ownerEmail}
                        onChange={(e) => handleChange("ownerEmail", e.target.value)}
                        className="w-full px-4 py-3 bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Phone Number</label>
                      <input
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={formData.ownerPhone}
                        onChange={(e) => handleChange("ownerPhone", e.target.value)}
                        className="w-full px-4 py-3 bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                        <span>Role Designation</span>
                        <span className="text-[10px] text-zinc-500 font-mono">FIXED (OWNER)</span>
                      </label>
                      <input
                        type="text"
                        value="OWNER"
                        readOnly
                        disabled
                        className="w-full px-4 py-3 bg-zinc-900/60 border-0 border-b-2 border-zinc-800 text-amber-400 font-mono text-sm cursor-not-allowed outline-none select-none opacity-80"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Palette className="w-5 h-5 text-zinc-300" /> Branding & Seating
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1 font-light">
                    Set up dining table count and digital menu branding.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Initial Dining Table Count</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="10"
                        value={formData.tableCount}
                        onChange={(e) => handleChange("tableCount", e.target.value)}
                        className="w-full px-4 py-3 bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Brand Color Theme</label>
                      <select
                        value={formData.colorScheme}
                        onChange={(e) => handleChange("colorScheme", e.target.value)}
                        className="w-full px-4 py-3 bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base focus:border-zinc-400 outline-none transition-colors cursor-pointer"
                      >
                        <option value="zinc" className="bg-zinc-900">Zinc / Minimal</option>
                        <option value="emerald" className="bg-zinc-900">Emerald Green</option>
                        <option value="rose" className="bg-zinc-900">Rose / Coral</option>
                        <option value="indigo" className="bg-zinc-900">Indigo Blue</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Logo URL (Optional)</label>
                    <input
                      type="url"
                      placeholder="https://example.com/logo.png"
                      value={formData.brandingLogo}
                      onChange={(e) => handleChange("brandingLogo", e.target.value)}
                      className="w-full px-4 py-3 bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-zinc-300" /> Review Onboarding Details
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1 font-light">
                    Verify your restaurant details before submitting for official verification.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Restaurant Info</span>
                    <p className="text-sm font-bold text-white">{formData.name || "N/A"}</p>
                    <p className="text-xs text-zinc-500">Cuisine: {formData.cuisineType}</p>
                    <p className="text-xs text-zinc-500">Hours: {formData.operatingHours}</p>
                    <p className="text-xs text-zinc-500 truncate">Address: {formData.address || "Not specified"}</p>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Owner Info</span>
                    <p className="text-sm font-bold text-white">{formData.ownerName || "N/A"}</p>
                    <p className="text-xs text-zinc-500">Email: {formData.ownerEmail}</p>
                    <p className="text-xs text-zinc-500">Phone: {formData.ownerPhone || "Not specified"}</p>
                    <p className="text-xs text-zinc-500">Role: {formData.ownerRole}</p>
                  </div>
                </div>

                <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-4 flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-zinc-300 shrink-0" />
                  <p className="text-xs text-zinc-400 font-light leading-relaxed">
                    Submitting will generate your store database record and initialize <b>{formData.tableCount} QR Dining Tables</b> automatically.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-5 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-6 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer"
                >
                  Next Step <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                  className="px-7 py-3 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <LoaderCircle className="w-4 h-4 animate-spin" /> Submitting Details...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Submit Onboarding Application
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-4xl mx-auto w-full text-center py-4 border-t border-zinc-800 mt-8 text-xs text-zinc-500 font-light">
        © {new Date().getFullYear()} Scan My Order • Webrizen AI Labs. All Rights Reserved.
      </footer>
    </div>
  )
}