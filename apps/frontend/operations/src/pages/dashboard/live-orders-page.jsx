import React, { useState, useEffect, useCallback } from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Input,
  Separator,
  Skeleton,
} from "@repo/ui"
import {
  Receipt,
  Clock,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  RefreshCw,
  ChefHat,
  Sparkles,
  Utensils,
  X,
  Send,
  IndianRupee,
  MessageSquare,
  ShieldCheck,
  CreditCard,
  Banknote,
  Users,
  Search,
  Filter,
} from "lucide-react"
import { useAuth } from "../../context/auth-context.jsx"
import { fetchMyStoreApi } from "../../services/store-api.js"
import {
  fetchStoreOrdersApi,
  verifyPostpaidOrderApi,
  updateOrderStatusApi,
} from "../../services/order-api.js"

export default function LiveOrdersPage() {
  const { token, user } = useAuth()

  const [store, setStore] = useState(null)
  const [isStoreLoading, setIsStoreLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [isOrdersLoading, setIsOrdersLoading] = useState(false)
  const [error, setError] = useState("")
  const [actionMsg, setActionMsg] = useState({ text: "", error: false })

  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL") // 'ALL', 'PENDING_VERIFICATION', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED'
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [actionLoadingId, setActionLoadingId] = useState(null)

  // 1. Fetch Store
  useEffect(() => {
    if (!token) return
    setIsStoreLoading(true)
    fetchMyStoreApi(token)
      .then((res) => {
        if (res?.data) {
          setStore(res.data)
        }
      })
      .catch((err) => {
        console.error("Failed to fetch store:", err)
      })
      .finally(() => setIsStoreLoading(false))
  }, [token])

  // 2. Fetch Orders for Store
  const loadOrders = useCallback(async () => {
    if (!token || !store?.id) return
    setIsOrdersLoading(true)
    setError("")
    try {
      const res = await fetchStoreOrdersApi(token, store.id, {
        status: statusFilter,
        paymentType: paymentTypeFilter,
      })
      if (Array.isArray(res?.data)) {
        setOrders(res.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders.")
    } finally {
      setIsOrdersLoading(false)
    }
  }, [token, store?.id, statusFilter, paymentTypeFilter])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // Auto-refresh orders every 8 seconds
  useEffect(() => {
    if (!token || !store?.id) return
    const interval = setInterval(() => {
      loadOrders()
    }, 8000)
    return () => clearInterval(interval)
  }, [token, store?.id, loadOrders])

  // Waiter Manual Verification Action for Postpaid Cash Orders
  const handleVerifyPostpaidOrder = async (orderId, orderNumber) => {
    setActionLoadingId(orderId)
    setActionMsg({ text: "", error: false })

    try {
      await verifyPostpaidOrderApi(token, orderId)
      setActionMsg({
        text: `Postpaid Order #${orderNumber} verified by waiter & sent to kitchen!`,
        error: false,
      })
      loadOrders()
    } catch (err) {
      setActionMsg({
        text: err instanceof Error ? err.message : "Verification failed.",
        error: true,
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  // Update Status Action Handler
  const handleUpdateStatus = async (orderId, nextStatus, nextPaymentStatus = null) => {
    setActionLoadingId(orderId)
    setActionMsg({ text: "", error: false })

    try {
      await updateOrderStatusApi(token, orderId, {
        orderStatus: nextStatus,
        paymentStatus: nextPaymentStatus,
      })
      setActionMsg({
        text: `Order status updated to ${nextStatus}!`,
        error: false,
      })
      loadOrders()
    } catch (err) {
      setActionMsg({
        text: err instanceof Error ? err.message : "Failed to update status.",
        error: true,
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  const filteredOrders = orders.filter((o) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchNum = o.orderNumber?.toLowerCase().includes(q)
      const matchTable = o.tableNumber?.toLowerCase().includes(q)
      const matchCustomer = o.customerName?.toLowerCase().includes(q)
      if (!matchNum && !matchTable && !matchCustomer) return false
    }
    return true
  })

  const pendingVerificationCount = orders.filter(
    (o) => o.orderStatus === "PENDING_VERIFICATION"
  ).length

  if (isStoreLoading) {
    return (
      <div className="space-y-6 w-full">
        <Skeleton className="h-8 w-48 bg-zinc-800" />
        <Skeleton className="h-32 w-full bg-zinc-900 rounded-xl" />
      </div>
    )
  }

  if (!store) {
    return (
      <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-lg mx-auto my-12 text-center p-8">
        <Receipt className="h-10 w-10 text-amber-400 mx-auto mb-3" />
        <CardTitle className="text-white">No Linked Store</CardTitle>
        <CardDescription className="text-zinc-400 text-xs">
          Please link a store establishment to manage live customer orders.
        </CardDescription>
      </Card>
    )
  }

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">Live Customer Orders</h1>
            {pendingVerificationCount > 0 && (
              <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 font-mono text-xs animate-pulse">
                {pendingVerificationCount} Waiter Verification Required
              </Badge>
            )}
          </div>
          <p className="text-sm text-zinc-400">
            Real-time dining table orders, waiter manual verification for postpaid cash orders, and kitchen display.
          </p>
        </div>

        <Button
          onClick={loadOrders}
          disabled={isOrdersLoading}
          variant="outline"
          className="border-zinc-800 text-zinc-300 hover:bg-zinc-800 text-xs gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isOrdersLoading ? "animate-spin" : ""}`} /> Refresh Orders
        </Button>
      </div>

      {actionMsg.text && (
        <div
          className={`flex items-center gap-2 text-xs rounded-lg px-4 py-3 border ${
            actionMsg.error
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}
        >
          {actionMsg.error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {actionMsg.text}
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 p-4 rounded-xl border border-zinc-800">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "ALL", label: "All Orders" },
            { id: "PENDING_VERIFICATION", label: `Waiters Needed (${pendingVerificationCount})` },
            { id: "ACCEPTED", label: "Accepted" },
            { id: "PREPARING", label: "Preparing 🍳" },
            { id: "READY", label: "Ready 🛎️" },
            { id: "SERVED", label: "Served 😋" },
            { id: "COMPLETED", label: "Completed" },
          ].map((tab) => (
            <Button
              key={tab.id}
              type="button"
              variant={statusFilter === tab.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter(tab.id)}
              className={`text-xs font-semibold ${
                statusFilter === tab.id
                  ? "bg-white text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <select
            value={paymentTypeFilter}
            onChange={(e) => setPaymentTypeFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 text-xs text-white rounded-md px-3 py-2 focus:outline-none"
          >
            <option value="ALL">All Payment Types</option>
            <option value="POSTPAID">Postpaid (Cash)</option>
            <option value="PREPAID">Prepaid (Online)</option>
          </select>

          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input
              type="text"
              placeholder="Search table or order #"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-zinc-950 border-zinc-800 text-white text-xs h-9 w-44"
            />
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      {isOrdersLoading && orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-2">
          <LoaderCircle className="h-6 w-6 animate-spin text-amber-400" />
          <p className="text-xs">Fetching live store orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 p-12 text-center space-y-3">
          <Receipt className="h-10 w-10 text-zinc-600 mx-auto" />
          <CardTitle className="text-base text-white">No active orders</CardTitle>
          <CardDescription className="text-zinc-500 text-xs">
            No live customer orders match the selected filter.
          </CardDescription>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.map((order) => {
            const isPendingVerification = order.orderStatus === "PENDING_VERIFICATION"
            const isPostpaid = order.paymentType === "POSTPAID"

            return (
              <Card
                key={order.id}
                className={`bg-zinc-900 text-zinc-100 flex flex-col justify-between transition-colors ${
                  isPendingVerification
                    ? "border-2 border-amber-500/60 bg-gradient-to-b from-amber-950/20 to-zinc-900"
                    : "border-zinc-800"
                }`}
              >
                <CardHeader className="pb-3 border-b border-zinc-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-white flex items-center gap-1.5">
                      <Receipt className="h-4 w-4 text-amber-400" /> #{order.orderNumber}
                    </span>
                    <Badge className="bg-zinc-800 text-amber-300 border-zinc-700 font-mono text-xs">
                      Table #{order.tableNumber}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-zinc-400">
                      {order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isPostpaid ? (
                        <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] gap-1">
                          <Banknote className="h-3 w-3" /> Postpaid
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] gap-1">
                          <CreditCard className="h-3 w-3" /> Prepaid
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="py-4 space-y-4 flex-1">
                  {/* Waiter Verification Alert for Postpaid Orders */}
                  {isPendingVerification && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
                      <p className="font-bold flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-400" /> Waiter Verification Required
                      </p>
                      <p className="text-[11px] text-amber-200/80 leading-normal">
                        Customer placed a postpaid cash order at Table #{order.tableNumber}. Please verify with table and approve for kitchen.
                      </p>
                    </div>
                  )}

                  {/* Customer Info */}
                  <div className="text-xs text-zinc-400 space-y-0.5">
                    <p className="text-white font-semibold">{order.customerName || "Guest Diner"}</p>
                    {order.customerEmail && <p className="text-zinc-500">{order.customerEmail}</p>}
                  </div>

                  {/* Special Kitchen Notes */}
                  {order.notes && (
                    <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs space-y-1">
                      <span className="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> Kitchen Note:
                      </span>
                      <p className="text-zinc-200 text-xs italic">"{order.notes}"</p>
                    </div>
                  )}

                  {/* Itemized Order Items */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                      Ordered Dishes ({order.items?.length || 0})
                    </span>
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                      {order.items?.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-xs py-1 border-b border-zinc-800/40 last:border-0"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <span className="text-white font-medium">{item.name}</span>
                            <span className="text-zinc-500 ml-1 font-mono">×{item.quantity}</span>
                          </div>
                          <span className="font-mono text-zinc-300 font-semibold">₹{item.itemTotal}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Billing Breakdown Summary */}
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-1 text-xs">
                    <div className="flex justify-between text-zinc-400">
                      <span>Subtotal</span>
                      <span className="font-mono text-zinc-300">₹{order.subtotal}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>GST (5%) + Service</span>
                      <span className="font-mono text-zinc-300">₹{order.tax + (order.serviceFee || 0)}</span>
                    </div>
                    <Separator className="bg-zinc-800 my-1" />
                    <div className="flex justify-between font-bold text-sm text-white">
                      <span>Total Amount</span>
                      <span className="font-mono text-amber-400">₹{order.totalAmount}</span>
                    </div>
                  </div>
                </CardContent>

                {/* Card Action Footer */}
                <CardFooter className="p-4 border-t border-zinc-800/60 pt-3">
                  {isPendingVerification ? (
                    <div className="flex items-center gap-2 w-full">
                      <Button
                        type="button"
                        disabled={actionLoadingId === order.id}
                        onClick={() => handleVerifyPostpaidOrder(order.id, order.orderNumber)}
                        className="flex-1 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs gap-1.5"
                      >
                        {actionLoadingId === order.id ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <ShieldCheck className="h-3.5 w-3.5" /> Verify & Send to Kitchen
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={actionLoadingId === order.id}
                        onClick={() => handleUpdateStatus(order.id, "CANCELLED")}
                        className="text-xs border-zinc-800 text-red-400 hover:bg-red-500/10"
                      >
                        Reject
                      </Button>
                    </div>
                  ) : order.orderStatus === "ACCEPTED" ? (
                    <Button
                      type="button"
                      disabled={actionLoadingId === order.id}
                      onClick={() => handleUpdateStatus(order.id, "PREPARING")}
                      className="w-full bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs gap-1.5"
                    >
                      {actionLoadingId === order.id ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <ChefHat className="h-3.5 w-3.5" /> Start Preparing 🍳
                        </>
                      )}
                    </Button>
                  ) : order.orderStatus === "PREPARING" ? (
                    <Button
                      type="button"
                      disabled={actionLoadingId === order.id}
                      onClick={() => handleUpdateStatus(order.id, "READY")}
                      className="w-full bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs gap-1.5"
                    >
                      {actionLoadingId === order.id ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" /> Mark Ready for Serving 🛎️
                        </>
                      )}
                    </Button>
                  ) : order.orderStatus === "READY" ? (
                    <Button
                      type="button"
                      disabled={actionLoadingId === order.id}
                      onClick={() => handleUpdateStatus(order.id, "SERVED")}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs gap-1.5"
                    >
                      {actionLoadingId === order.id ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Utensils className="h-3.5 w-3.5" /> Mark Order Served 😋
                        </>
                      )}
                    </Button>
                  ) : order.orderStatus === "SERVED" ? (
                    <Button
                      type="button"
                      disabled={actionLoadingId === order.id}
                      onClick={() => handleUpdateStatus(order.id, "COMPLETED", "PAID")}
                      className="w-full bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-500/30 font-bold text-xs gap-1.5"
                    >
                      {actionLoadingId === order.id ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Complete Order & Bill Paid
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="flex items-center justify-between w-full text-xs text-zinc-500 font-mono">
                      <span>Status: {order.orderStatus}</span>
                      <span>{order.paymentStatus}</span>
                    </div>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
