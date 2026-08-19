import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useParams, useSearchParams, Link } from "react-router-dom"
import {
  Store,
  Search,
  Clock,
  Utensils,
  Plus,
  Minus,
  ShoppingBag,
  AlertCircle,
  X,
  CheckCircle2,
  LoaderCircle,
  IndianRupee,
  Flame,
  ChefHat,
  Sparkles,
  Info,
  Send,
  MessageSquare,
  CreditCard,
  Banknote,
  UserCheck,
  RefreshCw,
  Hash,
  Receipt,
  Lock,
} from "lucide-react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Input,
  Badge,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  Separator,
  Skeleton,
} from "@repo/ui"
import { fetchStoreBySlugApi, createOrderApi, fetchOrderStatusApi } from "../services/store-menu-api.js"

const FONT_MAP = {
  "dm sans": {
    family: "'DM Sans', system-ui, -apple-system, sans-serif",
    url: "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap",
  },
  "newsreader": {
    family: "'Newsreader', Georgia, serif",
    url: "https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800&display=swap",
  },
  "inter": {
    family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  "playfair display": {
    family: "'Playfair Display', Georgia, serif",
    url: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap",
  },
  "outfit": {
    family: "'Outfit', system-ui, -apple-system, sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap",
  },
  "space grotesk": {
    family: "'Space Grotesk', monospace, sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap",
  },
  "roboto": {
    family: "'Roboto', -apple-system, BlinkMacSystemFont, sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900&display=swap",
  },
  "plus jakarta sans": {
    family: "'Plus Jakarta Sans', system-ui, sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap",
  },
}

const resolveFontDetails = (fontStyle) => {
  if (!fontStyle) return FONT_MAP["dm sans"]
  const key = String(fontStyle).trim().toLowerCase()
  return FONT_MAP[key] || FONT_MAP["dm sans"]
}

const resolveAccentColor = (scheme) => {
  if (!scheme) return "#ffffff"
  if (scheme.startsWith("#")) return scheme
  switch (scheme.toLowerCase()) {
    case "emerald": return "#10b981"
    case "blue":
    case "indigo": return "#6366f1"
    case "rose":
    case "red": return "#f43f5e"
    case "purple": return "#a855f7"
    case "light": return "#3b82f6"
    case "dark":
    case "zinc": return "#ffffff"
    case "amber": return "#f59e0b"
    default: return "#ffffff"
  }
}

export default function StoreMenuPage() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const tableParam = searchParams.get("table")

  const [storeData, setStoreData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("ALL")
  const [selectedDietary, setSelectedDietary] = useState("ALL")

  const [cart, setCart] = useState({})
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [orderType, setOrderType] = useState("DINING")
  const [tableNumber, setTableNumber] = useState(tableParam || "")
  const [notes, setNotes] = useState("")
  const [paymentType, setPaymentType] = useState("POSTPAID")
  const [couponInput, setCouponInput] = useState("")
  const [appliedCouponCode, setAppliedCouponCode] = useState("")

  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [isCustomerSignedIn, setIsCustomerSignedIn] = useState(false)

  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [orderError, setOrderError] = useState("")
  const [activeOrder, setActiveOrder] = useState(null)
  const [isTrackerOpen, setIsTrackerOpen] = useState(false)

  useEffect(() => {
    try {
      const savedUserStr = localStorage.getItem("customer_user")
      if (savedUserStr) {
        const savedUser = JSON.parse(savedUserStr)
        if (savedUser?.name) setCustomerName(savedUser.name)
        if (savedUser?.email) setCustomerEmail(savedUser.email)
        if (savedUser?.phone) setCustomerPhone(savedUser.phone || "")
        setIsCustomerSignedIn(true)
      }
    } catch (e) {
      console.error("Failed to parse customer_user:", e)
    }
  }, [])

  useEffect(() => {
    if (tableParam) {
      setTableNumber(tableParam)
    }
  }, [tableParam])

  useEffect(() => {
    if (storeData?.tables && tableNumber && storeData.tables.length > 0) {
      const isValid = storeData.tables.some(
        (t) => String(t.number).trim().toLowerCase() === String(tableNumber).trim().toLowerCase()
      )
      if (!isValid) {
        setTableNumber("")
      }
    }
  }, [storeData, tableNumber])

  useEffect(() => {
    if (!slug) return
    setIsLoading(true)
    setError(null)
    fetchStoreBySlugApi(slug)
      .then((res) => setStoreData(res.data))
      .catch((err) => {
        console.error("Failed to load store menu:", err)
        setError(err.message || "Store menu not found or unavailable")
      })
      .finally(() => setIsLoading(false))
  }, [slug])

  // Dynamically load Google Fonts with case-insensitive resolution & font-display swap
  useEffect(() => {
    const fontDetails = resolveFontDetails(storeData?.fontStyle)
    if (fontDetails?.url) {
      const fontKey = (storeData?.fontStyle || "dm-sans").toLowerCase().replace(/[^a-z0-9]+/g, "-")
      const linkId = `dynamic-google-font-${fontKey}`
      if (!document.getElementById(linkId)) {
        const link = document.createElement("link")
        link.id = linkId
        link.rel = "stylesheet"
        link.href = fontDetails.url
        document.head.appendChild(link)
      }
    }
  }, [storeData?.fontStyle])

  const pollActiveOrder = useCallback(async () => {
    if (!activeOrder?.id) return
    try {
      const res = await fetchOrderStatusApi(activeOrder.id)
      if (res?.data) setActiveOrder(res.data)
    } catch (err) {
      console.error("Failed to poll order status:", err)
    }
  }, [activeOrder?.id])

  useEffect(() => {
    if (!activeOrder?.id) return
    const interval = setInterval(pollActiveOrder, 6000)
    return () => clearInterval(interval)
  }, [activeOrder?.id, pollActiveOrder])

  const accentColor = useMemo(() => resolveAccentColor(storeData?.colorScheme), [storeData?.colorScheme])
  const fontFamily = useMemo(() => {
    const fontDetails = resolveFontDetails(storeData?.fontStyle)
    return fontDetails.family
  }, [storeData?.fontStyle])

  const menuItems = useMemo(() => Array.isArray(storeData?.menuItems) ? storeData.menuItems : [], [storeData])

  const categories = useMemo(() => {
    const set = new Set()
    menuItems.forEach((item) => {
      if (item.category) set.add(item.category)
    })
    return ["ALL", ...Array.from(set)]
  }, [menuItems])

  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (item.isAvailable === false) return false
      if (selectedCategory !== "ALL" && item.category !== selectedCategory) return false
      if (selectedDietary !== "ALL" && item.dietaryType !== selectedDietary) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const nameMatch = item.name?.toLowerCase().includes(q)
        const descMatch = item.description?.toLowerCase().includes(q)
        const catMatch = item.category?.toLowerCase().includes(q)
        if (!nameMatch && !descMatch && !catMatch) return false
      }
      return true
    })
  }, [menuItems, selectedCategory, selectedDietary, searchQuery])

  const groupedMenuItems = useMemo(() => {
    const groups = {}
    filteredMenuItems.forEach((item) => {
      const cat = item.category || "General Menu"
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    })
    return groups
  }, [filteredMenuItems])

  const updateCartQuantity = (itemId, delta) => {
    setCart((prev) => {
      const current = prev[itemId] || 0
      const next = current + delta
      if (next <= 0) {
        const copy = { ...prev }
        delete copy[itemId]
        return copy
      }
      return { ...prev, [itemId]: next }
    })
  }

  const cartSummary = useMemo(() => {
    let totalCount = 0
    let subtotal = 0

    Object.entries(cart).forEach(([itemId, qty]) => {
      const item = menuItems.find((m) => m.id === itemId)
      if (item) {
        totalCount += qty
        subtotal += (item.price || 0) * qty
      }
    })

    const taxType = (storeData?.taxType || "FORWARD").toUpperCase()
    const taxValueType = (storeData?.taxValueType || "PERCENTAGE").toUpperCase()
    const storeTaxValue = parseFloat(storeData?.taxValue) || 0

    let tax = 0
    if (taxValueType === "PERCENTAGE") {
      if (taxType === "BACKWARD") {
        tax = Math.round((subtotal - subtotal / (1 + storeTaxValue / 100)) * 100) / 100
      } else {
        tax = Math.round((subtotal * (storeTaxValue / 100)) * 100) / 100
      }
    } else {
      tax = Math.round(storeTaxValue * 100) / 100
    }

    const serviceFee = subtotal > 0 ? parseFloat(storeData?.serviceFee) || 0 : 0

    let couponDiscount = 0
    if (
      appliedCouponCode &&
      storeData?.couponCode &&
      appliedCouponCode.trim().toUpperCase() === storeData.couponCode.trim().toUpperCase()
    ) {
      const couponValue = parseFloat(storeData.couponValue) || 0
      if ((storeData.couponValueType || "PERCENTAGE").toUpperCase() === "PERCENTAGE") {
        couponDiscount = Math.round((subtotal * (couponValue / 100)) * 100) / 100
      } else {
        couponDiscount = couponValue
      }
    }

    const discount = Math.min(subtotal, Math.max(0, couponDiscount))
    const basePayable = taxType === "BACKWARD" ? subtotal : subtotal + tax
    const totalPrice = Math.max(0, Math.round((basePayable + serviceFee - discount) * 100) / 100)

    return { totalCount, subtotal, tax, taxType, serviceFee, discount, totalPrice }
  }, [cart, menuItems, storeData, appliedCouponCode])

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([itemId, qty]) => {
        const item = menuItems.find((m) => m.id === itemId)
        return item ? { ...item, qty } : null
      })
      .filter(Boolean)
  }, [cart, menuItems])

  const handlePlaceOrder = async () => {
    setOrderError("")

    const isDining = orderType === "DINING"
    if (isDining) {
      if (!tableNumber || String(tableNumber).trim() === "") {
        setOrderError("Please select a valid table number.")
        return
      }
      if (storeData?.tables && storeData.tables.length > 0) {
        const isValid = storeData.tables.some(
          (t) => String(t.number).trim().toLowerCase() === String(tableNumber).trim().toLowerCase()
        )
        if (!isValid) {
          setOrderError(`Table #${tableNumber} is not recognized. Please select a valid table.`)
          return
        }
      }
    }

    if (paymentType === "PREPAID" && !isCustomerSignedIn) {
      setOrderError("Online payment requires customer authentication.")
      return
    }

    if (cartItems.length === 0) {
      setOrderError("Your order sheet is empty.")
      return
    }

    setIsSubmittingOrder(true)

    try {
      const payload = {
        storeId: storeData.id,
        orderType,
        tableNumber: isDining ? String(tableNumber).trim() : "TAKEAWAY",
        paymentType,
        notes: notes.trim(),
        customerName: isCustomerSignedIn ? customerName.trim() : "Guest Diner",
        customerEmail: isCustomerSignedIn ? customerEmail.trim().toLowerCase() : null,
        customerPhone: isCustomerSignedIn ? customerPhone.trim() : null,
        appliedCouponCode: appliedCouponCode || undefined,
        items: cartItems.map((item) => ({
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.qty,
        })),
      }

      const response = await createOrderApi(payload)
      if (response?.success && response?.data) {
        setActiveOrder(response.data)
        setCart({})
        setIsCartOpen(false)
        setIsTrackerOpen(true)
      } else {
        throw new Error(response?.message || "Order creation failed.")
      }
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : "Failed to place order.")
    } finally {
      setIsSubmittingOrder(false)
    }
  }

  const renderDietaryBadge = (type) => {
    switch (type) {
      case "VEG":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] py-0.5 px-2 gap-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Veg
          </Badge>
        )
      case "NON_VEG":
        return (
          <Badge className="bg-red-500/10 text-red-400 border border-red-500/30 text-[10px] py-0.5 px-2 gap-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" /> Non-Veg
          </Badge>
        )
      case "EGG":
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] py-0.5 px-2 gap-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" /> Egg
          </Badge>
        )
      case "VEGAN":
        return (
          <Badge className="bg-teal-500/10 text-teal-400 border border-teal-500/30 text-[10px] py-0.5 px-2 gap-1 font-medium">
            🌱 Vegan
          </Badge>
        )
      default:
        return (
          <Badge className="bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] py-0.5 px-2">
            Veg
          </Badge>
        )
    }
  }

  const renderOrderStatusBadge = (status) => {
    switch (status) {
      case "PENDING_VERIFICATION":
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs gap-1.5 py-1 px-3">
            <Clock className="w-3.5 h-3.5 animate-spin" /> Waiter Verification
          </Badge>
        )
      case "ACCEPTED":
        return (
          <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs gap-1.5 py-1 px-3">
            <CheckCircle2 className="w-3.5 h-3.5" /> Accepted
          </Badge>
        )
      case "PREPARING":
        return (
          <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/30 text-xs gap-1.5 py-1 px-3">
            <ChefHat className="w-3.5 h-3.5 animate-pulse" /> Preparing
          </Badge>
        )
      case "READY":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs gap-1.5 py-1 px-3">
            <Sparkles className="w-3.5 h-3.5" /> Ready!
          </Badge>
        )
      case "SERVED":
        return (
          <Badge className="bg-teal-500/10 text-teal-400 border border-teal-500/30 text-xs gap-1.5 py-1 px-3">
            <Utensils className="w-3.5 h-3.5" /> Served
          </Badge>
        )
      case "COMPLETED":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs gap-1.5 py-1 px-3">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
          </Badge>
        )
      case "CANCELLED":
        return (
          <Badge className="bg-red-500/10 text-red-400 border border-red-500/30 text-xs gap-1.5 py-1 px-3">
            <X className="w-3.5 h-3.5" /> Cancelled
          </Badge>
        )
      default:
        return (
          <Badge className="bg-zinc-800 text-zinc-300 text-xs">{status}</Badge>
        )
    }
  }

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-zinc-950 text-white">
        <div className="min-h-screen p-4 sm:p-8 max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-lg bg-zinc-800" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-48 bg-zinc-800" />
              <Skeleton className="h-4 w-64 bg-zinc-800/60" />
            </div>
          </div>
          <Skeleton className="h-10 w-full rounded-lg bg-zinc-900" />
          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <Skeleton key={i} className="h-18 w-full rounded-lg bg-zinc-900" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !storeData) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }} />
        </div>

        <div className="relative w-full max-w-2xl flex flex-col items-center">
          {/* Main Card */}
          <Card className="bg-transparent! backdrop-blur-3xl rounded-none border-none text-zinc-100 w-full p-8 text-center space-y-6">

            {/* SVG Illustration */}
            <div className="relative w-40 h-40 mx-auto">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                {/* Animated circles */}
                <circle cx="100" cy="100" r="80" fill="none" stroke="#ef4444" strokeWidth="2" opacity="0.1" />
                <circle cx="100" cy="100" r="70" fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="4 4" opacity="0.2" />

                {/* Plate illustration */}
                <circle cx="100" cy="100" r="55" fill="#18181b" stroke="#3f3f46" strokeWidth="2" />
                <circle cx="100" cy="100" r="45" fill="#27272a" stroke="#3f3f46" strokeWidth="1" />

                {/* Fork */}
                <g transform="translate(135, 55) rotate(15)">
                  <rect x="0" y="0" width="6" height="30" fill="#a1a1aa" rx="2" />
                  <rect x="-2" y="30" width="10" height="4" fill="#a1a1aa" rx="1" />
                  <rect x="0" y="34" width="6" height="20" fill="#a1a1aa" rx="2" />
                </g>

                {/* Knife */}
                <g transform="translate(55, 135) rotate(-15)">
                  <rect x="0" y="0" width="6" height="30" fill="#a1a1aa" rx="2" />
                  <rect x="-2" y="30" width="10" height="4" fill="#a1a1aa" rx="1" />
                  <path d="M0 34 L6 34 L6 54 Q6 58 3 58 Q0 58 0 54 Z" fill="#a1a1aa" />
                </g>

                {/* Cross/Error indicator */}
                <circle cx="100" cy="100" r="35" fill="#ef4444" opacity="0.1" />
                <path d="M80 80 L120 120 M120 80 L80 120" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />

                {/* Small decorative elements */}
                <circle cx="70" cy="70" r="3" fill="#ef4444" opacity="0.5" />
                <circle cx="130" cy="130" r="2" fill="#ef4444" opacity="0.3" />
                <circle cx="130" cy="70" r="2" fill="#ef4444" opacity="0.4" />
              </svg>
            </div>

            {/* Content */}
            <div className="space-y-3">
              <CardTitle className="text-2xl font-bold text-white">
                Menu Unavailable
              </CardTitle>

              <CardDescription className="text-zinc-400 text-sm leading-relaxed">
                {error || "We couldn't find a restaurant menu matching this link."}
              </CardDescription>
            </div>

            {/* Additional info */}
            <div className="space-y-3 pt-4 border-t border-zinc-800">
              <p className="text-zinc-500 text-xs">
                The menu might have been removed or the link might be incorrect.
              </p>

              <div className="flex items-center justify-center gap-2 text-zinc-600 text-xs">
                <span className="inline-block w-2 h-2 bg-zinc-700 rounded-full"></span>
                <span>Please check the URL or contact the restaurant directly</span>
              </div>
            </div>
          </Card>

          {/* Footer note */}
          <p className="text-zinc-600 text-xs mt-6">
            Having trouble? Contact support at support@example.com
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: accentColor }}>
      <div className="pb-32 max-w-lg mx-auto bg-zinc-950 text-zinc-100" style={{ fontFamily }}>
      {/* Header */}
      <header className="bg-zinc-900/50 border-b border-zinc-800">
        <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="w-14 h-14 rounded-lg border border-zinc-700 bg-zinc-900 shrink-0">
                <AvatarImage src={storeData.brandingLogo} alt={storeData.name} className="object-cover" />
                <AvatarFallback className="bg-zinc-800 text-white font-bold text-lg">
                  {storeData.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-white tracking-tight truncate">{storeData.name}</h1>
                <p className="text-xs text-zinc-400 truncate">{storeData.description || "Authentic Culinary Experience"}</p>
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-md border border-zinc-700 bg-zinc-900 text-center shrink-0">
              <span className="block text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Table</span>
              <span className="text-sm font-bold text-white">
                {tableNumber ? `#${tableNumber}` : "—"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-zinc-500 mt-4 pt-4 border-t border-zinc-800/60">
            {storeData.operatingHours && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>{storeData.operatingHours}</span>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <ChefHat className="w-3.5 h-3.5" />
              <span>{menuItems.length} Dishes</span>
            </span>
            {activeOrder && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsTrackerOpen(true)}
                className="ml-auto"
              >
                <Receipt className="w-3.5 h-3.5" /> Order #{activeOrder.orderNumber}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-4 overflow-x-auto no-scrollbar">
            {[
              { id: "ALL", label: "All" },
              { id: "VEG", label: "Veg" },
              { id: "NON_VEG", label: "Non-Veg" },
              { id: "EGG", label: "Egg" },
              { id: "VEGAN", label: "Vegan" },
            ].map((diet) => (
              <Button
                key={diet.id}
                type="button"
                variant={selectedDietary === diet.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedDietary(diet.id)}
                className="shrink-0"
              >
                {diet.label}
              </Button>
            ))}
          </div>
        </div>
      </header>

      {/* Sticky Search & Categories */}
      <div className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes..."
              className="pl-9 pr-9 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 text-sm h-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <Button
                key={cat}
                type="button"
                variant={selectedCategory === cat ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
                className="shrink-0"
              >
                {cat === "ALL" ? "All Categories" : cat}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Grid */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {Object.keys(groupedMenuItems).length === 0 ? (
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
              <Utensils className="w-7 h-7" />
            </div>
            <CardTitle className="text-lg text-white">No dishes matched</CardTitle>
            <CardDescription className="text-zinc-500 text-sm">Try adjusting your search or filters.</CardDescription>
          </Card>
        ) : (
          Object.entries(groupedMenuItems).map(([categoryName, items]) => (
            <section key={categoryName}>
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 mb-4">
                <h2 className="text-lg font-bold text-white tracking-tight">{categoryName}</h2>
                <span className="text-xs text-zinc-500">({items.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((item) => {
                  const qty = cart[item.id] || 0
                  return (
                    <Card key={item.id} className="bg-zinc-900 border-zinc-800 text-zinc-100 hover:border-zinc-700 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {renderDietaryBadge(item.dietaryType)}
                              {item.spicinessLevel > 0 && (
                                <span className="text-red-400 text-xs flex items-center gap-0.5">
                                  <Flame className="w-3 h-3" />
                                  {"🌶️".repeat(item.spicinessLevel)}
                                </span>
                              )}
                            </div>
                            <h3 className="font-semibold text-white text-base leading-snug">{item.name}</h3>
                          </div>
                          {item.image && (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-16 h-16 rounded-lg object-cover border border-zinc-800 shrink-0 bg-zinc-950"
                            />
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed mt-2">{item.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 mt-2">
                          {item.prepTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {item.prepTime} mins
                            </span>
                          )}
                          {item.calories && <span>· {item.calories} kcal</span>}
                          {item.allergens && (
                            <span className="flex items-center gap-1 text-zinc-400">
                              · <Info className="w-3 h-3" /> {item.allergens}
                            </span>
                          )}
                        </div>
                      </CardContent>
                      <CardFooter className="px-4 py-3 flex items-center justify-between border-t border-zinc-800/50">
                        <div className="flex items-center text-white font-bold text-base">
                          <IndianRupee className="w-4 h-4 text-zinc-500" />
                          <span>{item.price}</span>
                        </div>
                        {qty === 0 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => updateCartQuantity(item.id, 1)}
                          >
                            <Plus className="w-4 h-4" /> Add
                          </Button>
                        ) : (
                          <div className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-950">
                            <button onClick={() => updateCartQuantity(item.id, -1)} className="h-7 w-7 flex items-center justify-center text-zinc-400 hover:text-white">
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-2 font-bold text-sm text-white">{qty}</span>
                            <button onClick={() => updateCartQuantity(item.id, 1)} className="h-7 w-7 flex items-center justify-center text-zinc-400 hover:text-white">
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </CardFooter>
                    </Card>
                  )
                })}
              </div>
            </section>
          ))
        )}
      </main>

      {/* Floating Cart Bar */}
      {cartSummary.totalCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-xl mx-auto">
          <div className="p-3 rounded-lg border border-zinc-700 bg-zinc-900 flex items-center justify-between shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-zinc-800 flex items-center justify-center relative">
                <ShoppingBag className="w-4 h-4 text-white" />
                <span className="absolute -top-1.5 -right-1.5 text-[10px] font-bold w-5 h-5 rounded-full bg-white text-zinc-950 flex items-center justify-center">
                  {cartSummary.totalCount}
                </span>
              </div>
              <div>
                <p className="font-semibold text-sm text-white leading-tight">
                  {cartSummary.totalCount} {cartSummary.totalCount === 1 ? "Item" : "Items"}
                </p>
                <p className="text-xs text-zinc-500">₹{cartSummary.totalPrice}</p>
              </div>
            </div>
            <Button type="button" onClick={() => setIsCartOpen(true)} size="sm">
              Review Order
            </Button>
          </div>
        </div>
      )}

      {/* Cart Sheet */}
      <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
        <SheetContent side="bottom" className="bg-zinc-950 border-zinc-800 text-zinc-100 w-full sm:max-w-lg mx-auto flex flex-col p-0">
          <SheetHeader className="text-left border-b border-zinc-800 px-6 py-4 shrink-0">
            <SheetTitle className="text-white text-lg font-bold flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-zinc-400" />
              Order & Billing
            </SheetTitle>
            {tableNumber && (
              <Badge className="bg-zinc-800 text-zinc-300 font-mono text-xs mt-1">Table #{tableNumber}</Badge>
            )}
          </SheetHeader>

          {orderError && (
            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3 mx-6 mt-4 shrink-0">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{orderError}</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto scrollbar-none px-6 py-4 space-y-6">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium block">Order Type *</label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-zinc-900 border border-zinc-800">
                <Button
                  type="button"
                  variant={orderType === "DINING" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setOrderType("DINING")}
                >
                  <Utensils className="w-3.5 h-3.5" /> Dining
                </Button>
                <Button
                  type="button"
                  variant={orderType === "TAKEAWAY" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setOrderType("TAKEAWAY")}
                >
                  <ShoppingBag className="w-3.5 h-3.5" /> Takeaway
                </Button>
              </div>
            </div>

            {orderType === "DINING" && (
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium flex items-center gap-1.5">
                  <Hash className="w-4 h-4" /> Select Table *
                </label>
                {storeData?.tables && storeData.tables.length > 0 ? (
                  <select
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base py-2.5 focus:border-zinc-400 outline-none cursor-pointer"
                    required
                  >
                    <option value="" className="bg-zinc-900">-- Choose Table --</option>
                    {storeData.tables.map((t) => (
                      <option key={t.id} value={t.number} className="bg-zinc-900">
                        Table #{t.number} ({t.section || "Main Area"}) - {t.capacity || 4} Seats
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 text-sm">
                    No tables configured. Contact restaurant staff.
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium block">
                Selected Items ({cartSummary.totalCount})
              </span>
              {cartItems.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-6">No items in your order.</p>
              ) : (
                <div className="space-y-2">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                        <p className="text-xs text-zinc-500">₹{item.price} × {item.qty}</p>
                      </div>
                      <div className="inline-flex items-center rounded-md border border-zinc-800 bg-zinc-950">
                        <button onClick={() => updateCartQuantity(item.id, -1)} className="h-6 w-6 flex items-center justify-center text-zinc-400 hover:text-white">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-xs font-bold text-white">{item.qty}</span>
                        <button onClick={() => updateCartQuantity(item.id, 1)} className="h-6 w-6 flex items-center justify-center text-zinc-400 hover:text-white">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-white w-16 text-right">₹{item.price * item.qty}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Kitchen Instructions
              </label>
              <Input
                type="text"
                placeholder="e.g. Less spicy, extra cheese..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-transparent border-0 border-b-2 border-zinc-800 text-white text-sm px-0 py-2.5 focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600"
              />
            </div>

            <div className="space-y-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Promo Coupon
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="WELCOME10"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  className="bg-transparent border-0 border-b-2 border-zinc-800 text-white text-sm px-0 py-2.5 focus:border-zinc-400 outline-none uppercase font-mono flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAppliedCouponCode(couponInput.trim())}
                >
                  Apply
                </Button>
              </div>
              {appliedCouponCode && (
                <div className="flex items-center justify-between text-xs text-emerald-400 pt-1">
                  <span>Coupon "{appliedCouponCode.toUpperCase()}" Applied!</span>
                  <button type="button" onClick={() => { setAppliedCouponCode(""); setCouponInput(""); }} className="text-zinc-500 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium block">Payment Mode *</span>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-zinc-900 border border-zinc-800">
                <Button
                  type="button"
                  variant={paymentType === "POSTPAID" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setPaymentType("POSTPAID")}
                >
                  <Banknote className="w-4 h-4" /> Postpaid
                </Button>
                <Button
                  type="button"
                  variant={paymentType === "PREPAID" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setPaymentType("PREPAID")}
                >
                  <CreditCard className="w-4 h-4" /> Prepaid
                </Button>
              </div>
            </div>

            {paymentType === "PREPAID" && (
              <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Customer Authentication</span>
                  {isCustomerSignedIn && (
                    <Badge className="bg-emerald-500/10 text-emerald-400 text-[10px]">Signed In</Badge>
                  )}
                </div>
                {!isCustomerSignedIn ? (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500">Online payment requires customer sign-in.</p>
                    <Link to={`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`}>
                      <Button type="button" className="w-full" size="sm">
                        <Lock className="w-4 h-4" /> Sign In / Register
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="text-sm text-zinc-300 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                    <p className="font-semibold text-white">{customerName}</p>
                    <p className="text-zinc-500">{customerEmail}</p>
                  </div>
                )}
              </div>
            )}

            <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Billing Breakdown</span>
                {storeData?.taxType && (
                  <Badge className="bg-zinc-800 text-zinc-400 text-[10px] font-mono">
                    Tax: {storeData.taxType} ({storeData.taxValue || 5}%)
                  </Badge>
                )}
              </div>
              <div className="flex justify-between text-zinc-400 text-xs">
                <span>Subtotal</span>
                <span className="text-white font-mono">₹{cartSummary.subtotal}</span>
              </div>
              <div className="flex justify-between text-zinc-400 text-xs">
                <span>GST {cartSummary.taxType === "BACKWARD" ? "(Inclusive)" : "(Exclusive)"}</span>
                <span className="text-white font-mono">₹{cartSummary.tax}</span>
              </div>
              {cartSummary.serviceFee > 0 && (
                <div className="flex justify-between text-zinc-400 text-xs">
                  <span>Service Fee</span>
                  <span className="text-white font-mono">₹{cartSummary.serviceFee}</span>
                </div>
              )}
              {cartSummary.discount > 0 && (
                <div className="flex justify-between text-emerald-400 text-xs">
                  <span>Discount</span>
                  <span className="font-mono">-₹{cartSummary.discount}</span>
                </div>
              )}
              <Separator className="bg-zinc-800 my-1.5" />
              <div className="flex justify-between text-base font-bold text-white">
                <span>Total</span>
                <span className="font-mono">₹{cartSummary.totalPrice}</span>
              </div>
            </div>
          </div>

          <SheetFooter className="border-t border-zinc-800 px-6 py-4 shrink-0">
            <Button
              type="button"
              onClick={handlePlaceOrder}
              disabled={isSubmittingOrder || cartItems.length === 0}
              className="w-full"
            >
              {isSubmittingOrder ? (
                <>
                  <LoaderCircle className="w-4 h-4 animate-spin" /> Processing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {paymentType === "PREPAID" ? "Pay & Send" : "Place Order"}
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Order Tracker Sheet */}
      <Sheet open={isTrackerOpen} onOpenChange={setIsTrackerOpen}>
        <SheetContent side="right" className="bg-zinc-950 border-zinc-800 text-zinc-100 w-full sm:max-w-md flex flex-col p-0" style={{ fontFamily }}>
          <SheetHeader className="text-left border-b border-zinc-800 px-6 py-4 shrink-0">
            <SheetTitle className="text-white text-lg font-bold flex items-center gap-2">
              <Receipt className="w-5 h-5 text-zinc-400" />
              Order Tracker
            </SheetTitle>
            <Badge className="bg-zinc-800 font-mono text-xs mt-1">#{activeOrder?.orderNumber}</Badge>
          </SheetHeader>
          {activeOrder && (
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 text-center space-y-2">
                <span className="text-xs text-zinc-500 uppercase font-bold tracking-wider block">Status</span>
                {renderOrderStatusBadge(activeOrder.orderStatus)}
              </div>
              <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Payment</span>
                  <span className="text-white font-mono">{activeOrder.paymentType}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Total</span>
                  <span className="text-white font-bold font-mono">₹{activeOrder.totalAmount}</span>
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium block">
                  Items ({activeOrder.items?.length || 0})
                </span>
                {activeOrder.items?.map((it) => (
                  <div key={it.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-sm">
                    <div>
                      <p className="font-semibold text-white">{it.name}</p>
                      <p className="text-zinc-500">₹{it.price} × {it.quantity}</p>
                    </div>
                    <span className="font-bold text-white font-mono">₹{it.itemTotal}</span>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={pollActiveOrder}
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
    </div>
  )
}