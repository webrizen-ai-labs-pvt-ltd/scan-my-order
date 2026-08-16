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

export async function fetchMenuItemsApi(token, storeId) {
  return request(`/stores/${storeId}/menu`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function createMenuItemApi(token, menuItemData) {
  const storeId = menuItemData.storeId
  return request(`/stores/${storeId}/menu`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(menuItemData),
  })
}

export async function updateMenuItemApi(token, itemId, menuItemData) {
  return request(`/stores/menu-item/${itemId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(menuItemData),
  })
}

export async function deleteMenuItemApi(token, itemId) {
  return request(`/stores/menu-item/${itemId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}
