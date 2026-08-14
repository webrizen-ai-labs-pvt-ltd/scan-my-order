import React, { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Label,
} from "@repo/ui"
import { ArrowLeft, UserPlus, AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react"
import { useAuth } from "../../context/auth-context.jsx"
import { createUserApi } from "../../services/admin-api.js"

export default function UserCreatePage() {
  const navigate = useNavigate()
  const { token } = useAuth()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("CUSTOMER")
  const [isLoading, setIsLoading] = useState(false)
  const [msg, setMsg] = useState({ text: "", error: false })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMsg({ text: "", error: false })
    setIsLoading(true)

    try {
      await createUserApi(token, { name, email, password, role })
      setMsg({ text: "User account created successfully!", error: false })
      setTimeout(() => {
        navigate("/dashboard/users")
      }, 1000)
    } catch (err) {
      setMsg({
        text: err instanceof Error ? err.message : "Failed to create user.",
        error: true,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header with Back Navigation */}
      <div className="flex items-center gap-4 border-b border-zinc-800 pb-6">
        <Link to="/dashboard/users">
          <Button variant="outline" size="sm" className="border-zinc-800 text-zinc-300 hover:bg-zinc-800 gap-1.5 text-xs">
            <ArrowLeft className="h-4 w-4" /> Back to Users List
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Add New Platform User</h1>
          <p className="text-xs text-zinc-400">Create administrative, store owner, or staff credentials.</p>
        </div>
      </div>

      <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-zinc-400" /> Account Credentials & Role Details
          </CardTitle>
          <CardDescription className="text-zinc-400 text-xs">
            All fields are required. The user will be initialized with ACTIVE status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-zinc-200 text-xs font-medium">
                  Full Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="e.g. Sarah Connor"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-white text-xs"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-200 text-xs font-medium">
                  Email Address (Login Username)
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="sarah@restaurant.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-white text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-zinc-200 text-xs font-medium">
                  Initial Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-white text-xs"
                  minLength={6}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-zinc-200 text-xs font-medium">
                  Assigned Platform Role
                </Label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-xs text-white rounded-md px-3 py-2.5 focus:outline-none"
                >
                  <option value="CUSTOMER">Customer (General Public)</option>
                  <option value="OWNER">Store Owner (Restaurant Executive)</option>
                  <option value="MANAGER">Store Manager</option>
                  <option value="WAITER">Waiter / Order Taker</option>
                  <option value="KITCHEN">Kitchen Staff</option>
                  <option value="ADMIN">System Administrator</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
              <Link to="/dashboard/users">
                <Button type="button" variant="outline" className="border-zinc-800 text-zinc-300 hover:bg-zinc-800 text-xs">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isLoading} className="bg-zinc-200 hover:bg-zinc-100 text-zinc-900 font-bold gap-2 text-xs">
                {isLoading ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" /> Creating User...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" /> Create User Account
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
