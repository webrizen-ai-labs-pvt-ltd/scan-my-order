import React, { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Key, AlertTriangle, Eye, EyeOff, Copy, Check, User, Mail, Shield, Lock } from "lucide-react"
import { Button } from "@repo/ui"
import { useAuth } from "../../../context/auth-context.jsx"
import { createEmployeeApi } from "../../../services/staff-api.js"

export default function StaffCreatePage() {
  const { token } = useAuth()
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "WAITER",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [copiedPassword, setCopiedPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState("")

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

  const handleSubmit = async (e) => {
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
      navigate("/dashboard/staff")
    } catch (err) {
      setFormError(err.message || "Failed to create staff account.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 sm:p-8 bg-zinc-950 min-h-screen text-zinc-100">
      <div className="mx-auto space-y-8">
        <div className="flex items-center gap-4 border-b border-zinc-800 pb-6">
          <Link to="/dashboard/staff">
            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-zinc-800 gap-2">
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Create Staff Account</h1>
            <p className="text-sm text-zinc-500">Add credentials for Waiters, Kitchen Staff, or Managers</p>
          </div>
        </div>

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
                  placeholder="e.g. Vikram Sharma"
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
                  placeholder="e.g. vikram.waiter@restaurant.com"
                  className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base px-0 py-3 focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600 font-mono"
                />
              </div>

              <div className="group relative">
                <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                  Staff Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base py-3 focus:border-zinc-400 outline-none transition-colors cursor-pointer"
                >
                  <option value="WAITER" className="bg-zinc-900">Waiter (POS & Order Placement)</option>
                  <option value="KITCHEN" className="bg-zinc-900">Kitchen Staff (KDS Display)</option>
                  <option value="MANAGER" className="bg-zinc-900">Manager (Full Store Operations)</option>
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
                <h2 className="text-base font-semibold text-white">Password</h2>
                <p className="text-sm text-zinc-500">Set initial password or auto-generate</p>
              </div>
            </div>

            <div className="space-y-5 pl-13">
              <div className="group relative">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
                    Initial Password *
                  </label>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="text-xs font-medium text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5"
                  >
                    <Key className="w-3.5 h-3.5" />
                    Auto Generate
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter password or click Auto Generate"
                    className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base px-0 py-3 pr-20 focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600 font-mono"
                  />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {formData.password && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(formData.password)}
                        title="Copy Password"
                        className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                      >
                        {copiedPassword ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
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
              {isSubmitting ? "Creating..." : "Create Staff Account"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}