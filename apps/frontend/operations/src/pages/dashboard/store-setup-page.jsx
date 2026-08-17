import React, { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from "react-router-dom"
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
} from "@repo/ui"
import {
  Store,
  Building2,
  Clock,
  Palette,
  Type,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Plus,
  Trash2,
  Edit2,
  QrCode,
  Users,
  Search,
  BookOpen,
  SlidersHorizontal,
  ExternalLink,
  Copy,
  Printer,
  Sparkles,
  Utensils,
  X,
  Eye,
  EyeOff,
  IndianRupee,
  ChevronRight,
  Download,
} from "lucide-react"
import { useAuth } from "../../context/auth-context.jsx"
import { fetchMyStoreApi, updateStoreApi } from "../../services/store-api.js"
import {
  fetchMenuItemsApi,
  createMenuItemApi,
  updateMenuItemApi,
  deleteMenuItemApi,
} from "../../services/menu-api.js"
import {
  fetchStoreTablesApi,
  createTableApi,
  updateTableApi,
  deleteTableApi,
} from "../../services/table-api.js"

export default function StoreSetupPage() {
  const { user, token } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const isOwner = user?.role === "OWNER"
  const qrCodeRef = useRef(null)

  // Active Tab
  const activeTabParam = searchParams.get("tab")?.toUpperCase()
  const [activeTab, setActiveTab] = useState(
    activeTabParam === "MENU" || activeTabParam === "TABLES" ? activeTabParam : "SETTINGS"
  )

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setSearchParams({ tab: tab.toLowerCase() })
  }

  // Common Store State
  const [store, setStore] = useState(null)
  const [isStoreLoading, setIsStoreLoading] = useState(true)

  // Settings State
  const [storeName, setStoreName] = useState("")
  const [slug, setSlug] = useState("")
  const [storeDescription, setStoreDescription] = useState("")
  const [operatingHours, setOperatingHours] = useState("")
  const [colorScheme, setColorScheme] = useState("#f59e0b")
  const [fontStyle, setFontStyle] = useState("DM Sans")
  const [brandingLogo, setBrandingLogo] = useState("")
  const [isUpdatingStore, setIsUpdatingStore] = useState(false)
  const [storeMsg, setStoreMsg] = useState({ text: "", error: false })
  const [copiedMenuLink, setCopiedMenuLink] = useState(false)

  const fontOptions = [
    { label: "DM Sans", value: "DM Sans" },
    { label: "Newsreader", value: "Newsreader" },
    { label: "Inter", value: "Inter" },
    { label: "Playfair Display", value: "Playfair Display" },
    { label: "Outfit", value: "Outfit" },
    { label: "Space Grotesk", value: "Space Grotesk" },
  ]

  // Menu State
  const [menuItems, setMenuItems] = useState([])
  const [isMenuLoading, setIsMenuLoading] = useState(false)
  const [menuSearch, setMenuSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("ALL")
  const [menuMsg, setMenuMsg] = useState({ text: "", error: false })

  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false)
  const [editingMenuItem, setEditingMenuItem] = useState(null)
  const [menuForm, setMenuForm] = useState({
    name: "",
    category: "Main Course",
    price: "",
    description: "",
    image: "",
    dietaryType: "VEG",
    spicinessLevel: 0,
    prepTime: 15,
    calories: 350,
    allergens: "",
    isAvailable: true,
  })
  const [isSavingMenuItem, setIsSavingMenuItem] = useState(false)

  // Tables State
  const [tables, setTables] = useState([])
  const [isTablesLoading, setIsTablesLoading] = useState(false)
  const [selectedSection, setSelectedSection] = useState("ALL")
  const [tableMsg, setTableMsg] = useState({ text: "", error: false })

  const [isTableModalOpen, setIsTableModalOpen] = useState(false)
  const [editingTable, setEditingTable] = useState(null)
  const [tableForm, setTableForm] = useState({
    number: "",
    name: "",
    capacity: 4,
    section: "Main Dining",
    status: "AVAILABLE",
  })
  const [isSavingTable, setIsSavingTable] = useState(false)

  const [qrModalTable, setQrModalTable] = useState(null)

  // Load Store
  const loadStoreData = useCallback(async () => {
    if (!token) return
    setIsStoreLoading(true)
    try {
      const res = await fetchMyStoreApi(token).catch(() => ({ data: null }))
      const storeData = res?.data
      if (storeData) {
        setStore(storeData)
        setStoreName(storeData.name || "")
        setStoreDescription(storeData.description || "")
        setOperatingHours(storeData.operatingHours || "")
        setColorScheme(storeData.colorScheme || "#f59e0b")
        setFontStyle(storeData.fontStyle || "DM Sans")
        setBrandingLogo(storeData.brandingLogo || "")
      } else {
        setStore(null)
      }
    } catch (err) {
      console.error("Failed to fetch store:", err)
      setStore(null)
    } finally {
      setIsStoreLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadStoreData()
  }, [loadStoreData])

  // Load Menu
  const loadMenuItems = useCallback(async () => {
    if (!token || !store?.id) return
    setIsMenuLoading(true)
    try {
      const res = await fetchMenuItemsApi(token, store.id).catch(() => ({ data: [] }))
      setMenuItems(Array.isArray(res?.data) ? res.data : [])
    } catch (err) {
      console.error("Failed to load menu items:", err)
      setMenuItems([])
    } finally {
      setIsMenuLoading(false)
    }
  }, [token, store?.id])

  useEffect(() => {
    if (store?.id && activeTab === "MENU") {
      loadMenuItems()
    }
  }, [store?.id, activeTab, loadMenuItems])

  // Load Tables
  const loadTables = useCallback(async () => {
    if (!token || !store?.id) return
    setIsTablesLoading(true)
    try {
      const res = await fetchStoreTablesApi(token, store.id).catch(() => ({ data: [] }))
      setTables(Array.isArray(res?.data) ? res.data : [])
    } catch (err) {
      console.error("Failed to load store tables:", err)
      setTables([])
    } finally {
      setIsTablesLoading(false)
    }
  }, [token, store?.id])

  useEffect(() => {
    if (store?.id && activeTab === "TABLES") {
      loadTables()
    }
  }, [store?.id, activeTab, loadTables])

  // Handlers (same as before)
  const handleStoreSubmit = async (e) => {
    e.preventDefault()
    if (!store?.id) return
    setStoreMsg({ text: "", error: false })
    setIsUpdatingStore(true)

    try {
      const res = await updateStoreApi(token, store.id, {
        name: storeName,
        slug: slug.trim().toLowerCase(),
        description: storeDescription,
        operatingHours,
        colorScheme,
        fontStyle,
        brandingLogo,
      })

      const updated = res?.data
      if (updated) {
        setStore(updated)
        setStoreName(updated.name || storeName)
        setSlug(updated.slug || slug)
        setStoreDescription(updated.description || storeDescription)
        setOperatingHours(updated.operatingHours || operatingHours)
        setColorScheme(updated.colorScheme || colorScheme)
        setFontStyle(updated.fontStyle || fontStyle)
        setBrandingLogo(updated.brandingLogo || brandingLogo)
      }

      setStoreMsg({ text: "Store establishment & custom URL slug updated successfully!", error: false })
    } catch (err) {
      setStoreMsg({
        text: err instanceof Error ? err.message : "Failed to update store.",
        error: true,
      })
    } finally {
      setIsUpdatingStore(false)
    }
  }

  const handleOpenMenuModal = (item = null) => {
    setEditingMenuItem(item)
    if (item) {
      setMenuForm({
        name: item.name || "",
        category: item.category || "Main Course",
        price: item.price || "",
        description: item.description || "",
        image: item.image || "",
        dietaryType: item.dietaryType || "VEG",
        spicinessLevel: item.spicinessLevel || 0,
        prepTime: item.prepTime || 15,
        calories: item.calories || 350,
        allergens: item.allergens || "",
        isAvailable: item.isAvailable !== false,
      })
    } else {
      setMenuForm({
        name: "",
        category: "Main Course",
        price: "",
        description: "",
        image: "",
        dietaryType: "VEG",
        spicinessLevel: 0,
        prepTime: 15,
        calories: 350,
        allergens: "",
        isAvailable: true,
      })
    }
    setIsMenuModalOpen(true)
  }

  const handleSaveMenuItem = async (e) => {
    e.preventDefault()
    if (!store?.id) return
    setIsSavingMenuItem(true)
    setMenuMsg({ text: "", error: false })

    try {
      const payload = {
        storeId: store.id,
        name: menuForm.name,
        category: menuForm.category,
        price: parseFloat(menuForm.price),
        description: menuForm.description,
        image: menuForm.image,
        dietaryType: menuForm.dietaryType,
        spicinessLevel: parseInt(menuForm.spicinessLevel, 10),
        prepTime: parseInt(menuForm.prepTime, 10),
        calories: parseInt(menuForm.calories, 10),
        allergens: menuForm.allergens,
        isAvailable: menuForm.isAvailable,
      }

      if (editingMenuItem) {
        await updateMenuItemApi(token, editingMenuItem.id, payload)
        setMenuMsg({ text: `Menu item "${menuForm.name}" updated!`, error: false })
      } else {
        await createMenuItemApi(token, payload)
        setMenuMsg({ text: `Menu item "${menuForm.name}" added!`, error: false })
      }

      setIsMenuModalOpen(false)
      loadMenuItems()
    } catch (err) {
      setMenuMsg({
        text: err instanceof Error ? err.message : "Failed to save menu item.",
        error: true,
      })
    } finally {
      setIsSavingMenuItem(false)
    }
  }

  const handleToggleMenuAvailability = async (item) => {
    try {
      await updateMenuItemApi(token, item.id, { isAvailable: !item.isAvailable })
      setMenuItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isAvailable: !item.isAvailable } : i))
      )
    } catch (_err) {
      setMenuMsg({ text: "Failed to toggle availability.", error: true })
    }
  }

  const handleDeleteMenuItem = async (id, name) => {
    if (!confirm(`Delete "${name}" from menu?`)) return
    try {
      await deleteMenuItemApi(token, id)
      setMenuMsg({ text: `Menu item "${name}" deleted.`, error: false })
      loadMenuItems()
    } catch (_err) {
      setMenuMsg({ text: "Failed to delete menu item.", error: true })
    }
  }

  const handleOpenTableModal = (table = null) => {
    setEditingTable(table)
    if (table) {
      setTableForm({
        number: table.number || "",
        name: table.name || "",
        capacity: table.capacity || 4,
        section: table.section || "Main Dining",
        status: table.status || "AVAILABLE",
      })
    } else {
      setTableForm({ number: "", name: "", capacity: 4, section: "Main Dining", status: "AVAILABLE" })
    }
    setIsTableModalOpen(true)
  }

  const handleSaveTable = async (e) => {
    e.preventDefault()
    if (!store?.id) return
    setIsSavingTable(true)
    setTableMsg({ text: "", error: false })

    try {
      const payload = {
        storeId: store.id,
        number: tableForm.number,
        name: tableForm.name || `Table ${tableForm.number}`,
        capacity: parseInt(tableForm.capacity, 10),
        section: tableForm.section,
        status: tableForm.status,
      }

      if (editingTable) {
        await updateTableApi(token, editingTable.id, payload)
        setTableMsg({ text: `Table "${tableForm.number}" updated!`, error: false })
      } else {
        await createTableApi(token, payload)
        setTableMsg({ text: `Table "${tableForm.number}" added!`, error: false })
      }

      setIsTableModalOpen(false)
      loadTables()
    } catch (err) {
      setTableMsg({
        text: err instanceof Error ? err.message : "Failed to save table.",
        error: true,
      })
    } finally {
      setIsSavingTable(false)
    }
  }

  const handleDeleteTable = async (id, number) => {
    if (!confirm(`Delete Table ${number}?`)) return
    try {
      await deleteTableApi(token, id)
      setTableMsg({ text: `Table ${number} deleted.`, error: false })
      loadTables()
    } catch (_err) {
      setTableMsg({ text: "Failed to delete table.", error: true })
    }
  }

  const getTableQrUrl = (tableNumber) => {
    const customerAppUrl = import.meta.env.VITE_CUSTOMER_APP_URL || "http://localhost:5175"
    return `${customerAppUrl.replace(/\/$/, "")}/store/${store?.id}?table=${encodeURIComponent(tableNumber)}`
  }

  // Download QR Code as Image
  const handleDownloadQR = async () => {
    if (!qrModalTable) return

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(
      getTableQrUrl(qrModalTable.number)
    )}`

    try {
      const response = await fetch(qrUrl)
      if (!response.ok) throw new Error("Fetch failed")
      const blob = await response.blob()

      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `table-${qrModalTable.number}-qr-code.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (_err) {
      // Fallback: load image into canvas and download
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        const canvas = document.createElement("canvas")
        canvas.width = img.width || 600
        canvas.height = img.height || 600
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.fillStyle = "#ffffff"
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0)
          const dataUrl = canvas.toDataURL("image/png")
          const link = document.createElement("a")
          link.href = dataUrl
          link.download = `table-${qrModalTable.number}-qr-code.png`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }
      }
      img.src = qrUrl
    }
  }

  const menuCategories = Array.from(new Set(menuItems.map((i) => i.category || "Uncategorized")))
  const filteredMenuItems = menuItems.filter((item) => {
    const matchesCategory = selectedCategory === "ALL" || item.category === selectedCategory
    const matchesSearch =
      !menuSearch ||
      item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(menuSearch.toLowerCase()))
    return matchesCategory && matchesSearch
  })

  const tableSections = Array.from(new Set(tables.map((t) => t.section || "Main Dining")))
  const filteredTables = tables.filter((table) => selectedSection === "ALL" || table.section === selectedSection)

  // Loading skeleton
  if (isStoreLoading) {
    return (
      <div className="space-y-8 w-full">
        <div className="border-b border-zinc-800 pb-6">
          <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-zinc-800/50 rounded animate-pulse" />
        </div>
        <div className="h-10 w-full bg-zinc-800/50 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
              <div className="h-4 w-20 bg-zinc-800 rounded animate-pulse" />
              <div className="h-8 w-32 bg-zinc-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // No store state
  if (!store) {
    return (
      <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-lg mx-auto my-12">
        <CardContent className="py-10 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto">
            <Building2 className="h-8 w-8 text-zinc-500" />
          </div>
          <h2 className="text-lg font-semibold text-white">No Store Linked</h2>
          <p className="text-sm text-zinc-500 max-w-sm mx-auto">
            Contact your administrator to link a store to your account.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">Store Setup</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 text-xs font-medium">
              <Store className="w-3.5 h-3.5" />
              {store.name}
            </span>
          </div>
          <p className="text-sm text-zinc-500">
            Configure branding, manage menu, and assign table QR codes
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex p-1 bg-zinc-900 border border-zinc-800 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => handleTabChange("SETTINGS")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === "SETTINGS" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
          >
            <SlidersHorizontal className="h-4 w-4" /> Settings
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("MENU")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === "MENU" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
          >
            <BookOpen className="h-4 w-4" /> Menu ({menuItems.length})
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("TABLES")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === "TABLES" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
          >
            <QrCode className="h-4 w-4" /> Tables ({tables.length})
          </button>
        </div>
      </div>

      {/* TAB 1: SETTINGS */}
      {activeTab === "SETTINGS" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
          <form onSubmit={handleStoreSubmit} className="space-y-8">
            {/* Store Details */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-zinc-300" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Store Details</h2>
                  <p className="text-sm text-zinc-500">Basic information about your establishment</p>
                </div>
              </div>

              <div className="space-y-5 pl-13">
                {storeMsg.text && (
                  <div
                    className={`flex items-center gap-2 text-sm rounded-lg px-4 py-3 border ${storeMsg.error
                        ? "bg-red-500/10 border-red-500/20 text-red-400"
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      }`}
                  >
                    {storeMsg.error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    {storeMsg.text}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="group relative">
                    <Label htmlFor="storeName" className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                      Store Name *
                    </Label>
                    <Input
                      id="storeName"
                      type="text"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-base px-0 py-3 focus:border-zinc-400 transition-colors"
                      required
                    />
                  </div>

                  <div className="group relative">
                    <Label htmlFor="storeSlug" className="text-xs uppercase tracking-wider text-amber-400 font-medium mb-2 block">
                      Digital Menu URL Slug *
                    </Label>
                    <Input
                      id="storeSlug"
                      type="text"
                      placeholder="e.g. royal-punjab-dhaba"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                      className="bg-transparent border-0 border-b-2 border-amber-500/50 rounded-none text-amber-300 font-mono text-base px-0 py-3 focus:border-amber-400 transition-colors placeholder:text-zinc-600"
                    />
                  </div>
                </div>

                {/* Digital Menu Direct Link Box */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Public Digital Menu Direct Link</span>
                    <p className="text-xs text-zinc-300 font-mono">
                      {(import.meta.env.VITE_MENU_APP_URL || "http://localhost:5174").replace(/\/$/, "")}/{slug || store?.slug || store?.id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const url = `${(import.meta.env.VITE_MENU_APP_URL || "http://localhost:5174").replace(/\/$/, "")}/${slug || store?.slug || store?.id}`
                        navigator.clipboard.writeText(url)
                        setCopiedMenuLink(true)
                        setTimeout(() => setCopiedMenuLink(false), 2000)
                      }}
                      className="text-xs gap-1.5 border-zinc-700 text-zinc-300"
                    >
                      {copiedMenuLink ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedMenuLink ? "Copied!" : "Copy Link"}</span>
                    </Button>
                    <a
                      href={`${(import.meta.env.VITE_MENU_APP_URL || "http://localhost:5174").replace(/\/$/, "")}/${slug || store?.slug || store?.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button type="button" size="sm" className="text-xs gap-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold">
                        <ExternalLink className="h-3.5 w-3.5" /> Open Menu
                      </Button>
                    </a>
                  </div>
                </div>

                <div className="group relative">
                  <Label htmlFor="operatingHours" className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                    <Clock className="h-4 w-4 inline mr-1.5" /> Operating Hours
                  </Label>
                  <Input
                    id="operatingHours"
                    type="text"
                    placeholder="Mon-Sun: 10:00 AM - 11:00 PM"
                    value={operatingHours}
                    onChange={(e) => setOperatingHours(e.target.value)}
                    className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-base px-0 py-3 focus:border-zinc-400 transition-colors placeholder:text-zinc-600"
                  />
                </div>

                <div className="group relative">
                  <Label htmlFor="storeDescription" className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                    Description
                  </Label>
                  <Input
                    id="storeDescription"
                    type="text"
                    placeholder="Authentic Wood-fired Pizza & Italian Bistro"
                    value={storeDescription}
                    onChange={(e) => setStoreDescription(e.target.value)}
                    className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-base px-0 py-3 focus:border-zinc-400 transition-colors placeholder:text-zinc-600"
                  />
                </div>
              </div>
            </div>

            {/* Branding */}
            <div className="space-y-6 pt-8 border-t border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <Palette className="h-5 w-5 text-zinc-300" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Branding & Theme</h2>
                  <p className="text-sm text-zinc-500">Customize your menu appearance</p>
                </div>
              </div>

              <div className="space-y-5 pl-13">
                <div className="group relative">
                  <Label htmlFor="brandingLogo" className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                    <ImageIcon className="h-4 w-4 inline mr-1.5" /> Logo URL
                  </Label>
                  <Input
                    id="brandingLogo"
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={brandingLogo}
                    onChange={(e) => setBrandingLogo(e.target.value)}
                    className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-base px-0 py-3 focus:border-zinc-400 transition-colors placeholder:text-zinc-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="group relative">
                    <Label htmlFor="fontStyle" className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                      <Type className="h-4 w-4 inline mr-1.5" /> Font Style
                    </Label>
                    <select
                      id="fontStyle"
                      value={fontStyle}
                      onChange={(e) => setFontStyle(e.target.value)}
                      className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-base text-white py-3 focus:outline-none focus:border-zinc-400 transition-colors cursor-pointer"
                    >
                      {fontOptions.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-zinc-900">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="group relative">
                    <Label htmlFor="colorScheme" className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                      <Palette className="h-4 w-4 inline mr-1.5" /> Accent Color
                    </Label>
                    <div className="flex items-center gap-3 py-2">
                      <input
                        type="color"
                        value={colorScheme}
                        onChange={(e) => setColorScheme(e.target.value)}
                        className="h-10 w-16 bg-zinc-950 border border-zinc-800 rounded cursor-pointer p-1"
                      />
                      <Input
                        id="colorScheme"
                        type="text"
                        value={colorScheme}
                        onChange={(e) => setColorScheme(e.target.value)}
                        className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-sm px-0 py-3 focus:border-zinc-400 transition-colors font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    type="submit"
                    disabled={isUpdatingStore || !isOwner}
                    className="bg-white hover:bg-zinc-200 text-zinc-900 font-medium gap-2 text-sm px-6 py-2"
                  >
                    {isUpdatingStore ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Store className="h-4 w-4" /> Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </form>

          {/* Live Preview */}
          <div className="space-y-6 lg:sticky lg:top-6 h-fit">
            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 overflow-hidden">
              <div className="h-1" style={{ backgroundColor: colorScheme || "#f59e0b" }} />
              <CardHeader className="pb-4">
                <CardTitle className="text-sm text-zinc-400 font-medium">Menu Preview</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  {brandingLogo ? (
                    <img src={brandingLogo} alt="Logo" className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                      <Utensils className="h-6 w-6 text-zinc-500" />
                    </div>
                  )}
                  <div>
                    <p className="text-lg font-bold text-white" style={{ fontFamily: fontStyle }}>
                      {storeName || store.name}
                    </p>
                    <p className="text-sm text-zinc-500" style={{ fontFamily: fontStyle }}>
                      {storeDescription || "Digital QR Ordering Menu"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
                    <div>
                      <p className="text-sm font-medium text-white">Sample Dish</p>
                      <p className="text-xs text-zinc-500">Description here</p>
                    </div>
                    <span className="text-sm font-semibold text-white">₹299</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-800">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> {operatingHours || "Open All Day"}
                  </span>
                  <span className="font-mono">{fontStyle}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: MENU */}
      {activeTab === "MENU" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <Input
                  type="text"
                  placeholder="Search menu..."
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  className="pl-9 bg-zinc-900 border-zinc-800 text-white text-sm py-2.5 w-64"
                />
              </div>

              <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("ALL")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${selectedCategory === "ALL" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                >
                  All
                </button>
                {menuCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${selectedCategory === cat ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => handleOpenMenuModal()}
              className="bg-white hover:bg-zinc-200 text-zinc-900 font-medium gap-2 text-sm"
            >
              <Plus className="h-4 w-4" /> Add Item
            </Button>
          </div>

          {menuMsg.text && (
            <div
              className={`flex items-center gap-2 text-sm rounded-lg px-4 py-3 border ${menuMsg.error
                  ? "bg-red-500/10 border-red-500/20 text-red-400"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                }`}
            >
              {menuMsg.error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {menuMsg.text}
            </div>
          )}

          {isMenuLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-2">
              <LoaderCircle className="h-6 w-6 animate-spin" />
              <p className="text-sm">Loading menu...</p>
            </div>
          ) : filteredMenuItems.length === 0 ? (
            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <CardContent className="py-12 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto">
                  <BookOpen className="h-7 w-7 text-zinc-500" />
                </div>
                <h3 className="text-base font-semibold text-white">No Menu Items</h3>
                <p className="text-sm text-zinc-500">Add your first dish to get started</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMenuItems.map((item) => (
                <Card
                  key={item.id}
                  className={`bg-zinc-900 border text-zinc-100 overflow-hidden hover:border-zinc-600 transition-all ${item.isAvailable ? "border-zinc-800" : "border-zinc-800 opacity-60"
                    }`}
                >
                  <div className="p-4 flex gap-4">
                    <div className="w-20 h-20 rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden shrink-0 relative">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Utensils className="h-6 w-6 text-zinc-600" />
                        </div>
                      )}
                      <span className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${item.dietaryType === "VEG" ? "bg-emerald-950 text-emerald-400 border border-emerald-800" :
                          item.dietaryType === "NON_VEG" ? "bg-red-950 text-red-400 border border-red-800" :
                            "bg-amber-950 text-amber-400 border border-amber-800"
                        }`}>
                        {item.dietaryType}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold text-white truncate">{item.name}</h4>
                        <div className="flex items-center gap-0.5">
                          <IndianRupee className="h-3.5 w-3.5 text-zinc-500" />
                          <span className="text-sm font-bold text-white">{item.price}</span>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-500 line-clamp-2">{item.description || "No description"}</p>
                      <span className="inline-block text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">{item.category}</span>
                    </div>
                  </div>

                  <div className="bg-zinc-950/60 px-4 py-2.5 border-t border-zinc-800 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleToggleMenuAvailability(item)}
                      className={`text-xs font-medium flex items-center gap-1.5 ${item.isAvailable ? "text-emerald-400" : "text-zinc-500"
                        }`}
                    >
                      {item.isAvailable ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {item.isAvailable ? "Available" : "Hidden"}
                    </button>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenMenuModal(item)}
                        className="text-zinc-400 hover:text-white hover:bg-zinc-800 p-1 h-7 w-7"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMenuItem(item.id, item.name)}
                        className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 p-1 h-7 w-7"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TABLES */}
      {activeTab === "TABLES" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setSelectedSection("ALL")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${selectedSection === "ALL" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
                  }`}
              >
                All Sections
              </button>
              {tableSections.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setSelectedSection(sec)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${selectedSection === sec ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                >
                  {sec}
                </button>
              ))}
            </div>

            <Button
              onClick={() => handleOpenTableModal()}
              className="bg-white hover:bg-zinc-200 text-zinc-900 font-medium gap-2 text-sm"
            >
              <Plus className="h-4 w-4" /> Add Table
            </Button>
          </div>

          {tableMsg.text && (
            <div
              className={`flex items-center gap-2 text-sm rounded-lg px-4 py-3 border ${tableMsg.error
                  ? "bg-red-500/10 border-red-500/20 text-red-400"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                }`}
            >
              {tableMsg.error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {tableMsg.text}
            </div>
          )}

          {isTablesLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-2">
              <LoaderCircle className="h-6 w-6 animate-spin" />
              <p className="text-sm">Loading tables...</p>
            </div>
          ) : filteredTables.length === 0 ? (
            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <CardContent className="py-12 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto">
                  <QrCode className="h-7 w-7 text-zinc-500" />
                </div>
                <h3 className="text-base font-semibold text-white">No Tables</h3>
                <p className="text-sm text-zinc-500">Add tables to generate QR codes</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredTables.map((tbl) => (
                <Card key={tbl.id} className="bg-zinc-900 border-zinc-800 text-zinc-100 hover:border-zinc-700 transition-all">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center text-white font-bold font-mono text-lg">
                          {tbl.number}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-white">{tbl.name || `Table ${tbl.number}`}</h4>
                          <span className="text-xs text-zinc-500">{tbl.section || "Main Dining"}</span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tbl.status === "AVAILABLE" ? "bg-emerald-500/10 text-emerald-400" :
                          tbl.status === "OCCUPIED" ? "bg-amber-500/10 text-amber-400" :
                            "bg-zinc-800 text-zinc-400"
                        }`}>
                        {tbl.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-sm text-zinc-400">
                      <Users className="h-4 w-4 text-zinc-600" />
                      {tbl.capacity} seats
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                      <Button
                        size="sm"
                        onClick={() => setQrModalTable(tbl)}
                        className="flex-1 bg-white hover:bg-zinc-200 text-zinc-900 text-sm font-medium gap-1.5"
                      >
                        <QrCode className="h-3.5 w-3.5" /> QR
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenTableModal(tbl)}
                        className="text-zinc-400 hover:text-white hover:bg-zinc-800 p-1 h-8 w-8"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTable(tbl.id, tbl.number)}
                        className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 p-1 h-8 w-8"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODALS - kept same but with zinc/white theme */}
      {isMenuModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-6 relative text-zinc-100">
            <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-transparent via-zinc-400 to-transparent" />
            <button
              type="button"
              onClick={() => setIsMenuModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h3 className="text-lg font-semibold text-white">
                {editingMenuItem ? "Edit Menu Item" : "Add Menu Item"}
              </h3>
              <p className="text-sm text-zinc-500">Configure item details</p>
            </div>

            <form onSubmit={handleSaveMenuItem} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm text-zinc-400">Item Name *</Label>
                  <Input
                    type="text"
                    value={menuForm.name}
                    onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                    className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-base px-0 py-2.5 focus:border-zinc-400 transition-colors"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-zinc-400">Price (₹) *</Label>
                  <Input
                    type="number"
                    value={menuForm.price}
                    onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })}
                    className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-base px-0 py-2.5 focus:border-zinc-400 transition-colors font-mono"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm text-zinc-400">Category</Label>
                <Input
                  type="text"
                  value={menuForm.category}
                  onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}
                  className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-base px-0 py-2.5 focus:border-zinc-400 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm text-zinc-400">Description</Label>
                <Input
                  type="text"
                  value={menuForm.description}
                  onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                  className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-base px-0 py-2.5 focus:border-zinc-400 transition-colors"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsMenuModalOpen(false)} className="text-zinc-400 hover:text-white text-sm">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSavingMenuItem} className="bg-white hover:bg-zinc-200 text-zinc-900 font-medium text-sm">
                  {isSavingMenuItem ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isTableModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-6 relative text-zinc-100">
            <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-transparent via-zinc-400 to-transparent" />
            <button
              type="button"
              onClick={() => setIsTableModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h3 className="text-lg font-semibold text-white">
                {editingTable ? "Edit Table" : "Add Table"}
              </h3>
              <p className="text-sm text-zinc-500">Set table details</p>
            </div>

            <form onSubmit={handleSaveTable} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm text-zinc-400">Table Number *</Label>
                  <Input
                    type="text"
                    value={tableForm.number}
                    onChange={(e) => setTableForm({ ...tableForm, number: e.target.value })}
                    className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-base px-0 py-2.5 focus:border-zinc-400 transition-colors font-mono"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-zinc-400">Capacity *</Label>
                  <Input
                    type="number"
                    value={tableForm.capacity}
                    onChange={(e) => setTableForm({ ...tableForm, capacity: e.target.value })}
                    className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-base px-0 py-2.5 focus:border-zinc-400 transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm text-zinc-400">Table Name</Label>
                <Input
                  type="text"
                  value={tableForm.name}
                  onChange={(e) => setTableForm({ ...tableForm, name: e.target.value })}
                  className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-base px-0 py-2.5 focus:border-zinc-400 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm text-zinc-400">Section</Label>
                <Input
                  type="text"
                  value={tableForm.section}
                  onChange={(e) => setTableForm({ ...tableForm, section: e.target.value })}
                  className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-base px-0 py-2.5 focus:border-zinc-400 transition-colors"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsTableModalOpen(false)} className="text-zinc-400 hover:text-white text-sm">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSavingTable} className="bg-white hover:bg-zinc-200 text-zinc-900 font-medium text-sm">
                  {isSavingTable ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {qrModalTable && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 space-y-6 relative text-zinc-100 text-center">
            <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-transparent via-zinc-400 to-transparent" />
            <button
              type="button"
              onClick={() => setQrModalTable(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h3 className="text-lg font-semibold text-white">Table {qrModalTable.number}</h3>
              <p className="text-sm text-zinc-500">{qrModalTable.name || `Table ${qrModalTable.number}`}</p>
            </div>

            {/* QR Code - with ref for download */}
            <div
              ref={qrCodeRef}
              className="bg-white p-4 rounded-lg inline-block mx-auto cursor-pointer hover:opacity-90 transition-opacity"
              onClick={handleDownloadQR}
              title="Click to download QR code"
            >
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                  getTableQrUrl(qrModalTable.number)
                )}`}
                alt={`Table ${qrModalTable.number} QR`}
                className="w-44 h-44 block mx-auto"
                crossOrigin="anonymous"
              />
            </div>

            {/* Hint */}
            <p className="text-xs text-zinc-600 -mt-2">Click QR code to download as PNG</p>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(getTableQrUrl(qrModalTable.number))
                  alert("QR URL copied!")
                }}
                className="flex-1 text-zinc-400 hover:text-white hover:bg-zinc-800 text-sm gap-1.5"
              >
                <Copy className="h-4 w-4" /> Copy Link
              </Button>
              <Button
                onClick={handleDownloadQR}
                className="flex-1 bg-white hover:bg-zinc-200 text-zinc-900 font-medium text-sm gap-1.5"
              >
                <Download className="h-4 w-4" /> Download QR
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}