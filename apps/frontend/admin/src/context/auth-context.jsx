import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { loginApi, fetchCurrentUserApi, logoutApi, updateProfileApi } from "../services/auth-api.js"

const AUTH_TOKEN_KEY = "scan_my_order_admin_token"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY) || null)
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  // Verify stored session token on initial mount
  useEffect(() => {
    let isMounted = true

    async function initAuth() {
      const storedToken = localStorage.getItem(AUTH_TOKEN_KEY)
      if (!storedToken) {
        if (isMounted) {
          setIsLoading(false)
        }
        return
      }

      try {
        const response = await fetchCurrentUserApi(storedToken)
        const userData = response?.data

        if (!userData || userData.role !== "ADMIN") {
          localStorage.removeItem(AUTH_TOKEN_KEY)
          if (isMounted) {
            setToken(null)
            setUser(null)
            if (userData && userData.role !== "ADMIN") {
              setAuthError("Access denied. Only system administrators can access the admin portal.")
            }
          }
        } else if (isMounted) {
          setUser(userData)
          setToken(storedToken)
          setAuthError(null)
        }
      } catch {
        localStorage.removeItem(AUTH_TOKEN_KEY)
        if (isMounted) {
          setToken(null)
          setUser(null)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    initAuth()

    return () => {
      isMounted = false
    }
  }, [])

  const login = useCallback(async (credentials) => {
    setIsLoading(true)
    setAuthError(null)

    try {
      const res = await loginApi(credentials)
      const userData = res?.data?.user
      const authToken = res?.data?.token

      if (!userData || !authToken) {
        throw new Error("Invalid response received from server.")
      }

      if (userData.role !== "ADMIN") {
        throw new Error("Access denied. Only system administrators can access the admin portal.")
      }

      localStorage.setItem(AUTH_TOKEN_KEY, authToken)
      setToken(authToken)
      setUser(userData)
      setIsLoading(false)
      return { success: true, user: userData }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed. Please try again."
      setAuthError(msg)
      setIsLoading(false)
      throw new Error(msg)
    }
  }, [])

  const loginWithPasskey = useCallback(async (payload) => {
    setIsLoading(true)
    setAuthError(null)

    try {
      const userData = payload?.user
      const authToken = payload?.token

      if (!userData || !authToken) {
        throw new Error("Invalid passkey response from server.")
      }

      if (userData.role !== "ADMIN") {
        throw new Error("Access denied. Only system administrators can access the admin portal.")
      }

      localStorage.setItem(AUTH_TOKEN_KEY, authToken)
      setToken(authToken)
      setUser(userData)
      setIsLoading(false)
      return { success: true, user: userData }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Passkey login failed."
      setAuthError(msg)
      setIsLoading(false)
      throw new Error(msg)
    }
  }, [])

  const updateProfile = useCallback(async (profileData) => {
    if (!token) throw new Error("Unauthenticated")
    const res = await updateProfileApi(token, profileData)
    if (res?.data) {
      setUser((prev) => ({ ...prev, ...res.data }))
    }
    return res
  }, [token])

  const logout = useCallback(async () => {
    if (token) {
      logoutApi(token).catch(() => ({}))
    }
    localStorage.removeItem(AUTH_TOKEN_KEY)
    setToken(null)
    setUser(null)
    setAuthError(null)
  }, [token])

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token && user && user.role === "ADMIN"),
    isLoading,
    authError,
    login,
    loginWithPasskey,
    updateProfile,
    logout,
    setAuthError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
