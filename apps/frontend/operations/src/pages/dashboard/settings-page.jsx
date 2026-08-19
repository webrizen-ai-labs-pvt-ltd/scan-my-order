import React, { useState, useEffect, useCallback } from "react"
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
  Badge,
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@repo/ui"
import {
  User,
  Fingerprint,
  Key,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Plus,
  Trash2,
  Laptop,
  Shield,
  Mail,
  Lock,
  Store,
  Building2,
  Clock,
  Palette,
  Type,
  Image as ImageIcon,
  ExternalLink,
  QrCode,
  Receipt,
} from "lucide-react"
import { startRegistration } from "@simplewebauthn/browser"
import { useAuth } from "../../context/auth-context.jsx"
import {
  getPasskeyRegisterOptionsApi,
  verifyPasskeyRegisterApi,
  fetchMyPasskeysApi,
  deletePasskeyApi,
  changePasswordApi,
  forgotPasswordApi,
  resetPasswordWithOtpApi,
  updateProfileApi,
} from "../../services/auth-api.js"
import { fetchMyStoreApi, updateStoreApi } from "../../services/store-api.js"

export default function SettingsPage() {
  const { user, token } = useAuth()
  const isOwner = user?.role === "OWNER"

  // Profile Form State
  const [name, setName] = useState(user?.name || "")
  const [avatar, setAvatar] = useState(user?.avatar || "")
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState({ text: "", error: false })

  // Dynamic Store Configuration Form State (For OWNER Role)
  const [store, setStore] = useState(null)
  const [isStoreLoading, setIsStoreLoading] = useState(isOwner)
  const [storeName, setStoreName] = useState("")
  const [slug, setSlug] = useState("")
  const [storeDescription, setStoreDescription] = useState("")
  const [operatingHours, setOperatingHours] = useState("")
  const [colorScheme, setColorScheme] = useState("#f59e0b")
  const [fontStyle, setFontStyle] = useState("DM Sans")
  const [brandingLogo, setBrandingLogo] = useState("")
  const [gstNumber, setGstNumber] = useState("")
  const [taxType, setTaxType] = useState("FORWARD")
  const [taxValueType, setTaxValueType] = useState("PERCENTAGE")
  const [taxValue, setTaxValue] = useState(5)
  const [serviceFee, setServiceFee] = useState(0)
  const [couponCode, setCouponCode] = useState("")
  const [couponValueType, setCouponValueType] = useState("PERCENTAGE")
  const [couponValue, setCouponValue] = useState(0)
  const [isUpdatingStore, setIsUpdatingStore] = useState(false)
  const [storeMsg, setStoreMsg] = useState({ text: "", error: false })

  // Available font options for store menu branding
  const fontOptions = [
    { label: "DM Sans (Modern Sans-Serif)", value: "DM Sans" },
    { label: "Newsreader (Elegant Serif)", value: "Newsreader" },
    { label: "Inter (Clean Tech Sans)", value: "Inter" },
    { label: "Playfair Display (Luxury Bistro)", value: "Playfair Display" },
    { label: "Outfit (Geometric Sans)", value: "Outfit" },
    { label: "Space Grotesk (Futuristic Mono)", value: "Space Grotesk" },
  ]

  // Sync profile state with context user
  useEffect(() => {
    if (user) {
      if (user.name) setName(user.name)
      if (user.avatar) setAvatar(user.avatar)
    }
  }, [user])

  // Fetch real linked store for OWNER accounts dynamically from backend
  useEffect(() => {
    if (isOwner && token) {
      setIsStoreLoading(true)
      fetchMyStoreApi(token)
        .then((res) => {
          const storeData = res?.data
          if (storeData) {
            setStore(storeData)
            setStoreName(storeData.name || "")
            setSlug(storeData.slug || "")
            setStoreDescription(storeData.description || "")
            setOperatingHours(storeData.operatingHours || "")
            setColorScheme(storeData.colorScheme || "#f59e0b")
            setFontStyle(storeData.fontStyle || "DM Sans")
            setBrandingLogo(storeData.brandingLogo || "")
            setGstNumber(storeData.gstNumber || "")
            setTaxType(storeData.taxType || "FORWARD")
            setTaxValueType(storeData.taxValueType || "PERCENTAGE")
            setTaxValue(storeData.taxValue !== undefined ? storeData.taxValue : 5)
            setServiceFee(storeData.serviceFee || 0)
            setCouponCode(storeData.couponCode || "")
            setCouponValueType(storeData.couponValueType || "PERCENTAGE")
            setCouponValue(storeData.couponValue || 0)
          } else {
            setStore(null)
          }
        })
        .catch((err) => {
          console.error("Failed to fetch store details:", err)
          setStore(null)
        })
        .finally(() => {
          setIsStoreLoading(false)
        })
    }
  }, [isOwner, token])

  // Password Mode: 'direct' or 'otp'
  const [passwordMode, setPasswordMode] = useState("direct")

  // Direct Password Change State
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState({ text: "", error: false })

  // OTP Reset State
  const [otpCode, setOtpCode] = useState("")
  const [otpNewPassword, setOtpNewPassword] = useState("")
  const [otpConfirmPassword, setOtpConfirmPassword] = useState("")
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isResettingWithOtp, setIsResettingWithOtp] = useState(false)
  const [otpSent, setOtpSent] = useState(false)

  // Passkeys State - Fetch registered passkeys directly from database API
  const [registeredPasskeys, setRegisteredPasskeys] = useState([])
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false)
  const [passkeyMsg, setPasskeyMsg] = useState({ text: "", error: false })

  const loadPasskeys = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetchMyPasskeysApi(token)
      if (Array.isArray(res?.data)) {
        setRegisteredPasskeys(res.data)
      }
    } catch (err) {
      console.error("Failed to fetch passkeys from server:", err)
    }
  }, [token])

  useEffect(() => {
    loadPasskeys()
  }, [loadPasskeys])

  // Profile Update Handler
  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setProfileMsg({ text: "", error: false })
    setIsUpdatingProfile(true)

    try {
      await updateProfileApi(token, { name, avatar })
      setProfileMsg({ text: "Profile details updated successfully!", error: false })
    } catch (err) {
      setProfileMsg({
        text: err instanceof Error ? err.message : "Failed to update profile.",
        error: true,
      })
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  // Dynamic Store Settings Update Handler (Owner only)
  const handleStoreSubmit = async (e) => {
    e.preventDefault()
    if (!store?.id) {
      setStoreMsg({ text: "No linked store available to update.", error: true })
      return
    }

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
        gstNumber,
        taxType,
        taxValueType,
        taxValue,
        serviceFee,
        couponCode,
        couponValueType,
        couponValue,
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
        setGstNumber(updated.gstNumber || "")
        setTaxType(updated.taxType || "FORWARD")
        setTaxValueType(updated.taxValueType || "PERCENTAGE")
        setTaxValue(updated.taxValue !== undefined ? updated.taxValue : 5)
        setServiceFee(updated.serviceFee || 0)
        setCouponCode(updated.couponCode || "")
        setCouponValueType(updated.couponValueType || "PERCENTAGE")
        setCouponValue(updated.couponValue || 0)
      }

      setStoreMsg({ text: "Store details & custom URL slug updated successfully!", error: false })
    } catch (err) {
      setStoreMsg({
        text: err instanceof Error ? err.message : "Failed to update store details.",
        error: true,
      })
    } finally {
      setIsUpdatingStore(false)
    }
  }

  // Direct Password Change Handler
  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPasswordMsg({ text: "", error: false })

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: "New passwords do not match.", error: true })
      return
    }

    setIsUpdatingPassword(true)

    try {
      await changePasswordApi(token, { currentPassword, newPassword })
      setPasswordMsg({ text: "Password updated successfully!", error: false })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      setPasswordMsg({
        text: err instanceof Error ? err.message : "Failed to update password.",
        error: true,
      })
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  // Request 6-Digit OTP Email Handler
  const handleSendOtpEmail = async () => {
    const targetEmail = user?.email
    if (!targetEmail) return
    setPasswordMsg({ text: "", error: false })
    setIsSendingOtp(true)

    try {
      await forgotPasswordApi(targetEmail)
      setOtpSent(true)
      setPasswordMsg({
        text: `6-digit OTP code sent to ${targetEmail}! Check your inbox.`,
        error: false,
      })
    } catch (err) {
      setPasswordMsg({
        text: err instanceof Error ? err.message : "Failed to send OTP code.",
        error: true,
      })
    } finally {
      setIsSendingOtp(false)
    }
  }

  // Verify OTP & Reset Password Handler
  const handleOtpResetSubmit = async (e) => {
    e.preventDefault()
    setPasswordMsg({ text: "", error: false })

    if (otpNewPassword !== otpConfirmPassword) {
      setPasswordMsg({ text: "New passwords do not match.", error: true })
      return
    }

    setIsResettingWithOtp(true)

    try {
      await resetPasswordWithOtpApi({
        email: user?.email,
        otp: otpCode,
        newPassword: otpNewPassword,
      })
      setPasswordMsg({ text: "Password reset successfully via OTP code!", error: false })
      setOtpCode("")
      setOtpNewPassword("")
      setOtpConfirmPassword("")
      setOtpSent(false)
      setPasswordMode("direct")
    } catch (err) {
      setPasswordMsg({
        text: err instanceof Error ? err.message : "Invalid or expired OTP code.",
        error: true,
      })
    } finally {
      setIsResettingWithOtp(false)
    }
  }

  // WebAuthn Passkey Registration Handler
  const handleRegisterPasskey = async () => {
    setPasskeyMsg({ text: "", error: false })
    setIsRegisteringPasskey(true)

    try {
      const optionsRes = await getPasskeyRegisterOptionsApi(token)
      const options = optionsRes?.data

      if (!options) {
        throw new Error("Failed to receive WebAuthn registration options from server.")
      }

      const registrationResponse = await startRegistration(options)

      await verifyPasskeyRegisterApi(token, {
        credential: registrationResponse,
        expectedChallenge: options.challenge,
      })

      await loadPasskeys()

      setPasskeyMsg({
        text: "Device fingerprint / Passkey registered successfully!",
        error: false,
      })
    } catch (err) {
      setPasskeyMsg({
        text: err instanceof Error ? err.message : "Passkey registration cancelled or failed.",
        error: true,
      })
    } finally {
      setIsRegisteringPasskey(false)
    }
  }

  // Passkey Deletion Handler
  const handleDeletePasskey = async (id) => {
    try {
      await deletePasskeyApi(token, id)
      setPasskeyMsg({ text: "Passkey removed successfully.", error: false })
      await loadPasskeys()
    } catch (err) {
      setPasskeyMsg({
        text: err instanceof Error ? err.message : "Failed to remove passkey.",
        error: true,
      })
    }
  }

  const userInitials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "ST"

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Account & Security Settings</h1>
        <p className="text-sm text-zinc-400 mt-2">
          Manage your store operational profile, establishment details, password authentication, and biometric passkeys.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_.4fr] gap-8">
        <div className="space-y-8">
          {/* Section 01: Dynamic Store Establishment Settings (Rendered ONLY for OWNER role) */}
          {isOwner && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-400 font-mono font-bold">OWNER</span>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Store className="h-4 w-4 text-amber-400" />
                  Store Establishment Details
                </h2>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>

              {isStoreLoading ? (
                <div className="p-8 text-center bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center gap-2 text-zinc-400 text-xs">
                  <LoaderCircle className="h-4 w-4 animate-spin text-amber-400" /> Loading linked store configuration...
                </div>
              ) : !store ? (
                /* Dynamic UI when NO store is linked with the OWNER user */
                <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
                  <CardContent className="py-8 text-center space-y-3">
                    <Store className="h-10 w-10 text-amber-400 mx-auto" />
                    <h3 className="text-base font-bold text-white">No Store Linked to Your Account</h3>
                    <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                      Your account role is <strong className="text-amber-400 font-mono">OWNER</strong>, but no store establishment is currently linked to your profile in the database.
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      To configure POS settings or digital menus, please onboard or link a store from the Admin console.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                /* Dynamic Store Configuration Form when store is linked */
                <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 relative overflow-hidden">
  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-zinc-400 to-transparent" />
  
  <CardHeader>
    <div className="flex items-center justify-between">
      <div>
        <CardTitle className="text-base text-white flex items-center gap-2">
          <Building2 className="h-5 w-5 text-zinc-300" /> {store.name}
        </CardTitle>
        <CardDescription className="text-sm text-zinc-500">
          Configure store details, hours, theme, and billing
        </CardDescription>
      </div>
      <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider bg-zinc-800 px-2 py-1 rounded-md">
        Linked Store
      </span>
    </div>
  </CardHeader>

  <CardContent>
    <form onSubmit={handleStoreSubmit} className="space-y-8">
      {storeMsg.text && (
        <div
          className={`flex items-center gap-2 text-sm rounded-lg px-4 py-3 border ${
            storeMsg.error
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}
        >
          {storeMsg.error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {storeMsg.text}
        </div>
      )}

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="group relative">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                Store Name *
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base px-0 py-3 focus:border-zinc-400 outline-none transition-colors"
                required
              />
            </div>

            <div className="group relative">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                Menu URL Slug
              </label>
              <input
                type="text"
                placeholder="e.g. royal-punjab-dhaba"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base px-0 py-3 focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600 font-mono"
              />
            </div>
          </div>

          <div className="group relative">
            <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
              <Clock className="h-4 w-4 inline mr-1.5" /> Operating Hours
            </label>
            <input
              type="text"
              placeholder="e.g. Mon-Sun: 10:00 AM - 11:00 PM"
              value={operatingHours}
              onChange={(e) => setOperatingHours(e.target.value)}
              className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base px-0 py-3 focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600"
            />
          </div>

          <div className="group relative">
            <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
              Description
            </label>
            <input
              type="text"
              placeholder="Authentic Wood-fired Pizza & Italian Dining"
              value={storeDescription}
              onChange={(e) => setStoreDescription(e.target.value)}
              className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base px-0 py-3 focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600"
            />
          </div>
        </div>
      </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="group relative">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                <ImageIcon className="h-4 w-4 inline mr-1.5" /> Logo URL
              </label>
              <input
                type="url"
                placeholder="https://example.com/logo.png"
                value={brandingLogo}
                onChange={(e) => setBrandingLogo(e.target.value)}
                className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base px-0 py-3 focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600"
              />
            </div>

            <div className="group relative">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                <Type className="h-4 w-4 inline mr-1.5" /> Font Style
              </label>
              <select
                value={fontStyle}
                onChange={(e) => setFontStyle(e.target.value)}
                className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base py-3 focus:border-zinc-400 outline-none transition-colors cursor-pointer"
              >
                {fontOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-zinc-900">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="group relative">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
                <Palette className="h-4 w-4 inline mr-1.5" /> Accent Color
              </label>
              <div className="flex items-center gap-3 py-2">
                <input
                  type="color"
                  value={colorScheme}
                  onChange={(e) => setColorScheme(e.target.value)}
                  className="h-10 w-16 bg-zinc-950 border border-zinc-800 rounded cursor-pointer p-1"
                />
                <input
                  type="text"
                  value={colorScheme}
                  onChange={(e) => setColorScheme(e.target.value)}
                  className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-sm px-0 py-3 focus:border-zinc-400 outline-none transition-colors font-mono"
                />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-1.5">
            <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">
              Font Preview ({fontStyle})
            </span>
            <p className="text-base font-bold text-white" style={{ fontFamily: fontStyle }}>
              {storeName || "Store Menu Header Preview"}
            </p>
            <p className="text-sm text-zinc-500" style={{ fontFamily: fontStyle }}>
              {storeDescription || "Freshly baked artisanal Margherita Pizza with creamy mozzarella & basil."}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 pt-8 border-t border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
            <Receipt className="h-5 w-5 text-zinc-300" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Tax & Billing</h2>
            <p className="text-sm text-zinc-500">Configure GST, tax type, and coupons</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pl-13">
          <div className="group relative">
            <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
              GSTIN Number
            </label>
            <input
              type="text"
              placeholder="27AAAAA0000A1Z5"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base px-0 py-3 focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600 font-mono"
            />
          </div>

          <div className="group relative">
            <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
              Tax Type
            </label>
            <select
              value={taxType}
              onChange={(e) => setTaxType(e.target.value)}
              className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base py-3 focus:border-zinc-400 outline-none transition-colors cursor-pointer"
            >
              <option value="FORWARD" className="bg-zinc-900">Forward (Exclusive)</option>
              <option value="BACKWARD" className="bg-zinc-900">Backward (Inclusive)</option>
            </select>
          </div>

          <div className="group relative">
            <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
              Tax Value Unit
            </label>
            <select
              value={taxValueType}
              onChange={(e) => setTaxValueType(e.target.value)}
              className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base py-3 focus:border-zinc-400 outline-none transition-colors cursor-pointer"
            >
              <option value="PERCENTAGE" className="bg-zinc-900">Percentage (%)</option>
              <option value="FIXED" className="bg-zinc-900">Fixed (₹)</option>
            </select>
          </div>

          <div className="group relative">
            <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
              Tax Value
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="5"
              value={taxValue}
              onChange={(e) => setTaxValue(e.target.value)}
              className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base px-0 py-3 focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600 font-mono"
            />
          </div>

          <div className="group relative">
            <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
              Service Fee (₹)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="10"
              value={serviceFee}
              onChange={(e) => setServiceFee(e.target.value)}
              className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base px-0 py-3 focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600 font-mono"
            />
          </div>

          <div className="group relative">
            <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
              Coupon Code
            </label>
            <input
              type="text"
              placeholder="WELCOME10"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base px-0 py-3 focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600 uppercase font-mono"
            />
          </div>

          <div className="group relative">
            <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
              Coupon Type
            </label>
            <select
              value={couponValueType}
              onChange={(e) => setCouponValueType(e.target.value)}
              className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base py-3 focus:border-zinc-400 outline-none transition-colors cursor-pointer"
            >
              <option value="PERCENTAGE" className="bg-zinc-900">Percentage (%)</option>
              <option value="FIXED" className="bg-zinc-900">Fixed (₹)</option>
            </select>
          </div>

          <div className="group relative">
            <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2 block">
              Coupon Value
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="10"
              value={couponValue}
              onChange={(e) => setCouponValue(e.target.value)}
              className="w-full bg-transparent border-0 border-b-2 border-zinc-800 text-white text-base px-0 py-3 focus:border-zinc-400 outline-none transition-colors placeholder:text-zinc-600 font-mono"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-8 border-t border-zinc-800">
        <Button
          type="submit"
          disabled={isUpdatingStore}
          className="bg-white hover:bg-zinc-200 text-zinc-900 font-medium text-sm gap-2 px-6 py-2"
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
    </form>
  </CardContent>
</Card>
              )}
            </section>
          )}

          {/* Section 02: Staff Profile Settings */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">02</span>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <User className="h-4 w-4 text-amber-400" />
                Staff Profile Settings
              </h2>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base text-white">Operational Account</CardTitle>
                    <CardDescription className="text-zinc-400 text-xs">Update your display name, avatar, and review staff privileges.</CardDescription>
                  </div>
                  <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 text-xs font-mono uppercase">
                    {user?.role || "WAITER"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileSubmit} className="space-y-6">
                  {profileMsg.text && (
                    <div
                      className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 border ${
                        profileMsg.error
                          ? "bg-red-500/10 border-red-500/20 text-red-400"
                          : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      }`}
                    >
                      {profileMsg.error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      {profileMsg.text}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl bg-zinc-950/60 border border-zinc-800">
                    <Avatar className="h-16 w-16 border-2 border-zinc-700 bg-zinc-800">
                      <AvatarImage src={avatar || user?.avatar || "https://i.pinimg.com/736x/37/38/9d/37389de7d25c8162cbb084a11cb5f218.jpg"} alt="Avatar" />
                      <AvatarFallback className="bg-amber-500 text-zinc-950 font-bold text-lg">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 w-full space-y-2">
                      <Label htmlFor="avatar" className="text-zinc-200 text-xs">
                        Avatar Image URL
                      </Label>
                      <Input
                        id="avatar"
                        type="url"
                        placeholder="https://example.com/avatar.jpg"
                        value={avatar}
                        onChange={(e) => setAvatar(e.target.value)}
                        className="bg-zinc-900 border-zinc-800 text-white text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-zinc-200">
                        Full Name
                      </Label>
                      <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-zinc-950 border-zinc-800 text-white"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-zinc-200">
                        Email Address (Account ID)
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={user?.email || "staff@restaurant.com"}
                        disabled
                        className="bg-zinc-950/50 border-zinc-800/80 text-zinc-400 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={isUpdatingProfile}
                      className="bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs gap-2"
                    >
                      {isUpdatingProfile ? (
                        <>
                          <LoaderCircle className="h-4 w-4 animate-spin" /> Saving...
                        </>
                      ) : (
                        "Save Profile Changes"
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </section>

          {/* Section 03: Password */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">03</span>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Key className="h-4 w-4 text-amber-400" />
                Password & Authentication
              </h2>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base text-white">Change Password</CardTitle>
                    <CardDescription className="text-zinc-400 text-xs">
                      Update your password directly or request a 6-digit OTP code to your email.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={passwordMode === "direct" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setPasswordMode("direct")}
                      className="text-xs h-8"
                    >
                      Direct Password
                    </Button>
                    <Button
                      type="button"
                      variant={passwordMode === "otp" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setPasswordMode("otp")}
                      className="text-xs h-8 gap-1.5"
                    >
                      <Mail className="h-3.5 w-3.5" /> OTP Code Reset
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {passwordMsg.text && (
                  <div
                    className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 border mb-4 ${
                      passwordMsg.error
                        ? "bg-red-500/10 border-red-500/20 text-red-400"
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    {passwordMsg.error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    {passwordMsg.text}
                  </div>
                )}

                {passwordMode === "direct" ? (
                  /* Direct Password Change */
                  <form onSubmit={handlePasswordSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="bg-zinc-950 border-zinc-800 text-white"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="bg-zinc-950 border-zinc-800 text-white"
                          minLength={6}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="bg-zinc-950 border-zinc-800 text-white"
                          minLength={6}
                          required
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        type="submit"
                        disabled={isUpdatingPassword}
                        variant="outline"
                        className="border-zinc-700 text-zinc-200 hover:bg-zinc-800 text-xs"
                      >
                        {isUpdatingPassword ? (
                          <>
                            <LoaderCircle className="h-4 w-4 animate-spin" /> Updating...
                          </>
                        ) : (
                          "Update Password"
                        )}
                      </Button>
                    </div>
                  </form>
                ) : (
                  /* OTP Code Password Reset */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-950/60 border border-zinc-800">
                      <div>
                        <p className="text-sm font-medium text-white">Send 6-Digit Verification OTP</p>
                        <p className="text-xs text-zinc-400">
                          Dispatches a 6-digit code to <strong>{user?.email || "staff@restaurant.com"}</strong>.
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={handleSendOtpEmail}
                        disabled={isSendingOtp}
                        className="bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold gap-2 text-xs h-9"
                      >
                        {isSendingOtp ? (
                          <>
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Sending...
                          </>
                        ) : (
                          <>
                            <Mail className="h-3.5 w-3.5" /> Send OTP Code
                          </>
                        )}
                      </Button>
                    </div>

                    {otpSent && (
                      <form onSubmit={handleOtpResetSubmit} className="space-y-4 pt-2">
                        <div className="space-y-2">
                          <Label htmlFor="otpCode" className="text-amber-400 font-semibold text-xs">
                            Enter 6-Digit OTP Code
                          </Label>
                          <Input
                            id="otpCode"
                            type="text"
                            placeholder="123456"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            className="bg-zinc-950 border-amber-500/50 text-white font-mono tracking-widest text-center text-lg font-bold"
                            maxLength={6}
                            required
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="otpNewPassword">New Password</Label>
                            <Input
                              id="otpNewPassword"
                              type="password"
                              value={otpNewPassword}
                              onChange={(e) => setOtpNewPassword(e.target.value)}
                              className="bg-zinc-950 border-zinc-800 text-white"
                              minLength={6}
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="otpConfirmPassword">Confirm New Password</Label>
                            <Input
                              id="otpConfirmPassword"
                              type="password"
                              value={otpConfirmPassword}
                              onChange={(e) => setOtpConfirmPassword(e.target.value)}
                              className="bg-zinc-950 border-zinc-800 text-white"
                              minLength={6}
                              required
                            />
                          </div>
                        </div>

                        <div className="flex justify-end pt-2">
                          <Button
                            type="submit"
                            disabled={isResettingWithOtp || otpCode.length !== 6}
                            className="bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs gap-2"
                          >
                            {isResettingWithOtp ? (
                              <>
                                <LoaderCircle className="h-4 w-4 animate-spin" /> Resetting...
                              </>
                            ) : (
                              <>
                                <Lock className="h-4 w-4" /> Reset Password with OTP
                              </>
                            )}
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Section 04: Passkeys & Security */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">04</span>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-amber-400" />
                Biometric Passkeys & Security
              </h2>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-zinc-800 border border-zinc-700">
                      <Shield className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base text-white">Device Fingerprint & Passkeys</CardTitle>
                      <CardDescription className="text-zinc-400 text-xs">
                        Log in passwordlessly using Touch ID, Face ID, Windows Hello, or hardware security keys.
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    onClick={handleRegisterPasskey}
                    disabled={isRegisteringPasskey}
                    className="bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs gap-2"
                  >
                    {isRegisteringPasskey ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" /> Prompting...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" /> Register Passkey
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {passkeyMsg.text && (
                  <div
                    className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 border ${
                      passkeyMsg.error
                        ? "bg-red-500/10 border-red-500/20 text-red-400"
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    {passkeyMsg.error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    {passkeyMsg.text}
                  </div>
                )}

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Registered Credentials ({registeredPasskeys.length})
                  </h3>

                  {registeredPasskeys.length === 0 ? (
                    <div className="text-center py-6 px-4 rounded-lg bg-zinc-950/40 border border-zinc-800/80">
                      <Fingerprint className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                      <p className="text-xs text-zinc-400 font-medium">No passkeys registered yet.</p>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        Click &quot;Register Passkey&quot; above to link your biometric device or hardware token.
                      </p>
                    </div>
                  ) : (
                    registeredPasskeys.map((passkey) => (
                      <div
                        key={passkey.id || passkey.credentialId}
                        className="flex items-center justify-between p-4 rounded-lg bg-zinc-950/60 border border-zinc-800"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-md bg-zinc-800 text-zinc-300">
                            <Laptop className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {passkey.deviceName || `Device Passkey (${(passkey.credentialId || passkey.id).slice(0, 8)}...)`}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {passkey.createdAt ? new Date(passkey.createdAt).toISOString().split("T")[0] : "Active"} •{" "}
                              {Array.isArray(passkey.transports)
                                ? passkey.transports.join(", ")
                                : typeof passkey.transports === "string"
                                ? passkey.transports
                                : "internal"}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePasskey(passkey.id || passkey.credentialId)}
                          className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-4 border-t border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">Require Passkey for High-Privilege Actions</p>
                      <p className="text-xs text-zinc-400">Require WebAuthn biometric check when modifying kitchen tickets or staff permissions.</p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">Order Security Alerts</p>
                      <p className="text-xs text-zinc-400">Receive instant alerts for high-value orders and table bill adjustments.</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>

        {/* Right Sticky Sidebar */}
        <div className="space-y-6 lg:sticky lg:top-6 h-fit">
          {/* Conditional Store Mobile/QR Preview Card for OWNER accounts */}
          {isOwner && store && (
            <Card className="bg-zinc-900 border-amber-500/30 text-zinc-100 overflow-hidden">
              <CardHeader className="pb-3 border-b border-zinc-800 bg-zinc-950/40">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs text-amber-400 font-bold flex items-center gap-1.5 uppercase tracking-wider font-mono">
                    <QrCode className="h-3.5 w-3.5" /> Customer Menu Preview
                  </CardTitle>
                  <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px] font-mono">
                    LIVE PREVIEW
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Mobile Screen Mockup */}
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3 relative overflow-hidden">
                  <div
                    className="absolute top-0 left-0 right-0 h-1.5"
                    style={{ backgroundColor: colorScheme || "#f59e0b" }}
                  />

                  <div className="flex items-center gap-3 pt-1">
                    {brandingLogo ? (
                      <img
                        src={brandingLogo}
                        alt="Store Logo"
                        className="h-10 w-10 rounded-lg object-cover border border-zinc-800 shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400 font-bold shrink-0">
                        <Store className="h-5 w-5" />
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <h4
                        className="text-sm font-bold text-white truncate"
                        style={{ fontFamily: fontStyle }}
                      >
                        {storeName || store.name}
                      </h4>
                      <p
                        className="text-[11px] text-zinc-400 truncate"
                        style={{ fontFamily: fontStyle }}
                      >
                        {storeDescription || "Digital QR Ordering Menu"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-zinc-500 border-t border-zinc-900 pt-2">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-zinc-400" /> {operatingHours || "Open All Day"}
                    </span>
                    <span className="font-mono text-amber-400 font-semibold">{fontStyle}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Customer View Ready</span>
                  <a
                    href={`http://localhost:5173/store/${store.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium"
                  >
                    Launch Menu <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Account Summary Card */}
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm text-zinc-400 font-medium">Account Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border border-zinc-700 bg-zinc-800">
                  <AvatarImage src={avatar || user?.avatar || "https://i.pinimg.com/736x/37/38/9d/37389de7d25c8162cbb084a11cb5f218.jpg"} alt="Avatar" />
                  <AvatarFallback className="bg-amber-500 text-zinc-950 font-bold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-white">{user?.name || "Store Staff"}</p>
                  <p className="text-xs text-zinc-500">{user?.email || "staff@restaurant.com"}</p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Assigned Role</span>
                  <span className="text-amber-400 font-mono font-bold uppercase">{user?.role || "WAITER"}</span>
                </div>
                {isOwner && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Store</span>
                    <span className="text-white font-semibold truncate max-w-28">
                      {store ? store.name : "Unlinked"}
                    </span>
                  </div>
                )}
                {isOwner && store && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Font Theme</span>
                    <span className="text-amber-400 font-medium">{fontStyle}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Registered Passkeys</span>
                  <span className="text-zinc-200 font-medium">{registeredPasskeys.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Security Status</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Active Session
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Best Practices Card */}
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm text-zinc-400 font-medium">Security Best Practices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-zinc-400 leading-relaxed">
                • Always lock or log out of terminal when leaving POS floor
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                • Link a biometric fingerprint / passkey for quick POS unlock
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                • Report unrecognized order voids to your store manager
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
