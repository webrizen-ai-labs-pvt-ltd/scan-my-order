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

export async function fetchStoreTablesApi(token, storeId) {
  const query = storeId ? `?storeId=${storeId}` : ""
  return request(`/tables${query}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function fetchTableByIdApi(token, id) {
  return request(`/tables/${id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function createTableApi(token, tableData) {
  return request("/tables", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(tableData),
  })
}

export async function updateTableApi(token, id, tableData) {
  return request(`/tables/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(tableData),
  })
}

export async function deleteTableApi(token, id) {
  return request(`/tables/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}
