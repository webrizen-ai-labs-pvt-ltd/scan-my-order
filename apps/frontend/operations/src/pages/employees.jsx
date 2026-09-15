import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import {
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Skeleton,
  Avatar,
  AvatarImage,
  AvatarFallback,
} from '@smo/ui';
import {
  UserGroupIcon,
  PlusSignIcon,
  Search01Icon,
  Store01Icon,
  UserEdit01Icon,
  Delete02Icon,
  Tick02Icon,
  AlertCircleIcon,
  RefreshIcon,
  Shield01Icon,
  CashierIcon,
  Dish01Icon,
  Pot02Icon,
  Call02Icon,
} from 'hugeicons-react';
import { EmployeeOnboardModal } from '../components/employee-onboard-modal';
import { EmployeeEditModal } from '../components/employee-edit-modal';

const ROLE_META = {
  TENANT_ADMIN: {
    label: 'Tenant Admin',
    badge:
      'bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700',
    icon: Shield01Icon,
  },
  STORE_MANAGER: {
    label: 'Store Manager',
    badge:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900',
    icon: Store01Icon,
  },
  CASHIER: {
    label: 'Cashier',
    badge:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
    icon: CashierIcon,
  },
  WAITER: {
    label: 'Waiter',
    badge:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
    icon: Dish01Icon,
  },
  KITCHEN_STAFF: {
    label: 'Kitchen Staff',
    badge:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
    icon: Pot02Icon,
  },
};

const STATUS_META = {
  ACTIVE: {
    label: 'Active',
    dot: 'bg-emerald-500',
    badge:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  },
  INVITED: {
    label: 'Invited',
    dot: 'bg-amber-500',
    badge:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  },
  SUSPENDED: {
    label: 'Suspended',
    dot: 'bg-orange-500',
    badge:
      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900',
  },
  DISABLED: {
    label: 'Disabled',
    dot: 'bg-zinc-400',
    badge:
      'bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
  },
};

const LABEL_CLASS =
  'mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300';

const CONTROL_CLASS =
  'h-9 rounded-md border-zinc-300 bg-white text-sm dark:border-zinc-700 dark:bg-zinc-900';

