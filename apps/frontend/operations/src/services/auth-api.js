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

export async function fetchCurrentUserApi(token) {
  return request("/users/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function updateProfileApi(token, profileData) {
  return request("/users/me", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(profileData),
  })
}

export async function changePasswordApi(token, passwordData) {
  return request("/users/me/password", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(passwordData),
  })
}

export async function forgotPasswordApi(email) {
  return request("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

export async function resetPasswordWithOtpApi(resetData) {
  return request("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(resetData),
  })
}

export async function getPasskeyRegisterOptionsApi(token) {
  return request("/auth/passkey/register-options", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function verifyPasskeyRegisterApi(token, payload) {
  return request("/auth/passkey/register-verify", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
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

export async function logoutApi(token) {
  return request("/auth/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => ({}))
}
