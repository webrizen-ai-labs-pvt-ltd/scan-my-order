import React, { useState, useEffect } from 'react';
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
  UserEdit01Icon,
  Shield01Icon,
  CashierIcon,
  Dish01Icon,
  Pot02Icon,
  InformationCircleIcon,
  ArrowRight01Icon,
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

const STATUSES = [
  {
    value: 'ACTIVE',
    label: 'Active',
    hint: 'Can sign in',
    dot: 'bg-emerald-500',
  },
  {
    value: 'INVITED',
    label: 'Invited',
    hint: 'Must accept invite',
    dot: 'bg-amber-500',
  },
  {
    value: 'SUSPENDED',
    label: 'Suspended',
    hint: 'Temporarily blocked',
    dot: 'bg-orange-500',
  },
  {
    value: 'DISABLED',
    label: 'Disabled',
    hint: 'Account closed',
    dot: 'bg-zinc-400',
  },
];

const ROLE_LABEL_MAP = {
  TENANT_ADMIN: 'Tenant Admin',
  STORE_MANAGER: 'Store Manager',
  CASHIER: 'Cashier',
  WAITER: 'Waiter',
  KITCHEN_STAFF: 'Kitchen Staff',
};

const LABEL_CLASS =
  'mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300';

const CONTROL_CLASS =
  'h-10 rounded-md border-zinc-300 bg-white text-sm focus-visible:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-900';

const SECTION_TITLE_CLASS =
  'mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500';