export const Employees = () => {
  const { user } = useAuthStore();
  const [employees, setEmployees] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [storeFilter, setStoreFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [onboardModalOpen, setOnboardModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState(null);

  // Toast feedback
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchStores = useCallback(async () => {
    try {
      const res = await api.get('/stores');
      if (res.data.success) {
        setStores(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load stores:', err);
    }
  }, []);

  const fetchEmployees = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError('');
      try {
        const query = new URLSearchParams();
        if (roleFilter !== 'ALL') query.set('role', roleFilter);
        if (statusFilter !== 'ALL') query.set('status', statusFilter);
        if (search.trim()) query.set('search', search.trim());
        query.set('limit', '200');

        const res = await api.get(`/users?${query.toString()}`);
        if (res.data.success) {
          const rawData = res.data.data;
          const list = Array.isArray(rawData) ? rawData : rawData?.users || [];
          // Filter out customer accounts from employees view
          setEmployees(list.filter((emp) => emp.role !== 'CUSTOMER'));
        }
      } catch (err) {
        console.error('Failed to load employees:', err);
        const msg =
          err.response?.data?.message ||
          'Unable to load employees. Please try again.';
        setError(msg);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [roleFilter, statusFilter, search]
  );

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchEmployees();
    }, 250);
    return () => clearTimeout(delayDebounce);
  }, [fetchEmployees]);

  // Client-side filtering for Store location
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (storeFilter !== 'ALL') {
        const empStoreId = emp.storeId || emp.store?.id;
        if (empStoreId !== storeFilter) return false;
      }
      return true;
    });
  }, [employees, storeFilter]);

  // Quick stats calculation
  const stats = useMemo(() => {
    const total = employees.length;
    const managers = employees.filter((e) => e.role === 'STORE_MANAGER').length;
    const cashiers = employees.filter((e) => e.role === 'CASHIER').length;
    const waiters = employees.filter(
      (e) => e.role === 'WAITER' || e.role === 'KITCHEN_STAFF'
    ).length;
    const active = employees.filter((e) => e.status === 'ACTIVE').length;
    return { total, managers, cashiers, waiters, active };
  }, [employees]);

  // 1-Click Role Change
  const handleQuickRoleChange = async (emp, newRole) => {
    if (emp.role === newRole) return;

    const requiresStore = [
      'STORE_MANAGER',
      'CASHIER',
      'WAITER',
      'KITCHEN_STAFF',
    ].includes(newRole);
    const existingStoreId = emp.storeId || emp.store?.id;

    if (requiresStore && !existingStoreId) {
      if (stores.length === 1) {
        // Auto-assign sole store
        return executeRoleChange(emp, newRole, stores[0].id);
      } else {
        // Prompt store selection via edit modal
        setSelectedEmployee({ ...emp, role: newRole });
        setEditModalOpen(true);
        showToast(
          'Please assign a store location for this operational role',
          'info'
        );
        return;
      }
    }

    await executeRoleChange(emp, newRole, existingStoreId);
  };

  const executeRoleChange = async (emp, newRole, storeId) => {
    setUpdatingRoleId(emp.id);
    try {
      const payload = { role: newRole };
      if (storeId) payload.storeId = storeId;
      if (newRole === 'TENANT_ADMIN') payload.storeId = null;

      const res = await api.patch(`/users/${emp.id}`, payload);
      if (res.data.success) {
        const updated = res.data.data;
        setEmployees((prev) =>
          prev.map((e) => (e.id === emp.id ? { ...e, ...updated } : e))
        );
        const roleName = ROLE_META[newRole]?.label || newRole.replace('_', ' ');
        showToast(
          `Role updated to ${roleName}. Formal corporate letter sent to ${emp.email}`
        );
      }
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to update role', 'error');
    } finally {
      setUpdatingRoleId(null);
    }
  };

  // Handle Quick Status Change
  const handleStatusChange = async (employeeId, newStatus) => {
    setActionLoading(true);
    try {
      const res = await api.patch(`/users/${employeeId}/status`, {
        status: newStatus,
      });
      if (res.data.success) {
        setEmployees((prev) =>
          prev.map((emp) =>
            emp.id === employeeId ? { ...emp, status: newStatus } : emp
          )
        );
        showToast(`Employee status updated to ${newStatus}`);
      }
    } catch (err) {
      console.error(err);
      showToast(
        err.response?.data?.message || 'Failed to update status',
        'error'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete Employee
  const handleDeleteEmployee = async (employeeId) => {
    setActionLoading(true);
    try {
      const res = await api.delete(`/users/${employeeId}`);
      if (res.data.success) {
        setEmployees((prev) => prev.filter((emp) => emp.id !== employeeId));
        setDeleteConfirmId(null);
        showToast('Employee account removed');
      }
    } catch (err) {
      console.error(err);
      showToast(
        err.response?.data?.message || 'Failed to delete employee',
        'error'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditClick = (emp) => {
    setSelectedEmployee(emp);
    setEditModalOpen(true);
  };

  const handleEditSuccess = (updatedEmp) => {
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === updatedEmp.id ? updatedEmp : emp))
    );
    showToast(
      `Updated ${updatedEmp.name} successfully. Corporate letter sent if role was adjusted.`
    );
  };

  const handleOnboardSuccess = (newEmp) => {
    setEmployees((prev) => [newEmp, ...prev]);
    showToast(`Onboarded ${newEmp.name} successfully`);
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed right-4 top-4 z-50 w-80 animate-in slide-in-from-top-2 duration-200">
          <div
            className={`flex items-start gap-2.5 rounded-md border border-zinc-200 border-l-4 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 ${toast.type === 'error'
                ? 'border-l-red-500'
                : toast.type === 'info'
                  ? 'border-l-blue-500'
                  : 'border-l-emerald-500'
              }`}
          >
            {toast.type === 'error' ? (
              <AlertCircleIcon size={16} className="mt-0.5 shrink-0 text-red-500" />
            ) : toast.type === 'info' ? (
              <AlertCircleIcon size={16} className="mt-0.5 shrink-0 text-blue-500" />
            ) : (
              <Tick02Icon size={16} className="mt-0.5 shrink-0 text-emerald-500" />
            )}
            <span className="text-sm leading-snug text-zinc-700 dark:text-zinc-200">
              {toast.message}
            </span>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-end sm:justify-between dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Employees
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Onboard team members, assign store locations, and manage operational
            roles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => fetchEmployees(false)}
            title="Refresh employees list"
            size="sm"
            className="rounded-none rounded-l-full"
          >
            <RefreshIcon size={14} />
            <span>Refresh</span>
          </Button>
          <Button
            variant="secondary"
            onClick={() => setOnboardModalOpen(true)}
            size="sm"
            className="rounded-none rounded-r-full"
          >
            <span>Onboard Employee</span>
          </Button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 sm:grid-cols-5 dark:border-zinc-800 dark:bg-zinc-800">
        <div className="flex flex-col justify-between bg-white p-4 dark:bg-zinc-900">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Total Staff
          </span>
          <span className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {stats.total}
          </span>
        </div>
        <div className="flex flex-col justify-between bg-white p-4 dark:bg-zinc-900">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Managers
          </span>
          <span className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {stats.managers}
          </span>
        </div>
        <div className="flex flex-col justify-between bg-white p-4 dark:bg-zinc-900">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Cashiers
          </span>
          <span className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {stats.cashiers}
          </span>
        </div>
        <div className="flex flex-col justify-between bg-white p-4 dark:bg-zinc-900">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Waiters &amp; Kitchen
          </span>
          <span className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {stats.waiters}
          </span>
        </div>
        <div className="col-span-2 flex flex-col justify-between bg-white p-4 sm:col-span-1 dark:bg-zinc-900">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Active Duty
          </span>
          <span className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {stats.active}
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid grid-cols-1 gap-1 md:grid-cols-12">
          {/* Search Input */}
          <div className="md:col-span-4">
            <label className={LABEL_CLASS}>Search</label>
            <div className="relative">
              <Search01Icon
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, email, or phone…"
                className={`${CONTROL_CLASS} pl-9`}
              />
            </div>
          </div>

          {/* Role Filter */}
          <div className="md:col-span-3">
            <label className={LABEL_CLASS}>Role</label>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className={CONTROL_CLASS} className="rounded-none rounded-l-full">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-sm">
                  All Roles
                </SelectItem>
                <SelectItem value="STORE_MANAGER" className="text-sm">
                  Store Manager
                </SelectItem>
                <SelectItem value="CASHIER" className="text-sm">
                  Cashier
                </SelectItem>
                <SelectItem value="WAITER" className="text-sm">
                  Waiter
                </SelectItem>
                <SelectItem value="KITCHEN_STAFF" className="text-sm">
                  Kitchen Staff
                </SelectItem>
                <SelectItem value="TENANT_ADMIN" className="text-sm">
                  Tenant Admin
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Store Filter */}
          <div className="md:col-span-3">
            <label className={LABEL_CLASS}>Store Location</label>
            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger className={CONTROL_CLASS} className="rounded-none">
                <SelectValue placeholder="All Stores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-sm">
                  All Stores
                </SelectItem>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-sm">
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-2">
            <label className={LABEL_CLASS}>Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className={CONTROL_CLASS} className="rounded-none rounded-r-full">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-sm">
                  All Statuses
                </SelectItem>
                <SelectItem value="ACTIVE" className="text-sm">
                  Active
                </SelectItem>
                <SelectItem value="INVITED" className="text-sm">
                  Invited
                </SelectItem>
                <SelectItem value="SUSPENDED" className="text-sm">
                  Suspended
                </SelectItem>
                <SelectItem value="DISABLED" className="text-sm">
                  Disabled
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Employee Content */}
      <div className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {loading ? (
          <div className="flex flex-col gap-3 p-6">
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <AlertCircleIcon size={28} className="mb-2 text-red-500" />
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {error}
            </p>
            <Button
              onClick={() => fetchEmployees()}
              variant="outline"
              className="mt-4 h-9 rounded-md border-zinc-300 text-sm font-medium"
            >
              Retry
            </Button>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
              <UserGroupIcon size={24} />
            </div>
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              No employees found
            </h3>
            <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              {search ||
                roleFilter !== 'ALL' ||
                storeFilter !== 'ALL' ||
                statusFilter !== 'ALL'
                ? 'Try adjusting your filters or search terms.'
                : 'Get started by onboarding your first staff member.'}
            </p>
            {!search && roleFilter === 'ALL' && (
              <Button
                onClick={() => setOnboardModalOpen(true)}
                className="mt-4 h-9 rounded-md bg-blue-600 px-3.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Onboard Employee
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Role
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Store Location
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredEmployees.map((emp) => {
                  const roleMeta = ROLE_META[emp.role] || {
                    label: emp.role,
                    badge:
                      'bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700',
                    icon: UserGroupIcon,
                  };
                  const statusMeta = STATUS_META[emp.status] || STATUS_META.DISABLED;
                  const isCurrentLoggedUser = emp.id === user?.id;

                  return (
                    <tr
                      key={emp.id}
                      className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                    >
                      {/* Name & Avatar */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9 rounded-full">
                            <AvatarImage src={emp.profilePhoto} alt={emp.name} />
                            <AvatarFallback className="rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                              {emp.name ? emp.name.charAt(0).toUpperCase() : 'E'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex min-w-0 flex-col">
                            <span className="flex items-center gap-1.5 truncate font-medium text-zinc-900 dark:text-zinc-100">
                              {emp.name}
                              {isCurrentLoggedUser && (
                                <span className="rounded border border-zinc-300 px-1.5 py-px text-[10px] font-medium text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
                                  You
                                </span>
                              )}
                            </span>
                            <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                              {emp.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 1-Click Role Selector */}
                      <td className="whitespace-nowrap px-4 py-3">
                        {isCurrentLoggedUser ? (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium ${roleMeta.badge}`}
                          >
                            <roleMeta.icon size={13} />
                            <span>{roleMeta.label}</span>
                          </span>
                        ) : (
                          <Select
                            value={emp.role}
                            onValueChange={(val) => handleQuickRoleChange(emp, val)}
                            disabled={updatingRoleId === emp.id || actionLoading}
                          >
                            <SelectTrigger
                              className={`flex h-8 items-center gap-1.5 rounded-full border px-2 text-xs font-medium ${roleMeta.badge} hover:brightness-[0.97]`}
                              title="Click to change operational role in 1 click"
                            >
                              <div className="flex min-w-0 items-center gap-1.5">
                                {updatingRoleId === emp.id ? (
                                  <RefreshIcon
                                    size={12}
                                    className="animate-spin text-zinc-500"
                                  />
                                ) : (
                                  <roleMeta.icon size={12} />
                                )}
                                <span className="truncate">{roleMeta.label}</span>
                              </div>
                            </SelectTrigger>
                            <SelectContent
                              align="start"
                              className="min-w-[240px] rounded-md border-zinc-200 p-1 dark:border-zinc-800"
                            >
                              <div className="mb-1 border-b border-zinc-100 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                                Change Role
                              </div>
                              {Object.entries(ROLE_META).map(([key, meta]) => {
                                const Icon = meta.icon;
                                return (
                                  <SelectItem
                                    key={key}
                                    value={key}
                                    className="cursor-pointer rounded py-1.5 text-sm"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`rounded border p-1 ${meta.badge}`}
                                      >
                                        <Icon size={12} />
                                      </span>
                                      <div className="flex flex-col">
                                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                          {meta.label}
                                        </span>
                                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                                          {key === 'TENANT_ADMIN'
                                            ? 'Full brand executive'
                                            : key === 'STORE_MANAGER'
                                              ? 'Store & inventory oversight'
                                              : key === 'CASHIER'
                                                ? 'POS billing & cash/UPI'
                                                : key === 'WAITER'
                                                  ? 'Table service & orders'
                                                  : 'Kitchen KDS tickets'}
                                        </span>
                                      </div>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        )}
                      </td>

                      {/* Store Location */}
                      <td className="whitespace-nowrap px-4 py-3">
                        {emp.store ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            <Store01Icon size={13} className="text-zinc-400" />
                            <span>{emp.store.name}</span>
                          </span>
                        ) : emp.role === 'TENANT_ADMIN' ? (
                          <span className="text-xs italic text-zinc-400 dark:text-zinc-500">
                            All stores
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${statusMeta.badge}`}
                        >
                          <span className={`size-1.5 rounded-full ${statusMeta.dot}`} />
                          <span>{statusMeta.label}</span>
                        </span>
                      </td>

                      {/* Contact Phone */}
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                        {emp.phone ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Call02Icon size={12} className="text-zinc-400" />
                            <span>{emp.phone}</span>
                          </span>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-600">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {/* Edit / Change Role Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(emp)}
                            title="Edit employee details & change operational role"
                            className="size-8 rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                          >
                            <UserEdit01Icon size={15} />
                          </Button>

                          {/* Quick Status Toggle */}
                          {!isCurrentLoggedUser && (
                            <Select
                              value={emp.status}
                              onValueChange={(val) => handleStatusChange(emp.id, val)}
                              disabled={actionLoading}
                            >
                              <SelectTrigger className="h-8 rounded-md border-zinc-300 px-2 text-xs dark:border-zinc-700">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent align="end">
                                <SelectItem value="ACTIVE" className="text-sm">
                                  Mark Active
                                </SelectItem>
                                <SelectItem value="SUSPENDED" className="text-sm">
                                  Suspend Access
                                </SelectItem>
                                <SelectItem value="DISABLED" className="text-sm">
                                  Disable Account
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}

                          {/* Delete Action with Confirmation */}
                          {!isCurrentLoggedUser &&
                            (deleteConfirmId === emp.id ? (
                              <div className="ml-1 flex animate-in fade-in items-center gap-1">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteEmployee(emp.id)}
                                  disabled={actionLoading}
                                  className="h-8 rounded-md bg-red-600 px-2 text-xs font-medium text-white hover:bg-red-700"
                                >
                                  Confirm
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="h-8 rounded-md px-2 text-xs"
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirmId(emp.id)}
                                title="Delete employee"
                                className="size-8 rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                              >
                                <Delete02Icon size={15} />
                              </Button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Onboard Employee Modal */}
      <EmployeeOnboardModal
        isOpen={onboardModalOpen}
        onClose={() => setOnboardModalOpen(false)}
        stores={stores}
        onSuccess={handleOnboardSuccess}
      />

      {/* Edit / Change Role Modal */}
      <EmployeeEditModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedEmployee(null);
        }}
        employee={selectedEmployee}
        stores={stores}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
};

export default Employees;