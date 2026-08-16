import React, { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@repo/ui"
import {
  Crown,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  ShieldAlert,
  Zap,
  IndianRupee,
  Building2,
  ShieldCheck,
  Phone,
  Store,
  CreditCard,
  Layers,
  X,
} from "lucide-react"
import { useAuth } from "../../context/auth-context.jsx"
import { fetchMyStoreApi } from "../../services/store-api.js"
import {
  fetchPlansApi,
  fetchStoreSubscriptionsApi,
  initiatePhonePeCheckoutApi,
  verifyPhonePePaymentApi,
} from "../../services/subscription-api.js"

export default function SubscriptionsPage() {
  const { user, token } = useAuth()
  const [searchParams] = useSearchParams()
  const isOwner = user?.role === "OWNER"

  // Data States
  const [store, setStore] = useState(null)
  const [plans, setPlans] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [subscribingPlanId, setSubscribingPlanId] = useState(null)
  const [msg, setMsg] = useState({ text: "", error: false })

  // PhonePe Verification State
  const [verifyingState, setVerifyingState] = useState({
    active: false,
    txnId: "",
    status: "idle", // 'verifying' | 'success' | 'error' | 'idle'
    message: "",
  })

  // Billing Cycle Filter Tab: 'MONTHLY' | 'YEARLY' | 'ALL'
  const [billingCycle, setBillingCycle] = useState("MONTHLY")

  // Verify PhonePe Payment helper
  const verifyPayment = useCallback(
    async (merchantTxnId) => {
      setVerifyingState({
        active: true,
        txnId: merchantTxnId || "",
        status: "verifying",
        message: merchantTxnId
          ? `Connecting to PhonePe servers to verify transaction ref: ${merchantTxnId}...`
          : "Checking PhonePe payment status for your pending store subscription...",
      })

      try {
        await verifyPhonePePaymentApi(token, { merchantTransactionId: merchantTxnId })
        setVerifyingState({
          active: true,
          txnId: merchantTxnId || "",
          status: "success",
          message: "PhonePe payment verified successfully! Your store subscription is now ACTIVE.",
        })
        window.history.replaceState({}, document.title, window.location.pathname)

        // Reload data to reflect active status
        const storeRes = await fetchMyStoreApi(token).catch(() => ({ data: null }))
        setStore(storeRes?.data || null)
        const plansRes = await fetchPlansApi().catch(() => ({ data: [] }))
        setPlans(Array.isArray(plansRes?.data) ? plansRes.data : [])
        const subsRes = await fetchStoreSubscriptionsApi(token).catch(() => ({ data: [] }))
        setSubscriptions(Array.isArray(subsRes?.data) ? subsRes.data : [])
      } catch (err) {
        setVerifyingState({
          active: true,
          txnId: merchantTxnId || "",
          status: "error",
          message: err instanceof Error ? err.message : "Failed to verify PhonePe payment status.",
        })
      }
    },
    [token]
  )

  // Load All Subscriptions & Plans
  const loadData = useCallback(async () => {
    if (!token || !isOwner) return
    setIsLoading(true)

    try {
      const storeRes = await fetchMyStoreApi(token).catch(() => ({ data: null }))
      const storeData = storeRes?.data
      setStore(storeData)

      const plansRes = await fetchPlansApi().catch(() => ({ data: [] }))
      setPlans(Array.isArray(plansRes?.data) ? plansRes.data : [])

      const subsRes = await fetchStoreSubscriptionsApi(token).catch(() => ({ data: [] }))
      const fetchedSubs = Array.isArray(subsRes?.data) ? subsRes.data : []
      setSubscriptions(fetchedSubs)

      // Auto-trigger verification if returning with query params OR if a PENDING subscription exists
      const txnId =
        searchParams.get("merchantTransactionId") ||
        searchParams.get("transactionId") ||
        searchParams.get("phonepeTxnId") ||
        searchParams.get("txnId")

      const pendingSub = fetchedSubs.find((s) => s.status === "PENDING" || s.paymentStatus === "PENDING")

      if (txnId || pendingSub) {
        const targetTxn = txnId || pendingSub?.phonepeMerchantTxnId
        verifyPayment(targetTxn)
      }
    } catch (err) {
      console.error("Failed to load subscription data:", err)
      setMsg({
        text: err instanceof Error ? err.message : "Failed to load subscriptions.",
        error: true,
      })
    } finally {
      setIsLoading(false)
    }
  }, [token, isOwner, searchParams, verifyPayment])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Restrict Access Failsafe for non-OWNER users
  if (!isOwner) {
    return (
      <div className="p-8 max-w-md mx-auto my-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto">
          <ShieldAlert className="h-8 w-8 text-zinc-400" />
        </div>
        <h2 className="text-lg font-semibold text-white">Access Restricted</h2>
        <p className="text-sm text-zinc-500 leading-relaxed">
          Subscription management is restricted to store owners only.
        </p>
      </div>
    )
  }

  // Active Subscription
  const activeSubscription = subscriptions.find(
    (sub) => sub.status === "ACTIVE" && sub.paymentStatus === "SUCCESS"
  )
  const activePlanPrice = activeSubscription?.plan?.price || 0

  // Filter plans by selected billing cycle tab
  const filteredPlans = plans.filter((plan) => {
    if (billingCycle === "ALL") return true
    const planCycle = (plan.interval || "MONTHLY").toUpperCase()
    return planCycle === billingCycle
  })

  // Initiate PhonePe Checkout and Redirect to Official Gateway
  const handleInitiateCheckout = async (plan) => {
    if (!store?.id) {
      setMsg({
        text: "Please link a store establishment to your account before subscribing to a plan.",
        error: true,
      })
      return
    }

    if (activeSubscription && plan.price < activePlanPrice) {
      setMsg({
        text: "Downgrading to a lower subscription tier is not allowed during an active higher tier subscription.",
        error: true,
      })
      return
    }

    setMsg({ text: "", error: false })
    setSubscribingPlanId(plan.id)

    try {
      const currentUrl = window.location.href.split("?")[0]
      const res = await initiatePhonePeCheckoutApi(token, {
        storeId: store.id,
        planId: plan.id,
        redirectUrl: currentUrl,
        sendEmail: true,
      })

      const checkoutUrl = res?.data?.checkoutUrl
      if (checkoutUrl) {
        // Redirect user directly to PhonePe payment gateway URL
        window.location.href = checkoutUrl
      } else {
        throw new Error("PhonePe checkout link was not returned by server.")
      }
    } catch (err) {
      setMsg({
        text: err instanceof Error ? err.message : "Failed to initiate PhonePe payment.",
        error: true,
      })
      setSubscribingPlanId(null)
    }
  }

  const formatDate = (date) => {
    if (!date) return "—"
    try {
      return new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    } catch {
      return "—"
    }
  }

  // Loading Skeleton
  if (isLoading && !verifyingState.active) {
    return (
      <div className="space-y-8 w-full">
        <div className="border-b border-zinc-800 pb-6">
          <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-zinc-800/50 rounded animate-pulse" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
              <div className="h-4 w-20 bg-zinc-800 rounded animate-pulse" />
              <div className="h-8 w-32 bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-full bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-zinc-800 rounded animate-pulse" />
              <div className="h-10 w-full bg-zinc-800 rounded animate-pulse mt-4" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 w-full">
      {/* 0. PROMINENT PHONEPE PAYMENT VERIFICATION BANNER */}
      {verifyingState.active && (
        <Card
          className={`border relative overflow-hidden transition-all duration-500 shadow-xl ${
            verifyingState.status === "verifying"
              ? "bg-zinc-900 border-amber-500/50 text-amber-300"
              : verifyingState.status === "success"
              ? "bg-zinc-900 border-emerald-500/50 text-emerald-300"
              : "bg-zinc-900 border-red-500/50 text-red-300"
          }`}
        >
          {/* Top accent glow line */}
          <div
            className={`h-1.5 bg-gradient-to-r ${
              verifyingState.status === "verifying"
                ? "from-amber-500 via-yellow-400 to-amber-600 animate-pulse"
                : verifyingState.status === "success"
                ? "from-emerald-500 via-teal-400 to-emerald-600"
                : "from-red-500 via-rose-400 to-red-600"
            }`}
          />

          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${
                    verifyingState.status === "verifying"
                      ? "bg-amber-950/60 border-amber-800/60 text-amber-400"
                      : verifyingState.status === "success"
                      ? "bg-emerald-950/60 border-emerald-800/60 text-emerald-400"
                      : "bg-red-950/60 border-red-800/60 text-red-400"
                  }`}
                >
                  {verifyingState.status === "verifying" ? (
                    <LoaderCircle className="h-6 w-6 animate-spin text-amber-400" />
                  ) : verifyingState.status === "success" ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-red-400" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">
                      {verifyingState.status === "verifying"
                        ? "Verifying PhonePe Payment Status..."
                        : verifyingState.status === "success"
                        ? "PhonePe Payment Verified & Activated!"
                        : "Payment Verification Notice"}
                    </h3>
                    {verifyingState.txnId && (
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {verifyingState.txnId}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400">{verifyingState.message}</p>
                </div>
              </div>

              {verifyingState.status !== "verifying" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setVerifyingState({ active: false, txnId: "", status: "idle", message: "" })}
                  className="text-zinc-400 hover:text-white shrink-0"
                >
                  <X className="h-4 w-4" /> Close
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Page Header */}
      <div className="border-b border-zinc-800 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">Subscriptions</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              PhonePe Ready
            </span>
          </div>
          <p className="text-sm text-zinc-500">
            Subscribe your store to digital menu & POS tiers
          </p>
        </div>

        {store && (
          <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 px-4 py-2.5 rounded-lg">
            <div className="w-8 h-8 rounded-md bg-zinc-800 flex items-center justify-center">
              <Store className="h-4 w-4 text-zinc-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{store.name || "Store"}</p>
              <p className="text-xs text-zinc-500">{store.id ? store.id.slice(0, 8) : "—"}...</p>
            </div>
          </div>
        )}
      </div>

      {/* Global Status Message */}
      {msg.text && (
        <div
          className={`flex items-center gap-2 text-sm rounded-lg p-4 border ${
            msg.error
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}
        >
          {msg.error ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          )}
          <p>{msg.text}</p>
        </div>
      )}

      {/* Unlinked Store Empty Banner */}
      {!store && (
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardContent className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto">
              <Building2 className="h-7 w-7 text-zinc-500" />
            </div>
            <h3 className="text-base font-semibold text-white">No Store Linked</h3>
            <p className="text-sm text-zinc-500 max-w-md mx-auto">
              Contact your administrator to link a store to your account.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 1. Active Subscription Card */}
      {activeSubscription && (
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-zinc-300 to-transparent" />
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
                  <Crown className="h-6 w-6 text-zinc-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-semibold text-white">
                      {activeSubscription.plan?.name || "Active Plan"}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                      <span className="w-1 h-1 rounded-full bg-emerald-400" /> Active
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500">
                    Expires {formatDate(activeSubscription.endDate)}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <IndianRupee className="h-4 w-4 text-zinc-500" />
                  <span className="text-2xl font-bold text-white">
                    {activeSubscription.amountPaid || activeSubscription.plan?.price || 0}
                  </span>
                  <span className="text-sm text-zinc-500">
                    /{activeSubscription.plan?.interval === "YEARLY" ? "yr" : "mo"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 2. Available Subscription Plans Catalog */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Available Plans</h2>
            <p className="text-sm text-zinc-500">Choose a subscription tier for your store</p>
          </div>

          {/* Billing Cycle Tabs (Monthly vs Yearly vs All) */}
          <div className="inline-flex p-1 bg-zinc-950 border border-zinc-800 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => setBillingCycle("MONTHLY")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                billingCycle === "MONTHLY"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("YEARLY")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                billingCycle === "YEARLY"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Yearly Billing
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                Save 20%
              </span>
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("ALL")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                billingCycle === "ALL"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              All Tiers
            </button>
          </div>
        </div>

        {filteredPlans.length === 0 ? (
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardContent className="py-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto">
                <Layers className="h-7 w-7 text-zinc-500" />
              </div>
              <h3 className="text-base font-semibold text-white">No Plans in this Category</h3>
              <p className="text-sm text-zinc-500 max-w-md mx-auto">
                No subscription plans are available for the selected billing cycle tab.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredPlans.map((plan, index) => {
              const isCurrentPlan = activeSubscription?.planId === plan.id
              const isSubscribingThis = subscribingPlanId === plan.id
              
              // Downgrade Protection: If owner has active sub and this plan is cheaper than active plan
              const isDowngrade = Boolean(activeSubscription && !isCurrentPlan && plan.price < activePlanPrice)
              const isUpgrade = Boolean(activeSubscription && !isCurrentPlan && plan.price > activePlanPrice)

              const featureList = Array.isArray(plan.features)
                ? plan.features
                : typeof plan.features === "string"
                ? plan.features.split(",").map((f) => f.trim()).filter(Boolean)
                : ["Digital QR Menu", "Live POS Dispatch", "Sales Analytics"]

              return (
                <Card
                  key={plan.id}
                  className={`relative bg-zinc-900 border text-zinc-100 overflow-hidden group hover:border-zinc-600 transition-all duration-300 ${
                    isCurrentPlan ? "border-zinc-500" : "border-zinc-800"
                  }`}
                >
                  {/* Gradient accent line */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 bg-linear-to-r ${
                      index % 3 === 0
                        ? "from-zinc-400 via-zinc-200 to-zinc-400"
                        : index % 3 === 1
                        ? "from-zinc-500 via-zinc-300 to-zinc-500"
                        : "from-zinc-600 via-zinc-400 to-zinc-600"
                    } opacity-50 group-hover:opacity-100 transition-opacity`}
                  />

                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                        {plan.interval || "MONTHLY"}
                      </span>
                      {isCurrentPlan && (
                        <span className="text-[10px] font-medium text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded-full">
                          Current Plan
                        </span>
                      )}
                      {isDowngrade && (
                        <span className="text-[10px] font-medium text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded-full">
                          Lower Tier
                        </span>
                      )}
                    </div>

                    <div className="flex items-end justify-between mb-2">
                      <div className="flex items-start gap-1">
                        <IndianRupee className="h-5 w-5 text-zinc-400 mt-1.5" />
                        <span className="text-4xl font-bold text-white tracking-tight">
                          {plan.price || 0}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-500 mb-1">
                        /{plan.interval === "YEARLY" ? "year" : "month"}
                      </span>
                    </div>

                    <CardTitle className="text-lg text-white">{plan.name || "Plan"}</CardTitle>
                    {plan.description && (
                      <CardDescription className="text-sm text-zinc-500 mt-1">
                        {plan.description}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-4 pt-0">
                    {/* Limits */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
                        <Building2 className="h-4 w-4 text-zinc-500 mb-1.5" />
                        <p className="text-lg font-bold text-white leading-none">{plan.maxStores || 1}</p>
                        <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">Stores</p>
                      </div>
                      <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
                        <Zap className="h-4 w-4 text-zinc-500 mb-1.5" />
                        <p className="text-lg font-bold text-white leading-none">{plan.maxMenuItems || 100}</p>
                        <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">Menu Items</p>
                      </div>
                    </div>

                    {/* Features */}
                    {featureList.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Features</p>
                        <div className="space-y-1.5">
                          {featureList.slice(0, 4).map((feat, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-zinc-400">
                              <span className="w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                              <span className="truncate">{feat}</span>
                            </div>
                          ))}
                          {featureList.length > 4 && (
                            <p className="text-xs text-zinc-600 pl-3">+{featureList.length - 4} more</p>
                          )}
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={() => handleInitiateCheckout(plan)}
                      disabled={isCurrentPlan || isDowngrade || !store || isSubscribingThis}
                      
                    >
                      {isSubscribingThis ? (
                        <>
                          <LoaderCircle className="h-4 w-4 animate-spin" /> Redirecting to PhonePe...
                        </>
                      ) : isCurrentPlan ? (
                        <>
                          <ShieldCheck className="h-4 w-4" /> Active Plan
                        </>
                      ) : isDowngrade ? (
                        <>
                          <AlertCircle className="h-4 w-4 text-zinc-600" /> Lower Tier (Downgrade Restricted)
                        </>
                      ) : !store ? (
                        <>
                          <Building2 className="h-4 w-4" /> No Store Linked
                        </>
                      ) : isUpgrade ? (
                        <>
                          <Crown className="h-4 w-4 text-amber-400" /> Upgrade to {plan.name}
                        </>
                      ) : (
                        <>
                          <Phone className="h-4 w-4" /> Subscribe with PhonePe
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* 3. Subscription History Table (Read-Only for Operations, Deletion Restricted to Admin) */}
      <div className="space-y-4 pt-4 border-t border-zinc-800">
        <h2 className="text-lg font-semibold text-white">Transaction History</h2>

        {subscriptions.length === 0 ? (
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardContent className="py-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto">
                <CreditCard className="h-7 w-7 text-zinc-500" />
              </div>
              <h3 className="text-base font-semibold text-white">No Transactions</h3>
              <p className="text-sm text-zinc-500 max-w-md mx-auto">
                You haven't made any subscription transactions yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider py-4">Plan</TableHead>
                  <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Amount</TableHead>
                  <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Reference</TableHead>
                  <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Start</TableHead>
                  <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Expiry</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => (
                  <TableRow key={sub.id} className="border-zinc-800 hover:bg-zinc-950/50 transition-colors">
                    <TableCell className="font-medium text-white text-sm">
                      {sub.plan?.name || "Subscription Plan"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-zinc-300">
                        <IndianRupee className="h-3.5 w-3.5 text-zinc-500" />
                        {sub.amountPaid || sub.plan?.price || 0}
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
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            sub.status === "ACTIVE"
                              ? "bg-emerald-400"
                              : sub.status === "PENDING"
                              ? "bg-amber-400"
                              : "bg-red-400"
                          }`}
                        />
                        {sub.status || "UNKNOWN"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-zinc-500">
                      {sub.phonepeMerchantTxnId || (sub.id ? sub.id.slice(0, 12) : "—")}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-400">
                      {formatDate(sub.startDate)}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-400">
                      {formatDate(sub.endDate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  )
}