import React, { useState } from "react"
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
} from "@repo/ui"
import { ArrowLeft, Layers, Plus, AlertCircle, CheckCircle2, LoaderCircle, IndianRupee, Store, UtensilsCrossed, Sparkles, CreditCard } from "lucide-react"
import { useAuth } from "../../context/auth-context.jsx"
import { createPlanApi } from "../../services/subscription-api.js"

export default function PlanCreatePage() {
  const navigate = useNavigate()
  const { token } = useAuth()

  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [interval, setInterval] = useState("MONTHLY")
  const [maxStores, setMaxStores] = useState("1")
  const [maxMenuItems, setMaxMenuItems] = useState("100")
  const [features, setFeatures] = useState("QR Dining, Kitchen Display System (KDS), Live Inventory, Analytics")

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [msg, setMsg] = useState({ text: "", error: false })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMsg({ text: "", error: false })
    setIsSubmitting(true)

    try {
      await createPlanApi(token, {
        name,
        code,
        description,
        price: parseFloat(price),
        interval,
        maxStores: parseInt(maxStores, 10),
        maxMenuItems: parseInt(maxMenuItems, 10),
        features,
      })
      setMsg({ text: "Subscription plan created successfully!", error: false })
      setTimeout(() => navigate("/dashboard/subscriptions"), 1000)
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Failed to create plan.", error: true })
    } finally {
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
            <h1 className="text-xl font-bold text-white tracking-tight">Create Subscription Plan</h1>
            <p className="text-sm text-zinc-500">Configure pricing and feature access</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-sm text-zinc-500">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          New Plan
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
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
                <p className="text-sm text-zinc-500">Basic information about your subscription tier</p>
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
                  placeholder="e.g. Professional Growth Tier"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (!code) setCode(e.target.value.toUpperCase().replace(/\s+/g, "_"))
                  }}
                  className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-base px-0 py-3 focus:border-zinc-400 transition-colors placeholder:text-zinc-600"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="group relative">
                  <Label htmlFor="code" className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                    Plan System Code *
                  </Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="PRO_MONTHLY"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-base px-0 py-3 focus:border-zinc-400 transition-colors placeholder:text-zinc-600 font-mono"
                    required
                  />
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

              <div className="group relative">
                <Label htmlFor="description" className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                  Plan Tagline / Overview
                </Label>
                <Input
                  id="description"
                  type="text"
                  placeholder="Ideal for growing restaurants with multi-table QR ordering and KDS."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-base px-0 py-3 focus:border-zinc-400 transition-colors placeholder:text-zinc-600"
                />
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
                    placeholder="1499"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="bg-transparent border-0 border-b-2 border-zinc-800 rounded-none text-white text-lg pl-8 pr-0 py-3 focus:border-zinc-400 transition-colors placeholder:text-zinc-600 font-mono"
                    required
                  />
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

          {/* Section 3: Features */}
          <div className="space-y-6 pt-8 border-t border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-zinc-300" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Included Features</h2>
                <p className="text-sm text-zinc-500">Comma-separated list of features</p>
              </div>
            </div>

            <div className="pl-13">
              <div className="group relative">
                <Label htmlFor="features" className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                  Features List
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
          <div className="flex justify-end gap-3 pt-8 border-t border-zinc-800">
            <Link to="/dashboard/subscriptions">
              <Button type="button" variant="ghost" className="text-zinc-400 hover:text-white hover:bg-zinc-800 text-sm px-4 py-2">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting} className="bg-white hover:bg-zinc-200 text-zinc-900 font-medium gap-2 text-sm px-6 py-2">
              {isSubmitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Create Plan
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Right Sidebar - Live Preview */}
        <div className="space-y-6 lg:sticky lg:top-6 h-fit">
          {/* Plan Preview Card */}
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 overflow-hidden">
            <CardHeader className="pb-4 border-b border-zinc-800">
              <CardTitle className="text-sm text-zinc-400 font-medium">Plan Preview</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-5">
                {/* Plan Header */}
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white mb-1">{name || "Plan Name"}</h3>
                  {description && (
                    <p className="text-sm text-zinc-500">{description}</p>
                  )}
                </div>

                {/* Price */}
                <div className="text-center py-4">
                  <span className="text-4xl font-bold text-white">₹{price || "0"}</span>
                  <span className="text-sm text-zinc-500 ml-2">
                    /{interval === "MONTHLY" ? "month" : "year"}
                  </span>
                </div>

                {/* Features List */}
                {featureList.length > 0 && (
                  <div className="space-y-2 pt-4 border-t border-zinc-800">
                    {featureList.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span className="text-sm text-zinc-300">{feature}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Limits */}
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-zinc-800">
                  <div className="text-center p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
                    <Store className="h-5 w-5 text-zinc-400 mx-auto mb-1" />
                    <p className="text-lg font-bold text-white">{maxStores}</p>
                    <p className="text-xs text-zinc-500">Stores</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
                    <UtensilsCrossed className="h-5 w-5 text-zinc-400 mx-auto mb-1" />
                    <p className="text-lg font-bold text-white">{maxMenuItems}</p>
                    <p className="text-xs text-zinc-500">Menu Items</p>
                  </div>
                </div>

                {/* CTA Button Preview */}
                <button className="w-full py-2.5 rounded-lg bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-200 transition-colors">
                  Subscribe Now
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Plan Code Info */}
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500">System Code</p>
                  <p className="text-sm font-medium text-white font-mono">{code || "—"}</p>
                </div>
                <Layers className="h-5 w-5 text-zinc-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}