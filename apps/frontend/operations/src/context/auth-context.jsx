import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { loginApi, logoutApi } from "../services/auth-api.js"

const AUTH_TOKEN_KEY = "smo_operations_token"
const AUTH_USER_KEY = "smo_operations_user"
const ALLOWED_OPERATIONS_ROLES = ["OWNER", "MANAGER", "WAITER", "KITCHEN"]

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY))
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem(AUTH_USER_KEY)
    return cached ? JSON.parse(cached) : null
  })
  const [isLoading, setIsLoading] = useState(false)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token)
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY)
    }
  }, [token])

  useEffect(() => {
    if (user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(AUTH_USER_KEY)
    }
  }, [user])

  const login = useCallback(async ({ email, password }) => {
    setIsLoading(true)
    setAuthError(null)

    try {
      const res = await loginApi({ email, password })
      const { user: userData, token: userToken } = res?.data || {}

      if (!userData || !userToken) {
        throw new Error("Invalid response format from authentication server.")
      }

      if (!ALLOWED_OPERATIONS_ROLES.includes(userData.role)) {
        throw new Error(`Access restricted to Store Operations staff & owners. Your account role (${userData.role}) is not authorized here.`)
      }

      setToken(userToken)
      setUser(userData)
      return res
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed."
      setAuthError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loginWithPasskey = useCallback(async (authData) => {
    setIsLoading(true)
    setAuthError(null)

    try {
      const { user: userData, token: userToken } = authData || {}

      if (!userData || !userToken) {
        throw new Error("Invalid passkey authentication payload.")
      }

      if (!ALLOWED_OPERATIONS_ROLES.includes(userData.role)) {
        throw new Error(`Access restricted to Store Operations staff & owners. Your account role (${userData.role}) is not authorized here.`)
      }

      setToken(userToken)
      setUser(userData)
      return authData
    } catch (err) {
      const message = err instanceof Error ? err.message : "Passkey authentication failed."
      setAuthError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    if (token) {
      logoutApi(token).catch(() => ({}))
    }
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
    setToken(null)
    setUser(null)
    setAuthError(null)
  }, [token])

  const isAuthenticated = Boolean(token && user && ALLOWED_OPERATIONS_ROLES.includes(user.role))

  const value = {
    user,
    token,
    isAuthenticated,
    isLoading,
    authError,
    login,
    loginWithPasskey,
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
