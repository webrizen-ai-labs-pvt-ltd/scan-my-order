import React, { useState } from "react"
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
  Switch,
} from "@repo/ui"
import {
  ArrowLeft,
  UtensilsCrossed,
  Plus,
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Flame,
  Clock,
  Zap,
  ShieldAlert,
  Leaf,
  Image as ImageIcon,
  IndianRupee,
  ChefHat,
} from "lucide-react"
import { useAuth } from "../../context/auth-context.jsx"
import { createMenuItemApi } from "../../services/admin-api.js"

export default function MenuItemCreatePage() {
  const { id: storeId } = useParams()
  const navigate = useNavigate()
  const { token } = useAuth()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [category, setCategory] = useState("Starters")
  const [image, setImage] = useState("")
  const [isAvailable, setIsAvailable] = useState(true)

  // Enterprise Food Properties
  const [dietaryType, setDietaryType] = useState("VEG")
  const [spicinessLevel, setSpicinessLevel] = useState("0")
  const [prepTime, setPrepTime] = useState("15")
  const [calories, setCalories] = useState("")
  const [allergens, setAllergens] = useState("")

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [msg, setMsg] = useState({ text: "", error: false })

  // Indian food categories
  const indianCategories = [
    "Starters",
    "Main Course",
    "Breads",
    "Rice & Biryani",
    "South Indian",
    "North Indian",
    "Chinese",
    "Tandoori",
    "Desserts",
    "Beverages",
    "Thali",
    "Street Food",
    "Snacks",
    "Breakfast",
    "Lunch",
    "Dinner",
  ]

  // Dietary type configs
  const dietaryConfigs = {
    VEG: { label: "Pure Veg", icon: "🟢", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
    NON_VEG: { label: "Non-Veg", icon: "🔴", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
    EGG: { label: "Egg", icon: "🟡", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
    VEGAN: { label: "Vegan", icon: "🌱", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMsg({ text: "", error: false })
    setIsSubmitting(true)

    try {
      await createMenuItemApi(token, storeId, {
        name,
        description,
        price: parseFloat(price),
        category,
        image,
        isAvailable,
        dietaryType,
        spicinessLevel: parseInt(spicinessLevel, 10),
        prepTime: prepTime ? parseInt(prepTime, 10) : null,
        calories: calories ? parseInt(calories, 10) : null,
        allergens,
      })
      setMsg({ text: "Menu item created successfully!", error: false })
      setTimeout(() => navigate(`/dashboard/stores/${storeId}/manage`), 1000)
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Failed to create menu item.", error: true })
    } finally {
      setIsSubmitting(false)
    }
  }

  const currentDietary = dietaryConfigs[dietaryType]

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-4">
          <Link to={`/dashboard/stores/${storeId}/manage`}>
            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-zinc-800 gap-1.5 text-xs">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Add Menu Item</h1>
            <p className="text-xs text-zinc-500">Configure your dish for digital menu display</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-zinc-500">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          New Item
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        {/* Main Form - Left Side */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Basic Details */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                <ChefHat className="h-4 w-4 text-zinc-300" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Basic Details</h2>
                <p className="text-xs text-zinc-500">Primary information about your dish</p>
              </div>
            </div>

            <div className="space-y-4 pl-11">
              <div className="group relative">
                <Label htmlFor="name" className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5 block">
                  Item Name *
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="e.g. Paneer Butter Masala"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-transparent border-0 border-b border-zinc-800 rounded-none text-white text-sm px-0 py-2 focus:border-zinc-400 transition-colors placeholder:text-zinc-600"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="group relative">
                  <Label htmlFor="price" className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5 block">
                    Price (₹ INR) *
                  </Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="249"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="bg-transparent border-0 border-b border-zinc-800 rounded-none text-white text-sm pl-6 pr-0 py-2 focus:border-zinc-400 transition-colors placeholder:text-zinc-600 font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="group relative">
                  <Label htmlFor="category" className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5 block">
                    Category *
                  </Label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-transparent border-0 border-b border-zinc-800 text-sm text-white py-2 focus:outline-none focus:border-zinc-400 transition-colors cursor-pointer"
                    required
                  >
                    {indianCategories.map((cat) => (
                      <option key={cat} value={cat} className="bg-zinc-900">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="group relative">
                <Label htmlFor="image" className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5 block">
                  Image URL
                </Label>
                <div className="relative">
                  <ImageIcon className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
                  <Input
                    id="image"
                    type="url"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    className="bg-transparent border-0 border-b border-zinc-800 rounded-none text-white text-sm pl-6 pr-0 py-2 focus:border-zinc-400 transition-colors placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <div className="group relative">
                <Label htmlFor="description" className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5 block">
                  Description & Ingredients
                </Label>
                <Input
                  id="description"
                  type="text"
                  placeholder="Cottage cheese in rich tomato gravy with butter and cream"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-transparent border-0 border-b border-zinc-800 rounded-none text-white text-sm px-0 py-2 focus:border-zinc-400 transition-colors placeholder:text-zinc-600"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Dietary & Culinary */}
          <div className="space-y-6 pt-8 border-t border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                <Leaf className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Dietary & Culinary Specs</h2>
                <p className="text-xs text-zinc-500">Classification, spiciness, and preparation details</p>
              </div>
            </div>

            <div className="space-y-6 pl-11">
              {/* Dietary Type - Visual Selector */}
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                  Dietary Classification *
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(dietaryConfigs).map(([key, config]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDietaryType(key)}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        dietaryType === key
                          ? `${config.bg} ${config.border} ${config.color}`
                          : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <span className="text-lg block mb-1">{config.icon}</span>
                      <span className="text-xs font-medium">{config.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Spiciness - Visual Selector */}
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-2 flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5 text-red-400" /> Spiciness Level
                </Label>
                <div className="flex gap-2">
                  {[0, 1, 2, 3].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setSpicinessLevel(String(level))}
                      className={`flex-1 p-2 rounded-lg border text-center transition-all ${
                        spicinessLevel === String(level)
                          ? "bg-red-500/10 border-red-500/30 text-red-400"
                          : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <span className="text-sm block">
                        {"🌶️".repeat(level) || "—"}
                      </span>
                      <span className="text-[10px] mt-1 block">
                        {level === 0 ? "Mild" : level === 1 ? "Medium" : level === 2 ? "Hot" : "Fiery"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="group relative">
                  <Label htmlFor="prepTime" className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5 block">
                    <Clock className="h-3 w-3 inline mr-1" /> Prep Time (min)
                  </Label>
                  <Input
                    id="prepTime"
                    type="number"
                    min="1"
                    placeholder="15"
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value)}
                    className="bg-transparent border-0 border-b border-zinc-800 rounded-none text-white text-sm px-0 py-2 focus:border-zinc-400 transition-colors placeholder:text-zinc-600 font-mono"
                  />
                </div>

                <div className="group relative">
                  <Label htmlFor="calories" className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5 block">
                    <Zap className="h-3 w-3 inline mr-1" /> Calories (kcal)
                  </Label>
                  <Input
                    id="calories"
                    type="number"
                    min="0"
                    placeholder="450"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    className="bg-transparent border-0 border-b border-zinc-800 rounded-none text-white text-sm px-0 py-2 focus:border-zinc-400 transition-colors placeholder:text-zinc-600 font-mono"
                  />
                </div>
              </div>

              <div className="group relative">
                <Label htmlFor="allergens" className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5 block">
                  <ShieldAlert className="h-3 w-3 inline mr-1" /> Allergens & Warnings
                </Label>
                <Input
                  id="allergens"
                  type="text"
                  placeholder="Contains Dairy, Nut Traces, Gluten-Free"
                  value={allergens}
                  onChange={(e) => setAllergens(e.target.value)}
                  className="bg-transparent border-0 border-b border-zinc-800 rounded-none text-white text-sm px-0 py-2 focus:border-zinc-400 transition-colors placeholder:text-zinc-600"
                />
              </div>

              {/* Availability Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-950/60 border border-zinc-800">
                <div>
                  <p className="text-sm font-medium text-white">Available for Ordering</p>
                  <p className="text-xs text-zinc-500">Show this item on digital menu</p>
                </div>
                <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-8 border-t border-zinc-800">
            <Link to={`/dashboard/stores/${storeId}/manage`}>
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
                  <Plus className="h-4 w-4" /> Add Item
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Right Sidebar - Live Preview */}
        <div className="space-y-6 lg:sticky lg:top-6 h-fit">
          {/* Menu Item Preview */}
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 overflow-hidden">
            <CardHeader className="pb-4 border-b border-zinc-800">
              <CardTitle className="text-sm text-zinc-400 font-medium">Menu Item Preview</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {/* Item Image */}
                {image ? (
                  <img src={image} alt={name} className="w-full h-40 object-cover rounded-lg" />
                ) : (
                  <div className="w-full h-40 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                    <UtensilsCrossed className="h-8 w-8 text-zinc-600" />
                  </div>
                )}

                {/* Item Info */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-bold text-white">{name || "Item Name"}</h3>
                      <p className="text-xs text-zinc-500 mt-1">{description || "No description yet"}</p>
                    </div>
                    <span className="text-lg font-bold text-white whitespace-nowrap">
                      ₹{price || "0"}
                    </span>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${currentDietary.bg} ${currentDietary.color} ${currentDietary.border} border`}>
                    {currentDietary.icon} {currentDietary.label}
                  </span>
                  
                  {spicinessLevel !== "0" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                      🌶️ {spicinessLevel === "1" ? "Medium" : spicinessLevel === "2" ? "Hot" : "Fiery"}
                    </span>
                  )}
                  
                  {prepTime && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                      <Clock className="h-3 w-3" /> {prepTime} min
                    </span>
                  )}
                  
                  {calories && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                      <Zap className="h-3 w-3" /> {calories} kcal
                    </span>
                  )}
                </div>

                {/* Allergens */}
                {allergens && (
                  <div className="pt-3 border-t border-zinc-800">
                    <p className="text-xs text-zinc-500 mb-1">Allergens</p>
                    <p className="text-xs text-zinc-400">{allergens}</p>
                  </div>
                )}

                {/* Availability Status */}
                <div className={`flex items-center gap-2 text-xs ${isAvailable ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                  {isAvailable ? 'Available for ordering' : 'Currently unavailable'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category Info */}
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500">Category</p>
                  <p className="text-sm font-medium text-white">{category}</p>
                </div>
                <UtensilsCrossed className="h-5 w-5 text-zinc-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}