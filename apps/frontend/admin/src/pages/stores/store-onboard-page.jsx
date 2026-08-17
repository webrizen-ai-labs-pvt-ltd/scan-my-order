import React, { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Label,
  Switch,
} from "@repo/ui"
import { ArrowLeft, Store, User, CheckCircle2, AlertCircle, LoaderCircle, Palette, Building2, Clock, Type, Image as ImageIcon } from "lucide-react"
import { useAuth } from "../../context/auth-context.jsx"
import { fetchUsersApi, onboardStoreApi } from "../../services/admin-api.js"

export default function StoreOnboardPage() {
  const navigate = useNavigate()
  const { token } = useAuth()

  // Store Details
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [brandingLogo, setBrandingLogo] = useState("")
  const [colorScheme, setColorScheme] = useState("dark")
  const [fontStyle, setFontStyle] = useState("DM Sans")
  const [operatingHours, setOperatingHours] = useState("10:00 AM - 10:00 PM")

  // Owner Options
  const [isNewOwner, setIsNewOwner] = useState(true)
  const [existingOwnerId, setExistingOwnerId] = useState("")
  const [ownerName, setOwnerName] = useState("")
  const [ownerEmail, setOwnerEmail] = useState("")
  const [ownerPassword, setOwnerPassword] = useState("")

  // Available Owners List
  const [ownersList, setOwnersList] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [msg, setMsg] = useState({ text: "", error: false })

  // Theme configurations
  const themeConfigs = {
    dark: {
      label: "Dark Zinc",
      bg: "bg-zinc-900",
      surface: "bg-zinc-800",
      text: "text-white",
      muted: "text-zinc-400",
      border: "border-zinc-700",
      accent: "bg-zinc-200 text-zinc-900",
      accentHover: "hover:bg-zinc-100",
      previewBg: "bg-gradient-to-br from-zinc-900 to-zinc-950",
    },
    amber: {
      label: "Amber Gold",
      bg: "bg-amber-950",
      surface: "bg-amber-900/50",
      text: "text-amber-50",
      muted: "text-amber-300/70",
      border: "border-amber-700/50",
      accent: "bg-amber-500 text-amber-950",
      accentHover: "hover:bg-amber-400",
      previewBg: "bg-gradient-to-br from-amber-950 to-amber-900",
    },
    emerald: {
      label: "Emerald Green",
      bg: "bg-emerald-950",
      surface: "bg-emerald-900/50",
      text: "text-emerald-50",
      muted: "text-emerald-300/70",
      border: "border-emerald-700/50",
      accent: "bg-emerald-500 text-emerald-950",
      accentHover: "hover:bg-emerald-400",
      previewBg: "bg-gradient-to-br from-emerald-950 to-emerald-900",
    },
    light: {
      label: "Clean White",
      bg: "bg-white",
      surface: "bg-zinc-50",
      text: "text-zinc-900",
      muted: "text-zinc-500",
      border: "border-zinc-200",
      accent: "bg-zinc-900 text-white",
      accentHover: "hover:bg-zinc-800",
      previewBg: "bg-gradient-to-br from-white to-zinc-100",
    },
  }

  const fontConfigs = {
    "DM Sans": { family: "'DM Sans', sans-serif", label: "DM Sans" },
    "Inter": { family: "'Inter', sans-serif", label: "Inter" },
    "Outfit": { family: "'Outfit', sans-serif", label: "Outfit" },
    "Roboto": { family: "'Roboto', sans-serif", label: "Roboto" },
  }

  useEffect(() => {
    async function loadOwners() {
      if (!token) return
      try {
        const res = await fetchUsersApi(token, { role: "OWNER", limit: 50 })
        if (res?.data) {
          setOwnersList(res.data)
        }
      } catch (err) {
        console.error("Failed to load owners:", err)
      }
    }
    loadOwners()
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMsg({ text: "", error: false })
    setIsSubmitting(true)

    const payload = {
      name,
      ...(slug ? { slug: slug.trim().toLowerCase() } : {}),
      description,
      brandingLogo,
      colorScheme,
      fontStyle,
      operatingHours,
      ...(isNewOwner
        ? {
            newOwner: {
              name: ownerName,
              email: ownerEmail,
              password: ownerPassword,
            },
          }
        : { ownerId: existingOwnerId }),
    }

    try {
      await onboardStoreApi(token, payload)
      setMsg({ text: "Restaurant store onboarded successfully!", error: false })
      setTimeout(() => navigate("/dashboard/stores"), 1000)
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Failed to onboard store.", error: true })
    } finally {
      setIsSubmitting(false)
    }
  }

  const currentTheme = themeConfigs[colorScheme]
  const currentFont = fontConfigs[fontStyle]

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-4">
          <Link to="/dashboard/stores">
            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-zinc-800 gap-1.5 text-xs">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Onboard New Store</h1>
            <p className="text-xs text-zinc-500">Set up your restaurant establishment</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-zinc-500">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          Step 1 of 3
        </div>
      </div>

      {msg.text && (
        <div
          className={`flex items-center gap-2 text-xs rounded-lg px-4 py-3 border ${
            msg.error
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}
        >
          {msg.error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
        {/* Main Form - Left Side */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Store Details - Minimal style */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-zinc-300" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Establishment</h2>
                <p className="text-xs text-zinc-500">Basic information about your store</p>
              </div>
            </div>

            <div className="space-y-4 pl-11">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="group relative">
                  <Label htmlFor="storeName" className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5 block">
                    Store Name *
                  </Label>
                  <Input
                    id="storeName"
                    type="text"
                    placeholder="Bella Italia Bistro"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-transparent border-0 border-b border-zinc-800 rounded-none text-white text-sm px-0 py-2 focus:border-zinc-400 transition-colors placeholder:text-zinc-600"
                    required
                  />
                </div>

                <div className="group relative">
                  <Label htmlFor="storeSlug" className="text-[10px] uppercase tracking-wider text-amber-400 font-medium mb-1.5 block">
                    Custom Store Slug (Optional)
                  </Label>
                  <Input
                    id="storeSlug"
                    type="text"
                    placeholder="e.g. bella-italia-bistro"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    className="bg-transparent border-0 border-b border-amber-500/50 rounded-none text-amber-300 font-mono text-sm px-0 py-2 focus:border-amber-400 transition-colors placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="group relative">
                  <Label htmlFor="operatingHours" className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5 block">
                    Operating Hours
                  </Label>
                  <div className="relative">
                    <Clock className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
                    <Input
                      id="operatingHours"
                      type="text"
                      placeholder="10:00 AM - 11:00 PM"
                      value={operatingHours}
                      onChange={(e) => setOperatingHours(e.target.value)}
                      className="bg-transparent border-0 border-b border-zinc-800 rounded-none text-white text-sm pl-6 pr-0 py-2 focus:border-zinc-400 transition-colors placeholder:text-zinc-600"
                    />
                  </div>
                </div>

                <div className="group relative">
                  <Label htmlFor="brandingLogo" className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5 block">
                    Logo URL
                  </Label>
                  <div className="relative">
                    <ImageIcon className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
                    <Input
                      id="brandingLogo"
                      type="url"
                      placeholder="https://..."
                      value={brandingLogo}
                      onChange={(e) => setBrandingLogo(e.target.value)}
                      className="bg-transparent border-0 border-b border-zinc-800 rounded-none text-white text-sm pl-6 pr-0 py-2 focus:border-zinc-400 transition-colors placeholder:text-zinc-600"
                    />
                  </div>
                </div>
              </div>

              <div className="group relative">
                <Label htmlFor="description" className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5 block">
                  Description
                </Label>
                <Input
                  id="description"
                  type="text"
                  placeholder="Authentic Italian Wood-fired Pizza & QR Dining"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-transparent border-0 border-b border-zinc-800 rounded-none text-white text-sm px-0 py-2 focus:border-zinc-400 transition-colors placeholder:text-zinc-600"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Owner - Minimal style */}
          <div className="space-y-6 pt-8 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <User className="h-4 w-4 text-zinc-300" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Owner Assignment</h2>
                  <p className="text-xs text-zinc-500">Choose who manages this store</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">{isNewOwner ? 'New Owner' : 'Existing'}</span>
                <Switch checked={isNewOwner} onCheckedChange={setIsNewOwner} />
              </div>
            </div>

            <div className="space-y-4 pl-11">
              {isNewOwner ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="group relative">
                      <Label htmlFor="ownerName" className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5 block">
                        Full Name
                      </Label>
                      <Input
                        id="ownerName"
                        type="text"
                        placeholder="Marco Rossi"
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        className="bg-transparent border-0 border-b border-zinc-800 rounded-none text-white text-sm px-0 py-2 focus:border-zinc-400 transition-colors placeholder:text-zinc-600"
                        required={isNewOwner}
                      />
                    </div>

                    <div className="group relative">
                      <Label htmlFor="ownerEmail" className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5 block">
                        Email Address
                      </Label>
                      <Input
                        id="ownerEmail"
                        type="email"
                        placeholder="marco@bellaitalia.com"
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                        className="bg-transparent border-0 border-b border-zinc-800 rounded-none text-white text-sm px-0 py-2 focus:border-zinc-400 transition-colors placeholder:text-zinc-600"
                        required={isNewOwner}
                      />
                    </div>
                  </div>

                  <div className="group relative">
                    <Label htmlFor="ownerPassword" className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5 block">
                      Initial Password
                    </Label>
                    <Input
                      id="ownerPassword"
                      type="password"
                      placeholder="••••••••"
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      className="bg-transparent border-0 border-b border-zinc-800 rounded-none text-white text-sm px-0 py-2 focus:border-zinc-400 transition-colors placeholder:text-zinc-600"
                      minLength={6}
                      required={isNewOwner}
                    />
                  </div>
                </>
              ) : (
                <div className="group relative">
                  <Label htmlFor="existingOwnerId" className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5 block">
                    Select Owner
                  </Label>
                  <select
                    id="existingOwnerId"
                    value={existingOwnerId}
                    onChange={(e) => setExistingOwnerId(e.target.value)}
                    className="w-full bg-transparent border-0 border-b border-zinc-800 text-sm text-white py-2 focus:outline-none focus:border-zinc-400 transition-colors cursor-pointer"
                    required={!isNewOwner}
                  >
                    <option value="" className="bg-zinc-900">Choose an owner...</option>
                    {ownersList.map((o) => (
                      <option key={o.id} value={o.id} className="bg-zinc-900">
                        {o.name} ({o.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Theme - Minimal style */}
          <div className="space-y-6 pt-8 border-t border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                <Palette className="h-4 w-4 text-zinc-300" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Theme Configuration</h2>
                <p className="text-xs text-zinc-500">Customize the digital menu appearance</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 pl-11">
              <div className="group relative">
                <Label htmlFor="colorScheme" className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5 block">
                  Color Scheme
                </Label>
                <select
                  id="colorScheme"
                  value={colorScheme}
                  onChange={(e) => setColorScheme(e.target.value)}
                  className="w-full bg-transparent border-0 border-b border-zinc-800 text-sm text-white py-2 focus:outline-none focus:border-zinc-400 transition-colors cursor-pointer"
                >
                  <option value="dark" className="bg-zinc-900">Dark Zinc</option>
                  <option value="amber" className="bg-zinc-900">Amber Gold</option>
                  <option value="emerald" className="bg-zinc-900">Emerald Green</option>
                  <option value="light" className="bg-zinc-900">Clean White</option>
                </select>
              </div>

              <div className="group relative">
                <Label htmlFor="fontStyle" className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5 block">
                  Font Style
                </Label>
                <select
                  id="fontStyle"
                  value={fontStyle}
                  onChange={(e) => setFontStyle(e.target.value)}
                  className="w-full bg-transparent border-0 border-b border-zinc-800 text-sm text-white py-2 focus:outline-none focus:border-zinc-400 transition-colors cursor-pointer"
                >
                  <option value="DM Sans" className="bg-zinc-900">DM Sans</option>
                  <option value="Inter" className="bg-zinc-900">Inter</option>
                  <option value="Outfit" className="bg-zinc-900">Outfit</option>
                  <option value="Roboto" className="bg-zinc-900">Roboto</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-8 border-t border-zinc-800">
            <Link to="/dashboard/stores">
              <Button type="button" variant="ghost" className="text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting} className="bg-white hover:bg-zinc-200 text-zinc-900 font-medium gap-2 text-xs">
              {isSubmitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Creating...
                </>
              ) : (
                <>
                  <Store className="h-4 w-4" /> Create Store
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Right Sidebar - Live Preview with Theme */}
        <div className="space-y-6 lg:sticky lg:top-6 h-fit">
          {/* Digital Menu Preview */}
          <Card className={`${currentTheme.bg} ${currentTheme.border} ${currentTheme.text} overflow-hidden transition-all duration-300`}>
            <CardHeader className="pb-4 border-b border-opacity-10 border-current">
              <CardTitle className={`text-sm font-medium ${currentTheme.muted}`}>Digital Menu Preview</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-5" style={{ fontFamily: currentFont.family }}>
                {/* Restaurant Header */}
                <div className="flex items-center gap-3">
                  {brandingLogo ? (
                    <img src={brandingLogo} alt="Logo" className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className={`w-12 h-12 rounded-lg ${currentTheme.surface} ${currentTheme.border} border flex items-center justify-center`}>
                      <Store className={`h-5 w-5 ${currentTheme.muted}`} />
                    </div>
                  )}
                  <div>
                    <p className={`text-lg font-bold ${currentTheme.text}`}>{name || "Your Restaurant"}</p>
                    <p className={`text-xs ${currentTheme.muted}`}>{description || "Your tagline here"}</p>
                  </div>
                </div>

                {/* Menu Items Preview */}
                <div className="space-y-2">
                  <div className={`flex items-center justify-between p-3 rounded-lg ${currentTheme.surface} ${currentTheme.border} border`}>
                    <div>
                      <p className={`text-sm font-medium ${currentTheme.text}`}>Margherita Pizza</p>
                      <p className={`text-xs ${currentTheme.muted}`}>Tomato, mozzarella, basil</p>
                    </div>
                    <span className={`text-sm font-semibold ${currentTheme.text}`}>$14.99</span>
                  </div>
                  <div className={`flex items-center justify-between p-3 rounded-lg ${currentTheme.surface} ${currentTheme.border} border`}>
                    <div>
                      <p className={`text-sm font-medium ${currentTheme.text}`}>Pasta Carbonara</p>
                      <p className={`text-xs ${currentTheme.muted}`}>Egg, pancetta, pecorino</p>
                    </div>
                    <span className={`text-sm font-semibold ${currentTheme.text}`}>$16.99</span>
                  </div>
                  <div className={`flex items-center justify-between p-3 rounded-lg ${currentTheme.surface} ${currentTheme.border} border`}>
                    <div>
                      <p className={`text-sm font-medium ${currentTheme.text}`}>Tiramisu</p>
                      <p className={`text-xs ${currentTheme.muted}`}>Classic Italian dessert</p>
                    </div>
                    <span className={`text-sm font-semibold ${currentTheme.text}`}>$8.99</span>
                  </div>
                </div>

                {/* QR Code Placeholder */}
                <div className={`flex items-center justify-center p-4 rounded-lg ${currentTheme.surface} ${currentTheme.border} border`}>
                  <div className="text-center">
                    <div className={`w-16 h-16 mx-auto mb-2 rounded-lg ${currentTheme.accent} opacity-90`} />
                    <p className={`text-[10px] ${currentTheme.muted}`}>Scan to view menu</p>
                  </div>
                </div>

                {/* Operating Hours */}
                <div className={`flex items-center justify-center gap-2 text-xs ${currentTheme.muted}`}>
                  <Clock className="h-3 w-3" />
                  {operatingHours}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Theme Info */}
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500">Active Theme</p>
                  <p className="text-sm font-medium text-white">
                    {currentTheme.label} / {currentFont.label}
                  </p>
                </div>
                <Palette className={`h-5 w-5 ${currentTheme.muted}`} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}