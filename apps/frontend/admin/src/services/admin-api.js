const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(/\/$/, "")

async function adminRequest(endpoint, token, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
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

export async function fetchUsersApi(token, { page = 1, limit = 10, search = "", role = "", status = "" } = {}) {
  const params = new URLSearchParams()
  if (page) params.append("page", String(page))
  if (limit) params.append("limit", String(limit))
  if (search) params.append("search", search)
  if (role && role !== "ALL") params.append("role", role)
  if (status && status !== "ALL") params.append("status", status)

  const queryString = params.toString()
  return adminRequest(`/admin/users${queryString ? `?${queryString}` : ""}`, token, {
    method: "GET",
  })
}

export async function fetchUserByIdApi(token, id) {
  return adminRequest(`/admin/users/${id}`, token, {
    method: "GET",
  })
}

export async function createUserApi(token, userData) {
  return adminRequest("/admin/users", token, {
    method: "POST",
    body: JSON.stringify(userData),
  })
}

export async function updateUserApi(token, id, userData) {
  return adminRequest(`/admin/users/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(userData),
  })
}

export async function deleteUserApi(token, id) {
  return adminRequest(`/admin/users/${id}`, token, {
    method: "DELETE",
  })
}

export async function updateUserRoleApi(token, id, role) {
  return adminRequest(`/admin/users/${id}/role`, token, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  })
}

export async function updateUserStatusApi(token, id, status) {
  return adminRequest(`/admin/users/${id}/status`, token, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
}

export async function fetchStoresApi(token) {
  return adminRequest("/admin/stores", token, {
    method: "GET",
  })
}

export async function fetchStoreByIdApi(token, id) {
  return adminRequest(`/admin/stores/${id}`, token, {
    method: "GET",
  })
}

export async function updateStoreApi(token, id, storeData) {
  return adminRequest(`/admin/stores/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(storeData),
  })
}

export async function deleteStoreApi(token, id) {
  return adminRequest(`/admin/stores/${id}`, token, {
    method: "DELETE",
  })
}

export async function onboardStoreApi(token, storeData) {
  return adminRequest("/admin/onboard-store", token, {
    method: "POST",
    body: JSON.stringify(storeData),
  })
}

export async function createMenuItemApi(token, storeId, itemData) {
  return adminRequest(`/admin/stores/${storeId}/menu`, token, {
    method: "POST",
    body: JSON.stringify(itemData),
  })
}

export async function updateMenuItemApi(token, storeId, itemId, itemData) {
  return adminRequest(`/admin/stores/${storeId}/menu/${itemId}`, token, {
    method: "PUT",
    body: JSON.stringify(itemData),
  })
}

export async function deleteMenuItemApi(token, storeId, itemId) {
  return adminRequest(`/admin/stores/${storeId}/menu/${itemId}`, token, {
    method: "DELETE",
  })
}

export async function toggleMenuItemAvailabilityApi(token, storeId, itemId) {
  return adminRequest(`/admin/stores/${storeId}/menu/${itemId}/availability`, token, {
    method: "PATCH",
  })
}
