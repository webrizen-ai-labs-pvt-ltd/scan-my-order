import React, { createContext, useContext, useState, useEffect } from "react"
import { loginApi, registerApi, googleAuthApi, fetchCurrentUserApi, logoutApi } from "../services/auth-api.js"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("smo_marketing_user")
      return savedUser ? JSON.parse(savedUser) : null
    } catch {
      return null
    }
  })

  const [token, setToken] = useState(() => {
    return localStorage.getItem("smo_marketing_token") || null
  })

  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function verifyAuth() {
      if (token) {
        try {
          const res = await fetchCurrentUserApi(token)
          if (res?.data) {
            setUser(res.data)
            localStorage.setItem("smo_marketing_user", JSON.stringify(res.data))
          }
        } catch {
          logout()
        }
      }
      setIsLoading(false)
    }

    verifyAuth()
  }, [token])

  const login = async (credentials) => {
    const res = await loginApi(credentials)
    if (res?.data?.token) {
      const authToken = res.data.token
      const userData = res.data.user
      setToken(authToken)
      setUser(userData)
      localStorage.setItem("smo_marketing_token", authToken)
      localStorage.setItem("smo_marketing_user", JSON.stringify(userData))
      return res.data
    }
    throw new Error("Invalid response from server.")
  }

  const register = async (userData) => {
    const res = await registerApi(userData)
    if (res?.data?.token) {
      const authToken = res.data.token
      const userPayload = res.data.user
      setToken(authToken)
      setUser(userPayload)
      localStorage.setItem("smo_marketing_token", authToken)
      localStorage.setItem("smo_marketing_user", JSON.stringify(userPayload))
      return res.data
    }
    throw new Error("Invalid registration response from server.")
  }

  const loginWithGoogle = async (googlePayload) => {
    const res = await googleAuthApi(googlePayload)
    if (res?.data?.token) {
      const authToken = res.data.token
      const userPayload = res.data.user
      setToken(authToken)
      setUser(userPayload)
      localStorage.setItem("smo_marketing_token", authToken)
      localStorage.setItem("smo_marketing_user", JSON.stringify(userPayload))
      return res.data
    }
    throw new Error("Invalid Google sign-in response from server.")
  }

  const loginWithPasskey = async (authData) => {
    if (authData?.token && authData?.user) {
      setToken(authData.token)
      setUser(authData.user)
      localStorage.setItem("smo_marketing_token", authData.token)
      localStorage.setItem("smo_marketing_user", JSON.stringify(authData.user))
      return authData
    }
    throw new Error("Invalid passkey login response.")
  }

  const logout = async () => {
    try {
      if (token) {
        await logoutApi(token).catch((err) => {
          console.warn("Backend logout request error (continuing client cleanup):", err)
        })
      }
    } finally {
      // Disable Google GSI One Tap auto-select if active
      if (typeof window !== "undefined" && window.google?.accounts?.id?.disableAutoSelect) {
        try {
          window.google.accounts.id.disableAutoSelect()
        } catch {
          // Ignore GSI script error
        }
      }

      // Clear React auth states
      setToken(null)
      setUser(null)

      // Purge local storage & session tokens
      localStorage.removeItem("smo_marketing_token")
      localStorage.removeItem("smo_marketing_user")
      sessionStorage.removeItem("smo_marketing_token")
      sessionStorage.removeItem("smo_marketing_user")
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        register,
        loginWithGoogle,
        loginWithPasskey,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
