import React, { useState, useEffect } from "react"
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
} from "lucide-react"
import { startRegistration } from "@simplewebauthn/browser"
import { useAuth } from "../context/auth-context.jsx"
import {
  changePasswordApi,
  forgotPasswordApi,
  resetPasswordWithOtpApi,
  getPasskeyRegisterOptionsApi,
  verifyPasskeyRegisterApi,
} from "../services/auth-api.js"

export default function SettingsPage() {
  const { user, token, updateProfile } = useAuth()

  // Profile Form State
  const [name, setName] = useState(user?.name || "")
  const [avatar, setAvatar] = useState(user?.avatar || "")
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState({ text: "", error: false })

  // Keep state synced with context user
  useEffect(() => {
    if (user) {
      if (user.name) setName(user.name)
      if (user.avatar) setAvatar(user.avatar)
    }
  }, [user])

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

  // Dynamic Passkeys State
  const [registeredPasskeys, setRegisteredPasskeys] = useState(user?.passkeys || [])
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false)
  const [passkeyMsg, setPasskeyMsg] = useState({ text: "", error: false })

  useEffect(() => {
    if (user?.passkeys) {
      setRegisteredPasskeys(user.passkeys)
    }
  }, [user?.passkeys])

  // Profile Update Handler
  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setProfileMsg({ text: "", error: false })
    setIsUpdatingProfile(true)

    try {
      await updateProfile({ name, avatar })
      setProfileMsg({ text: "Profile updated successfully!", error: false })
    } catch (err) {
      setProfileMsg({
        text: err instanceof Error ? err.message : "Failed to update profile.",
        error: true,
      })
    } finally {
      setIsUpdatingProfile(false)
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
    const targetEmail = user?.email || "admin@scanmyorder.com"
    setPasswordMsg({ text: "", error: false })
    setIsSendingOtp(true)

    try {
      await forgotPasswordApi(targetEmail)
      setOtpSent(true)
      setPasswordMsg({
        text: `6-digit OTP code sent to ${targetEmail}! Check your email inbox.`,
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
        email: user?.email || "admin@scanmyorder.com",
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

      const newPasskey = {
        id: `pk_${Date.now()}`,
        credentialId: registrationResponse.id,
        deviceName: `${navigator.platform || "Biometric Device"} Passkey`,
        createdAt: new Date().toISOString().split("T")[0],
        transports: registrationResponse.response.transports || ["internal"],
      }

      setRegisteredPasskeys((prev) => [...prev, newPasskey])
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

  const handleDeletePasskey = (id) => {
    setRegisteredPasskeys((prev) => prev.filter((p) => (p.id || p.credentialId) !== id))
    setPasskeyMsg({ text: "Passkey removed.", error: false })
  }

  const userInitials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "AD"

  return (
    <div className="space-y-8 max-w-7xl w-full">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Account & Security Settings</h1>
        <p className="text-sm text-zinc-400 mt-2">
          Manage your administrator profile details, password authentication, and device fingerprint / WebAuthn passkeys.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        <div className="space-y-8">
          {/* Section 01: Profile Settings */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">01</span>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <User className="h-4 w-4 text-zinc-400" />
                Profile Settings
              </h2>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base text-white">Administrator Profile</CardTitle>
                    <CardDescription className="text-zinc-400 text-xs">Update your name, avatar, and view your assigned system role.</CardDescription>
                  </div>
                  <Badge className="bg-zinc-800 text-zinc-300 border border-zinc-700 px-3 py-1 text-xs">
                    {user?.role || "ADMIN"}
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
                      <AvatarFallback className="bg-zinc-700 text-white font-bold text-lg">
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
                        value={user?.email || "admin@scanmyorder.com"}
                        disabled
                        className="bg-zinc-950/50 border-zinc-800/80 text-zinc-400 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={isUpdatingProfile}
                      className="bg-zinc-200 hover:bg-zinc-100 text-zinc-900 gap-2"
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

          {/* Section 02: Password */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">02</span>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Key className="h-4 w-4 text-zinc-400" />
                Password
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
                  /* Option A: Direct Password Change */
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
                        className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
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
                  /* Option B: OTP Code Password Reset */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-950/60 border border-zinc-800">
                      <div>
                        <p className="text-sm font-medium text-white">Send 6-Digit Verification OTP</p>
                        <p className="text-xs text-zinc-400">
                          Dispatches a secure 6-digit numeric code to <strong>{user?.email || "admin@scanmyorder.com"}</strong>.
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={handleSendOtpEmail}
                        disabled={isSendingOtp}
                        className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold gap-2 text-xs h-9"
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
                          <Label htmlFor="otpCode" className="text-yellow-400 font-semibold text-xs">
                            Enter 6-Digit OTP Code
                          </Label>
                          <Input
                            id="otpCode"
                            type="text"
                            placeholder="123456"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            className="bg-zinc-950 border-yellow-500/50 text-white font-mono tracking-widest text-center text-lg font-bold"
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
                            className="bg-zinc-200 hover:bg-zinc-100 text-zinc-900 font-bold gap-2"
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

          {/* Section 03: Passkeys & Security */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">03</span>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-zinc-400" />
                Device Passkey & Security
              </h2>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-zinc-800 border border-zinc-700">
                      <Shield className="h-5 w-5 text-zinc-300" />
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
                    className="bg-zinc-200 hover:bg-zinc-100 text-zinc-900 gap-2"
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
                      <p className="text-sm font-medium text-white">Require Passkey for Admin Operations</p>
                      <p className="text-xs text-zinc-400">Force WebAuthn device verification when performing sensitive system actions.</p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">Security & Sign-In Alerts</p>
                      <p className="text-xs text-zinc-400">Receive instant email notifications when new device sign-ins occur.</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>

        {/* Sidebar Summary */}
        <div className="space-y-6 lg:sticky lg:top-6 h-fit">
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm text-zinc-400 font-medium">Account Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border border-zinc-700 bg-zinc-800">
                  <AvatarImage src={avatar || user?.avatar || "https://github.com/evilrabbit.png"} alt="Avatar" />
                  <AvatarFallback className="bg-zinc-700 text-white font-bold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-white">{user?.name || "System Admin"}</p>
                  <p className="text-xs text-zinc-500">{user?.email || "admin@scanmyorder.com"}</p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Role</span>
                  <span className="text-zinc-200 font-medium">{user?.role || "ADMIN"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Passkeys</span>
                  <span className="text-zinc-200 font-medium">{registeredPasskeys.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">2FA Status</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Enabled
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm text-zinc-400 font-medium">Security Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-zinc-400 leading-relaxed">
                • Use a unique password for this account
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                • Enable passkeys for passwordless login
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                • Review sign-in alerts regularly
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}