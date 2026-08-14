import React, { useState } from "react"
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
} from "@repo/ui"
import { Search, UserPlus } from "lucide-react"

export default function UsersPage() {
  const [search, setSearch] = useState("")

  const users = [
    { id: "usr_1", name: "Alex Johnson", email: "alex.admin@scanmyorder.com", role: "ADMIN", status: "ACTIVE", joined: "2026-01-15" },
    { id: "usr_2", name: "Maria Garcia", email: "maria.owner@bistro.com", role: "OWNER", status: "ACTIVE", joined: "2026-02-01" },
    { id: "usr_3", name: "David Chen", email: "david.mgr@bistro.com", role: "MANAGER", status: "ACTIVE", joined: "2026-02-10" },
    { id: "usr_4", name: "Sarah Smith", email: "sarah.w@bistro.com", role: "WAITER", status: "ACTIVE", joined: "2026-02-12" },
    { id: "usr_5", name: "Robert Miller", email: "robert.k@bistro.com", role: "KITCHEN", status: "SUSPENDED", joined: "2026-02-14" },
  ]

  const filteredUsers = users.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  )

  const getRoleBadge = (role) => {
    const map = {
      ADMIN: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      OWNER: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      MANAGER: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      WAITER: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      KITCHEN: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    }
    return <Badge className={map[role] || "bg-slate-800 text-slate-300"}>{role}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">User Management</h1>
          <p className="text-sm text-slate-400">Manage user accounts, roles, and authorization status across the platform.</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2">
          <UserPlus className="h-4 w-4" /> Add User
        </Button>
      </div>

      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-slate-950 border-slate-800 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="text-xs text-slate-400">
              Showing {filteredUsers.length} of {users.length} users
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="border-slate-800">
              <TableRow className="border-slate-800 hover:bg-slate-950">
                <TableHead className="text-slate-400">User</TableHead>
                <TableHead className="text-slate-400">Role</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Joined</TableHead>
                <TableHead className="text-right text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => (
                <TableRow key={u.id} className="border-slate-800 hover:bg-slate-950/50">
                  <TableCell className="font-medium text-white">
                    <div>
                      <p className="text-slate-200">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>{getRoleBadge(u.role)}</TableCell>
                  <TableCell>
                    <Badge variant={u.status === "ACTIVE" ? "default" : "destructive"} className={u.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : ""}>
                      {u.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-400 text-xs">{u.joined}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-slate-800">Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
