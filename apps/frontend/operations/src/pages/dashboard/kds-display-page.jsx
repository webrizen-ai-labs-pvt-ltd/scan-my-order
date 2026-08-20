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
  Skeleton,
} from "@repo/ui"
import {
  ChefHat,
  Clock,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Volume2,
  VolumeX,
  Radio,
  Receipt,
  MessageSquare,
  Flame,
  CheckSquare,
  Square,
} from "lucide-react"
import { useAuth } from "../../context/auth-context.jsx"
import { fetchMyStoreApi } from "../../services/store-api.js"
import { fetchStoreOrdersApi, updateOrderStatusApi } from "../../services/order-api.js"
import { useOrderSocket } from "../../hooks/useOrderSocket.js"

// Elapsed Time Helper
function getElapsedTime(createdAt) {
  if (!createdAt) return { text: "0m", minutes: 0 }
  const elapsedMs = Date.now() - new Date(createdAt).getTime()
  const minutes = Math.floor(elapsedMs / 60000)
  const seconds = Math.floor((elapsedMs % 60000) / 1000)
  return {
    text: `${minutes}m ${seconds}s`,
    minutes,
  }
}

export default function KdsDisplayPage() {
  const { token } = useAuth()
  const [store, setStore] = useState(null)
  const [isStoreLoading, setIsStoreLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState(null)
  const [checkedItems, setCheckedItems] = useState({})
  const [, setNow] = useState(Date.now())

  // Ticker for elapsed time timer (every 1 second)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

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
      .catch((err) => console.error("Failed to fetch store:", err))
      .finally(() => setIsStoreLoading(false))
  }, [token])

  // 2. Fetch KDS Kitchen Orders (ACCEPTED and PREPARING)
  const loadKdsOrders = useCallback(async () => {
    if (!token || !store?.id) return
    setIsLoading(true)
    try {
      const res = await fetchStoreOrdersApi(token, store.id)
      if (Array.isArray(res?.data)) {
        // Kitchen only cares about ACCEPTED, PREPARING, and READY
        const kitchenOrders = res.data.filter((o) =>
          ["ACCEPTED", "PREPARING", "READY"].includes(o.orderStatus)
        )
        setOrders(kitchenOrders)
      }
    } catch (err) {
      console.error("Failed to load KDS orders:", err)
    } finally {
      setIsLoading(false)
    }
  }, [token, store?.id])

  useEffect(() => {
    loadKdsOrders()
  }, [loadKdsOrders])

  // WebSocket Integration
  const handleSocketOrderCreated = useCallback((newOrder) => {
    if (["ACCEPTED", "PREPARING", "READY"].includes(newOrder.orderStatus)) {
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === newOrder.id)
        if (exists) return prev
        return [...prev, newOrder]
      })
    }
  }, [])

  const handleSocketOrderUpdated = useCallback((updatedOrder) => {
    setOrders((prev) => {
      if (["ACCEPTED", "PREPARING", "READY"].includes(updatedOrder.orderStatus)) {
        const exists = prev.some((o) => o.id === updatedOrder.id)
        if (exists) {
          return prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
        }
        return [...prev, updatedOrder]
      }
      // Remove served or completed orders from KDS
      return prev.filter((o) => o.id !== updatedOrder.id)
    })
  }, [])

  const { isConnected, soundEnabled, toggleSound } = useOrderSocket(store?.id, {
    onOrderCreated: handleSocketOrderCreated,
    onOrderUpdated: handleSocketOrderUpdated,
  })

  // Action Handler: Status Transition
  const handleStatusTransition = async (orderId, nextStatus) => {
    setActionLoadingId(orderId)
    try {
      await updateOrderStatusApi(token, orderId, { orderStatus: nextStatus })
      loadKdsOrders()
    } catch (err) {
      console.error("Status transition error:", err)
    } finally {
      setActionLoadingId(null)
    }
  }

  // Toggle Item Prepared Checkbox
  const toggleItemCheck = (orderId, itemId) => {
    const key = `${orderId}_${itemId}`
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (isStoreLoading) {
    return (
      <div className="space-y-6 w-full">
        <Skeleton className="h-8 w-48 bg-zinc-800" />
        <Skeleton className="h-48 w-full bg-zinc-900 rounded-xl" />
      </div>
    )
  }

  if (!store) {
    return (
      <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-lg mx-auto my-12 text-center p-8">
        <ChefHat className="h-10 w-10 text-amber-400 mx-auto mb-3" />
        <CardTitle className="text-white">No Store Linked</CardTitle>
        <CardDescription className="text-zinc-400 text-xs">
          Please link a store establishment to launch the Kitchen Display System (KDS).
        </CardDescription>
      </Card>
    )
  }

  return (
    <div className="space-y-6 w-full min-h-screen">
      {/* Header Bar */}
      <div className="border-b border-zinc-800 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <ChefHat className="h-6 w-6 text-amber-400" /> Kitchen Display System (KDS)
            </h1>
            {isConnected ? (
              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs gap-1.5 py-1 px-2.5">
                <Radio className="h-3 w-3 animate-pulse text-emerald-400" /> Live Feed
              </Badge>
            ) : (
              <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs gap-1.5 py-1 px-2.5">
                <RefreshCw className="h-3 w-3 animate-spin text-amber-400" /> Connecting
              </Badge>
            )}
            <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 font-mono text-xs">
              {orders.length} Active Kitchen Tickets
            </Badge>
          </div>
          <p className="text-xs text-zinc-400 pt-1">
            Real-time kitchen order queue, preparation timers, item checklists, and readiness dispatches.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={toggleSound}
            className={`text-xs gap-1.5 border-zinc-800 ${
              soundEnabled ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" : "text-zinc-500"
            }`}
          >
            {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            <span>{soundEnabled ? "Chime On" : "Muted"}</span>
          </Button>

          <Button
            onClick={loadKdsOrders}
            disabled={isLoading}
            variant="outline"
            className="border-zinc-800 text-zinc-300 hover:bg-zinc-800 text-xs gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh Queue
          </Button>
        </div>
      </div>

      {/* KDS Kitchen Ticket Grid */}
      {orders.length === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 p-16 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
          <CardTitle className="text-lg text-white">Kitchen Queue Clear! 🎉</CardTitle>
          <CardDescription className="text-zinc-500 text-xs">
            All customer dishes are prepared and served. Waiting for new dining orders...
          </CardDescription>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {orders.map((order) => {
            const elapsed = getElapsedTime(order.createdAt)
            const isUrgent = elapsed.minutes >= 15
            const isWarning = elapsed.minutes >= 8 && elapsed.minutes < 15

            const isPreparing = order.orderStatus === "PREPARING"
            const isReady = order.orderStatus === "READY"

            return (
              <Card
                key={order.id}
                className={`bg-zinc-900 text-zinc-100 flex flex-col justify-between border-2 transition-all ${
                  isUrgent
                    ? "border-red-500/80 bg-red-950/20"
                    : isWarning
                    ? "border-amber-500/80 bg-amber-950/20"
                    : isReady
                    ? "border-emerald-500/80 bg-emerald-950/20"
                    : "border-zinc-800"
                }`}
              >
                {/* KDS Ticket Header */}
                <CardHeader className="pb-3 border-b border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-base font-bold text-white flex items-center gap-1.5">
                      <Receipt className="h-4 w-4 text-amber-400" /> #{order.orderNumber}
                    </span>
                    <Badge className="bg-zinc-800 text-amber-300 border-zinc-700 font-mono text-sm font-bold px-2.5 py-0.5">
                      Table #{order.tableNumber}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className={`font-mono font-bold flex items-center gap-1 ${
                      isUrgent ? "text-red-400 animate-pulse" : isWarning ? "text-amber-400" : "text-emerald-400"
                    }`}>
                      <Clock className="h-3.5 w-3.5" /> {elapsed.text}
                    </span>
                    <Badge
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 ${
                        isReady
                          ? "bg-emerald-500 text-zinc-950"
                          : isPreparing
                          ? "bg-amber-500 text-zinc-950"
                          : "bg-white text-zinc-950"
                      }`}
                    >
                      {order.orderStatus}
                    </Badge>
                  </div>
                </CardHeader>

                {/* KDS Kitchen Ticket Items Checklist */}
                <CardContent className="py-4 space-y-3 flex-1">
                  {order.notes && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> Note:
                      </span>
                      <p className="font-medium italic">"{order.notes}"</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                      Dishes ({order.items?.length || 0})
                    </span>
                    <div className="space-y-1.5">
                      {order.items?.map((item) => {
                        const isChecked = checkedItems[`${order.id}_${item.id}`]
                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleItemCheck(order.id, item.id)}
                            className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                              isChecked
                                ? "bg-zinc-950/60 border-zinc-800/40 text-zinc-500 line-through"
                                : "bg-zinc-950 border-zinc-800 text-white hover:border-zinc-700"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              {isChecked ? (
                                <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0" />
                              ) : (
                                <Square className="h-4 w-4 text-zinc-600 shrink-0" />
                              )}
                              <span className="font-semibold text-sm">{item.name}</span>
                            </div>
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 font-mono text-sm px-2 py-0.5">
                              ×{item.quantity}
                            </Badge>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>

                {/* KDS Footer Action Buttons */}
                <CardFooter className="p-4 border-t border-zinc-800 pt-3">
                  {order.orderStatus === "ACCEPTED" ? (
                    <Button
                      type="button"
                      disabled={actionLoadingId === order.id}
                      onClick={() => handleStatusTransition(order.id, "PREPARING")}
                      className="w-full bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs gap-1.5 py-2.5"
                    >
                      {actionLoadingId === order.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Flame className="h-4 w-4" /> Start Cooking 🍳
                        </>
                      )}
                    </Button>
                  ) : order.orderStatus === "PREPARING" ? (
                    <Button
                      type="button"
                      disabled={actionLoadingId === order.id}
                      onClick={() => handleStatusTransition(order.id, "READY")}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs gap-1.5 py-2.5"
                    >
                      {actionLoadingId === order.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" /> Dish Ready 🛎️
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={actionLoadingId === order.id}
                      onClick={() => handleStatusTransition(order.id, "SERVED")}
                      className="w-full bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-500/30 font-bold text-xs gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Served to Customer
                    </Button>
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
