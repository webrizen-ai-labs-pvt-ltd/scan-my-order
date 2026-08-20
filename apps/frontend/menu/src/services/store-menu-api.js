const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(/\/$/, "")
const FALLBACK_API_URL = "http://127.0.0.1:8000/api"

async function request(endpoint) {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`
  const primaryUrl = `${API_BASE_URL}${cleanEndpoint}`
  const fallbackUrl = `${FALLBACK_API_URL}${cleanEndpoint}`

  try {
    const res = await fetch(primaryUrl, { headers: { "Content-Type": "application/json" } })
    if (res.ok) {
      return await res.json()
    }
  } catch {
    // Primary failed, try fallback
  }

  try {
    const res = await fetch(fallbackUrl, { headers: { "Content-Type": "application/json" } })
    if (res.ok) {
      return await res.json()
    }
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error || data?.message || "Failed to fetch store menu")
  } catch (err) {
    if (err instanceof Error) throw err
    throw new Error("Unable to connect to restaurant server.")
  }
}

export async function fetchStoreBySlugApi(slug) {
  return request(`/stores/${encodeURIComponent(slug)}`)
}

export async function createOrderApi(orderData) {
  const primaryUrl = `${API_BASE_URL}/orders`
  const fallbackUrl = `${FALLBACK_API_URL}/orders`

  try {
    const res = await fetch(primaryUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    })
    const data = await res.json()
    if (res.ok) return data
    throw new Error(data?.message || data?.error || "Failed to place order")
  } catch (err) {
    if (err instanceof Error && err.message !== "Failed to fetch") throw err
    const res = await fetch(fallbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    })
    const data = await res.json()
    if (res.ok) return data
    throw new Error(data?.message || data?.error || "Failed to place order")
  }
}

export async function requestTableServiceApi(serviceData) {
  const primaryUrl = `${API_BASE_URL}/orders/call-waiter`
  try {
    const res = await fetch(primaryUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serviceData),
    })
    return await res.json()
  } catch (err) {
    console.error("Failed to request table service:", err)
    return { success: false }
  }
}

export async function fetchOrderStatusApi(orderId) {
  return request(`/orders/${encodeURIComponent(orderId)}`)
}
