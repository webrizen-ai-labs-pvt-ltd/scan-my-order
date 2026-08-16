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
} from "@repo/ui"
import { ArrowLeft, Layers, Save, Trash2, AlertCircle, CheckCircle2, LoaderCircle, IndianRupee, Store, UtensilsCrossed, Sparkles, CreditCard, Eye, EyeOff } from "lucide-react"
import { useAuth } from "../../context/auth-context.jsx"
import { fetchPlanByIdApi, updatePlanApi, deletePlanApi } from "../../services/subscription-api.js"

export default function PlanEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token } = useAuth()

  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [interval, setInterval] = useState("MONTHLY")
  const [maxStores, setMaxStores] = useState("1")
  const [maxMenuItems, setMaxMenuItems] = useState("100")
  const [features, setFeatures] = useState("")
  const [status, setStatus] = useState("ACTIVE")
  const [showPreview, setShowPreview] = useState(true)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [msg, setMsg] = useState({ text: "", error: false })

  useEffect(() => {
    async function loadPlan() {
      if (!token || !id) return
      setLoading(true)
      try {
        const res = await fetchPlanByIdApi(token, id)
        const plan = res?.data
        if (plan) {
          setName(plan.name || "")
          setDescription(plan.description || "")
          setPrice(String(plan.price || 0))
          setInterval(plan.interval || "MONTHLY")
          setMaxStores(String(plan.maxStores || 1))
          setMaxMenuItems(String(plan.maxMenuItems || 100))
          setFeatures(plan.features || "")
          setStatus(plan.status || "ACTIVE")
        }
      } catch (err) {
        setMsg({ text: err instanceof Error ? err.message : "Failed to load plan details.", error: true })
      } finally {
        setLoading(false)
      }
    }
    loadPlan()
  }, [token, id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMsg({ text: "", error: false })
    setIsSubmitting(true)

    try {
      await updatePlanApi(token, id, {
        name,
        description,
        price: parseFloat(price),
        interval,
        maxStores: parseInt(maxStores, 10),
        maxMenuItems: parseInt(maxMenuItems, 10),
        features,
        status,
      })
      setMsg({ text: "Subscription plan updated successfully!", error: false })
      setTimeout(() => navigate("/dashboard/subscriptions"), 1000)
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Failed to update plan.", error: true })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this subscription plan?")) return
    setIsSubmitting(true)
    try {
      await deletePlanApi(token, id)
      navigate("/dashboard/subscriptions")
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Failed to delete plan.", error: true })
      setIsSubmitting(false)
    }
  }

  const featureList = features ? features.split(",").map(f => f.trim()).filter(Boolean) : []

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-4">
          <Link to="/dashboard/subscriptions">
            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-zinc-800 gap-1.5 text-sm">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Edit Subscription Plan</h1>
            <p className="text-sm text-zinc-500">Update pricing and feature access</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
        </div>
      </div>

      {msg.text && (
        <div
          className={`flex items-center gap-2 text-sm rounded-lg px-4 py-3 border ${
            msg.error
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}
        >
          {msg.error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-2">
          <LoaderCircle className="h-6 w-6 animate-spin" />
          <p className="text-sm">Fetching subscription plan details...</p>
        </div>
      ) : (
        <div className={`grid grid-cols-1 ${showPreview ? 'lg:grid-cols-[1fr_380px]' : ''} gap-8`}>
          {/* Main Form - Left Side */}
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Section 1: Plan Details */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <Layers className="h-5 w-5 text-zinc-300" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Plan Details</h2>
                  <p className="text-sm text-zinc-500">Basic information about this tier</p>
                </div>
              </div>

              <div className="space-y-5 pl-13">
                <div className="group relative">
                  <Label htmlFor="name" className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                    Plan Display Name *
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-base px-0 py-3 focus:border-zinc-400 transition-colors placeholder:text-zinc-600"
                    required
                  />
                </div>

                <div className="group relative">
                  <Label htmlFor="status" className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                    Plan Status
                  </Label>
                  <select
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-base text-white py-3 focus:outline-none focus:border-zinc-400 transition-colors cursor-pointer"
                  >
                    <option value="ACTIVE" className="bg-zinc-900">ACTIVE (Available for subscriptions)</option>
                    <option value="INACTIVE" className="bg-zinc-900">INACTIVE (Hidden from catalog)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Pricing & Limits */}
            <div className="space-y-6 pt-8 border-t border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-zinc-300" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Pricing & Limits</h2>
                  <p className="text-sm text-zinc-500">Set pricing and resource entitlements</p>
                </div>
              </div>

              <div className="space-y-5 pl-13">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="group relative">
                    <Label htmlFor="price" className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                      Price Amount (₹ INR) *
                    </Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-600" />
                      <Input
                        id="price"
                        type="number"
                        step="1"
                        min="0"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-lg pl-8 pr-0 py-3 focus:border-zinc-400 transition-colors placeholder:text-zinc-600 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="group relative">
                    <Label htmlFor="interval" className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                      Billing Cycle *
                    </Label>
                    <select
                      id="interval"
                      value={interval}
                      onChange={(e) => setInterval(e.target.value)}
                      className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-base text-white py-3 focus:outline-none focus:border-zinc-400 transition-colors cursor-pointer"
                    >
                      <option value="MONTHLY" className="bg-zinc-900">Monthly Billing</option>
                      <option value="YEARLY" className="bg-zinc-900">Yearly Billing (Annual Discount)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="group relative">
                    <Label htmlFor="maxStores" className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                      <Store className="h-4 w-4 inline mr-1.5" /> Max Stores *
                    </Label>
                    <Input
                      id="maxStores"
                      type="number"
                      min="1"
                      value={maxStores}
                      onChange={(e) => setMaxStores(e.target.value)}
                      className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-base px-0 py-3 focus:border-zinc-400 transition-colors placeholder:text-zinc-600 font-mono"
                      required
                    />
                  </div>

                  <div className="group relative">
                    <Label htmlFor="maxMenuItems" className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                      <UtensilsCrossed className="h-4 w-4 inline mr-1.5" /> Max Menu Items *
                    </Label>
                    <Input
                      id="maxMenuItems"
                      type="number"
                      min="10"
                      value={maxMenuItems}
                      onChange={(e) => setMaxMenuItems(e.target.value)}
                      className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-base px-0 py-3 focus:border-zinc-400 transition-colors placeholder:text-zinc-600 font-mono"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Description & Features */}
            <div className="space-y-6 pt-8 border-t border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-zinc-300" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Description & Features</h2>
                  <p className="text-sm text-zinc-500">Plan overview and included features</p>
                </div>
              </div>

              <div className="space-y-5 pl-13">
                <div className="group relative">
                  <Label htmlFor="description" className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                    Plan Tagline / Overview
                  </Label>
                  <Input
                    id="description"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-base px-0 py-3 focus:border-zinc-400 transition-colors placeholder:text-zinc-600"
                  />
                </div>

                <div className="group relative">
                  <Label htmlFor="features" className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                    Features List (Comma-separated)
                  </Label>
                  <Input
                    id="features"
                    type="text"
                    value={features}
                    onChange={(e) => setFeatures(e.target.value)}
                    className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-base px-0 py-3 focus:border-zinc-400 transition-colors placeholder:text-zinc-600"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-8 border-t border-zinc-800">
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="text-red-400 hover:bg-red-500/10 text-sm gap-1.5"
              >
                <Trash2 className="h-4 w-4" /> Delete Plan
              </Button>

              <div className="flex gap-3">
                <Link to="/dashboard/subscriptions">
                  <Button type="button" variant="ghost" className="text-zinc-400 hover:text-white hover:bg-zinc-800 text-sm px-4 py-2">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting} className="bg-white hover:bg-zinc-200 text-zinc-900 font-medium gap-2 text-sm px-6 py-2">
                  {isSubmitting ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" /> Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>

          {/* Right Sidebar - Live Preview */}
          {showPreview && (
            <div className="space-y-6 lg:sticky lg:top-6 h-fit">
              {/* Plan Preview Card */}
              <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-zinc-400 via-zinc-200 to-zinc-400 opacity-50" />
                <CardHeader className="pb-4 border-b border-zinc-800">
                  <CardTitle className="text-sm text-zinc-400 font-medium">Plan Preview</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-5">
                    {/* Plan Header */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider bg-zinc-800/50 px-2 py-1 rounded-md">
                          {status}
                        </span>
                      </div>
                      <div className="flex items-end justify-between mb-2">
                        <div className="flex items-start gap-1">
                          <IndianRupee className="h-5 w-5 text-zinc-400 mt-1.5" />
                          <span className="text-4xl font-bold text-white tracking-tight">{price || "0"}</span>
                        </div>
                        <span className="text-xs text-zinc-500 mb-1">/{interval === "YEARLY" ? "year" : "month"}</span>
                      </div>
                      <h3 className="text-lg font-bold text-white">{name || "Plan Name"}</h3>
                      {description && (
                        <p className="text-sm text-zinc-500 mt-1">{description}</p>
                      )}
                    </div>

                    {/* Limits */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
                        <Store className="h-4 w-4 text-zinc-500 mb-1.5" />
                        <p className="text-lg font-bold text-white leading-none">{maxStores}</p>
                        <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">Stores</p>
                      </div>
                      <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
                        <UtensilsCrossed className="h-4 w-4 text-zinc-500 mb-1.5" />
                        <p className="text-lg font-bold text-white leading-none">{maxMenuItems}</p>
                        <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">Menu Items</p>
                      </div>
                    </div>

                    {/* Features */}
                    {featureList.length > 0 && (
                      <div className="space-y-2 pt-4 border-t border-zinc-800">
                        <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Features</p>
                        <div className="space-y-1.5">
                          {featureList.slice(0, 4).map((feature, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm text-zinc-400">
                              <span className="w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                              <span className="truncate">{feature}</span>
                            </div>
                          ))}
                          {featureList.length > 4 && (
                            <p className="text-xs text-zinc-600 pl-3">+{featureList.length - 4} more</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* CTA Button */}
                    <button className="w-full py-2.5 rounded-lg bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-200 transition-colors">
                      Subscribe Now
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  )
}