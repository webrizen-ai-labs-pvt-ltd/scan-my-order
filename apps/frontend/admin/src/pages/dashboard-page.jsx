import React, { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
} from "@repo/ui"
import {
  Users,
  Store,
  CreditCard,
  TrendingUp,
  Activity,
  Plus,
  ArrowRight,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Crown,
  IndianRupee,
  ArrowUpRight,
} from "lucide-react"
import { useAuth } from "../context/auth-context.jsx"
import { fetchUsersApi, fetchStoresApi } from "../services/admin-api.js"
import { fetchPlansApi, fetchStoreSubscriptionsApi } from "../services/subscription-api.js"

export default function DashboardPage() {
  const { token, user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [stores, setStores] = useState([])
  const [plans, setPlans] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    async function loadDashboardData() {
      if (!token) return
      setLoading(true)
      try {
        const [usersRes, storesRes, plansRes, subsRes] = await Promise.all([
          fetchUsersApi(token).catch(() => ({ data: [] })),
          fetchStoresApi(token).catch(() => ({ data: [] })),
          fetchPlansApi(token).catch(() => ({ data: [] })),
          fetchStoreSubscriptionsApi(token).catch(() => ({ data: [] })),
        ])

        if (usersRes?.data) setUsers(usersRes.data)
        if (storesRes?.data) setStores(storesRes.data)
        if (plansRes?.data) setPlans(plansRes.data)
        if (subsRes?.data) setSubscriptions(subsRes.data)
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to load dashboard metrics.")
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [token])

  // Analytics Calculations
  const activeStores = stores.length
  const totalUsers = users.length

  // User Role Breakdown
  const roleCounts = users.reduce((acc, u) => {
    const r = u.role || "CUSTOMER"
    acc[r] = (acc[r] || 0) + 1
    return acc
  }, {})

  // Subscription Analytics
  const activeSubscriptions = subscriptions.filter((s) => s.status === "ACTIVE")
  const mrr = activeSubscriptions.reduce((sum, s) => sum + (s.amountPaid || s.plan?.price || 0), 0)
  const arr = mrr * 12

  // Plan adoption calculation
  const planAdoption = plans.map((plan) => {
    const count = subscriptions.filter((s) => s.planId === plan.id || s.plan?.code === plan.code).length
    const percentage = subscriptions.length > 0 ? Math.round((count / subscriptions.length) * 100) : 0
    return { ...plan, count, percentage }
  })

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-sm text-zinc-500">
            Welcome back, <span className="text-zinc-300 font-medium">{user?.name || "Administrator"}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/dashboard/stores/onboard">
            <Button variant="ghost" className="text-zinc-400 hover:text-white hover:bg-zinc-800 gap-2 text-sm">
              <Plus className="h-4 w-4" /> Onboard Store
            </Button>
          </Link>
          <Link to="/dashboard/subscriptions/assign">
            <Button className="bg-white hover:bg-zinc-200 text-zinc-900 font-medium gap-2 text-sm">
              <CreditCard className="h-4 w-4" /> PhonePe Checkout
            </Button>
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 text-sm bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-4">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-3">
          <LoaderCircle className="h-8 w-8 animate-spin" />
          <p className="text-sm">Fetching analytics...</p>
        </div>
      ) : (
        <>
          {/* KPI Metrics - Minimal Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* MRR */}
            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 relative overflow-hidden group hover:border-zinc-700 transition-colors">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">MRR</p>
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex items-baseline gap-1">
                  <IndianRupee className="h-4 w-4 text-zinc-500" />
                  <span className="text-3xl font-bold text-white tracking-tight">{mrr.toLocaleString()}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-2">ARR: ₹{arr.toLocaleString()}</p>
              </CardContent>
            </Card>

            {/* Active Stores */}
            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 relative overflow-hidden group hover:border-zinc-700 transition-colors">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-zinc-400 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Active Stores</p>
                  <Store className="h-4 w-4 text-zinc-400" />
                </div>
                <span className="text-3xl font-bold text-white tracking-tight">{activeStores}</span>
                <Link to="/dashboard/stores" className="text-xs text-zinc-500 hover:text-white mt-2 inline-flex items-center gap-1 transition-colors">
                  View all <ArrowUpRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            {/* Users */}
            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 relative overflow-hidden group hover:border-zinc-700 transition-colors">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Users</p>
                  <Users className="h-4 w-4 text-indigo-400" />
                </div>
                <span className="text-3xl font-bold text-white tracking-tight">{totalUsers}</span>
                <p className="text-xs text-zinc-500 mt-2">{roleCounts.OWNER || 0} store owners</p>
              </CardContent>
            </Card>

            {/* Subscriptions */}
            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 relative overflow-hidden group hover:border-zinc-700 transition-colors">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Subscriptions</p>
                  <CreditCard className="h-4 w-4 text-blue-400" />
                </div>
                <span className="text-3xl font-bold text-white tracking-tight">{activeSubscriptions.length}</span>
                <p className="text-xs text-zinc-500 mt-2">{plans.length} pricing plans</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Plan Adoption - Left 2/3 */}
            <Card className="lg:col-span-2 bg-zinc-900 border-zinc-800 text-zinc-100">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base text-white">Plan Adoption</CardTitle>
                    <CardDescription className="text-sm text-zinc-500 mt-1">
                      Subscription distribution across tiers
                    </CardDescription>
                  </div>
                  <Link to="/dashboard/subscriptions">
                    <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-zinc-800 text-sm">
                      Manage Plans
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {planAdoption.length === 0 ? (
                  <p className="text-sm text-zinc-500 py-6 text-center">No plans configured yet.</p>
                ) : (
                  <div className="space-y-5">
                    {planAdoption.map((plan) => (
                      <div key={plan.id} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-white">{plan.name}</span>
                          <span className="text-zinc-500">{plan.count} subs</span>
                        </div>
                        <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-800">
                          <div
                            className="bg-zinc-300 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(plan.percentage, plan.count > 0 ? 15 : 0)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-zinc-800">
                  <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800">
                    <p className="text-xs text-zinc-500 mb-1">Total Revenue</p>
                    <p className="text-lg font-bold text-white">₹{mrr.toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800">
                    <p className="text-xs text-zinc-500 mb-1">Avg. Per Sub</p>
                    <p className="text-lg font-bold text-white">
                      ₹{activeSubscriptions.length ? Math.round(mrr / activeSubscriptions.length).toLocaleString() : 0}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800">
                    <p className="text-xs text-zinc-500 mb-1">Gateway</p>
                    <p className="text-sm font-medium text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> Active
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Right Column */}
            <div className="space-y-6">
              {/* User Roles */}
              <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base text-white">User Roles</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
                    <span className="text-sm text-zinc-300">Administrators</span>
                    <span className="text-sm font-semibold text-white">{roleCounts.ADMIN || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
                    <span className="text-sm text-zinc-300">Store Owners</span>
                    <span className="text-sm font-semibold text-white">{roleCounts.OWNER || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
                    <span className="text-sm text-zinc-300">Staff</span>
                    <span className="text-sm font-semibold text-white">
                      {(roleCounts.MANAGER || 0) + (roleCounts.WAITER || 0) + (roleCounts.KITCHEN || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
                    <span className="text-sm text-zinc-300">Customers</span>
                    <span className="text-sm font-semibold text-white">{roleCounts.CUSTOMER || 0}</span>
                  </div>
                </CardContent>
              </Card>

              {/* System Status */}
              <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-400" /> System Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Backend API</span>
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Operational
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Database</span>
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Connected
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Passkey Auth</span>
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4" /> Enabled
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Mailer</span>
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Ready
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Store List */}
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base text-white">Onboarded Stores</CardTitle>
                  <CardDescription className="text-sm text-zinc-500 mt-1">
                    Quick access to store management
                  </CardDescription>
                </div>
                <Link to="/dashboard/stores">
                  <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-zinc-800 text-sm">
                    View All
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {stores.length === 0 ? (
                <p className="text-sm text-zinc-500 py-8 text-center">No stores onboarded yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {stores.slice(0, 6).map((store) => (
                    <div key={store.id} className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 transition-colors group">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center">
                          <Store className="h-4 w-4 text-zinc-400" />
                        </div>
                        <Link to={`/dashboard/stores/${store.id}/manage`}>
                          <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-white hover:bg-zinc-800 p-1 h-7 w-7">
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                      <p className="text-sm font-medium text-white truncate">{store.name}</p>
                      <p className="text-xs text-zinc-500 mt-1">{store.owner?.name || "Unassigned"}</p>
                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-800">
                        <span className="text-xs text-zinc-500">{store.menuItems?.length || 0} items</span>
                        <span className="text-xs text-emerald-400">Active</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}