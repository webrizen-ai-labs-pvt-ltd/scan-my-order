import React, { useState, useEffect, useCallback } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  Users,
  UserPlus,
  ShieldCheck,
  ChefHat,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  UserCheck,
  UserX,
  LoaderCircle,
} from "lucide-react"
import { Button } from "@repo/ui"
import { useAuth } from "../../../context/auth-context.jsx"
import {
  fetchEmployeesApi,
  changeEmployeeStatusApi,
  removeEmployeeApi,
} from "../../../services/staff-api.js"

export default function StaffListPage() {
  const { token } = useAuth()
  const navigate = useNavigate()

  const [employees, setEmployees] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRole, setSelectedRole] = useState("ALL")
  const [selectedStatus, setSelectedStatus] = useState("ALL")

  const [deletingId, setDeletingId] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const showToast = (message, type = "success") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const loadEmployees = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetchEmployeesApi(token, {
        search: searchQuery,
        role: selectedRole,
        status: selectedStatus,
        limit: 100,
      })
      setEmployees(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error("Error loading staff accounts:", err)
      setError(err.message || "Failed to load staff accounts")
    } finally {
      setIsLoading(false)
    }
  }, [token, searchQuery, selectedRole, selectedStatus])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  const handleQuickStatusToggle = async (empId, currentStatus) => {
    const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE"
    try {
      await changeEmployeeStatusApi(token, empId, newStatus)
      showToast(`Status updated to ${newStatus}`)
      loadEmployees()
    } catch (err) {
      showToast(err.message || "Failed to update status", "error")
    }
  }

  const handleRemoveConfirm = async (empId, empName) => {
    setIsDeleting(true)
    try {
      await removeEmployeeApi(token, empId)
      showToast(`Staff account for ${empName} removed.`, "info")
      setDeletingId(null)
      loadEmployees()
    } catch (err) {
      showToast(err.message || "Failed to remove staff account", "error")
    } finally {
      setIsDeleting(false)
    }
  }

  const formatDate = (date) => {
    if (!date) return "—"
    try {
      return new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    } catch {
      return "—"
    }
  }

  const totalCount = employees.length
  const managerCount = employees.filter((e) => e.role === "MANAGER").length
  const waiterCount = employees.filter((e) => e.role === "WAITER").length
  const kitchenCount = employees.filter((e) => e.role === "KITCHEN").length

  const roleConfig = {
    MANAGER: { icon: ShieldCheck, color: "text-zinc-300", bg: "bg-zinc-800", border: "border-zinc-700" },
    KITCHEN: { icon: ChefHat, color: "text-zinc-300", bg: "bg-zinc-800", border: "border-zinc-700" },
    WAITER: { icon: UserCheck, color: "text-zinc-300", bg: "bg-zinc-800", border: "border-zinc-700" },
  }

  return (
    <div className="p-6 sm:p-8 space-y-8 bg-zinc-950 min-h-screen text-zinc-100 font-sans">
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-lg border flex items-center gap-3 text-sm font-medium transition-all ${
            toast.type === "error"
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : toast.type === "info"
              ? "bg-zinc-800 border-zinc-700 text-zinc-300"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}
        >
          {toast.type === "error" ? (
            <XCircle className="w-5 h-5 shrink-0" />
          ) : toast.type === "info" ? (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Staff Accounts</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage accounts, credentials, and access permissions
          </p>
        </div>
        <Link to="/dashboard/staff/new">
          <Button>
            <UserPlus className="w-4 h-4" />
            Add Staff Member
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 relative overflow-hidden group hover:border-zinc-700 transition-colors">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-transparent via-zinc-400 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total Staff</p>
          <p className="text-3xl font-bold text-white mt-2">{totalCount}</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 relative overflow-hidden group hover:border-zinc-700 transition-colors">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-transparent via-zinc-400 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Managers</p>
          <p className="text-3xl font-bold text-white mt-2">{managerCount}</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 relative overflow-hidden group hover:border-zinc-700 transition-colors">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-transparent via-zinc-400 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Waitstaff</p>
          <p className="text-3xl font-bold text-white mt-2">{waiterCount}</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 relative overflow-hidden group hover:border-zinc-700 transition-colors">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-transparent via-zinc-400 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Kitchen Staff</p>
          <p className="text-3xl font-bold text-white mt-2">{kitchenCount}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-8 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <div className="inline-flex bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            {["ALL", "MANAGER", "WAITER", "KITCHEN"].map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  selectedRole === role
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {role === "ALL" ? "All" : role.charAt(0) + role.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 cursor-pointer"
          >
            <option value="ALL" className="bg-zinc-900">All Statuses</option>
            <option value="ACTIVE" className="bg-zinc-900">Active</option>
            <option value="INACTIVE" className="bg-zinc-900">Inactive</option>
            <option value="SUSPENDED" className="bg-zinc-900">Suspended</option>
          </select>

          <Button variant="ghost" size="icon" onClick={loadEmployees} title="Refresh" className="text-zinc-400 hover:text-white hover:bg-zinc-800">
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-zinc-500 space-y-3">
            <LoaderCircle className="w-8 h-8 animate-spin mx-auto" />
            <p className="text-sm font-medium">Loading staff records...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-400 space-y-3">
            <AlertTriangle className="w-8 h-8 mx-auto" />
            <p className="text-sm font-medium">{error}</p>
            <Button onClick={loadEmployees} variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
              Retry
            </Button>
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 space-y-3">
            <UserX className="w-10 h-10 mx-auto text-zinc-600" />
            <p className="text-base font-semibold text-zinc-300">No staff members found</p>
            <p className="text-sm text-zinc-500 max-w-sm mx-auto">
              {searchQuery || selectedRole !== "ALL" || selectedStatus !== "ALL"
                ? "No staff match your current filters."
                : "Add your first staff member to get started."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-950/60 text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                <tr>
                  <th className="py-4 px-6">Staff Member</th>
                  <th className="py-4 px-6">Role</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Joined</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {employees.map((emp) => {
                  const role = roleConfig[emp.role] || roleConfig.WAITER
                  const RoleIcon = role.icon

                  return (
                    <React.Fragment key={emp.id}>
                      <tr className="hover:bg-zinc-800/40 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-white text-sm shrink-0">
                              {(emp.name || "S").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-white text-sm">{emp.name}</p>
                              <p className="text-xs text-zinc-500 font-mono mt-0.5">{emp.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${role.bg} ${role.color} ${role.border} border`}>
                            <RoleIcon className="w-3.5 h-3.5" />
                            <span className="capitalize">{emp.role.toLowerCase()}</span>
                          </span>
                        </td>

                        <td className="py-4 px-6">
                          <button
                            onClick={() => handleQuickStatusToggle(emp.id, emp.status)}
                            className="flex items-center gap-2"
                            title="Toggle Status"
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                emp.status === "ACTIVE"
                                  ? "bg-emerald-400"
                                  : emp.status === "SUSPENDED"
                                  ? "bg-red-400"
                                  : "bg-zinc-500"
                              }`}
                            />
                            <span
                              className={`text-xs font-medium capitalize ${
                                emp.status === "ACTIVE"
                                  ? "text-emerald-400"
                                  : emp.status === "SUSPENDED"
                                  ? "text-red-400"
                                  : "text-zinc-400"
                              }`}
                            >
                              {emp.status.toLowerCase()}
                            </span>
                          </button>
                        </td>

                        <td className="py-4 px-6 text-sm text-zinc-400">
                          {formatDate(emp.createdAt)}
                        </td>

                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link to={`/dashboard/staff/${emp.id}/edit`}>
                              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-zinc-800 p-1 h-8 w-8">
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingId(deletingId === emp.id ? null : emp.id)}
                              className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 p-1 h-8 w-8"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {deletingId === emp.id && (
                        <tr className="bg-red-500/5 border-y border-red-500/20">
                          <td colSpan={5} className="py-3 px-6 text-sm">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-zinc-300">
                                Remove <strong className="text-white">{emp.name}</strong>?
                              </span>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeletingId(null)}
                                  disabled={isDeleting}
                                  className="text-zinc-400 hover:text-white text-sm"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveConfirm(emp.id, emp.name)}
                                  disabled={isDeleting}
                                  className="text-red-400 hover:bg-red-500/10 text-sm"
                                >
                                  {isDeleting ? "Removing..." : "Confirm"}
                                </Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}