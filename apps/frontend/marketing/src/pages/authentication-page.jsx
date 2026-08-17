import React, { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Button } from "@repo/ui"
import { logoWhite } from "@repo/ui/assets"
import { Lock, Eye, EyeOff, Mail, KeyRound, AlertCircle, LoaderCircle, FingerprintIcon } from "lucide-react"
import { startAuthentication } from "@simplewebauthn/browser"
import { useAuth } from "../context/auth-context.jsx"
import { getPasskeyAuthOptionsApi, verifyPasskeyAuthApi } from "../services/auth-api.js"

export default function AuthenticationPage() {
  const navigate = useNavigate()
  const { login, register, loginWithGoogle, loginWithPasskey } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)
  const [error, setError] = useState("")

  // Initialize official Google Identity Services Account Picker
  useEffect(() => {
    const googleClientId =
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      "575269768989-jeoghehpiba7je6795fkdar80sc28q7h.apps.googleusercontent.com"

    const initGoogleGsi = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCallback,
          auto_select: false,
        })

        const googleBtnEl = document.getElementById("googleBtnContainer")
        if (googleBtnEl) {
          googleBtnEl.innerHTML = "" // Clear previous instances
          window.google.accounts.id.renderButton(googleBtnEl, {
            theme: "filled_black",
            size: "large",
            width: "100%",
            text: "continue_with",
            shape: "pill",
          })
        }
      }
    }

    if (window.google?.accounts?.id) {
      initGoogleGsi()
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval)
          initGoogleGsi()
        }
      }, 300)
      return () => clearInterval(interval)
    }
  }, [])

  // Callback executed when user selects a Google Account from Google's official popup
  const handleGoogleCallback = async (response) => {
    setError("")
    setIsGoogleLoading(true)

    try {
      if (!response?.credential) {
        throw new Error("No credential returned from Google account selector.")
      }

      // Decode base64 JWT payload from Google GSI response
      const base64Url = response.credential.split(".")[1]
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      )
      const payload = JSON.parse(jsonPayload)

      if (!payload?.email) {
        throw new Error("Google account email could not be retrieved.")
      }

      // Authenticate account with exact real Google credentials
      await loginWithGoogle({
        email: payload.email,
        name: payload.name || payload.email.split("@")[0],
        avatar: payload.picture || null,
        googleId: payload.sub,
        role: "OWNER",
      })

      navigate("/onboarding")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google Sign-In failed. Please try again.")
    } finally {
      setIsGoogleLoading(false)
    }
  }

  // Trigger Google Account Picker Popup manually
  const triggerGooglePrompt = () => {
    setError("")
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // If One Tap is blocked, render button container click
          const googleBtn = document.querySelector("#googleBtnContainer div[role=button]")
          if (googleBtn) {
            googleBtn.click()
          }
        }
      })
    } else {
      setError("Google Sign-In services loading... Please try again in a moment.")
    }
  }

  // Automatic seamless authentication handler (Login -> Fallback Register behind the scenes)
  const handleAuthenticate = async (e) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      try {
        await login({ email, password })
      } catch (loginErr) {
        const nameFromEmail = email.split("@")[0].replace(/[._-]/g, " ")
        const formattedName = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1)

        await register({
          name: formattedName || "Restaurant Owner",
          email,
          password,
          role: "OWNER",
        })
      }

      navigate("/onboarding")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please check your details.")
    } finally {
      setIsLoading(false)
    }
  }

  // WebAuthn Passkey Biometric Login
  const handlePasskeyAuth = async () => {
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
      navigate("/onboarding")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passkey authentication failed or was cancelled.")
    } finally {
      setIsPasskeyLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 grid md:grid-cols-[.6fr_1fr] p-4 relative font-sans">
      {/* Left Form Container - Matching Admin authentication page UI */}
      <div className="bg-zinc-800 rounded-l-3xl border-y-2 border-l-2 border-zinc-700 flex justify-center items-center">
        <div className="max-w-xl mx-auto p-8 w-full">
          {/* Header & Logo */}
          <div className="space-y-2 mb-6">
            <Link to="/" className="py-3.5 flex flex-row items-center gap-3 group">
              <img src={logoWhite} alt="Scan My Order" className="h-8 w-auto object-contain" />
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-semibold text-white group-hover:text-zinc-200 transition-colors">Scan My Order</span>
                <span className="truncate text-[10px] text-zinc-400">Partner Portal</span>
              </div>
            </Link>

            <div className="pt-2">
              <h1 className="text-2xl font-semibold text-white tracking-tight mb-2">
                Authentication
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-light">
                Select your account or enter your credentials to authenticate and start restaurant onboarding.
              </p>
            </div>
          </div>

          <form onSubmit={handleAuthenticate} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}

            {/* Stacked Input Container */}
            <div className="flex flex-col w-full overflow-hidden rounded-3xl border border-zinc-700">
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-zinc-300 transition-colors pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  placeholder="owner@restaurant.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-4 bg-white/10 placeholder:text-zinc-400 text-white focus:bg-white/15 transition-colors outline-none text-xs sm:text-sm"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="h-px bg-zinc-700" />

              <div className="relative group">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-zinc-300 transition-colors pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-4 bg-white/10 placeholder:text-zinc-400 text-white focus:bg-white/15 transition-colors outline-none text-xs sm:text-sm"
                  required
                  autoComplete="current-password"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid md:grid-cols-2 gap-3">
              <Button
                type="submit"
                disabled={isLoading || isGoogleLoading || isPasskeyLoading}
              >
                {isLoading ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin mr-2 inline" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2 inline" />
                    Authenticate & Continue
                  </>
                )}
              </Button>

              {/* Official Google Account Picker Container */}
              <div id="googleBtnContainer" className="w-full min-h-11"></div>

            </div>
            <div className="w-full h-px bg-zinc-50/10 my-6 flex justify-center items-center text-center">
              <span className="text-xs py-1.5 px-3 bg-zinc-50/10 backdrop-blur-3xl rounded-full text-zinc-50">OR</span>
            </div>
            {/* Biometric Passkey Option */}
              <Button
                variant="link"
                type="button"
                onClick={handlePasskeyAuth}
                disabled={isLoading || isGoogleLoading || isPasskeyLoading}
                className="w-full text-zinc-400 hover:text-white text-xs gap-2 py-2"
              >
                {isPasskeyLoading ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Authenticating Passkey...
                  </>
                ) : (
                  <>
                    <FingerprintIcon className="h-4 w-4 text-amber-400" /> Authenticate with Fingerprint
                  </>
                )}
              </Button>
          </form>

          <div className="mt-6 text-[11px] text-zinc-400 max-w-xl font-light">
            By authenticating, you agree to our Terms of Service and Privacy Policy. Restaurant onboarding submissions undergo instant verification.
          </div>
        </div>
      </div>

      {/* Right Column Cover Image - Matching Admin auth layout */}
      <div className="bg-zinc-900 rounded-r-3xl border-y-2 border-r-2 border-zinc-700 overflow-hidden relative h-full">
        <img
          src="https://i.pinimg.com/736x/03/0c/68/030c6816f5519507f72f40ddeb7229b7.jpg"
          alt="Scan My Order Restaurant Operations"
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  )
}
