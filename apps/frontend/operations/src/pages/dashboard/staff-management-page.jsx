import React, { useState, useEffect, useCallback } from "react"
import {
  Users,
  UserPlus,
  ShieldCheck,
  ChefHat,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Key,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Copy,
  Check,
  X,
  UserCheck,
  UserX,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@repo/ui"
import { useAuth } from "../../context/auth-context.jsx"
import {
  fetchEmployeesApi,
  createEmployeeApi,
  updateEmployeeApi,
  changeEmployeeRoleApi,
  changeEmployeeStatusApi,
  removeEmployeeApi,
} from "../../services/staff-api.js"

export default function StaffManagementPage() {
  const { token } = useAuth()

  // View state: "LIST" | "ADD" | "EDIT" | "DELETE"
  const [currentView, setCurrentView] = useState("LIST")

  // Data state
  const [employees, setEmployees] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRole, setSelectedRole] = useState("ALL")
  const [selectedStatus, setSelectedStatus] = useState("ALL")

  // Selected Employee for Edit/Delete
  const [activeEmployee, setActiveEmployee] = useState(null)

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "WAITER",
    status: "ACTIVE",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [copiedPassword, setCopiedPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState("")

  // Helper Toast
  const showToast = (message, type = "success") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Load employees
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
      setEmployees(res.data || [])
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

  // Password Generator
  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$"
    let pwd = ""
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData((prev) => ({ ...prev, password: pwd }))
    setShowPassword(true)
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setCopiedPassword(true)
    setTimeout(() => setCopiedPassword(false), 2000)
  }

  // Navigators
  const navigateToAddView = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "WAITER",
      status: "ACTIVE",
    })
    setFormError("")
    setShowPassword(false)
    setCurrentView("ADD")
  }

  const navigateToEditView = (emp) => {
    setActiveEmployee(emp)
    setFormData({
      name: emp.name || "",
      email: emp.email || "",
      password: "",
      role: emp.role || "WAITER",
      status: emp.status || "ACTIVE",
    })
    setFormError("")
    setShowPassword(false)
    setCurrentView("EDIT")
  }

  const navigateToDeleteView = (emp) => {
    setActiveEmployee(emp)
    setCurrentView("DELETE")
  }

  const navigateToList = () => {
    setActiveEmployee(null)
    setCurrentView("LIST")
  }

  // Handlers
  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    setFormError("")
    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
      setFormError("Full Name, Email, and Password are required.")
      return
    }

    setIsSubmitting(true)
    try {
      await createEmployeeApi(token, {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
      })
      showToast(`Staff account created for ${formData.name}!`)
      navigateToList()
      loadEmployees()
    } catch (err) {
      setFormError(err.message || "Failed to create staff account.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setFormError("")
    if (!activeEmployee) return
    if (!formData.name.trim() || !formData.email.trim()) {
      setFormError("Full Name and Email are required.")
      return
    }

    setIsSubmitting(true)
    try {
      await updateEmployeeApi(token, activeEmployee.id, {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        ...(formData.password ? { password: formData.password } : {}),
        role: formData.role,
        status: formData.status,
      })
      showToast(`Staff account for ${formData.name} updated!`)
      navigateToList()
      loadEmployees()
    } catch (err) {
      setFormError(err.message || "Failed to update staff account.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!activeEmployee) return
    setIsSubmitting(true)
    try {
      await removeEmployeeApi(token, activeEmployee.id)
      showToast(`Staff account for ${activeEmployee.name} removed.`, "info")
      navigateToList()
      loadEmployees()
    } catch (err) {
      showToast(err.message || "Failed to remove staff account.", "error")
    } finally {
      setIsSubmitting(false)
    }
  }

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

  // Derived Statistics
  const totalCount = employees.length
  const managerCount = employees.filter((e) => e.role === "MANAGER").length
  const waiterCount = employees.filter((e) => e.role === "WAITER").length
  const kitchenCount = employees.filter((e) => e.role === "KITCHEN").length

  return (
    <div className="p-6 sm:p-8 space-y-8 bg-zinc-950 min-h-screen text-zinc-100 font-sans">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl border flex items-center gap-3 text-sm font-medium transition-all ${
            toast.type === "error"
              ? "bg-red-950 border-red-800 text-red-200"
              : toast.type === "info"
              ? "bg-blue-950 border-blue-800 text-blue-200"
              : "bg-emerald-950 border-emerald-800 text-emerald-200"
          }`}
        >
          {toast.type === "error" ? (
            <XCircle className="w-5 h-5 text-red-400 shrink-0" />
          ) : toast.type === "info" ? (
            <AlertTriangle className="w-5 h-5 text-blue-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-PAGE VIEW 1: STAFF LIST (MAIN PAGE) */}
      {/* ========================================================================= */}
      {currentView === "LIST" && (
        <div className="space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <Users className="w-7 h-7 text-amber-400" />
                Staff Accounts & Roles
              </h1>
              <p className="text-zinc-400 text-sm mt-1">
                Manage accounts, credentials, and access permissions for your store personnel.
              </p>
            </div>
            <Button onClick={navigateToAddView} className="gap-2 shrink-0">
              <UserPlus className="w-4 h-4" />
              <span>Add Staff Member</span>
            </Button>
          </div>

          {/* Stat Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Total Staff</p>
                <p className="text-2xl sm:text-3xl font-black text-white mt-1">{totalCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-amber-400">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Managers</p>
                <p className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">{managerCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Waitstaff</p>
                <p className="text-2xl sm:text-3xl font-black text-blue-400 mt-1">{waiterCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <UserCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Kitchen Staff</p>
                <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">{kitchenCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ChefHat className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Control Bar: Search & Filters */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff by name or email..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-8 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white h-7 w-7"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
              {/* Role Filter Buttons */}
              <div className="inline-flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs font-medium">
                {["ALL", "MANAGER", "WAITER", "KITCHEN"].map((role) => (
                  <Button
                    key={role}
                    variant={selectedRole === role ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setSelectedRole(role)}
                    className="capitalize text-xs"
                  >
                    {role === "ALL" ? "All Roles" : role.toLowerCase()}
                  </Button>
                ))}
              </div>

              {/* Status Select */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-300 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>

              {/* Refresh Button */}
              <Button variant="outline" size="icon" onClick={loadEmployees} title="Refresh Staff List">
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-amber-400" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center text-zinc-500 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500" />
                <p className="text-sm font-medium">Loading staff records...</p>
              </div>
            ) : error ? (
              <div className="p-12 text-center text-red-400 space-y-3">
                <AlertTriangle className="w-8 h-8 mx-auto text-red-500" />
                <p className="text-sm font-medium">{error}</p>
                <Button onClick={loadEmployees} variant="outline" size="sm">
                  Retry
                </Button>
              </div>
            ) : employees.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 space-y-3">
                <UserX className="w-10 h-10 mx-auto text-zinc-600" />
                <p className="text-base font-semibold text-zinc-300">No staff members found</p>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  {searchQuery || selectedRole !== "ALL" || selectedStatus !== "ALL"
                    ? "No staff match your current search and filter criteria."
                    : "Add your first waiter, manager, or kitchen staff member."}
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
                      <th className="py-4 px-6">Joined Date</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {employees.map((emp) => {
                      const roleStyle =
                        emp.role === "MANAGER"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : emp.role === "KITCHEN"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-blue-500/10 text-blue-400 border-blue-500/30"

                      const roleIcon =
                        emp.role === "MANAGER" ? (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        ) : emp.role === "KITCHEN" ? (
                          <ChefHat className="w-3.5 h-3.5" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5" />
                        )

                      return (
                        <tr key={emp.id} className="hover:bg-zinc-800/40 transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-amber-400 text-sm shrink-0">
                                {emp.avatar ? (
                                  <img src={emp.avatar} alt={emp.name} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                  (emp.name || "S").charAt(0).toUpperCase()
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-white text-sm">{emp.name}</p>
                                <p className="text-xs text-zinc-400 font-mono mt-0.5">{emp.email}</p>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-6">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${roleStyle}`}
                            >
                              {roleIcon}
                              <span className="capitalize">{emp.role.toLowerCase()}</span>
                            </span>
                          </td>

                          <td className="py-4 px-6">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleQuickStatusToggle(emp.id, emp.status)}
                              className="gap-2 h-auto py-1 px-2.5"
                              title="Toggle Status"
                            >
                              <span
                                className={`w-2.5 h-2.5 rounded-full ${
                                  emp.status === "ACTIVE"
                                    ? "bg-emerald-500"
                                    : emp.status === "SUSPENDED"
                                    ? "bg-red-500"
                                    : "bg-zinc-500"
                                }`}
                              />
                              <span
                                className={`text-xs font-semibold capitalize ${
                                  emp.status === "ACTIVE"
                                    ? "text-emerald-400"
                                    : emp.status === "SUSPENDED"
                                    ? "text-red-400"
                                    : "text-zinc-400"
                                }`}
                              >
                                {emp.status.toLowerCase()}
                              </span>
                            </Button>
                          </td>

                          <td className="py-4 px-6 text-xs text-zinc-400">
                            {emp.createdAt ? new Date(emp.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}
                          </td>

                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigateToEditView(emp)}
                                className="gap-1.5"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                                <span>Edit</span>
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => navigateToDeleteView(emp)}
                                className="gap-1.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-PAGE VIEW 2: ADD STAFF MEMBER */}
      {/* ========================================================================= */}
      {currentView === "ADD" && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-4 border-b border-zinc-800 pb-6">
            <Button variant="outline" size="sm" onClick={navigateToList} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Staff List</span>
            </Button>
            <div>
              <h2 className="text-xl font-bold text-white">Add New Staff Member</h2>
              <p className="text-xs text-zinc-400">Create login credentials for Waiters, Kitchen Staff, or Managers.</p>
            </div>
          </div>

          {formError && (
            <div className="p-4 rounded-xl bg-red-950 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleCreateSubmit} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Full Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Vikram Sharma"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="e.g. vikram.waiter@restaurant.com"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Staff Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors cursor-pointer"
              >
                <option value="WAITER">Waiter (POS & Order Placement)</option>
                <option value="KITCHEN">Kitchen Staff (KDS Display)</option>
                <option value="MANAGER">Manager (Full Store Operations)</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Initial Password
                </label>
                <Button type="button" variant="outline" size="sm" onClick={generatePassword} className="gap-1.5 text-xs">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>Auto Generate</span>
                </Button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter password or click Auto Generate"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-4 pr-20 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors font-mono text-xs"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {formData.password && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(formData.password)}
                      title="Copy Password"
                      className="h-7 w-7"
                    >
                      {copiedPassword ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowPassword(!showPassword)}
                    className="h-7 w-7"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="pt-4 flex gap-4">
              <Button type="button" variant="outline" onClick={navigateToList} className="w-full">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Creating..." : "Create Staff Account"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-PAGE VIEW 3: EDIT STAFF MEMBER */}
      {/* ========================================================================= */}
      {currentView === "EDIT" && activeEmployee && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-4 border-b border-zinc-800 pb-6">
            <Button variant="outline" size="sm" onClick={navigateToList} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Staff List</span>
            </Button>
            <div>
              <h2 className="text-xl font-bold text-white">Edit Staff Account</h2>
              <p className="text-xs text-zinc-400">Modify details or credentials for {activeEmployee.name}.</p>
            </div>
          </div>

          {formError && (
            <div className="p-4 rounded-xl bg-red-950 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleEditSubmit} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Full Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                  Staff Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors cursor-pointer"
                >
                  <option value="WAITER">Waiter</option>
                  <option value="KITCHEN">Kitchen Staff</option>
                  <option value="MANAGER">Manager</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                  Account Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors cursor-pointer"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Reset Password (Leave blank to keep unchanged)
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter new password to reset"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors font-mono text-xs"
              />
            </div>

            <div className="pt-4 flex gap-4">
              <Button type="button" variant="outline" onClick={navigateToList} className="w-full">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-PAGE VIEW 4: DELETE CONFIRMATION */}
      {/* ========================================================================= */}
      {currentView === "DELETE" && activeEmployee && (
        <div className="max-w-xl mx-auto space-y-6">
          <div className="flex items-center gap-4 border-b border-zinc-800 pb-6">
            <Button variant="outline" size="sm" onClick={navigateToList} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Staff List</span>
            </Button>
            <div>
              <h2 className="text-xl font-bold text-white">Revoke Staff Access</h2>
              <p className="text-xs text-zinc-400">Confirm account deletion for {activeEmployee.name}.</p>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Are you sure you want to remove this staff account?</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                Staff member <span className="text-white font-bold">{activeEmployee.name}</span> ({activeEmployee.email}) will immediately lose access to all POS and KDS operations.
              </p>
            </div>

            <div className="pt-2 flex gap-4">
              <Button type="button" variant="outline" onClick={navigateToList} className="w-full">
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? "Removing..." : "Remove Staff Account"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
