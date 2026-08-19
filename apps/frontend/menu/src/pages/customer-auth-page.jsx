import React, { useState } from "react"
import { useNavigate, useSearchParams, Link } from "react-router-dom"
import { Button, Input, Card, CardTitle, CardDescription, Badge } from "@repo/ui"
import { logoWhite } from "@repo/ui/assets"
import { Lock, Eye, EyeOff, Mail, KeyRound, AlertCircle, LoaderCircle, User, ArrowLeft, CheckCircle2 } from "lucide-react"

const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(/\/$/, "")
const FALLBACK_API_URL = "http://127.0.0.1:8000/api"

async function authRequest(endpoint, body) {
  const primaryUrl = `${API_BASE_URL}${endpoint}`
  const fallbackUrl = `${FALLBACK_API_URL}${endpoint}`

  try {
    const res = await fetch(primaryUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (res.ok) return data
    throw new Error(data?.message || data?.error || "Authentication failed")
  } catch (err) {
    if (err instanceof Error && !err.message.includes("HTTP")) {
      const res = await fetch(fallbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) return data
      throw new Error(data?.message || data?.error || "Authentication failed")
    }
    throw err
  }
}

export default function CustomerAuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectUrl = searchParams.get("redirect") || "/"

  const [mode, setMode] = useState("login") // 'login' or 'register'
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      if (mode === "login") {
        const res = await authRequest("/auth/login", { email, password })
        if (res?.data?.token) {
          localStorage.setItem("customer_token", res.data.token)
          localStorage.setItem("customer_user", JSON.stringify(res.data.user))
          navigate(redirectUrl)
        }
      } else {
        // Register new customer account with role: "CUSTOMER"
        const res = await authRequest("/auth/register", {
          name,
          email,
          password,
          role: "CUSTOMER",
        })
        if (res?.data?.token) {
          localStorage.setItem("customer_token", res.data.token)
          localStorage.setItem("customer_user", JSON.stringify(res.data.user))
          navigate(redirectUrl)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen bg-zinc-950 grid md:grid-cols-[.6fr_1fr] p-4 relative"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* Left Form Container */}
      <div className="bg-zinc-900 rounded-2xl md:rounded-l-3xl md:rounded-r-none border border-zinc-800 flex flex-col justify-center items-center p-6 sm:p-10">
        <div className="max-w-md mx-auto w-full space-y-6">
          {/* Header & Back Link */}
          <div className="space-y-3">
            <Link to={redirectUrl} className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Return to Menu
            </Link>

            <div className="flex items-center gap-3 pt-2">
              <img src={logoWhite} alt="Scan My Order" className="h-8 w-auto object-contain" />
              <div>
                <span className="block text-sm font-bold text-white">Scan My Order</span>
                <span className="block text-[10px] text-amber-400 font-mono uppercase tracking-wider">Customer Portal</span>
              </div>
            </div>

            <div className="pt-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                {mode === "login" ? "Customer Sign In" : "Create Customer Account"}
              </h1>
              <p className="text-xs text-zinc-400 leading-relaxed mt-1">
                {mode === "login"
                  ? "Sign in to complete online prepaid orders and track your dining order status."
                  : "Register your customer account to place instant prepaid food orders."}
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); }}
              className={`py-2 rounded-lg font-bold transition-all ${
                mode === "login" ? "bg-white text-zinc-950" : "text-zinc-400 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode("register"); setError(""); }}
              className={`py-2 rounded-lg font-bold transition-all ${
                mode === "register" ? "bg-white text-zinc-950" : "text-zinc-400 hover:text-white"
              }`}
            >
              Register
            </button>
          </div>

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {mode === "register" && (
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-9 bg-zinc-950 border-zinc-800 text-white text-xs h-10"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Email Address *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 bg-zinc-950 border-zinc-800 text-white text-xs h-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Password *</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-9 bg-zinc-950 border-zinc-800 text-white text-xs h-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs h-11 gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Authenticating...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  {mode === "login" ? "Sign In & Continue" : "Create Account & Continue"}
                </>
              )}
            </Button>
          </form>

          <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
            By authenticating, your customer account role is assigned as <span className="text-amber-400 font-mono font-bold">CUSTOMER</span>.
          </p>
        </div>
      </div>

      {/* Right Hero Branding Image */}
      <div className="hidden md:block bg-zinc-900 rounded-r-3xl border-y-2 border-r-2 border-zinc-800 overflow-hidden relative h-full">
        <img
          src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80"
          alt="Restaurant Culinary Experience"
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-linear-to-t from-zinc-950 via-zinc-950/40 to-transparent p-12 flex flex-col justify-end">
          <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs w-max mb-3">
            Digital Dining OS
          </Badge>
          <h2 className="text-2xl font-bold text-white tracking-tight">Fast, Seamless Prepaid Dining Orders</h2>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-lg">
            Sign in to pay online directly from your table QR code, receive live kitchen status notifications, and enjoy your meal.
          </p>
        </div>
      </div>
    </div>
  )
}
