const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(/\/$/, "")

async function subscriptionRequest(endpoint, token, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export async function fetchPlansApi(token) {
  return subscriptionRequest("/subscriptions/plans", token, {
    method: "GET",
  })
}

export async function fetchPlanByIdApi(token, id) {
  return subscriptionRequest(`/subscriptions/plans/${id}`, token, {
    method: "GET",
  })
}

export async function createPlanApi(token, planData) {
  return subscriptionRequest("/subscriptions/plans", token, {
    method: "POST",
    body: JSON.stringify(planData),
  })
}

export async function updatePlanApi(token, id, planData) {
  return subscriptionRequest(`/subscriptions/plans/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(planData),
  })
}

export async function deletePlanApi(token, id) {
  return subscriptionRequest(`/subscriptions/plans/${id}`, token, {
    method: "DELETE",
  })
}

export async function fetchStoreSubscriptionsApi(token) {
  return subscriptionRequest("/subscriptions/store-subscriptions", token, {
    method: "GET",
  })
}

export async function assignStoreSubscriptionApi(token, data) {
  return subscriptionRequest("/subscriptions/assign", token, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function deleteStoreSubscriptionApi(token, id) {
  return subscriptionRequest(`/subscriptions/store-subscriptions/${id}`, token, {
    method: "DELETE",
  })
}

export async function initiatePhonePeCheckoutApi(token, data) {
  return subscriptionRequest("/subscriptions/phonepe-checkout", token, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function verifyPhonePePaymentApi(token, data) {
  return subscriptionRequest("/subscriptions/phonepe-verify", token, {
    method: "POST",
    body: JSON.stringify(data),
  })
}
