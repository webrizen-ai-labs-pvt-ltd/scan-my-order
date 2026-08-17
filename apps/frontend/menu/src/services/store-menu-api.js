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
