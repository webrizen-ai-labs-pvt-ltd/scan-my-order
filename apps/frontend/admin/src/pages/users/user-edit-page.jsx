import React, { useState, useEffect } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Label,
  Badge,
} from "@repo/ui"
import { ArrowLeft, Save, AlertCircle, CheckCircle2, LoaderCircle, Shield, Trash2 } from "lucide-react"
import { useAuth } from "../../context/auth-context.jsx"
import { fetchUserByIdApi, updateUserApi, deleteUserApi } from "../../services/admin-api.js"

export default function UserEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token } = useAuth()

  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("CUSTOMER")
  const [status, setStatus] = useState("ACTIVE")
  const [avatar, setAvatar] = useState("")
  const [ownedStores, setOwnedStores] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [msg, setMsg] = useState({ text: "", error: false })

  useEffect(() => {
    async function loadUserDetails() {
      if (!token || !id) return
      setLoading(true)
      try {
        const res = await fetchUserByIdApi(token, id)
        const userData = res?.data
        if (userData) {
          setName(userData.name || "")
          setEmail(userData.email || "")
          setRole(userData.role || "CUSTOMER")
          setStatus(userData.status || "ACTIVE")
          setAvatar(userData.avatar || "")
          setOwnedStores(userData.ownedStores || [])
        }
      } catch (err) {
        setMsg({ text: err instanceof Error ? err.message : "Failed to load user details.", error: true })
      } finally {
        setLoading(false)
      }
    }
    loadUserDetails()
  }, [token, id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMsg({ text: "", error: false })
    setIsSubmitting(true)

    try {
      await updateUserApi(token, id, { name, email, role, status, avatar })
      setMsg({ text: "User details updated successfully!", error: false })
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Failed to update user.", error: true })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to deactivate/delete this user?")) return
    setIsSubmitting(true)
    try {
      await deleteUserApi(token, id)
      setMsg({ text: "User deactivated successfully.", error: false })
      setTimeout(() => navigate("/dashboard/users"), 1000)
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Failed to delete user.", error: true })
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-zinc-800 pb-6">
        <Link to="/dashboard/users">
          <Button variant="outline" size="sm" className="border-zinc-800 text-zinc-300 hover:bg-zinc-800 gap-1.5 text-xs">
            <ArrowLeft className="h-4 w-4" /> Back to Users
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Edit User Account #{id?.slice(0, 8)}</h1>
          <p className="text-xs text-zinc-400">Modify authorization status, role privileges, and profile settings.</p>
        </div>
      </div>

      {msg.text && (
        <div
          className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 border ${
            msg.error
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}
        >
          {msg.error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-2">
          <LoaderCircle className="h-6 w-6 animate-spin" />
          <p className="text-xs">Fetching user account records...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Shield className="h-4 w-4 text-zinc-400" /> Account Profile & Privileges
              </CardTitle>
              <CardDescription className="text-zinc-400 text-xs">
                Update account details and administrative access rights.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-zinc-200 text-xs font-medium">
                      Full Name
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-zinc-950 border-zinc-800 text-white text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-zinc-200 text-xs font-medium">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-zinc-950 border-zinc-800 text-white text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role" className="text-zinc-200 text-xs font-medium">
                      Role
                    </Label>
                    <select
                      id="role"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 text-xs text-white rounded-md px-3 py-2.5 focus:outline-none"
                    >
                      <option value="CUSTOMER">Customer</option>
                      <option value="OWNER">Store Owner</option>
                      <option value="MANAGER">Manager</option>
                      <option value="WAITER">Waiter</option>
                      <option value="KITCHEN">Kitchen Staff</option>
                      <option value="ADMIN">System Admin</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status" className="text-zinc-200 text-xs font-medium">
                      Account Status
                    </Label>
                    <select
                      id="status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 text-xs text-white rounded-md px-3 py-2.5 focus:outline-none"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="avatar" className="text-zinc-200 text-xs font-medium">
                    Avatar Image URL
                  </Label>
                  <Input
                    id="avatar"
                    type="url"
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    placeholder="https://example.com/avatar.png"
                    className="bg-zinc-950 border-zinc-800 text-white text-xs"
                  />
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="text-red-400 hover:bg-red-500/10 text-xs gap-1.5"
                  >
                    <Trash2 className="h-4 w-4" /> Deactivate Account
                  </Button>

                  <Button type="submit" disabled={isSubmitting} className="bg-zinc-200 hover:bg-zinc-100 text-zinc-900 font-bold gap-2 text-xs">
                    {isSubmitting ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" /> Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Sidebar Summary */}
          <div className="space-y-6">
            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs text-zinc-400 font-medium">Associated Stores</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {ownedStores.length === 0 ? (
                  <p className="text-xs text-zinc-500">No restaurant stores owned by this user.</p>
                ) : (
                  ownedStores.map((s) => (
                    <div key={s.id} className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs space-y-1">
                      <p className="font-semibold text-white">{s.name}</p>
                      <p className="text-[11px] text-zinc-500 line-clamp-1">{s.description || "No description provided."}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs text-zinc-400 font-medium">Security Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">User ID</span>
                  <span className="text-zinc-300 font-mono text-[11px]">{id?.slice(0, 10)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Current Role</span>
                  <Badge className="bg-zinc-800 text-zinc-200 text-[10px]">{role}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