export const EmployeeEditModal = ({
  employee,
  stores = [],
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [storeId, setStoreId] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (employee) {
      setName(employee.name || '');
      setPhone(employee.phone || '');
      setRole(employee.role || 'WAITER');
      setStoreId(employee.storeId || employee.store?.id || stores[0]?.id || '');
      setStatus(employee.status || 'ACTIVE');
      setPassword('');
      setShowPassword(false);
      setError('');
    }
  }, [employee, stores]);

  if (!isOpen || !employee) return null;

  const isStoreScoped = role !== 'TENANT_ADMIN';

  // ---- Change detection ----
  const originalStoreId = employee.storeId || employee.store?.id || '';
  const roleChanged = role !== employee.role;
  const storeChanged = isStoreScoped && storeId !== originalStoreId;
  const statusChanged = status !== employee.status;
  const nameChanged = name.trim() !== (employee.name || '').trim();
  const phoneChanged = phone.trim() !== (employee.phone || '').trim();
  const passwordChanged = Boolean(password);
  const hasChanges =
    roleChanged ||
    storeChanged ||
    statusChanged ||
    nameChanged ||
    phoneChanged ||
    passwordChanged;

  const selectedRole = ROLES.find((r) => r.value === role);
  const selectedStore = stores.find((s) => s.id === storeId);
  const originalStore = stores.find((s) => s.id === originalStoreId);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please provide the employee full name');
      return;
    }

    if (password && password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (isStoreScoped && !storeId) {
      setError('Please assign the employee to a store location');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        role,
        status,
        storeId: isStoreScoped ? storeId : null,
      };

      if (password) {
        payload.password = password;
      }

      const res = await api.patch(`/users/${employee.id}`, payload);
      if (res.data.success) {
        onSuccess(res.data.data);
        onClose();
      } else {
        setError(res.data.error?.message || 'Failed to update employee');
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          err.message ||
          'Failed to update employee'
      );
    } finally {
      setLoading(false);
    }
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
              <UserEdit01Icon size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Edit Employee
              </h3>
              <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                {employee.name} &middot; {employee.email}
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
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-5">
            {/* Left: Editable Fields */}
            <div className="min-h-0 overflow-y-auto px-8 py-6 lg:col-span-3">
              {error && (
                <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </div>
              )}

              {/* Section: Role */}
              <section className="mb-7">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className={SECTION_TITLE_CLASS + ' mb-0'}>
                    Operational Role
                  </h4>
                  {roleChanged && (
                    <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                      Changing
                    </span>
                  )}
                </div>

                {/* Role gallery */}
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
                          <span className="block truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            {r.label}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                            {r.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Section: Store assignment */}
              <section className="mb-7">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className={SECTION_TITLE_CLASS + ' mb-0'}>
                    Store Assignment
                  </h4>
                  {storeChanged && (
                    <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                      Transferring
                    </span>
                  )}
                </div>

                {isStoreScoped ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
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
                    </div>
                    <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                        Currently Assigned
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        <Store01Icon
                          size={13}
                          className="text-amber-600 dark:text-amber-400"
                        />
                        {originalStore?.name || 'Not assigned'}
                      </p>
                    </div>
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
                        Full access across all stores. No store assignment
                        required.
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* Section: Profile */}
              <section className="mb-7">
                <h4 className={SECTION_TITLE_CLASS}>Profile</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                      required
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
                <div className="mt-4">
                  <label className={LABEL_CLASS}>
                    <Mail01Icon size={14} className="text-zinc-400" />
                    <span>Email Address</span>
                    <span className="ml-auto text-[10px] font-normal text-zinc-400">
                      Read-only
                    </span>
                  </label>
                  <Input
                    value={employee.email}
                    disabled
                    className={`${CONTROL_CLASS} cursor-not-allowed bg-zinc-50 text-zinc-500 dark:bg-zinc-800/60`}
                  />
                </div>
              </section>

              {/* Section: Status */}
              <section className="mb-7">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className={SECTION_TITLE_CLASS + ' mb-0'}>
                    Account Status
                  </h4>
                  {statusChanged && (
                    <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                      Changing
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {STATUSES.map((s) => {
                    const selected = status === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setStatus(s.value)}
                        className={`rounded-md border px-3 py-2.5 text-left transition-colors ${
                          selected
                            ? 'border-amber-400 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/30'
                            : 'border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <span className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          <span className={`size-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-zinc-500 dark:text-zinc-400">
                          {s.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Section: Password reset */}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className={SECTION_TITLE_CLASS + ' mb-0'}>
                    Password Reset
                  </h4>
                  {passwordChanged && (
                    <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                      Will reset
                    </span>
                  )}
                </div>
                <div className="rounded-md border border-zinc-200 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-zinc-800/30">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      <LockPasswordIcon size={14} className="text-zinc-400" />
                      <span>New Password</span>
                      <span className="ml-1 text-[10px] font-normal text-zinc-400">
                        Leave blank to keep existing
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
                </div>
              </section>
            </div>

            {/* Right: Change Summary */}
            <aside className="hidden min-h-0 overflow-y-auto border-l border-zinc-200 bg-zinc-50/60 px-6 py-6 lg:col-span-2 lg:block dark:border-zinc-800 dark:bg-zinc-900/40">
              <h4 className={SECTION_TITLE_CLASS}>Change Summary</h4>

              {!hasChanges ? (
                <div className="flex items-start gap-2.5 rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <InformationCircleIcon
                    size={16}
                    className="mt-0.5 shrink-0 text-zinc-400"
                  />
                  <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                    No changes yet. Edits you make on the left will appear here
                    before you save.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {roleChanged && (
                    <ChangeRow
                      label="Role"
                      from={ROLE_LABEL_MAP[employee.role] || employee.role}
                      to={selectedRole.label}
                      icon={selectedRole.icon}
                    />
                  )}

                  {storeChanged && (
                    <ChangeRow
                      label="Store"
                      from={originalStore?.name || 'Not assigned'}
                      to={selectedStore?.name || '—'}
                      icon={Store01Icon}
                    />
                  )}

                  {statusChanged && (
                    <ChangeRow
                      label="Status"
                      from={
                        STATUSES.find((s) => s.value === employee.status)
                          ?.label || employee.status
                      }
                      to={
                        STATUSES.find((s) => s.value === status)?.label || status
                      }
                      icon={Shield01Icon}
                    />
                  )}

                  {nameChanged && (
                    <SimpleRow
                      label="Name"
                      from={employee.name}
                      to={name.trim()}
                    />
                  )}

                  {phoneChanged && (
                    <SimpleRow
                      label="Phone"
                      from={employee.phone || 'Not set'}
                      to={phone.trim() || 'Cleared'}
                    />
                  )}

                  {passwordChanged && (
                    <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                        <LockPasswordIcon size={12} />
                        Password will be reset
                      </p>
                      <p className="mt-1 text-[10px] leading-snug text-amber-800/80 dark:text-amber-200/70">
                        The employee will need to use the new password on their
                        next sign-in.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Employee metadata footer */}
              <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Employee
                </p>
                <dl className="space-y-2 text-[11px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500 dark:text-zinc-400">ID</dt>
                    <dd className="truncate font-mono font-medium text-zinc-700 dark:text-zinc-300">
                      {employee.id?.slice(0, 8) || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500 dark:text-zinc-400">Email</dt>
                    <dd className="truncate font-medium text-zinc-700 dark:text-zinc-300">
                      {employee.email}
                    </dd>
                  </div>
                </dl>
              </div>
            </aside>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-zinc-200 px-8 py-3.5 dark:border-zinc-800">
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {hasChanges
                ? 'You have unsaved changes.'
                : 'No changes to save.'}
            </p>

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
              <Button
                type="submit"
                disabled={loading || !hasChanges}
                className="h-9 rounded-md bg-amber-400 px-4 text-sm font-semibold text-zinc-950 hover:bg-amber-500 disabled:opacity-50"
              >
                {loading ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* --- Small helper components for the change summary --- */

const ChangeRow = ({ label, from, to, icon: Icon }) => (
  <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
      {label}
    </p>
    <div className="flex items-center gap-2 text-[11px]">
      <span className="truncate text-zinc-500 line-through dark:text-zinc-500">
        {from}
      </span>
      <ArrowRight01Icon size={12} className="shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="flex min-w-0 items-center gap-1 truncate font-semibold text-zinc-900 dark:text-zinc-100">
        {Icon && (
          <Icon size={11} className="shrink-0 text-amber-600 dark:text-amber-400" />
        )}
        {to}
      </span>
    </div>
  </div>
);

const SimpleRow = ({ label, from, to }) => (
  <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
      {label}
    </p>
    <div className="flex items-center gap-2 text-[11px]">
      <span className="truncate text-zinc-500 line-through dark:text-zinc-500">
        {from}
      </span>
      <ArrowRight01Icon size={12} className="shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
        {to}
      </span>
    </div>
  </div>
);