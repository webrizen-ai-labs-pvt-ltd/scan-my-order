import React, { useState, useEffect } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, AlertTriangle, LoaderCircle, User, Mail, Shield, Lock, KeyRound } from "lucide-react"
import { Button } from "@repo/ui"
import { useAuth } from "../../../context/auth-context.jsx"
import { getEmployeeByIdApi, updateEmployeeApi } from "../../../services/staff-api.js"

export default function StaffEditPage() {
  const { token } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()

  const [isLoading, setIsLoading] = useState(true)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "WAITER",
    status: "ACTIVE",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState("")

  useEffect(() => {
    if (!token || !id) return
    setIsLoading(true)

    getEmployeeByIdApi(token, id)
      .then((res) => {
        const emp = res.data
        if (emp) {
          setFormData({
            name: emp.name || "",
            email: emp.email || "",
            password: "",
            role: emp.role || "WAITER",
            status: emp.status || "ACTIVE",
          })
        }
        setIsLoading(false)
      })
      .catch((err) => {
        setFormError(err.message || "Failed to load employee details.")
        setIsLoading(false)
      })
  }, [token, id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError("")
    if (!formData.name.trim() || !formData.email.trim()) {
      setFormError("Full Name and Email are required.")
      return
    }

    setIsSubmitting(true)
    try {
      await updateEmployeeApi(token, id, {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        ...(formData.password ? { password: formData.password } : {}),
        role: formData.role,
        status: formData.status,
      })
      navigate("/dashboard/staff")
    } catch (err) {
      setFormError(err.message || "Failed to update staff account.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 sm:p-8 bg-zinc-950 min-h-screen text-zinc-100 font-sans">
      <div className="mx-auto space-y-8">
        <div className="flex items-center gap-4 border-b border-zinc-800 pb-6">
          <Link to="/dashboard/staff">
            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-zinc-800 gap-2">
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Edit Staff Account</h1>
            <p className="text-sm text-zinc-500">Update credentials, role, or access status</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-2">
            <LoaderCircle className="w-8 h-8 animate-spin" />
            <p className="text-sm">Loading employee details...</p>
          </div>
        ) : (
          <>
            {formError && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                    <User className="h-5 w-5 text-zinc-300" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white">Staff Details</h2>
                    <p className="text-sm text-zinc-500">Basic information about the employee</p>
                  </div>
                </div>

                <div className="space-y-5 pl-13">
                  <div className="group relative">
                    <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base px-0 py-3 focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600"
                    />
                  </div>

                  <div className="group relative">
                    <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base px-0 py-3 focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-6 pt-8 border-t border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-zinc-300" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white">Role & Status</h2>
                    <p className="text-sm text-zinc-500">Set access level and account state</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pl-13">
                  <div className="group relative">
                    <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                      Staff Role
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base py-3 focus:border-zinc-400 outline-none transition-colors cursor-pointer"
                    >
                      <option value="WAITER" className="bg-zinc-900">Waiter</option>
                      <option value="KITCHEN" className="bg-zinc-900">Kitchen Staff</option>
                      <option value="MANAGER" className="bg-zinc-900">Manager</option>
                    </select>
                  </div>

                  <div className="group relative">
                    <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                      Account Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base py-3 focus:border-zinc-400 outline-none transition-colors cursor-pointer"
                    >
                      <option value="ACTIVE" className="bg-zinc-900">Active</option>
                      <option value="SUSPENDED" className="bg-zinc-900">Suspended</option>
                      <option value="INACTIVE" className="bg-zinc-900">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-6 pt-8 border-t border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                    <Lock className="h-5 w-5 text-zinc-300" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white">Password Reset</h2>
                    <p className="text-sm text-zinc-500">Leave blank to keep current password</p>
                  </div>
                </div>

                <div className="pl-13">
                  <div className="group relative">
                    <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                      <KeyRound className="h-4 w-4 inline mr-1.5" /> New Password
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter new password to reset"
                      className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base px-0 py-3 focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-8 border-t border-zinc-800">
                <Link to="/dashboard/staff" className="flex-1">
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}