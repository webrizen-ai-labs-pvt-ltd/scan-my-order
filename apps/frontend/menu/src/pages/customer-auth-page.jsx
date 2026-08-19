import React, { useState, useEffect } from "react"
import { useNavigate, useSearchParams, Link } from "react-router-dom"
import { Button } from "@repo/ui"
import { logoWhite } from "@repo/ui/assets"
import { AlertCircle, LoaderCircle, FingerprintIcon } from "lucide-react"
import { startAuthentication } from "@simplewebauthn/browser"

const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(/\/$/, "")

async function authApiRequest(endpoint, body) {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (res.ok) return data
  throw new Error(data?.message || data?.error || "Authentication failed")
}

function parseJwtPayload(token) {
  try {
    const base64Url = token.split(".")[1]
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
    return JSON.parse(jsonPayload)
  } catch (e) {
    return null
  }
}

export default function CustomerAuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectUrl = searchParams.get("redirect") || "/"

  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)
  const [error, setError] = useState("")

  // Dynamically load Google GSI SDK script
  useEffect(() => {
    if (!document.getElementById("google-gsi-script")) {
      const script = document.createElement("script")
      script.id = "google-gsi-script"
      script.src = "https://accounts.google.com/gsi/client"
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  }, [])

  // Process completed Google authentication
  const processGooglePayload = async (googlePayload) => {
    setIsGoogleLoading(true)
    setError("")

    try {
      const res = await authApiRequest("/auth/google", {
        email: googlePayload.email,
        name: googlePayload.name || googlePayload.email.split("@")[0],
        avatar: googlePayload.avatar || null,
        googleId: googlePayload.googleId || `google_${Date.now()}`,
        role: "CUSTOMER", // Ensures user is automatically registered as CUSTOMER enum
      })

      if (res?.data?.token) {
        localStorage.setItem("customer_token", res.data.token)
        localStorage.setItem("customer_user", JSON.stringify(res.data.user))
        navigate(redirectUrl)
      } else {
        throw new Error("Invalid authentication response received from server")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google authentication failed.")
    } finally {
      setIsGoogleLoading(false)
    }
  }

  // Check URL hash for OAuth redirect token response
  useEffect(() => {
    if (window.location.hash) {
      const params = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = params.get("access_token")
      const idToken = params.get("id_token")

      if (accessToken) {
        setIsGoogleLoading(true)
        fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
          .then((res) => res.json())
          .then((userInfo) => {
            if (userInfo?.email) {
              processGooglePayload({
                email: userInfo.email,
                name: userInfo.name || userInfo.given_name,
                avatar: userInfo.picture,
                googleId: userInfo.sub,
              })
            }
          })
          .catch((err) => console.error("Google OAuth token callback error:", err))
          .finally(() => setIsGoogleLoading(false))
      } else if (idToken) {
        const decoded = parseJwtPayload(idToken)
        if (decoded?.email) {
          processGooglePayload({
            email: decoded.email,
            name: decoded.name || decoded.given_name,
            avatar: decoded.picture,
            googleId: decoded.sub,
          })
        }
      }
    }
  }, [])

  // Official Google OAuth Popup & One-Tap Redirect
  const handleGoogleAuth = () => {
    setError("")
    setIsGoogleLoading(true)

    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "1086208638974-placeholder.apps.googleusercontent.com"

    // 1. Try Google GSI OAuth2 Token Client Popup
    if (window.google?.accounts?.oauth2) {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
          callback: async (response) => {
            if (response.access_token) {
              try {
                const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                  headers: { Authorization: `Bearer ${response.access_token}` },
                })
                const userInfo = await userInfoRes.json()
                if (userInfo?.email) {
                  await processGooglePayload({
                    email: userInfo.email,
                    name: userInfo.name || userInfo.given_name,
                    avatar: userInfo.picture,
                    googleId: userInfo.sub,
                  })
                  return
                }
              } catch (err) {
                console.error("Failed to fetch Google user info:", err)
              }
            }
            setIsGoogleLoading(false)
          },
        })
        tokenClient.requestAccessToken()
        return
      } catch (err) {
        console.warn("GSI token client error:", err)
      }
    }

    // 2. Try Google GSI ID One-Tap
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response) => {
            if (response.credential) {
              const decoded = parseJwtPayload(response.credential)
              if (decoded?.email) {
                processGooglePayload({
                  email: decoded.email,
                  name: decoded.name || decoded.given_name,
                  avatar: decoded.picture,
                  googleId: decoded.sub,
                })
                return
              }
            }
            setIsGoogleLoading(false)
          },
        })
        window.google.accounts.id.prompt()
        return
      } catch (err) {
        console.warn("GSI id prompt error:", err)
      }
    }

    // 3. Fallback to Official Google OAuth 2.0 Popup Window Redirect
    const redirectUri = window.location.origin + window.location.pathname
    const scope = encodeURIComponent("openid email profile")
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&response_type=token&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}`

    const width = 500
    const height = 600
    const left = window.screen.width / 2 - width / 2
    const top = window.screen.height / 2 - height / 2

    const popup = window.open(authUrl, "GoogleSignInPopup", `width=${width},height=${height},top=${top},left=${left}`)

    if (!popup) {
      window.location.href = authUrl
    } else {
      setIsGoogleLoading(false)
    }
  }

  // Handle Biometric / Fingerprint / WebAuthn Passkey Login
  const handlePasskeyAuth = async () => {
    setError("")
    setIsPasskeyLoading(true)

    try {
      const optionsRes = await authApiRequest("/auth/passkey/authenticate-options", {})
      const authData = optionsRes?.data

      if (!authData || !authData.options) {
        throw new Error("Failed to generate passkey authentication options.")
      }

      const credential = await startAuthentication(authData.options)
      const verifyRes = await authApiRequest("/auth/passkey/authenticate-verify", {
        credential,
        expectedChallenge: authData.challengeKey,
      })

      if (!verifyRes?.data?.token) {
        throw new Error("Passkey authentication failed.")
      }

      localStorage.setItem("customer_token", verifyRes.data.token)
      localStorage.setItem("customer_user", JSON.stringify(verifyRes.data.user))
      navigate(redirectUrl)
    } catch (err) {
      console.error("Passkey authentication error:", err)
      const errMsg = err instanceof Error ? err.message : "Passkey authentication failed."
      
      if (errMsg.includes("Passkey not registered") || errMsg.includes("404") || errMsg.includes("User not found")) {
        setError("No registered biometric passkey found on this device. Please sign in with Google first to pair your passkey.")
      } else {
        setError(errMsg)
      }
    } finally {
      setIsPasskeyLoading(false)
    }
  }

  return (
    <div
      className="h-screen bg-zinc-950 grid md:grid-cols-[.6fr_1fr] p-4 relative"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* Left Container matching Admin panel layout */}
      <div className="bg-zinc-800 rounded-l-3xl border-y-2 border-l-2 border-zinc-700 flex justify-center items-center">
        <div className="max-w-xl mx-auto p-8 w-full">
          <div className="space-y-2 mb-6">
            <Link to="/" className="flex flex-row items-start gap-2">
              <img src={logoWhite} alt="Scan My Order" className="h-8" />
              <div className="flex flex-col">
                <span className="text-white">Scan My Order</span>
                <span className="text-white/50 text-[10px] leading-1">It's better than paper</span>
              </div>
            </Link>

            <div className="pt-2">
              <h1 className="text-xl font-normal text-white tracking-tight mb-2">
                Customer Sign In
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Sign in with Google or Biometric Passkey to place prepaid orders and track real-time kitchen status.
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-6">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons: Only Continue with Google or Passkey */}
          <div className="space-y-4 grid md:grid-cols-2">
            <Button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isGoogleLoading || isPasskeyLoading}
              className="w-full cursor-pointer"
            >
              {isGoogleLoading ? (
                <>
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  <span>Connecting Google...</span>
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              onClick={handlePasskeyAuth}
              disabled={isGoogleLoading || isPasskeyLoading}
              variant="link"
              className="w-full cursor-pointer"
            >
              {isPasskeyLoading ? (
                <>
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  <span>Verifying Passkey...</span>
                </>
              ) : (
                <>
                  <FingerprintIcon className="h-5 w-5 text-amber-400" />
                  <span>Continue with Passkey</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Right Hero Image matching Admin layout */}
      <div className="hidden md:block bg-zinc-900 rounded-r-3xl border-y-2 border-r-2 border-zinc-700 overflow-hidden relative h-full">
        <img
          src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80"
          alt="Customer Dining Authentication"
          className="w-full h-full object-cover opacity-85"
        />
      </div>
    </div>
  )
}
