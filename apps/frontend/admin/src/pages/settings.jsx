import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import { startRegistration } from '@simplewebauthn/browser';
import { Card, CardContent, Button, Input, Label, Skeleton } from '@smo/ui';
import {
  Settings01Icon,
  UserIcon,
  Shield01Icon,
  Delete01Icon,
  PlusSignIcon,
  Loading03Icon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  FingerPrintIcon,
  LaptopIcon
} from 'hugeicons-react';

export const Settings = () => {
  const { user, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [profilePhoto, setProfilePhoto] = useState(user?.profilePhoto || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ text: '', error: false });

  const [isRegistering, setIsRegistering] = useState(false);
  const [passkeys, setPasskeys] = useState([]);
  const [isLoadingPasskeys, setIsLoadingPasskeys] = useState(false);
  const [passkeyMsg, setPasskeyMsg] = useState({ text: '', error: false });

  const fetchPasskeys = async () => {
    setIsLoadingPasskeys(true);
    try {
      const response = await api.get('/auth/passkeys');
      if (response.data.success) {
        setPasskeys(Array.isArray(response.data.data) ? response.data.data : []);
      }
    } catch (error) {
      console.error("Failed to load passkeys:", error);
      setPasskeys([]);
    } finally {
      setIsLoadingPasskeys(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPasskeys();
    }
  }, [user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    setProfileMsg({ text: '', error: false });
    try {
      const response = await api.patch(`/users/${user.id}`, { name, profilePhoto });
      if (response.data.success) {
        updateUser({ name, profilePhoto });
        setProfileMsg({ text: 'Profile updated successfully!', error: false });
      }
    } catch (error) {
      setProfileMsg({
        text: "Failed to update profile: " + (error.response?.data?.error?.message || error.message),
        error: true
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRegisterPasskey = async () => {
    setIsRegistering(true);
    setPasskeyMsg({ text: '', error: false });
    try {
      const optionsResponse = await api.get('/auth/passkeys/register-options');
      const options = optionsResponse.data.data;

      let attResp;
      try {
        attResp = await startRegistration({ optionsJSON: options });
      } catch (error) {
        if (error.name === 'InvalidStateError') {
          setPasskeyMsg({ text: 'Authenticator was already registered.', error: true });
        } else {
          setPasskeyMsg({ text: 'Failed to register passkey: ' + error.message, error: true });
        }
        return;
      }

      const verificationResponse = await api.post('/auth/passkeys/register', attResp);

      if (verificationResponse.data.success) {
        setPasskeyMsg({ text: 'Passkey registered successfully!', error: false });
        fetchPasskeys();
      }
    } catch (error) {
      console.error(error);
      setPasskeyMsg({
        text: "Registration failed: " + (error.response?.data?.error?.message || error.message),
        error: true
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDeletePasskey = async (id) => {
    if (!window.confirm("Are you sure you want to delete this passkey?")) return;
    try {
      const response = await api.delete(`/auth/passkeys/${id}`);
      if (response.data.success) {
        setPasskeys(passkeys.filter(p => p.id !== id));
        setPasskeyMsg({ text: 'Passkey removed.', error: false });
      }
    } catch (error) {
      setPasskeyMsg({ text: 'Failed to delete passkey.', error: true });
      console.error(error);
    }
  };

  const formatDate = (date) => {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return '—';
    }
  };

  const userInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || 'US';

  return (
    <div className="space-y-8 w-full">
      <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
          <Settings01Icon className="text-zinc-900 dark:text-zinc-100" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Settings</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage your profile and security preferences</p>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-mono">01</span>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <UserIcon size={16} className="text-zinc-500" />
            Profile
          </h3>
          <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Form */}
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <CardContent className="p-6">
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                {profileMsg.text && (
                  <div
                    className={`flex items-center gap-2 text-sm rounded-lg px-4 py-3 border ${profileMsg.error
                        ? "bg-red-500/10 border-red-500/20 text-red-400"
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      }`}
                  >
                    {profileMsg.error ? <AlertCircleIcon size={16} /> : <CheckmarkCircle02Icon size={16} />}
                    {profileMsg.text}
                  </div>
                )}

                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-zinc-600 dark:text-zinc-400">Email</Label>
                    <Input id="email" type="email" value={user?.email || ''} disabled className="bg-zinc-50 dark:bg-zinc-900 cursor-not-allowed text-zinc-400" />
                    <p className="text-xs text-zinc-400">Email cannot be changed.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-zinc-600 dark:text-zinc-400">Full Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="photo" className="text-zinc-600 dark:text-zinc-400">Profile Photo URL</Label>
                    <Input
                      id="photo"
                      value={profilePhoto}
                      onChange={(e) => setProfilePhoto(e.target.value)}
                      placeholder="https://example.com/avatar.jpg"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating ? (
                      <>
                        <Loading03Icon className="animate-spin" size={16} /> Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Right Column - Live Preview */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-mono">Preview</span>
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
            </div>

            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
              <CardContent className="p-6">
                {/* Profile Card Preview */}
                <div className="space-y-6">
                  {/* Cover Area */}
                  <div className="relative">
                    <div className="h-32 rounded-lg bg-gradient-to-r from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-purple-500/10" />
                    </div>

                    {/* Avatar */}
                    <div className="absolute -bottom-8 left-6">
                      {profilePhoto ? (
                        <img
                          src={profilePhoto}
                          alt={name || 'Profile'}
                          className="w-20 h-20 rounded-full object-cover border-4 border-white dark:border-zinc-950 bg-white dark:bg-zinc-900"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-purple-500 flex items-center justify-center font-bold text-2xl text-white border-4 border-white dark:border-zinc-950">
                          {userInitials}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Profile Info */}
                  <div className="pt-4 space-y-4">
                    <div className="text-left">
                      <h4 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                        {name || user?.name || 'User Name'}
                      </h4>
                      <p className="text-sm text-zinc-500 mt-1">{user?.email}</p>
                    </div>

                  </div>
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-zinc-400 text-center">
              This is how your profile will appear to others
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4 pt-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-mono">02</span>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Shield01Icon size={16} className="text-zinc-500" />
            Security & Passkeys
          </h3>
          <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
          <CardContent className="p-6 space-y-6">
            {passkeyMsg.text && (
              <div
                className={`flex items-center gap-2 text-sm rounded-lg px-4 py-3 border ${passkeyMsg.error
                    ? "bg-red-500/10 border-red-500/20 text-red-400"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  }`}
              >
                {passkeyMsg.error ? <AlertCircleIcon size={16} /> : <CheckmarkCircle02Icon size={16} />}
                {passkeyMsg.text}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Registered Passkeys</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Use Touch ID, Face ID, or Windows Hello
                </p>
              </div>
              <Button onClick={handleRegisterPasskey} disabled={isRegistering} size="sm">
                {isRegistering ? (
                  <>
                    <Loading03Icon className="animate-spin" size={14} /> Registering...
                  </>
                ) : (
                  <>
                    <PlusSignIcon size={14} /> Add Passkey
                  </>
                )}
              </Button>
            </div>

            {isLoadingPasskeys ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full bg-zinc-100 dark:bg-zinc-800" />
                <Skeleton className="h-14 w-full bg-zinc-100 dark:bg-zinc-800" />
              </div>
            ) : passkeys.length === 0 ? (
              <div className="p-8 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 text-center">
                <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                  <FingerPrintIcon className="h-6 w-6 text-zinc-400" />
                </div>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">No passkeys registered yet</p>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Passkeys are a safer alternative to passwords. Register one to sign in without typing your password.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {passkeys.map(passkey => (
                  <div key={passkey.id} className="flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <LaptopIcon className="text-zinc-500" size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          Passkey added {formatDate(passkey.createdAt)}
                        </p>
                        <p className="text-xs text-zinc-500">
                          Last used: {passkey.lastUsedAt ? formatDate(passkey.lastUsedAt) : 'Never'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeletePasskey(passkey.id)}
                      className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Delete01Icon size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
};