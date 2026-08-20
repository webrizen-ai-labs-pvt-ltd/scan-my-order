import React, { useState, useEffect, useRef } from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Input,
  Separator,
  Skeleton,
} from "@repo/ui"
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Receipt,
  Search,
  Utensils,
  CreditCard,
  Banknote,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Printer,
  UserCheck,
  IndianRupee,
  Hash,
  X,
  Clock,
  Layers,
  QrCode,
  Flame,
  Users,
  ChevronUp,
} from "lucide-react"
import { useAuth } from "../../context/auth-context.jsx"
import { fetchMyStoreApi } from "../../services/store-api.js"
import { fetchMenuItemsApi } from "../../services/menu-api.js"
import { fetchStoreTablesApi } from "../../services/table-api.js"
import { createPosOrderApi, fetchStoreOrdersApi } from "../../services/order-api.js"

export default function PosTerminalPage() {
  const { token } = useAuth()
  const [store, setStore] = useState(null)
  const [isStoreLoading, setIsStoreLoading] = useState(true)

  const [menuItems, setMenuItems] = useState([])
  const [tables, setTables] = useState([])
  const [activeStoreOrders, setActiveStoreOrders] = useState([])
  const [isMenuLoading, setIsMenuLoading] = useState(false)

  const [orderType, setOrderType] = useState("DINING")
  const [tableNumber, setTableNumber] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [paymentType, setPaymentType] = useState("POSTPAID")
  const [orderNotes, setOrderNotes] = useState("")

  const [cart, setCart] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("ALL")
  const [selectedSection, setSelectedSection] = useState("ALL")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastCreatedOrder, setLastCreatedOrder] = useState(null)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [showMobileCartDrawer, setShowMobileCartDrawer] = useState(false)
  const [statusMsg, setStatusMsg] = useState({ text: "", error: false })

  const searchInputRef = useRef(null)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === "/" || e.key === "F2") && document.activeElement !== searchInputRef.current) {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === "Escape") {
        if (showReceiptModal) setShowReceiptModal(false)
        if (showMobileCartDrawer) setShowMobileCartDrawer(false)
        setSearchQuery("")
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [showReceiptModal, showMobileCartDrawer])

  useEffect(() => {
    if (!token) return
    setIsStoreLoading(true)
    fetchMyStoreApi(token)
      .then((res) => {
        if (res?.data) setStore(res.data)
      })
      .catch((err) => console.error("Failed to fetch store:", err))
      .finally(() => setIsStoreLoading(false))
  }, [token])

  useEffect(() => {
    if (!token || !store?.id) return
    setIsMenuLoading(true)

    Promise.all([
      fetchMenuItemsApi(token, store.id).catch(() => ({ data: [] })),
      fetchStoreTablesApi(token, store.id).catch(() => ({ data: [] })),
      fetchStoreOrdersApi(token, store.id).catch(() => ({ data: [] })),
    ])
      .then(([menuRes, tableRes, orderRes]) => {
        if (Array.isArray(menuRes?.data)) setMenuItems(menuRes.data)
        if (Array.isArray(tableRes?.data)) {
          setTables(tableRes.data)
          if (tableRes.data.length > 0 && !tableNumber) {
            setTableNumber(tableRes.data[0].number || "1")
          }
        }
        if (Array.isArray(orderRes?.data)) {
          setActiveStoreOrders(orderRes.data.filter((o) => o.orderStatus !== "COMPLETED" && o.orderStatus !== "CANCELLED"))
        }
      })
      .finally(() => setIsMenuLoading(false))
  }, [token, store?.id])

  const handleAddToCart = (item) => {
    if (item.isAvailable === false) return
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id)
      if (existing) {
        return prev.map((c) => (c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c))
      }
      return [...prev, { ...item, menuItemId: item.id, quantity: 1 }]
    })
  }

  const handleUpdateQuantity = (itemId, delta) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.id === itemId) {
            const nextQty = c.quantity + delta
            return nextQty > 0 ? { ...c, quantity: nextQty } : null
          }
          return c
        })
        .filter(Boolean)
    )
  }

  const handleRemoveFromCart = (itemId) => {
    setCart((prev) => prev.filter((c) => c.id !== itemId))
  }

  const handleClearCart = () => {
    setCart([])
  }

  const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * item.quantity, 0)
  const taxRate = parseFloat(store?.taxValue) || 5
  const tax = Math.round(subtotal * (taxRate / 100) * 100) / 100
  const serviceFee = subtotal > 0 ? parseFloat(store?.serviceFee) || 0 : 0
  const totalAmount = Math.max(0, Math.round((subtotal + tax + serviceFee) * 100) / 100)

  const handlePlacePosOrder = async (e) => {
    if (e) e.preventDefault()
    if (cart.length === 0 || isSubmitting) return

    if (orderType === "DINING" && (!tableNumber || String(tableNumber).trim() === "")) {
      setStatusMsg({ text: "Please select or enter a table number before placing order.", error: true })
      return
    }

    setIsSubmitting(true)
    setStatusMsg({ text: "", error: false })

    try {
      const payload = {
        storeId: store.id,
        tableNumber: orderType === "TAKEAWAY" ? "TAKEAWAY" : String(tableNumber).trim(),
        orderType,
        paymentType,
        customerName: customerName.trim() || "Walk-in Diner",
        customerPhone: customerPhone.trim() || undefined,
        notes: orderNotes.trim() || undefined,
        items: cart.map((i) => ({
          menuItemId: i.id,
          name: i.name,
          price: parseFloat(i.price) || 0,
          quantity: i.quantity,
        })),
      }

      const res = await createPosOrderApi(token, payload)
      if (res?.data) {
        setLastCreatedOrder(res.data)
        setStatusMsg({ text: `Order #${res.data.orderNumber} placed successfully!`, error: false })
        setCart([])
        setOrderNotes("")
        setShowMobileCartDrawer(false)
        setShowReceiptModal(true)
      }
    } catch (err) {
      setStatusMsg({ text: err instanceof Error ? err.message : "Failed to place order.", error: true })
    } finally {
      setIsSubmitting(false)
    }
  }

  const sections = Array.from(new Set(tables.map((t) => t.section || "Main Dining"))).filter(Boolean)
  const displayTables = tables.length > 0 ? tables : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => ({
    id: `default_${n}`,
    number: String(n),
    name: `Table ${n}`,
    capacity: 4,
    section: "Main Dining",
    status: "AVAILABLE",
  }))

  const filteredTables = displayTables.filter((t) => {
    if (selectedSection !== "ALL" && (t.section || "Main Dining") !== selectedSection) return false
    return true
  })

  const categories = Array.from(new Set(menuItems.map((m) => m.category || "General"))).filter(Boolean)
  const filteredMenuItems = menuItems.filter((item) => {
    if (selectedCategory !== "ALL" && (item.category || "General") !== selectedCategory) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return item.name.toLowerCase().includes(q) || (item.category && item.category.toLowerCase().includes(q))
    }
    return true
  })

  const getTableActiveOrderCount = (tblNum) => {
    return activeStoreOrders.filter((o) => o.tableNumber === String(tblNum)).length
  }

  if (isStoreLoading) {
    return (
      <div className="space-y-6 w-full">
        <Skeleton className="h-8 w-48 bg-zinc-800" />
        <Skeleton className="h-64 w-full bg-zinc-900 rounded-lg" />
      </div>
    )
  }

  if (!store) {
    return (
      <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-lg mx-auto my-12 text-center p-8">
        <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-3">
          <Utensils className="h-7 w-7 text-zinc-400" />
        </div>
        <CardTitle className="text-white text-base">No Store Linked</CardTitle>
        <CardDescription className="text-zinc-500 text-sm mt-1">
          Link a store to launch the POS terminal.
        </CardDescription>
      </Card>
    )
  }

  return (
    <div className="space-y-6 w-full pb-20 lg:pb-0">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <ShoppingCart className="h-6 w-6 text-zinc-300" /> POS Terminal
            </h1>
            <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-2 py-1 rounded-md">
              {store.name}
            </span>
          </div>
          <p className="text-sm text-zinc-500 pt-1">
            Table management, order dispatch, and billing
          </p>
        </div>

        {lastCreatedOrder && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowReceiptModal(true)}
          >
            <Printer className="h-4 w-4" /> Ticket #{lastCreatedOrder.orderNumber}
          </Button>
        )}
      </div>

      {statusMsg.text && (
        <div
          className={`flex items-center gap-2 text-sm rounded-lg px-4 py-3 border ${
            statusMsg.error
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}
        >
          {statusMsg.error ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {statusMsg.text}
        </div>
      )}

      {/* Table Selection */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Hash className="h-3.5 w-3.5" /> Select Table ({displayTables.length})
          </span>

          <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg p-1">
            <Button
              type="button"
              size="sm"
              variant={orderType === "DINING" ? "default" : "ghost"}
              onClick={() => setOrderType("DINING")}
            >
              <Utensils className="w-3.5 h-3.5" /> Dining
            </Button>
            <Button
              type="button"
              size="sm"
              variant={orderType === "TAKEAWAY" ? "default" : "ghost"}
              onClick={() => setOrderType("TAKEAWAY")}
            >
              <Flame className="w-3.5 h-3.5" /> Takeaway
            </Button>
          </div>
        </div>

        {orderType === "DINING" && (
          <div className="space-y-3">
            {sections.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <Button
                  type="button"
                  size="sm"
                  variant={selectedSection === "ALL" ? "default" : "ghost"}
                  onClick={() => setSelectedSection("ALL")}
                >
                  All
                </Button>
                {sections.map((sec) => (
                  <Button
                    key={sec}
                    type="button"
                    size="sm"
                    variant={selectedSection === sec ? "default" : "ghost"}
                    onClick={() => setSelectedSection(sec)}
                  >
                    {sec}
                  </Button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {filteredTables.map((tbl) => {
                const isSelected = tableNumber === tbl.number
                const activeCount = getTableActiveOrderCount(tbl.number)
                const isOccupied = activeCount > 0

                return (
                  <button
                    key={tbl.id || tbl.number}
                    type="button"
                    onClick={() => setTableNumber(tbl.number)}
                    className={`relative px-3.5 py-2 rounded-lg border text-xs font-mono font-medium transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-white border-white text-zinc-950"
                        : isOccupied
                        ? "bg-zinc-800/50 border-zinc-600 text-zinc-300"
                        : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-600"
                    }`}
                  >
                    <span>T-{tbl.number}</span>
                    {tbl.capacity && <span className="text-[10px] opacity-60">({tbl.capacity}p)</span>}
                    {isOccupied && (
                      <span className="h-2 w-2 rounded-full bg-emerald-400 absolute -top-1 -right-1" />
                    )}
                  </button>
                )
              })}

              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-zinc-500">Custom:</span>
                <Input
                  type="text"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="#"
                  className="w-16 h-8 bg-zinc-950 border-zinc-800 text-white font-mono text-xs text-center"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Menu Items */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 p-3 rounded-lg border border-zinc-800">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <Button
                type="button"
                size="sm"
                variant={selectedCategory === "ALL" ? "default" : "ghost"}
                onClick={() => setSelectedCategory("ALL")}
              >
                All ({menuItems.length})
              </Button>
              {categories.map((cat) => {
                const count = menuItems.filter((m) => (m.category || "General") === cat).length
                return (
                  <Button
                    key={cat}
                    type="button"
                    size="sm"
                    variant={selectedCategory === cat ? "default" : "ghost"}
                    onClick={() => setSelectedCategory(cat)}
                    className="whitespace-nowrap"
                  >
                    {cat} ({count})
                  </Button>
                )
              })}
            </div>

            <div className="relative shrink-0">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search (/)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 bg-zinc-950 border-zinc-800 text-white text-sm h-9 w-56"
              />
            </div>
          </div>

          {isMenuLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-2">
              <LoaderCircle className="h-6 w-6 animate-spin" />
              <p className="text-sm">Loading menu...</p>
            </div>
          ) : filteredMenuItems.length === 0 ? (
            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 p-12 text-center">
              <Utensils className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">No dishes match your filters.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredMenuItems.map((item) => {
                const cartQty = cart.find((c) => c.id === item.id)?.quantity || 0
                const isAvailable = item.isAvailable !== false

                return (
                  <Card
                    key={item.id}
                    onClick={() => isAvailable && handleAddToCart(item)}
                    className={`bg-zinc-900 border p-3.5 flex flex-col justify-between space-y-3 relative cursor-pointer transition-colors ${
                      !isAvailable
                        ? "opacity-50 border-zinc-800/40"
                        : cartQty > 0
                        ? "border-zinc-400"
                        : "border-zinc-800 hover:border-zinc-600"
                    }`}
                  >
                    {cartQty > 0 && (
                      <span className="absolute top-2 right-2 bg-white text-zinc-950 font-bold font-mono text-xs min-w-[22px] h-5.5 px-1.5 flex items-center justify-center rounded-full">
                        {cartQty}
                      </span>
                    )}

                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider truncate">
                        {item.category || "General"}
                      </span>
                      <h4 className="text-sm font-semibold text-white leading-snug">{item.name}</h4>
                      {item.description && <p className="text-xs text-zinc-500 line-clamp-1">{item.description}</p>}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
                      <span className="font-mono text-sm font-bold text-white flex items-center gap-0.5">
                        <IndianRupee className="h-3.5 w-3.5 text-zinc-500" />{item.price}
                      </span>
                      <span className={`text-xs font-medium ${isAvailable ? "text-zinc-400" : "text-red-400"}`}>
                        {isAvailable ? "+ Add" : "Sold Out"}
                      </span>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="hidden lg:block lg:col-span-5 xl:col-span-4">
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 p-5 space-y-4 sticky top-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-zinc-400" /> 
                  Ticket #{orderType === "TAKEAWAY" ? "TAKEAWAY" : `T-${tableNumber || "—"}`}
                </h3>
                <span className="text-xs text-zinc-500">Items: {cart.reduce((s, c) => s + c.quantity, 0)}</span>
              </div>
              {cart.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={handleClearCart} className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10">
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 font-medium block mb-1.5">Payment</label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-sm py-2 focus:border-zinc-400 outline-none cursor-pointer"
                >
                  <option value="POSTPAID" className="bg-zinc-900">Postpaid (Cash)</option>
                  <option value="PREPAID" className="bg-zinc-900">Prepaid (Online)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-medium block mb-1.5">Guest Name</label>
                <Input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Walk-in Guest"
                  className="bg-transparent border-0 border-b-2 border-zinc-800 text-white text-sm px-0 py-2 focus:border-zinc-400 outline-none placeholder:text-zinc-600"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-zinc-800">
              {cart.length === 0 ? (
                <div className="py-10 text-center text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-lg">
                  Tap dishes to add to order
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="font-medium text-white truncate">{item.name}</p>
                        <p className="text-xs text-zinc-500 font-mono">₹{item.price} × {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleUpdateQuantity(item.id, -1)} className="h-6 w-6 rounded bg-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="font-mono font-bold text-white text-xs w-4 text-center">{item.quantity}</span>
                        <button onClick={() => handleUpdateQuantity(item.id, 1)} className="h-6 w-6 rounded bg-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center">
                          <Plus className="h-3 w-3" />
                        </button>
                        <button onClick={() => handleRemoveFromCart(item.id)} className="h-6 w-6 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center ml-1">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <>
                <Input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Kitchen notes..."
                  className="bg-transparent border-0 border-b-2 border-zinc-800 text-white text-sm px-0 py-2 focus:border-zinc-400 outline-none placeholder:text-zinc-600"
                />

                <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1.5 text-sm">
                  <div className="flex justify-between text-zinc-400">
                    <span>Subtotal</span>
                    <span className="font-mono text-zinc-300">₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>GST ({taxRate}%) + Fee</span>
                    <span className="font-mono text-zinc-300">₹{(tax + serviceFee).toFixed(2)}</span>
                  </div>
                  <Separator className="bg-zinc-800 my-1.5" />
                  <div className="flex justify-between font-semibold text-white">
                    <span>Total</span>
                    <span className="font-mono">₹{totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}

            <Button
              type="button"
              disabled={cart.length === 0 || isSubmitting}
              onClick={handlePlacePosOrder}
              className="w-full"
            >
              {isSubmitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <UserCheck className="h-4 w-4" /> Dispatch Order
                </>
              )}
            </Button>
          </Card>
        </div>
      </div>

      {/* Mobile Floating Cart */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-zinc-950/95 border-t border-zinc-800 backdrop-blur-xl z-40 flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
              Total ({cart.reduce((s, c) => s + c.quantity, 0)} items)
            </span>
            <p className="font-mono text-base font-bold text-white">₹{totalAmount.toFixed(2)}</p>
          </div>
          <Button type="button" onClick={() => setShowMobileCartDrawer(true)}>
            Review Ticket <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Mobile Cart Drawer */}
      {showMobileCartDrawer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col justify-end lg:hidden">
          <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <Receipt className="h-4 w-4 text-zinc-400" /> Ticket #{tableNumber || "—"}
              </h3>
              <button onClick={() => setShowMobileCartDrawer(false)} className="text-zinc-500 hover:text-white p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="font-medium text-white truncate">{item.name}</p>
                    <p className="text-xs text-zinc-500 font-mono">₹{item.price} × {item.quantity}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleUpdateQuantity(item.id, -1)} className="h-6 w-6 rounded bg-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="font-mono font-bold text-white text-xs w-4 text-center">{item.quantity}</span>
                    <button onClick={() => handleUpdateQuantity(item.id, 1)} className="h-6 w-6 rounded bg-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              disabled={isSubmitting}
              onClick={handlePlacePosOrder}
              className="w-full"
            >
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Dispatch Order"}
            </Button>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && lastCreatedOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black max-w-sm w-full p-6 rounded-lg space-y-4 font-mono shadow-2xl">
            <div className="flex justify-between items-start border-b pb-3">
              <div className="w-full text-center">
                <h3 className="font-bold text-lg uppercase tracking-wider">{store.name}</h3>
                <p className="text-xs text-zinc-600">POS Kitchen Ticket</p>
                {store.gstNumber && <p className="text-xs text-zinc-600">GSTIN: {store.gstNumber}</p>}
              </div>
              <button onClick={() => setShowReceiptModal(false)} className="text-zinc-500 hover:text-black shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-xs space-y-1">
              <div className="flex justify-between font-bold">
                <span>Ticket: #{lastCreatedOrder.orderNumber}</span>
                <span>Table: #{lastCreatedOrder.tableNumber}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>{lastCreatedOrder.customerName || "Diner"}</span>
                <span>{new Date(lastCreatedOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            <div className="border-t border-b py-2 space-y-1 text-xs">
              {lastCreatedOrder.items?.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span className="truncate pr-2">{item.name}</span>
                  <span>{item.quantity} × ₹{item.price} = ₹{item.itemTotal}</span>
                </div>
              ))}
            </div>

            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{lastCreatedOrder.subtotal}</span>
              </div>
              <div className="flex justify-between">
                <span>GST ({taxRate}%):</span>
                <span>₹{lastCreatedOrder.tax}</span>
              </div>
              <div className="flex justify-between font-bold text-sm border-t pt-1">
                <span>TOTAL:</span>
                <span>₹{lastCreatedOrder.totalAmount}</span>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <Button type="button" onClick={() => window.print()} className="flex-1">
                <Printer className="h-4 w-4" /> Print
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowReceiptModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}