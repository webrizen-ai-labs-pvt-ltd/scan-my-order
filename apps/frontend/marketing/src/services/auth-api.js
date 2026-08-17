const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(/\/$/, "")

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      const errorMessage = data?.error || data?.message || `HTTP Request failed with status ${res.status}`
      throw new Error(errorMessage)
    }

    return data
  } catch (err) {
    if (err instanceof Error) {
      throw err
    }
    throw new Error("Network request failed. Please check your connection.")
  }
}

export async function loginApi(credentials) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  })
}

export async function registerApi(userData) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      ...userData,
      role: userData.role || "OWNER",
    }),
  })
}

export async function googleAuthApi(payload) {
  return request("/auth/google", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      role: payload.role || "OWNER",
    }),
  })
}

export async function fetchCurrentUserApi(token) {
  return request("/users/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function getPasskeyAuthOptionsApi(email) {
  return request("/auth/passkey/authenticate-options", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

export async function verifyPasskeyAuthApi(payload) {
  return request("/auth/passkey/authenticate-verify", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function onboardStoreApi(token, storeData) {
  return request("/stores/onboard", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(storeData),
  })
}

export async function fetchMyStoreApi(token) {
  if (!token) return { data: null }
  return request("/stores/my-store", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function logoutApi(token) {
  if (!token) return { success: true }
  return request("/auth/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}
