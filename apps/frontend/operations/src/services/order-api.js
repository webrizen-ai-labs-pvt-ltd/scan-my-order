const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(/\/$/, "")
const FALLBACK_API_URL = "http://127.0.0.1:8000/api"

async function request(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`
  const primaryUrl = `${API_BASE_URL}${cleanEndpoint}`
  const fallbackUrl = `${FALLBACK_API_URL}${cleanEndpoint}`

  const headers = {
    "Content-Type": "application/json",
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {}),
  }

  try {
    const res = await fetch(primaryUrl, { ...options, headers })
    const data = await res.json().catch(() => ({}))
    if (res.ok) return data
    throw new Error(data?.message || data?.error || `HTTP ${res.status}`)
  } catch (err) {
    if (err instanceof Error && !err.message.includes("HTTP")) {
      const res = await fetch(fallbackUrl, { ...options, headers })
      const data = await res.json().catch(() => ({}))
      if (res.ok) return data
      throw new Error(data?.message || data?.error || `HTTP ${res.status}`)
    }
    throw err
  }
}

export async function fetchStoreOrdersApi(token, storeId, query = {}) {
  const params = new URLSearchParams()
  if (query.status) params.append("status", query.status)
  if (query.paymentType) params.append("paymentType", query.paymentType)
  const queryString = params.toString() ? `?${params.toString()}` : ""
  return request(`/orders/store/${storeId}${queryString}`, { token })
}

export async function verifyPostpaidOrderApi(token, orderId) {
  return request(`/orders/${orderId}/verify`, {
    method: "PATCH",
    token,
  })
}

export async function updateOrderStatusApi(token, orderId, payload) {
  return request(`/orders/${orderId}/status`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  })
}
