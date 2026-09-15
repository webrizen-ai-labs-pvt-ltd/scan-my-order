import React, { useState } from 'react';
import api from '../lib/api';
import {
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@smo/ui';
import {
  Cancel01Icon,
  Store01Icon,
  UserIcon,
  Mail01Icon,
  Call02Icon,
  LockPasswordIcon,
  ViewIcon,
  ViewOffIcon,
  SparklesIcon,
  Tick02Icon,
  ArrowRight01Icon,
  ArrowLeft01Icon,
  Shield01Icon,
  CashierIcon,
  Dish01Icon,
  Pot02Icon,
  UserGroupIcon,
  InformationCircleIcon,
} from 'hugeicons-react';

const ROLES = [
  {
    value: 'STORE_MANAGER',
    label: 'Store Manager',
    description: 'Inventory, POS, KDS, staff & tables',
    icon: Store01Icon,
  },
  {
    value: 'CASHIER',
    label: 'Cashier',
    description: 'POS terminal, billing & order history',
    icon: CashierIcon,
  },
  {
    value: 'WAITER',
    label: 'Waiter / Captain',
    description: 'Waiter panel, tableside ordering & guest calls',
    icon: Dish01Icon,
  },
  {
    value: 'KITCHEN_STAFF',
    label: 'Kitchen Staff',
    description: 'Kitchen Display System (KDS)',
    icon: Pot02Icon,
  },
  {
    value: 'TENANT_ADMIN',
    label: 'Tenant Administrator',
    description: 'Full access to brand operations & all stores',
    icon: Shield01Icon,
  },
];

const STEPS = [
  { id: 1, key: 'identity', label: 'Identity', hint: 'Name & contact' },
  { id: 2, key: 'access', label: 'Access', hint: 'Role & store' },
  { id: 3, key: 'credentials', label: 'Credentials', hint: 'Password & status' },
];

const LABEL_CLASS =
  'mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300';

const CONTROL_CLASS =
  'h-10 rounded-md border-zinc-300 bg-white text-sm focus-visible:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-900';

export const EmployeeOnboardModal = ({
  isOpen,
  onClose,
  stores = [],
  onSuccess,
}) => {
  const [step, setStep] = useState(1);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('WAITER');
  const [storeId, setStoreId] = useState(stores[0]?.id || '');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const isStoreScoped = role !== 'TENANT_ADMIN';
  const selectedRole = ROLES.find((r) => r.value === role);

  const generateRandomPassword = () => {
    const chars =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let res = '';
    for (let i = 0; i < 10; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(res);
    setShowPassword(true);
  };

  const validateStep = (stepId) => {
    setError('');
    if (stepId === 1) {
      if (!name.trim()) return 'Please provide the employee full name';
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return 'Please provide a valid email address';
    }
    if (stepId === 2) {
      if (!role) return 'Please choose an operational role';
      if (isStoreScoped && !storeId)
        return 'Please assign the employee to a store location';
    }
    if (stepId === 3) {
      if (!password || password.length < 8)
        return 'Password must be at least 8 characters long';
    }
    return '';
  };

  const goNext = () => {
    const msg = validateStep(step);
    if (msg) {
      setError(msg);
      return;
    }
    setError('');
    setStep((s) => Math.min(3, s + 1));
  };

  const goBack = () => {
    setError('');
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    for (const s of [1, 2, 3]) {
      const msg = validateStep(s);
      if (msg) {
        setStep(s);
        setError(msg);
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        role,
        password,
        status,
        storeId: isStoreScoped ? storeId : undefined,
      };

      const res = await api.post('/users', payload);
      if (res.data.success) {
        onSuccess(res.data.data);
        onClose();
      } else {
        setError(res.data.error?.message || 'Failed to onboard employee');
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          err.message ||
          'Failed to onboard employee'
      );
    } finally {
      setLoading(false);
    }
  };

  const stepDone = (id) => {
    if (id === 1)
      return (
        name.trim() && email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      );
    if (id === 2) return role && (!isStoreScoped || storeId);
    if (id === 3) return password && password.length >= 8;
    return false;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-zinc-900/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex aspect-video max-h-[92vh] w-[min(96vw,1280px)] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-6 py-3.5 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-md bg-amber-400 text-zinc-950">
              <UserGroupIcon size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Onboard New Employee
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Step {step} of 3 — {STEPS[step - 1].label}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <Cancel01Icon size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            {/* Sidebar Stepper */}
            <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-zinc-50/60 p-5 md:flex md:flex-col dark:border-zinc-800 dark:bg-zinc-900/40">
              <ol className="flex flex-col gap-1">
                {STEPS.map((s) => {
                  const isActive = step === s.id;
                  const isDone = stepDone(s.id);
                  const isPast = step > s.id;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (s.id <= step || stepDone(s.id)) {
                            setError('');
                            setStep(s.id);
                          }
                        }}
                        className={`flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
                          isActive
                            ? 'bg-white shadow-sm ring-1 ring-amber-200 dark:bg-zinc-800 dark:ring-amber-900/50'
                            : 'hover:bg-white/60 dark:hover:bg-zinc-800/40'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                            isDone
                              ? 'border-amber-400 bg-amber-400 text-zinc-950'
                              : isActive
                              ? 'border-amber-500 bg-white text-amber-600 dark:bg-zinc-900 dark:text-amber-400'
                              : 'border-zinc-300 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'
                          }`}
                        >
                          {isDone && !isActive ? <Tick02Icon size={12} /> : s.id}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-xs font-semibold ${
                              isActive
                                ? 'text-zinc-900 dark:text-zinc-100'
                                : 'text-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            {s.label}
                          </span>
                          <span className="block text-[10px] text-zinc-500 dark:text-zinc-500">
                            {s.hint}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>

              {/* Live preview */}
              <div className="mt-6 flex-1 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Preview
                </p>
                <p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {name.trim() || 'New Employee'}
                </p>
                <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                  {email.trim() || 'email@restaurant.com'}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                    <selectedRole.icon size={10} />
                    {selectedRole.label}
                  </span>
                  {isStoreScoped && storeId && (
                    <span className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      <Store01Icon size={10} />
                      {stores.find((s) => s.id === storeId)?.name || '—'}
                    </span>
                  )}
                </div>
              </div>

              <p className="mt-4 text-[10px] leading-snug text-zinc-400 dark:text-zinc-500">
                All fields marked <span className="text-red-500">*</span> are
                required to onboard.
              </p>
            </aside>

            {/* Step Content */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
                {error && (
                  <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                  </div>
                )}

                {/* Mobile step indicator */}
                <div className="mb-5 flex items-center gap-2 md:hidden">
                  {STEPS.map((s) => (
                    <div
                      key={s.id}
                      className={`h-1 flex-1 rounded-full ${
                        step >= s.id
                          ? 'bg-amber-400'
                          : 'bg-zinc-200 dark:bg-zinc-800'
                      }`}
                    />
                  ))}
                </div>

                {/* STEP 1 — Identity */}
                {step === 1 && (
                  <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
                    {/* Form column (wider) */}
                    <div className="lg:col-span-3">
                      <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                        Who are we onboarding?
                      </h4>
                      <p className="mt-1 mb-6 text-xs text-zinc-500 dark:text-zinc-400">
                        Start with the essentials — this is how they'll appear
                        across the Operations Panel.
                      </p>

                      <div className="flex flex-col gap-5">
                        <div>
                          <label className={LABEL_CLASS}>
                            <UserIcon size={14} className="text-zinc-400" />
                            <span>
                              Full Name <span className="text-red-500">*</span>
                            </span>
                          </label>
                          <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Rahul Sharma"
                            autoFocus
                            className={CONTROL_CLASS}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                          <div>
                            <label className={LABEL_CLASS}>
                              <Mail01Icon size={14} className="text-zinc-400" />
                              <span>
                                Work Email{' '}
                                <span className="text-red-500">*</span>
                              </span>
                            </label>
                            <Input
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="staff@restaurant.com"
                              className={CONTROL_CLASS}
                            />
                          </div>
                          <div>
                            <label className={LABEL_CLASS}>
                              <Call02Icon size={14} className="text-zinc-400" />
                              <span>Phone Number</span>
                              <span className="ml-auto text-[10px] font-normal text-zinc-400">
                                Optional
                              </span>
                            </label>
                            <Input
                              type="tel"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              placeholder="+91 98765 43210"
                              className={CONTROL_CLASS}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Info column */}
                    <div className="lg:col-span-2">
                      <div className="rounded-md border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                        <div className="flex items-start gap-2.5">
                          <InformationCircleIcon
                            size={16}
                            className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                          />
                          <div className="space-y-3">
                            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                              What happens after onboarding?
                            </p>
                            <ul className="space-y-2 text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-200/80">
                              <li className="flex gap-2">
                                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-500" />
                                <span>
                                  A welcome email is sent with their sign-in
                                  credentials.
                                </span>
                              </li>
                              <li className="flex gap-2">
                                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-500" />
                                <span>
                                  They can access only the panels permitted by
                                  their role.
                                </span>
                              </li>
                              <li className="flex gap-2">
                                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-500" />
                                <span>
                                  You can change their role or status any time
                                  from the Employees page.
                                </span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2 — Access */}
                {step === 2 && (
                  <div>
                    <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      What should they be able to do?
                    </h4>
                    <p className="mt-1 mb-6 text-xs text-zinc-500 dark:text-zinc-400">
                      Pick a role. This determines which panels and actions
                      they'll have access to.
                    </p>

                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
                      {/* Role Gallery */}
                      <div className="lg:col-span-3">
                        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                          Operational Role
                        </p>
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          {ROLES.map((r) => {
                            const Icon = r.icon;
                            const selected = role === r.value;
                            return (
                              <button
                                key={r.value}
                                type="button"
                                onClick={() => setRole(r.value)}
                                className={`flex items-start gap-3 rounded-md border p-3 text-left transition-colors ${
                                  selected
                                    ? 'border-amber-400 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/30'
                                    : 'border-zinc-200 bg-white hover:border-amber-300 hover:bg-amber-50/40 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-amber-900 dark:hover:bg-amber-950/10'
                                }`}
                              >
                                <span
                                  className={`flex size-9 shrink-0 items-center justify-center rounded-md border ${
                                    selected
                                      ? 'border-amber-400 bg-amber-400 text-zinc-950'
                                      : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                                  }`}
                                >
                                  <Icon size={16} />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-1.5">
                                    <span className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                      {r.label}
                                    </span>
                                    {selected && (
                                      <Tick02Icon
                                        size={12}
                                        className="shrink-0 text-amber-600 dark:text-amber-400"
                                      />
                                    )}
                                  </span>
                                  <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                                    {r.description}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Store Assignment */}
                      <div className="lg:col-span-2">
                        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                          Store Assignment
                        </p>
                        {isStoreScoped ? (
                          <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                            <label className={LABEL_CLASS}>
                              <Store01Icon size={14} className="text-zinc-400" />
                              <span>
                                Store Location{' '}
                                <span className="text-red-500">*</span>
                              </span>
                            </label>
                            <Select value={storeId} onValueChange={setStoreId}>
                              <SelectTrigger className={CONTROL_CLASS}>
                                <SelectValue placeholder="Choose store location" />
                              </SelectTrigger>
                              <SelectContent>
                                {stores.length === 0 ? (
                                  <div className="p-2 text-xs text-zinc-400">
                                    No stores found
                                  </div>
                                ) : (
                                  stores.map((s) => (
                                    <SelectItem
                                      key={s.id}
                                      value={s.id}
                                      className="text-sm"
                                    >
                                      {s.name}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            <p className="mt-2 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
                              This employee will only see data for the assigned
                              store.
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                            <Shield01Icon
                              size={16}
                              className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                            />
                            <div>
                              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                                Tenant Administrator
                              </p>
                              <p className="mt-1 text-[11px] leading-snug text-amber-800/90 dark:text-amber-200/80">
                                Full access across all stores. No store
                                assignment is required.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3 — Credentials */}
                {step === 3 && (
                  <div>
                    <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      Almost there — secure the account.
                    </h4>
                    <p className="mt-1 mb-6 text-xs text-zinc-500 dark:text-zinc-400">
                      Set a temporary password. They can change it after their
                      first sign-in.
                    </p>

                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
                      {/* Left: password + status */}
                      <div className="flex flex-col gap-5 lg:col-span-3">
                        <div>
                          <div className="mb-1.5 flex items-center justify-between">
                            <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                              <LockPasswordIcon
                                size={14}
                                className="text-zinc-400"
                              />
                              <span>
                                Temporary Password{' '}
                                <span className="text-red-500">*</span>
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={generateRandomPassword}
                              className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 hover:underline dark:text-amber-400"
                            >
                              <SparklesIcon size={12} />
                              <span>Generate</span>
                            </button>
                          </div>
                          <div className="relative">
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="Minimum 8 characters"
                              className={`${CONTROL_CLASS} pr-10 font-mono`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                            >
                              {showPassword ? (
                                <ViewOffIcon size={16} />
                              ) : (
                                <ViewIcon size={16} />
                              )}
                            </button>
                          </div>
                          <p className="mt-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                            Used to sign into the Operations Panel.
                          </p>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            Initial Account Status
                          </label>
                          <div className="grid grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              onClick={() => setStatus('ACTIVE')}
                              className={`rounded-md border px-3 py-2.5 text-left transition-colors ${
                                status === 'ACTIVE'
                                  ? 'border-amber-400 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/30'
                                  : 'border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
                              }`}
                            >
                              <span className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                <span className="size-1.5 rounded-full bg-emerald-500" />
                                Active
                              </span>
                              <span className="mt-0.5 block text-[10px] text-zinc-500 dark:text-zinc-400">
                                Can sign in immediately
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setStatus('INVITED')}
                              className={`rounded-md border px-3 py-2.5 text-left transition-colors ${
                                status === 'INVITED'
                                  ? 'border-amber-400 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/30'
                                  : 'border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
                              }`}
                            >
                              <span className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                <span className="size-1.5 rounded-full bg-amber-500" />
                                Invited
                              </span>
                              <span className="mt-0.5 block text-[10px] text-zinc-500 dark:text-zinc-400">
                                Must accept invite first
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Right: review */}
                      <div className="lg:col-span-2">
                        <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                            Review
                          </p>
                          <dl className="space-y-2.5 text-[11px]">
                            <div className="flex items-baseline justify-between gap-3">
                              <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">
                                Name
                              </dt>
                              <dd className="truncate text-right font-medium text-zinc-800 dark:text-zinc-200">
                                {name || '—'}
                              </dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-3">
                              <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">
                                Email
                              </dt>
                              <dd className="truncate text-right font-medium text-zinc-800 dark:text-zinc-200">
                                {email || '—'}
                              </dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-3">
                              <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">
                                Phone
                              </dt>
                              <dd className="truncate text-right font-medium text-zinc-800 dark:text-zinc-200">
                                {phone || '—'}
                              </dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-3 border-t border-zinc-200 pt-2.5 dark:border-zinc-800">
                              <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">
                                Role
                              </dt>
                              <dd className="flex items-center gap-1.5 truncate text-right font-medium text-zinc-800 dark:text-zinc-200">
                                <selectedRole.icon
                                  size={11}
                                  className="shrink-0 text-amber-600 dark:text-amber-400"
                                />
                                {selectedRole.label}
                              </dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-3">
                              <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">
                                Store
                              </dt>
                              <dd className="truncate text-right font-medium text-zinc-800 dark:text-zinc-200">
                                {isStoreScoped
                                  ? stores.find((s) => s.id === storeId)
                                      ?.name || '—'
                                  : 'All stores'}
                              </dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-3">
                              <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">
                                Status
                              </dt>
                              <dd className="truncate text-right font-medium text-zinc-800 dark:text-zinc-200">
                                {status === 'ACTIVE' ? 'Active' : 'Invited'}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex shrink-0 items-center justify-between gap-2 border-t border-zinc-200 px-8 py-3.5 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  {step > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={goBack}
                      disabled={loading}
                      className="h-9 rounded-md border-zinc-300 px-3 text-sm font-medium dark:border-zinc-700"
                    >
                      <ArrowLeft01Icon size={14} />
                      <span className="ml-1.5">Back</span>
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={loading}
                    className="h-9 rounded-md border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700"
                  >
                    Cancel
                  </Button>

                  {step < 3 ? (
                    <Button
                      type="button"
                      onClick={goNext}
                      className="h-9 rounded-md bg-amber-400 px-4 text-sm font-semibold text-zinc-950 hover:bg-amber-500"
                    >
                      <span>Continue</span>
                      <ArrowRight01Icon size={14} className="ml-1.5" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={loading}
                      className="h-9 rounded-md bg-amber-400 px-4 text-sm font-semibold text-zinc-950 hover:bg-amber-500"
                    >
                      {loading ? 'Onboarding…' : 'Onboard Employee'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};