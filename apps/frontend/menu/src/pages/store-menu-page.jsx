import React, { useState, useEffect, useMemo } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import {
  Store,
  Search,
  Clock,
  MapPin,
  Utensils,
  Plus,
  Minus,
  ShoppingBag,
  Leaf,
  AlertCircle,
  RefreshCw,
  X,
  CheckCircle2,
  LoaderCircle
} from "lucide-react"
import { fetchStoreBySlugApi } from "../services/store-menu-api.js"

export default function StoreMenuPage() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const tableParam = searchParams.get("table")

  // State
  const [storeData, setStoreData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("ALL")
  const [selectedDietary, setSelectedDietary] = useState("ALL")

  // Cart state: { [itemId]: quantity }
  const [cart, setCart] = useState({})

  // Fetch store details & menu
  useEffect(() => {
    if (!slug) return
    setIsLoading(true)
    setError(null)

    fetchStoreBySlugApi(slug)
      .then((res) => {
        setStoreData(res.data)
      })
      .catch((err) => {
        console.error("Failed to load store menu:", err)
        setError(err.message || "Store menu not found or unavailable")
      })
      .finally(() => setIsLoading(false))
  }, [slug])

  const menuItems = useMemo(() => storeData?.menuItems || [], [storeData])

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set()
    menuItems.forEach((item) => {
      if (item.category) set.add(item.category)
    })
    return ["ALL", ...Array.from(set)]
  }, [menuItems])

  // Filter menu items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      // Available status
      if (item.isAvailable === false) return false

      // Category match
      if (selectedCategory !== "ALL" && item.category !== selectedCategory) return false

      // Dietary match
      if (selectedDietary !== "ALL" && item.dietaryType !== selectedDietary) return false

      // Search query match
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

  // Group items by category
  const groupedMenuItems = useMemo(() => {
    const groups = {}
    filteredMenuItems.forEach((item) => {
      const cat = item.category || "General Menu"
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    })
    return groups
  }, [filteredMenuItems])

  // Cart Helpers
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

  // Cart Summary calculations
  const cartSummary = useMemo(() => {
    let totalCount = 0
    let totalPrice = 0

    Object.entries(cart).forEach(([itemId, qty]) => {
      const item = menuItems.find((m) => m.id === itemId)
      if (item) {
        totalCount += qty
        totalPrice += (item.price || 0) * qty
      }
    })

    return { totalCount, totalPrice }
  }, [cart, menuItems])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 font-sans space-y-4">
        <LoaderCircle className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-sm font-medium text-zinc-400">Loading restaurant digital menu...</p>
      </div>
    )
  }

  if (error || !storeData) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 font-sans space-y-4 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-white">Menu Unavailable</h1>
        <p className="text-xs text-zinc-400 max-w-sm">{error || "Could not find a restaurant menu matching this link."}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans pb-28">
      {/* 1. STORE BRANDING HEADER */}
      <header className="bg-zinc-900 border-b border-zinc-800 p-5 sm:p-8">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xl shrink-0 overflow-hidden">
                {storeData.brandingLogo ? (
                  <img src={storeData.brandingLogo} alt={storeData.name} className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-7 h-7" />
                )}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{storeData.name}</h1>
                <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{storeData.description || "Authentic Dining & Cuisine"}</p>
              </div>
            </div>

            {/* Table Badge */}
            {tableParam && (
              <div className="bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl text-center shrink-0">
                <span className="block text-[10px] text-amber-400 uppercase font-semibold tracking-wider">Dining At</span>
                <span className="text-sm font-bold text-amber-300">Table #{tableParam}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-1 border-t border-zinc-800/60">
            {storeData.operatingHours && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{storeData.operatingHours}</span>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-amber-400" />
              <span>{menuItems.length} Dishes Available</span>
            </span>
          </div>
        </div>
      </header>

      {/* 2. SEARCH & DIETARY CONTROL BAR */}
      <div className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 p-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes, starters, beverages..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-8 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Horizontal Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors cursor-pointer border ${selectedCategory === cat
                    ? "bg-amber-500 text-zinc-950 border-amber-400 font-bold"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                  }`}
              >
                {cat === "ALL" ? "All Categories" : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. MENU ITEMS DISPLAY */}
      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-8">
        {Object.keys(groupedMenuItems).length === 0 ? (
          <div className="py-16 text-center text-zinc-500 space-y-3">
            <Utensils className="w-10 h-10 mx-auto text-zinc-600" />
            <p className="text-base font-semibold text-zinc-300">No dishes match your filter</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Try clearing your search query or switching dietary category options.
            </p>
          </div>
        ) : (
          Object.entries(groupedMenuItems).map(([categoryName, items]) => (
            <section key={categoryName} className="space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>{categoryName}</span>
                <span className="text-xs font-normal text-zinc-500">({items.length})</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((item) => {
                  const qty = cart[item.id] || 0
                  const isVeg = item.dietaryType === "VEG"

                  return (
                    <div
                      key={item.id}
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex gap-4 items-center justify-between"
                    >
                      {/* Left: Info */}
                      <div className="space-y-1.5 overflow-hidden flex-1">
                        <div className="flex items-center gap-2">
                          {/* Dietary Badge Icon */}
                          <span
                            className={`w-3.5 h-3.5 border flex items-center justify-center p-0.5 rounded-xs shrink-0 ${isVeg ? "border-emerald-500" : "border-red-500"
                              }`}
                            title={isVeg ? "Vegetarian" : "Non-Vegetarian"}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? "bg-emerald-500" : "bg-red-500"}`} />
                          </span>

                          <h3 className="font-bold text-white text-sm truncate">{item.name}</h3>
                        </div>

                        {item.description && (
                          <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{item.description}</p>
                        )}

                        <p className="text-sm font-extrabold text-amber-400 pt-1">₹{item.price}</p>
                      </div>

                      {/* Right: Quantity Controls */}
                      <div className="flex flex-col items-center gap-2 shrink-0">
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-16 h-16 rounded-xl object-cover border border-zinc-800"
                          />
                        )}

                        {qty === 0 ? (
                          <button
                            onClick={() => updateCartQuantity(item.id, 1)}
                            className="px-4 py-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-zinc-950 font-bold border border-amber-500/30 rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </button>
                        ) : (
                          <div className="inline-flex items-center bg-zinc-950 border border-amber-500/40 rounded-xl p-1 text-xs">
                            <button
                              onClick={() => updateCartQuantity(item.id, -1)}
                              className="p-1 text-zinc-400 hover:text-white rounded-lg cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-2.5 font-bold text-amber-400">{qty}</span>
                            <button
                              onClick={() => updateCartQuantity(item.id, 1)}
                              className="p-1 text-zinc-400 hover:text-white rounded-lg cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))
        )}
      </main>

      {/* 4. STICKY FLOATING CART BAR AT BOTTOM */}
      {cartSummary.totalCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-3xl mx-auto bg-amber-500 border border-amber-400 rounded-2xl p-4 text-zinc-950 flex items-center justify-between shadow-2xl animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-950/10 flex items-center justify-center text-zinc-950">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <p className="font-extrabold text-sm">
                {cartSummary.totalCount} {cartSummary.totalCount === 1 ? "Item" : "Items"} Selected
              </p>
              <p className="text-xs font-semibold opacity-90">Total: ₹{cartSummary.totalPrice}</p>
            </div>
          </div>

          <button
            onClick={() => alert(`Ordering ${cartSummary.totalCount} items (Total: ₹${cartSummary.totalPrice})`)}
            className="bg-zinc-950 text-amber-400 hover:bg-zinc-900 font-bold px-5 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
          >
            View Order & Checkout &rarr;
          </button>
        </div>
      )}
    </div>
  )
}
