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

export async function fetchEmployeesApi(token, params = {}) {
  const queryParts = []
  if (params.role && params.role !== "ALL") queryParts.push(`role=${encodeURIComponent(params.role)}`)
  if (params.status && params.status !== "ALL") queryParts.push(`status=${encodeURIComponent(params.status)}`)
  if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`)
  if (params.page) queryParts.push(`page=${params.page}`)
  if (params.limit) queryParts.push(`limit=${params.limit}`)

  const query = queryParts.length > 0 ? `?${queryParts.join("&")}` : ""
  return request(`/owner/employees${query}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function getEmployeeByIdApi(token, id) {
  return request(`/owner/employees/${id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function createEmployeeApi(token, employeeData) {
  return request("/owner/employees", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(employeeData),
  })
}

export async function updateEmployeeApi(token, id, employeeData) {
  return request(`/owner/employees/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(employeeData),
  })
}

export async function changeEmployeeRoleApi(token, id, role) {
  return request(`/owner/employees/${id}/role`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ role }),
  })
}

export async function changeEmployeeStatusApi(token, id, status) {
  return request(`/owner/employees/${id}/status`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  })
}

export async function removeEmployeeApi(token, id) {
  return request(`/owner/employees/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}
