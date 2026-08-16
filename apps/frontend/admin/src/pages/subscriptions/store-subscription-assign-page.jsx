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
import {
  ArrowLeft,
  Send,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Mail,
  Copy,
  ExternalLink,
  Store,
  Building2,
  Layers,
  IndianRupee,
  Phone,
  Zap,
} from "lucide-react"
import { useAuth } from "../../context/auth-context.jsx"
import { fetchStoresApi } from "../../services/admin-api.js"
import {
  fetchPlansApi,
  assignStoreSubscriptionApi,
  initiatePhonePeCheckoutApi,
} from "../../services/subscription-api.js"

export default function StoreSubscriptionAssignPage() {
  const navigate = useNavigate()
  const { token } = useAuth()

  const [stores, setStores] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)

  const [selectedStoreId, setSelectedStoreId] = useState("")
  const [selectedPlanId, setSelectedPlanId] = useState("")
  const [assignmentMode, setAssignmentMode] = useState("PHONEPE") // "PHONEPE" or "DIRECT"
  const [sendEmailToOwner, setSendEmailToOwner] = useState(true)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [msg, setMsg] = useState({ text: "", error: false })
  const [generatedResult, setGeneratedResult] = useState(null)

  useEffect(() => {
    async function loadOptions() {
      if (!token) return
      setLoading(true)
      try {
        const [storesRes, plansRes] = await Promise.all([
          fetchStoresApi(token),
          fetchPlansApi(token),
        ])
        if (storesRes?.data) setStores(storesRes.data)
        if (plansRes?.data) setPlans(plansRes.data)
      } catch (err) {
        setMsg({ text: err instanceof Error ? err.message : "Failed to load stores or plans.", error: true })
      } finally {
        setLoading(false)
      }
    }
    loadOptions()
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMsg({ text: "", error: false })
    setGeneratedResult(null)
    setIsSubmitting(true)

    try {
      if (assignmentMode === "DIRECT") {
        await assignStoreSubscriptionApi(token, {
          storeId: selectedStoreId,
          planId: selectedPlanId,
        })
        setMsg({ text: "Subscription directly assigned and activated for the store!", error: false })
        setTimeout(() => navigate("/dashboard/subscriptions"), 1200)
      } else {
        // PhonePe Checkout Generation & Nodemailer Email
        const res = await initiatePhonePeCheckoutApi(token, {
          storeId: selectedStoreId,
          planId: selectedPlanId,
          sendEmail: sendEmailToOwner,
        })
        if (res?.data) {
          setGeneratedResult(res.data)
          setMsg({
            text: res.data.emailSent
              ? `PhonePe payment link generated and emailed to store owner (${res.data.ownerEmail})!`
              : "PhonePe payment checkout link generated successfully!",
            error: false,
          })
        }
      }
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Failed to process subscription action.", error: true })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopyLink = () => {
    if (generatedResult?.checkoutUrl) {
      navigator.clipboard.writeText(generatedResult.checkoutUrl)
      alert("PhonePe payment checkout URL copied to clipboard!")
    }
  }

  const selectedStore = stores.find((s) => s.id === selectedStoreId)
  const selectedPlan = plans.find((p) => p.id === selectedPlanId)

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
            <h1 className="text-xl font-bold text-white tracking-tight">Assign Subscription</h1>
            <p className="text-sm text-zinc-500">Generate payment links or activate directly</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-sm text-zinc-500">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          PhonePe Gateway
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

      {/* Generated Result Checkout Card */}
      {generatedResult && (
        <Card className="bg-zinc-900 border-amber-500/30 text-zinc-100 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400" />
          <CardHeader>
            <CardTitle className="text-base text-amber-400 flex items-center gap-2">
              <Phone className="h-5 w-5" /> PhonePe Checkout Generated
            </CardTitle>
            <CardDescription className="text-zinc-400 text-sm">
              Transaction Ref: <span className="font-mono text-white font-semibold">{generatedResult.merchantTransactionId}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm font-medium">Checkout URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={generatedResult.checkoutUrl}
                  className="bg-zinc-950 border-zinc-700 text-amber-400 font-mono text-sm py-3"
                />
                <Button variant="outline" onClick={handleCopyLink} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1.5 text-sm">
                  <Copy className="h-4 w-4" /> Copy
                </Button>
                <a href={generatedResult.checkoutUrl} target="_blank" rel="noreferrer">
                  <Button className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium gap-1.5 text-sm">
                    <ExternalLink className="h-4 w-4" /> Open
                  </Button>
                </a>
              </div>
            </div>

            {generatedResult.emailSent && (
              <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                <Mail className="h-4 w-4 shrink-0" />
                <span>Payment link emailed to <strong>{generatedResult.ownerEmail}</strong></span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-2">
          <LoaderCircle className="h-6 w-6 animate-spin" />
          <p className="text-sm">Loading stores and plans...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          {/* Main Form - Left Side */}
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Section 1: Store & Plan Selection */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-zinc-300" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Select Store & Plan</h2>
                  <p className="text-sm text-zinc-500">Choose target establishment and subscription tier</p>
                </div>
              </div>

              <div className="space-y-5 pl-13">
                <div className="group relative">
                  <Label htmlFor="storeId" className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                    <Store className="h-4 w-4 inline mr-1.5" /> Restaurant Store *
                  </Label>
                  <select
                    id="storeId"
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-base text-white py-3 focus:outline-none focus:border-zinc-400 transition-colors cursor-pointer"
                    required
                  >
                    <option value="" className="bg-zinc-900">Choose a store...</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id} className="bg-zinc-900">
                        {s.name} (Owner: {s.owner?.name || "Unassigned"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="group relative">
                  <Label htmlFor="planId" className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                    <Layers className="h-4 w-4 inline mr-1.5" /> Subscription Plan *
                  </Label>
                  <select
                    id="planId"
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-base text-white py-3 focus:outline-none focus:border-zinc-400 transition-colors cursor-pointer"
                    required
                  >
                    <option value="" className="bg-zinc-900">Choose a plan...</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id} className="bg-zinc-900">
                        {p.name} (₹{p.price}/{p.interval})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Activation Mode */}
            <div className="space-y-6 pt-8 border-t border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-zinc-300" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Activation Mode</h2>
                  <p className="text-sm text-zinc-500">Choose how to activate the subscription</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-13">
                {/* PhonePe Option */}
                <button
                  type="button"
                  onClick={() => setAssignmentMode("PHONEPE")}
                  className={`p-5 rounded-xl border-2 text-left transition-all ${
                    assignmentMode === "PHONEPE"
                      ? "border-amber-500/50 bg-amber-500/5"
                      : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      assignmentMode === "PHONEPE" ? "bg-amber-500/10" : "bg-zinc-800"
                    }`}>
                      <Phone className={`h-5 w-5 ${assignmentMode === "PHONEPE" ? "text-amber-400" : "text-zinc-400"}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">PhonePe Checkout</p>
                      <p className="text-xs text-zinc-500">Generate payment link</p>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Create PhonePe payment URL and email invoice to store owner.
                  </p>
                </button>

                {/* Direct Option */}
                <button
                  type="button"
                  onClick={() => setAssignmentMode("DIRECT")}
                  className={`p-5 rounded-xl border-2 text-left transition-all ${
                    assignmentMode === "DIRECT"
                      ? "border-emerald-500/50 bg-emerald-500/5"
                      : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      assignmentMode === "DIRECT" ? "bg-emerald-500/10" : "bg-zinc-800"
                    }`}>
                      <CheckCircle2 className={`h-5 w-5 ${assignmentMode === "DIRECT" ? "text-emerald-400" : "text-zinc-400"}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Direct Activation</p>
                      <p className="text-xs text-zinc-500">Activate immediately</p>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Instantly activate subscription without payment processing.
                  </p>
                </button>
              </div>

              {/* Email Toggle */}
              {assignmentMode === "PHONEPE" && (
                <div className="pl-13">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-950/60 border border-zinc-800">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-amber-400" />
                      <div>
                        <p className="text-sm font-medium text-white">Email Invoice to Owner</p>
                        <p className="text-xs text-zinc-500">
                          {selectedStore?.owner?.email
                            ? `Send to: ${selectedStore.owner.email}`
                            : "Sends payment link to owner's email"}
                        </p>
                      </div>
                    </div>
                    <Switch checked={sendEmailToOwner} onCheckedChange={setSendEmailToOwner} />
                  </div>
                </div>
              )}
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
                    <LoaderCircle className="h-4 w-4 animate-spin" /> Processing...
                  </>
                ) : assignmentMode === "PHONEPE" ? (
                  <>
                    <Send className="h-4 w-4" /> Generate Payment Link
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Activate Subscription
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Right Sidebar - Summary */}
          <div className="space-y-6 lg:sticky lg:top-6 h-fit">
            {/* Selection Summary */}
            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <CardHeader className="pb-4 border-b border-zinc-800">
                <CardTitle className="text-sm text-zinc-400 font-medium">Selection Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                {/* Store */}
                <div>
                  <p className="text-xs text-zinc-500 mb-1.5">Selected Store</p>
                  {selectedStore ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                        <Store className="h-5 w-5 text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{selectedStore.name}</p>
                        <p className="text-xs text-zinc-500">{selectedStore.owner?.name || "No owner"}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-600">No store selected</p>
                  )}
                </div>

                {/* Plan */}
                <div className="pt-4 border-t border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-1.5">Selected Plan</p>
                  {selectedPlan ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-white">{selectedPlan.name}</p>
                        <div className="flex items-center gap-1">
                          <IndianRupee className="h-4 w-4 text-zinc-400" />
                          <span className="text-lg font-bold text-white">{selectedPlan.price}</span>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-500">{selectedPlan.interval === "YEARLY" ? "Per year" : "Per month"}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-600">No plan selected</p>
                  )}
                </div>

                {/* Mode */}
                <div className="pt-4 border-t border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-1.5">Activation Mode</p>
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                    assignmentMode === "PHONEPE"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-emerald-500/10 text-emerald-400"
                  }`}>
                    {assignmentMode === "PHONEPE" ? <Phone className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {assignmentMode === "PHONEPE" ? "PhonePe Checkout" : "Direct Activation"}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Help Card */}
            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <CardContent className="p-4">
                <p className="text-xs text-zinc-500 leading-relaxed">
                  <strong className="text-zinc-300">PhonePe Mode:</strong> Generates a payment link and emails it to the store owner.
                </p>
                <p className="text-xs text-zinc-500 leading-relaxed mt-2">
                  <strong className="text-zinc-300">Direct Mode:</strong> Activates subscription immediately without payment.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}