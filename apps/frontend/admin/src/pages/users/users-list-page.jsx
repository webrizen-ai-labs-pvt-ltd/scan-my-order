import React, { useState, useEffect, useCallback } from "react"
import { useNavigate, Link } from "react-router-dom"
import {
  Card,
  CardHeader,
  CardContent,
  Badge,
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@repo/ui"
import { Search, UserPlus, AlertCircle, LoaderCircle, Store, ChevronLeft, ChevronRight } from "lucide-react"
import { useAuth } from "../../context/auth-context.jsx"
import { fetchUsersApi, updateUserStatusApi } from "../../services/admin-api.js"

export default function UsersListPage() {
  const navigate = useNavigate()
  const { token } = useAuth()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Search & Filter State
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalUsers, setTotalUsers] = useState(0)

  const loadUsers = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError("")

    try {
      const res = await fetchUsersApi(token, {
        page,
        limit: 10,
        search,
        role: roleFilter,
        status: statusFilter,
      })

      if (res?.data) {
        setUsers(res.data)
        if (res.meta) {
          setTotalPages(res.meta.totalPages || 1)
          setTotalUsers(res.meta.total || res.data.length)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.")
    } finally {
      setLoading(false)
    }
  }, [token, page, search, roleFilter, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadUsers])

  const handleStatusToggle = async (userId, currentStatus) => {
    const nextStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE"
    try {
      await updateUserStatusApi(token, userId, nextStatus)
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: nextStatus } : u))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.")
    }
  }

  const getRoleBadge = (role) => {
    const map = {
      ADMIN: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      OWNER: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      MANAGER: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      WAITER: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
      KITCHEN: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      CUSTOMER: "bg-zinc-800 text-zinc-400 border-zinc-700",
    }
    return <Badge className={`border px-2.5 py-0.5 text-xs font-semibold ${map[role] || "bg-zinc-800 text-zinc-300"}`}>{role}</Badge>
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">User Management</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage user accounts, administrative roles, and authorization status across the platform.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate("/dashboard/stores/onboard")}
            variant="outline"
            className="border-zinc-700 text-zinc-200 hover:bg-zinc-800 gap-2"
          >
            <Store className="h-4 w-4 text-amber-400" /> Onboard New Store
          </Button>
          <Button
            onClick={() => navigate("/dashboard/users/new")}
            className="bg-zinc-200 hover:bg-zinc-100 text-zinc-900 font-semibold gap-2"
          >
            <UserPlus className="h-4 w-4" /> Add New User
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Main Table Card */}
      <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Search users by name or email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="pl-9 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-500 text-xs"
              />
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Role:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value)
                    setPage(1)
                  }}
                  className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded-md px-3 py-2 focus:outline-none"
                >
                  <option value="ALL">All Roles</option>
                  <option value="ADMIN">Admin</option>
                  <option value="OWNER">Owner</option>
                  <option value="MANAGER">Manager</option>
                  <option value="WAITER">Waiter</option>
                  <option value="KITCHEN">Kitchen</option>
                  <option value="CUSTOMER">Customer</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value)
                    setPage(1)
                  }}
                  className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded-md px-3 py-2 focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-2">
              <LoaderCircle className="h-6 w-6 animate-spin" />
              <p className="text-xs">Loading user records...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 px-4">
              <p className="text-sm text-zinc-400 font-medium">No user records found.</p>
              <p className="text-xs text-zinc-500 mt-1">Try adjusting your search criteria or add a new user.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="border-zinc-800">
                  <TableRow className="border-zinc-800 hover:bg-zinc-950">
                    <TableHead className="text-zinc-400">User Identity</TableHead>
                    <TableHead className="text-zinc-400">Role</TableHead>
                    <TableHead className="text-zinc-400">Status</TableHead>
                    <TableHead className="text-zinc-400">Created Date</TableHead>
                    <TableHead className="text-right text-zinc-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const initials = u.name
                      ? u.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                      : "US"
                    return (
                      <TableRow key={u.id} className="border-zinc-800 hover:bg-zinc-950/50">
                        <TableCell className="font-medium text-white">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-zinc-800 bg-zinc-800">
                              <AvatarImage src={u.avatar || undefined} alt={u.name} />
                              <AvatarFallback className="bg-zinc-800 text-zinc-200 text-xs font-bold">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm text-white font-medium">{u.name}</p>
                              <p className="text-xs text-zinc-400">{u.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(u.role)}</TableCell>
                        <TableCell>
                          <Badge
                            className={`border px-2.5 py-0.5 text-xs ${
                              u.status === "ACTIVE"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : u.status === "SUSPENDED"
                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                : "bg-zinc-800 text-zinc-400 border-zinc-700"
                            }`}
                          >
                            {u.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-zinc-400 text-xs">
                          {u.createdAt ? new Date(u.createdAt).toISOString().split("T")[0] : "—"}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatusToggle(u.id, u.status)}
                            className="text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                          >
                            {u.status === "ACTIVE" ? "Suspend" : "Activate"}
                          </Button>
                          <Link to={`/dashboard/users/${u.id}/edit`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                            >
                              Edit Details
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800 text-xs text-zinc-400 mt-4">
            <div>
              Showing {users.length} of {totalUsers} total users
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="border-zinc-800 text-zinc-300 hover:bg-zinc-800 h-8 gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </Button>
              <span className="text-zinc-300 font-medium px-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="border-zinc-800 text-zinc-300 hover:bg-zinc-800 h-8 gap-1"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
