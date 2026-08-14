import React from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from "@repo/ui"
import { Users, Store, ShieldAlert, Activity } from "lucide-react"

export default function DashboardPage() {
  const stats = [
    { title: "Total Users", count: "1,248", change: "+12% this month", icon: Users, color: "text-indigo-400" },
    { title: "Active Stores", count: "84", change: "+5 new stores", icon: Store, color: "text-emerald-400" },
    { title: "System Health", count: "99.9%", change: "All services operational", icon: Activity, color: "text-blue-400" },
    { title: "Pending Audits", count: "3", change: "Requires review", icon: ShieldAlert, color: "text-amber-400" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">System Overview</h1>
        <p className="text-sm text-slate-400">Monitor ecosystem health, user accounts, and restaurant store metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <Card key={i} className="bg-slate-900 border-slate-800 text-slate-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">{stat.title}</CardTitle>
                <Icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{stat.count}</div>
                <p className="text-xs text-slate-500 mt-1">{stat.change}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg text-white">Recent System Activities</CardTitle>
              <CardDescription className="text-slate-400">Live operational logs across all restaurant stores.</CardDescription>
            </div>
            <Badge variant="outline" className="border-slate-700 text-slate-300">Live Stream</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <div>
              <p className="text-sm font-medium text-slate-200">New Store Onboarded: "La Trattoria Bistro"</p>
              <p className="text-xs text-slate-500">Owner ID: owner_9281a • 10 minutes ago</p>
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Success</Badge>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <div>
              <p className="text-sm font-medium text-slate-200">Role Upgrade: User "john.waiter@gmail.com" to WAITER</p>
              <p className="text-xs text-slate-500">Action by Admin • 45 minutes ago</p>
            </div>
            <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">Updated</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
