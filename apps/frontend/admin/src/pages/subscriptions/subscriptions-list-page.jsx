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
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@repo/ui"
import {
  CreditCard,
  Plus,
  Send,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Store,
  Layers,
  Edit,
  Trash2,
  Check,
  IndianRupee,
  Phone,
  Shield,
} from "lucide-react"
import { useAuth } from "../../context/auth-context.jsx"
import {
  fetchPlansApi,
  fetchStoreSubscriptionsApi,
  deletePlanApi,
  deleteStoreSubscriptionApi,
} from "../../services/subscription-api.js"

export default function SubscriptionsListPage() {
  const { token } = useAuth()
  const [activeTab, setActiveTab] = useState("subscriptions")
  const [subscriptions, setSubscriptions] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ text: "", error: false })

  useEffect(() => {
    async function loadData() {
      if (!token) return
      setLoading(true)
      try {
        const [subsRes, plansRes] = await Promise.all([
          fetchStoreSubscriptionsApi(token),
          fetchPlansApi(token),
        ])
        if (subsRes?.data) setSubscriptions(subsRes.data)
        if (plansRes?.data) setPlans(plansRes.data)
      } catch (err) {
        setMsg({ text: err instanceof Error ? err.message : "Failed to load subscriptions data.", error: true })
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [token])

  const handleDeletePlan = async (planId) => {
    if (!window.confirm("Are you sure you want to delete this subscription plan?")) return
    try {
      await deletePlanApi(token, planId)
      setPlans((prev) => prev.filter((p) => p.id !== planId))
      setMsg({ text: "Subscription plan deleted.", error: false })
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Failed to delete plan.", error: true })
    }
  }

  const handleDeleteSubscription = async (subId) => {
    if (!window.confirm("Are you sure you want to delete this non-active store subscription record?")) return
    try {
      await deleteStoreSubscriptionApi(token, subId)
      setSubscriptions((prev) => prev.filter((s) => s.id !== subId))
      setMsg({ text: "Store subscription record deleted successfully.", error: false })
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Failed to delete store subscription.", error: true })
    }
  }

  const formatDate = (date) => {
    if (!date) return "—"
    return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Subscriptions</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage subscription tiers and store billing
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/dashboard/subscriptions/assign">
            <Button variant="ghost" className="text-zinc-400 hover:text-white hover:bg-zinc-800 gap-2 text-sm">
              <Send className="h-4 w-4" /> Assign Plan
            </Button>
          </Link>
          <Link to="/dashboard/subscriptions/plans/new">
            <Button className="bg-white hover:bg-zinc-200 text-zinc-900 font-medium gap-2 text-sm">
              <Plus className="h-4 w-4" /> Create Plan
            </Button>
          </Link>
        </div>
      </div>

      {msg.text && (
        <div
          className={`flex items-center gap-2 text-sm rounded-lg px-4 py-3 border ${
            msg.error
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}
        >
          {msg.error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {msg.text}
        </div>
      )}

      {/* Tabs Control - Modern pill style */}
      <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("subscriptions")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === "subscriptions"
              ? "bg-zinc-800 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Store className="h-4 w-4 inline mr-2" /> Store Subscriptions
          <span className="ml-2 text-xs text-zinc-500">({subscriptions.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("plans")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === "plans"
              ? "bg-zinc-800 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Layers className="h-4 w-4 inline mr-2" /> Plans
          <span className="ml-2 text-xs text-zinc-500">({plans.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-2">
          <LoaderCircle className="h-6 w-6 animate-spin" />
          <p className="text-sm">Loading subscriptions and plans...</p>
        </div>
      ) : activeTab === "subscriptions" ? (
        /* Tab 1: Store Subscriptions */
        <div className="space-y-4">
          {subscriptions.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-14 h-14 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center mx-auto mb-4">
                <CreditCard className="h-7 w-7 text-zinc-500" />
              </div>
              <p className="text-base text-zinc-400 font-medium">No store subscriptions yet</p>
              <p className="text-sm text-zinc-500 mt-1 mb-6">Assign a plan to get started</p>
              <Link to="/dashboard/subscriptions/assign">
                <Button className="bg-white hover:bg-zinc-200 text-zinc-900 font-medium gap-2 text-sm">
                  <Send className="h-4 w-4" /> Assign Subscription
                </Button>
              </Link>
            </div>
          ) : (
            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider py-4">Store</TableHead>
                        <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Plan</TableHead>
                        <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Billing Period</TableHead>
                        <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Status</TableHead>
                        <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Payment Ref</TableHead>
                        <TableHead className="text-right text-zinc-500 text-xs font-medium uppercase tracking-wider">Amount</TableHead>
                        <TableHead className="text-right text-zinc-500 text-xs font-medium uppercase tracking-wider">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions.map((sub) => (
                        <TableRow key={sub.id} className="border-zinc-800 hover:bg-zinc-950/50 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                                <Store className="h-4 w-4 text-zinc-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-white">{sub.store?.name || "Unassigned"}</p>
                                <p className="text-xs text-zinc-500">{sub.store?.owner?.name || "—"}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-zinc-300">{sub.plan?.name || "Standard"}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm text-zinc-400">
                              <Calendar className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
                              <span className="text-xs">
                                {formatDate(sub.startDate)} → {formatDate(sub.endDate)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                sub.status === "ACTIVE"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : sub.status === "PENDING"
                                  ? "bg-amber-500/10 text-amber-400"
                                  : "bg-red-500/10 text-red-400"
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                sub.status === "ACTIVE"
                                  ? "bg-emerald-400"
                                  : sub.status === "PENDING"
                                  ? "bg-amber-400"
                                  : "bg-red-400"
                              }`} />
                              {sub.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-mono text-zinc-500">
                              {sub.phonepeMerchantTxnId || sub.phonepeTxnId || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <IndianRupee className="h-3.5 w-3.5 text-zinc-500" />
                              <span className="text-sm font-semibold text-white">
                                {sub.amountPaid || sub.plan?.price || 0}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {sub.status !== "ACTIVE" || sub.paymentStatus !== "SUCCESS" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSubscription(sub.id)}
                                className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 p-1 h-8 w-8"
                                title="Delete inactive / pending subscription record"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Shield className="h-4 w-4 text-zinc-600 inline" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* Tab 2: Subscription Plans Catalog */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan, index) => (
            <Card 
              key={plan.id} 
              className="relative bg-zinc-900 border-zinc-800 text-zinc-100 overflow-hidden group hover:border-zinc-600 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.05)]"
            >
              {/* Gradient accent line at top */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
                index % 3 === 0 
                  ? "from-zinc-400 via-zinc-200 to-zinc-400" 
                  : index % 3 === 1 
                  ? "from-zinc-500 via-zinc-300 to-zinc-500"
                  : "from-zinc-600 via-zinc-400 to-zinc-600"
              } opacity-50 group-hover:opacity-100 transition-opacity`} 
              />
              
              {/* Subtle background pattern */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.03),transparent_50%)] pointer-events-none" />
              
              <CardHeader className="pb-4 relative">
                {/* Plan code badge */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider bg-zinc-800/50 px-2 py-1 rounded-md border border-zinc-700/50">
                    {plan.code}
                  </span>
                  {index === 0 && (
                    <span className="text-[10px] font-medium text-zinc-400 bg-zinc-800 px-2 py-1 rounded-full">
                      Most Popular
                    </span>
                  )}
                </div>

                {/* Price section */}
                <div className="flex items-end justify-between mb-4">
                  <div className="flex items-start gap-1">
                    <IndianRupee className="h-5 w-5 text-zinc-400 mt-1.5" />
                    <span className="text-4xl font-bold text-white tracking-tight">{plan.price}</span>
                  </div>
                  <span className="text-xs text-zinc-500 mb-1">/{plan.interval === "YEARLY" ? "year" : "month"}</span>
                </div>

                <CardTitle className="text-lg text-white">{plan.name}</CardTitle>
                <CardDescription className="text-sm text-zinc-500 mt-1">
                  {plan.description || "Full POS & QR dining access."}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-0 relative">
                {/* Limits section with icons */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 group-hover:border-zinc-700 transition-colors">
                    <Store className="h-4 w-4 text-zinc-500 mb-1.5" />
                    <p className="text-lg font-bold text-white leading-none">{plan.maxStores}</p>
                    <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">Stores</p>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 group-hover:border-zinc-700 transition-colors">
                    <Layers className="h-4 w-4 text-zinc-500 mb-1.5" />
                    <p className="text-lg font-bold text-white leading-none">{plan.maxMenuItems}</p>
                    <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">Menu Items</p>
                  </div>
                </div>

                {/* Features */}
                {plan.features && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Features</p>
                    <div className="space-y-1.5">
                      {plan.features.split(",").slice(0, 4).map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-zinc-400">
                          <span className="w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                          <span className="truncate">{feat.trim()}</span>
                        </div>
                      ))}
                      {plan.features.split(",").length > 4 && (
                        <p className="text-xs text-zinc-600 pl-3">+{plan.features.split(",").length - 4} more features</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                  <Link to={`/dashboard/subscriptions/plans/${plan.id}/edit`}>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-zinc-400 hover:text-white hover:bg-zinc-800 text-sm gap-1.5 group/edit"
                    >
                      <Edit className="h-3.5 w-3.5" /> 
                      <span className="group-hover/edit:underline underline-offset-2">Edit</span>
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeletePlan(plan.id)}
                    className="text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add New Plan Card */}
          <Link to="/dashboard/subscriptions/plans/new">
            <Card className="relative bg-zinc-900/30 border-2 border-dashed border-zinc-800 text-zinc-100 h-full min-h-[350px] flex items-center justify-center hover:border-zinc-600 hover:bg-zinc-900/50 transition-all cursor-pointer group overflow-hidden">
              {/* Subtle gradient on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-zinc-800/0 group-hover:to-zinc-800/20 transition-all opacity-0 group-hover:opacity-100 pointer-events-none" />
              
              <CardContent className="text-center relative">
                <div className="w-14 h-14 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-zinc-800 group-hover:border-zinc-600 transition-all duration-300">
                  <Plus className="h-7 w-7 text-zinc-500 group-hover:text-white group-hover:rotate-90 transition-all duration-300" />
                </div>
                <p className="text-base font-medium text-zinc-400 group-hover:text-white transition-colors">
                  Create New Plan
                </p>
                <p className="text-sm text-zinc-600 mt-1.5">Design a custom subscription tier</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}
    </div>
  )
}