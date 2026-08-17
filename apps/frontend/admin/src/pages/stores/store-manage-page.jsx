import React, { useState, useEffect } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Label,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@repo/ui"
import {
  ArrowLeft,
  Store,
  UtensilsCrossed,
  Plus,
  Search,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Palette,
  Clock,
  Save,
  Flame,
  Zap,
  ShieldAlert,
} from "lucide-react"
import { useAuth } from "../../context/auth-context.jsx"
import {
  fetchStoreByIdApi,
  updateStoreApi,
  deleteStoreApi,
  toggleMenuItemAvailabilityApi,
  deleteMenuItemApi,
} from "../../services/admin-api.js"

export default function StoreManagePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token } = useAuth()

  const [activeTab, setActiveTab] = useState("menu")
  const [store, setStore] = useState(null)
  const [menuItems, setMenuItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [msg, setMsg] = useState({ text: "", error: false })

  // Store Edit Form State
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [brandingLogo, setBrandingLogo] = useState("")
  const [colorScheme, setColorScheme] = useState("dark")
  const [fontStyle, setFontStyle] = useState("DM Sans")
  const [operatingHours, setOperatingHours] = useState("")

  // Menu Search & Filters
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("ALL")
  const [selectedDietary, setSelectedDietary] = useState("ALL")

  useEffect(() => {
    async function loadStore() {
      if (!token || !id) return
      setLoading(true)
      try {
        const res = await fetchStoreByIdApi(token, id)
        const storeData = res?.data
        if (storeData) {
          setStore(storeData)
          setMenuItems(storeData.menuItems || [])
          setName(storeData.name || "")
          setSlug(storeData.slug || "")
          setDescription(storeData.description || "")
          setBrandingLogo(storeData.brandingLogo || "")
          setColorScheme(storeData.colorScheme || "dark")
          setFontStyle(storeData.fontStyle || "DM Sans")
          setOperatingHours(storeData.operatingHours || "")
        }
      } catch (err) {
        setMsg({ text: err instanceof Error ? err.message : "Failed to load store details.", error: true })
      } finally {
        setLoading(false)
      }
    }
    loadStore()
  }, [token, id])

  const handleUpdateStore = async (e) => {
    e.preventDefault()
    setMsg({ text: "", error: false })
    setIsSubmitting(true)

    try {
      await updateStoreApi(token, id, {
        name,
        slug: slug.trim().toLowerCase(),
        description,
        brandingLogo,
        colorScheme,
        fontStyle,
        operatingHours,
      })
      setMsg({ text: "Store establishment details & URL slug updated!", error: false })
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Failed to update store.", error: true })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteStore = async () => {
    if (!window.confirm("Are you sure you want to delete this store establishment and all associated menu items?")) return
    setIsSubmitting(true)
    try {
      await deleteStoreApi(token, id)
      navigate("/dashboard/stores")
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Failed to delete store.", error: true })
      setIsSubmitting(false)
    }
  }

  const handleToggleAvailability = async (itemId) => {
    try {
      const res = await toggleMenuItemAvailabilityApi(token, id, itemId)
      if (res?.data) {
        setMenuItems((prev) =>
          prev.map((item) => (item.id === itemId ? { ...item, isAvailable: res.data.isAvailable } : item))
        )
      }
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Failed to toggle availability.", error: true })
    }
  }

  const handleDeleteMenuItem = async (itemId) => {
    if (!window.confirm("Are you sure you want to delete this menu item?")) return
    try {
      await deleteMenuItemApi(token, id, itemId)
      setMenuItems((prev) => prev.filter((item) => item.id !== itemId))
      setMsg({ text: "Menu item deleted.", error: false })
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Failed to delete menu item.", error: true })
    }
  }

  // Extract categories dynamically
  const categories = Array.from(new Set(menuItems.map((item) => item.category || "General")))

  const filteredMenuItems = menuItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(search.toLowerCase()))
    const matchesCategory = selectedCategory === "ALL" || (item.category || "General") === selectedCategory
    const matchesDietary = selectedDietary === "ALL" || (item.dietaryType || "VEG") === selectedDietary
    return matchesSearch && matchesCategory && matchesDietary
  })

  const renderDietaryBadge = (type) => {
    switch (type) {
      case "VEG":
        return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px] gap-1">🟢 Veg</Badge>
      case "NON_VEG":
        return <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[11px] gap-1">🔴 Non-Veg</Badge>
      case "EGG":
        return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[11px] gap-1">🟡 Egg</Badge>
      case "VEGAN":
        return <Badge className="bg-teal-500/10 text-teal-400 border-teal-500/20 text-[11px] gap-1">🌱 Vegan</Badge>
      default:
        return <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 text-[11px]">Veg</Badge>
    }
  }

  const renderSpiciness = (level) => {
    if (!level || level === 0) return null
    return (
      <span className="text-red-400 text-xs flex items-center font-medium gap-0.5">
        <Flame className="h-3 w-3" />
        {"🌶️".repeat(level)}
      </span>
    )
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-3">
          <Link to="/dashboard/stores">
            <Button variant="outline" size="sm" className="border-zinc-800 text-zinc-300 hover:bg-zinc-800 gap-1.5 text-xs">
              <ArrowLeft className="h-4 w-4" /> Back to Stores
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">{store?.name || "Store Management"}</h1>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">Active</Badge>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Owner: <span className="text-zinc-200 font-medium">{store?.owner?.name || "Unassigned"}</span> ({store?.owner?.email || "—"})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link to={`/dashboard/stores/${id}/menu/new`}>
            <Button className="bg-zinc-200 hover:bg-zinc-100 text-zinc-900 font-bold gap-2 text-xs">
              <Plus className="h-4 w-4" /> Add Food Item
            </Button>
          </Link>
        </div>
      </div>

      {msg.text && (
        <div
          className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 border ${
            msg.error
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}
        >
          {msg.error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {msg.text}
        </div>
      )}

      {/* Tabs Control */}
      <div className="flex items-center gap-2 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab("menu")}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "menu"
              ? "border-amber-400 text-white"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <UtensilsCrossed className="h-3.5 w-3.5 inline mr-2" /> Digital Food Menu ({menuItems.length})
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "settings"
              ? "border-amber-400 text-white"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Palette className="h-3.5 w-3.5 inline mr-2" /> Store Details & Branding
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-2">
          <LoaderCircle className="h-6 w-6 animate-spin" />
          <p className="text-xs">Loading establishment dashboard...</p>
        </div>
      ) : activeTab === "menu" ? (
        /* Tab 1: Digital Menu Items Catalog */
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardHeader>
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <Input
                  placeholder="Search food items by name, ingredients, description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-500 text-xs"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Dietary Filter */}
                <select
                  value={selectedDietary}
                  onChange={(e) => setSelectedDietary(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 text-xs text-white rounded-md px-3 py-1.5 focus:outline-none"
                >
                  <option value="ALL">All Dietary Types</option>
                  <option value="VEG">🟢 Veg Only</option>
                  <option value="NON_VEG">🔴 Non-Veg Only</option>
                  <option value="EGG">🟡 Egg Only</option>
                  <option value="VEGAN">🌱 Vegan Only</option>
                </select>

                {/* Category Filter Pills */}
                <button
                  onClick={() => setSelectedCategory("ALL")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    selectedCategory === "ALL"
                      ? "bg-zinc-200 text-zinc-900 border-zinc-200 font-bold"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  All Categories
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      selectedCategory === cat
                        ? "bg-zinc-200 text-zinc-900 border-zinc-200 font-bold"
                        : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredMenuItems.length === 0 ? (
              <div className="text-center py-16 px-4">
                <UtensilsCrossed className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                <p className="text-sm text-zinc-400 font-medium">No menu items found for the selected filters.</p>
                <p className="text-xs text-zinc-500 mt-1 mb-4">Click below to create a new food item.</p>
                <Link to={`/dashboard/stores/${id}/menu/new`}>
                  <Button className="bg-zinc-200 hover:bg-zinc-100 text-zinc-900 font-bold gap-2 text-xs">
                    <Plus className="h-4 w-4" /> Add Food Item
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="border-zinc-800">
                    <TableRow className="border-zinc-800 hover:bg-zinc-950">
                      <TableHead className="text-zinc-400">Dish / Item</TableHead>
                      <TableHead className="text-zinc-400">Dietary & Spiciness</TableHead>
                      <TableHead className="text-zinc-400">Category & Specs</TableHead>
                      <TableHead className="text-zinc-400">Price</TableHead>
                      <TableHead className="text-zinc-400">Availability</TableHead>
                      <TableHead className="text-right text-zinc-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMenuItems.map((item) => (
                      <TableRow key={item.id} className="border-zinc-800 hover:bg-zinc-950/50">
                        <TableCell className="font-medium text-white max-w-xs">
                          <div className="flex items-center gap-3">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="h-12 w-12 rounded-lg object-cover bg-zinc-950 border border-zinc-800 shrink-0" />
                            ) : (
                              <div className="h-12 w-12 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 shrink-0">
                                <UtensilsCrossed className="h-5 w-5" />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-semibold text-white">{item.name}</p>
                              <p className="text-xs text-zinc-400 line-clamp-1">{item.description || "No description provided."}</p>
                              {item.allergens && (
                                <p className="text-[10px] text-amber-400 flex items-center gap-1 mt-0.5">
                                  <ShieldAlert className="h-3 w-3" /> {item.allergens}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1">
                            <div>{renderDietaryBadge(item.dietaryType)}</div>
                            {renderSpiciness(item.spicinessLevel)}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1">
                            <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 text-[11px]">
                              {item.category || "General"}
                            </Badge>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                              {item.prepTime && (
                                <span className="flex items-center gap-0.5">
                                  <Clock className="h-3 w-3 text-zinc-500" /> {item.prepTime}m
                                </span>
                              )}
                              {item.calories && (
                                <span className="flex items-center gap-0.5">
                                  <Zap className="h-3 w-3 text-amber-500" /> {item.calories} kcal
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="text-amber-400 font-bold text-sm">
                          ₹{typeof item.price === "number" ? item.price.toFixed(2) : parseFloat(item.price || 0).toFixed(2)}
                        </TableCell>

                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleAvailability(item.id)}
                            className={`text-xs border px-2.5 py-0.5 h-7 font-medium ${
                              item.isAvailable
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                                : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                            }`}
                          >
                            {item.isAvailable ? "Available" : "Unavailable"}
                          </Button>
                        </TableCell>

                        <TableCell className="text-right space-x-2">
                          <Link to={`/dashboard/stores/${id}/menu/${item.id}/edit`}>
                            <Button variant="outline" size="sm" className="text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1">
                              <Edit className="h-3.5 w-3.5" /> Edit
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteMenuItem(item.id)}
                            className="text-xs text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Tab 2: Store Branding & Settings Form */
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardHeader>
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Store className="h-4 w-4 text-amber-400" /> Store Branding & Settings
            </CardTitle>
            <CardDescription className="text-zinc-400 text-xs">
              Update restaurant details, operating hours, and digital menu theme settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateStore} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-zinc-200 text-xs font-medium">
                    Store Name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-zinc-950 border-zinc-800 text-white text-xs"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug" className="text-amber-400 text-xs font-semibold">
                    Digital Menu URL Slug
                  </Label>
                  <Input
                    id="slug"
                    type="text"
                    placeholder="e.g. royal-punjab-dhaba"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    className="bg-zinc-950 border-amber-500/40 text-amber-300 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">Public Menu Link:</span>
                <a
                  href={`http://localhost:5174/${slug || store?.slug || store?.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:underline flex items-center gap-1 font-bold"
                >
                  http://localhost:5174/{slug || store?.slug || store?.id}
                </a>
              </div>

              <div className="space-y-2">
                <Label htmlFor="operatingHours" className="text-zinc-200 text-xs font-medium flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-zinc-400" /> Operating Hours
                </Label>
                <Input
                  id="operatingHours"
                  type="text"
                  value={operatingHours}
                  onChange={(e) => setOperatingHours(e.target.value)}
                  placeholder="10:00 AM - 11:00 PM"
                  className="bg-zinc-950 border-zinc-800 text-white text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-zinc-200 text-xs font-medium">
                  Description / Tagline
                </Label>
                <Input
                  id="description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-white text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="brandingLogo" className="text-zinc-200 text-xs font-medium">
                  Branding Logo Image URL
                </Label>
                <Input
                  id="brandingLogo"
                  type="url"
                  value={brandingLogo}
                  onChange={(e) => setBrandingLogo(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="colorScheme" className="text-zinc-200 text-xs font-medium">
                    Color Scheme Theme
                  </Label>
                  <select
                    id="colorScheme"
                    value={colorScheme}
                    onChange={(e) => setColorScheme(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-xs text-white rounded-md px-3 py-2.5 focus:outline-none"
                  >
                    <option value="dark">Dark Modern Zinc</option>
                    <option value="amber">Warm Amber Gold</option>
                    <option value="emerald">Fresh Emerald Green</option>
                    <option value="light">Classic Clean White</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fontStyle" className="text-zinc-200 text-xs font-medium">
                    Typography Font Style
                  </Label>
                  <select
                    id="fontStyle"
                    value={fontStyle}
                    onChange={(e) => setFontStyle(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-xs text-white rounded-md px-3 py-2.5 focus:outline-none"
                  >
                    <option value="DM Sans">DM Sans (Default Modern)</option>
                    <option value="Inter">Inter (Clean Sans)</option>
                    <option value="Outfit">Outfit (Geometric Modern)</option>
                    <option value="Roboto">Roboto (Classic)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDeleteStore}
                  disabled={isSubmitting}
                  className="text-red-400 hover:bg-red-500/10 text-xs gap-1.5"
                >
                  <Trash2 className="h-4 w-4" /> Delete Store Establishment
                </Button>

                <Button type="submit" disabled={isSubmitting} className="bg-zinc-200 hover:bg-zinc-100 text-zinc-900 font-bold gap-2 text-xs">
                  {isSubmitting ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" /> Save Store Settings
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
