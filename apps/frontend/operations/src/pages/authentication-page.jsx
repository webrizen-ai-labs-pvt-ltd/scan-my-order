import React, { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Button } from "@repo/ui"
import { logoWhite } from "@repo/ui/assets"
import { Lock, Eye, EyeOff, Mail, KeyRound, AlertCircle, LoaderCircle, FingerprintIcon } from "lucide-react"
import { startAuthentication } from "@simplewebauthn/browser"
import { useAuth } from "../context/auth-context.jsx"
import { getPasskeyAuthOptionsApi, verifyPasskeyAuthApi } from "../services/auth-api.js"

export default function AuthenticationPage() {
  const navigate = useNavigate()
  const { login, loginWithPasskey } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async (e) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      await login({ email, password })
      navigate("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasskeyLogin = async () => {
    setError("")
    setIsPasskeyLoading(true)

    try {
      const optionsRes = await getPasskeyAuthOptionsApi(email || undefined)
      const authData = optionsRes?.data

      if (!authData || !authData.options) {
        throw new Error("Failed to receive WebAuthn passkey options from server.")
      }

      const credential = await startAuthentication(authData.options)
      const verifyRes = await verifyPasskeyAuthApi({
        credential,
        expectedChallenge: authData.challengeKey,
      })

      if (!verifyRes?.data) {
        throw new Error("Passkey verification failed.")
      }

      await loginWithPasskey(verifyRes.data)
      navigate("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passkey authentication failed or was cancelled.")
    } finally {
      setIsPasskeyLoading(false)
    }
  }

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  return (
    <div className="h-screen bg-zinc-950 grid md:grid-cols-[.6fr_1fr] p-4 relative">
      <div className="bg-zinc-800 rounded-l-3xl border-y-2 border-l-2 border-zinc-700 flex justify-center items-center">
        <div className="max-w-xl mx-auto p-8 w-full">
          <div className="space-y-2 mb-6">
            <Link to="/" className="py-3.5 flex flex-row items-center gap-3 group">
              <img src={logoWhite} alt="Scan My Order Operations" className="h-8 w-auto object-contain" />
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-semibold text-white group-hover:text-zinc-200 transition-colors">Scan My Order</span>
                <span className="truncate text-[10px] text-amber-400">Operations OS</span>
              </div>
            </Link>

            <div className="pt-4">
              <h1 className="text-xl font-normal text-white tracking-tight mb-2">
                Store Operations Sign In
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Enter your credentials or use biometric passkey to access store POS, KDS, and live table order tracking.
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex flex-col w-full">
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-zinc-300 transition-colors pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  placeholder="owner@restaurant.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-4 bg-white/10 rounded-none rounded-t-3xl shadow-none placeholder:text-zinc-400 text-white focus:bg-white/15 transition-colors outline-none"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="h-px bg-zinc-600" />

              <div className="relative group">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-zinc-300 transition-colors pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-4 bg-white/10 rounded-none rounded-b-3xl shadow-none placeholder:text-zinc-400 text-white focus:bg-white/15 transition-colors outline-none"
                  required
                  autoComplete="current-password"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none"
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 items-center gap-2">
              <Button
                type="submit"
                disabled={isLoading || isPasskeyLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin"><LoaderCircle className="h-4 w-4" /></span>
                    Signing in...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Sign In to Operations
                  </>
                )}
              </Button>

              <Button
                variant="link"
                type="button"
                onClick={handlePasskeyLogin}
                disabled={isLoading || isPasskeyLoading}
                className="h-10 w-full text-zinc-300 hover:text-white gap-2"
              >
                {isPasskeyLoading ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <FingerprintIcon className="h-4 w-4" /> Continue with Fingerprint
                  </>
                )}
              </Button>
            </div>
          </form>

          <div className="mt-6 text-xs text-zinc-400 max-w-xl">
            <b>Important Notice:</b> Access restricted to Store Operations staff (Owner, Manager, Waiter, Kitchen).
          </div>
        </div>
      </div>
      <div className="bg-zinc-900 rounded-r-3xl border-y-2 border-r-2 border-zinc-700 overflow-hidden relative h-full">
        <img src="https://i.pinimg.com/1200x/bf/26/5b/bf265b13603377182db5e7fd0749a25f.jpg" alt="Operations Authentication" className="w-full h-full object-cover object-bottom" />
      </div>
    </div>
  )
}
