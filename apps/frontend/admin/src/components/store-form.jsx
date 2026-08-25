import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, Button, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@smo/ui';
import { Loading03Icon, Store01Icon, ArrowLeft02Icon, Building04Icon, UserIcon } from 'hugeicons-react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';

const defaultHours = {
  monday: { open: '09:00', close: '22:00', isClosed: false },
  tuesday: { open: '09:00', close: '22:00', isClosed: false },
  wednesday: { open: '09:00', close: '22:00', isClosed: false },
  thursday: { open: '09:00', close: '22:00', isClosed: false },
  friday: { open: '09:00', close: '23:00', isClosed: false },
  saturday: { open: '09:00', close: '23:00', isClosed: false },
  sunday: { open: '09:00', close: '22:00', isClosed: false },
};

const WeeklyHoursEditor = ({ value, onChange }) => {
  const [hours, setHours] = useState(() => {
    if (typeof value === 'object' && value !== null && Object.keys(value).length > 0) return value;
    try { 
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : defaultHours;
    } catch { return defaultHours; }
  });

  const updateDay = (day, field, val) => {
    const newHours = { ...hours, [day]: { ...(hours[day] || {}), [field]: val } };
    setHours(newHours);
    onChange(newHours);
  };

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <div className="space-y-3 mt-2 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-zinc-50 dark:bg-zinc-900/30">
      {days.map(day => (
        <div key={day} className="flex items-center justify-between gap-4">
          <div className="w-24 capitalize text-sm font-medium">{day}</div>
          <div className="flex items-center gap-2 flex-1">
            <label className="flex items-center gap-2 text-sm text-zinc-500">
              <input type="checkbox" checked={hours[day]?.isClosed || false} onChange={(e) => updateDay(day, 'isClosed', e.target.checked)} className="rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900" />
              Closed
            </label>
            {!hours[day]?.isClosed && (
              <div className="flex items-center gap-2 ml-4">
                <Input type="time" value={hours[day]?.open || '09:00'} onChange={(e) => updateDay(day, 'open', e.target.value)} className="w-32 h-8 text-sm" />
                <span className="text-zinc-500 text-sm">to</span>
                <Input type="time" value={hours[day]?.close || '22:00'} onChange={(e) => updateDay(day, 'close', e.target.value)} className="w-32 h-8 text-sm" />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export const StoreForm = ({ initialData, isEdit }) => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    slug: initialData?.slug || '',
    banner: initialData?.banner || '',
    address: initialData?.address || '',
    contactPhone: initialData?.contactPhone || '',
    contactEmail: initialData?.contactEmail || '',
    operatingHours: initialData?.operatingHours || '',
    status: initialData?.status || 'ACTIVE',
    tenantId: initialData?.tenantId || 'none'
  });

  const [adminData, setAdminData] = useState({
    name: '',
    email: '',
    phone: '',
    password: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [tenants, setTenants] = useState([]);
  const [existingAdmins, setExistingAdmins] = useState([]);
  const [fetchingAdmins, setFetchingAdmins] = useState(false);
  
  const [provisionMode, setProvisionMode] = useState('CREATE');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [tenantUsers, setTenantUsers] = useState([]);
  
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (isSuperAdmin) {
      api.get('/tenants').then(res => {
        if (res.data.success) setTenants(res.data.data);
      }).catch(console.error);
    }
    
    // Fetch users of the selected tenant to allow assigning an existing user
    if (formData.tenantId && formData.tenantId !== 'none') {
      api.get(`/users?tenantId=${formData.tenantId}&limit=1000`)
        .then(res => {
          if (res.data.success) {
            setTenantUsers(res.data.data.users || res.data.data);
          }
        })
        .catch(console.error);
    }
    
    // Fetch existing Store Managers when in edit mode
    if (isEdit) {
      setFetchingAdmins(true);
      api.get(`/users?role=STORE_MANAGER&storeId=${initialData.id}`)
        .then(res => {
          if (res.data.success) {
            setExistingAdmins(res.data.data.users || res.data.data); // Handle pagination structure if present
          }
        })
        .catch(console.error)
        .finally(() => setFetchingAdmins(false));
    }
  }, [isSuperAdmin, isEdit, formData.tenantId]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAdminChange = (field, value) => {
    setAdminData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const payload = { ...formData };
    
    if (payload.tenantId === 'none') delete payload.tenantId;

    if (provisionMode === 'CREATE' && adminData.email && adminData.password) {
      payload.adminUser = adminData;
    } else if (provisionMode === 'SELECT' && selectedUserId) {
      payload.adminUserId = selectedUserId;
    }

    try {
      if (isEdit) {
        await api.patch(`/stores/${initialData.id}`, payload);
      } else {
        await api.post('/stores', payload);
      }
      navigate('/stores');
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/stores')} className="shrink-0 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          <ArrowLeft02Icon size={20} />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {isEdit ? 'Edit Store' : 'Create Store'}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isEdit ? 'Update store details.' : 'Add a new physical location or branch.'}
          </p>
        </div>
      </div>

      <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-md">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="space-y-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Store01Icon size={16} className="text-zinc-500" /> Store Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Store Name</Label>
                  <Input 
                    id="name" 
                    value={formData.name}
                    onChange={(e) => {
                      handleChange('name', e.target.value);
                      if (!isEdit && !formData.slug) {
                        handleChange('slug', e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
                      }
                    }}
                    placeholder="e.g. Downtown Cafe"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (URL Friendly)</Label>
                  <Input 
                    id="slug" 
                    value={formData.slug}
                    onChange={(e) => handleChange('slug', e.target.value)}
                    placeholder="downtown-cafe"
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input 
                    id="address" 
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder="Full store address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input 
                    id="contactPhone" 
                    value={formData.contactPhone}
                    onChange={(e) => handleChange('contactPhone', e.target.value)}
                    placeholder="e.g. +1 555-0123"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input 
                    id="contactEmail" 
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => handleChange('contactEmail', e.target.value)}
                    placeholder="store@example.com"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Operating Hours</Label>
                  <WeeklyHoursEditor 
                    value={formData.operatingHours}
                    onChange={(val) => handleChange('operatingHours', val)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="banner">Banner URL (Optional)</Label>
                  <Input 
                    id="banner" 
                    value={formData.banner}
                    onChange={(e) => handleChange('banner', e.target.value)}
                    placeholder="https://example.com/banner.png"
                  />
                </div>

                {isSuperAdmin && (
                  <div className="space-y-2 md:col-span-2">
                    <Label className="flex items-center gap-1"><Building04Icon size={14}/> Tenant Assignment</Label>
                    <Select value={formData.tenantId} onValueChange={(val) => handleChange('tenantId', val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Tenant" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select a Tenant</SelectItem>
                        {tenants.length === 0 ? (
                          <SelectItem value="empty" disabled>No tenants found. Create one first.</SelectItem>
                        ) : (
                          tenants.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {isEdit && (
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={(val) => handleChange('status', val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="SUSPENDED">Suspended</SelectItem>
                        <SelectItem value="DISABLED">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            <>
              <hr className="border-zinc-200 dark:border-zinc-800" />
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <UserIcon size={16} className="text-zinc-500" /> Store Manager Information
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    {!isEdit 
                      ? "Provision a new Store Manager to oversee this location. They will receive a welcome email. Leave blank to manage users separately."
                      : "Store Managers who manage this store."}
                  </p>
                </div>
                  
                {isEdit && fetchingAdmins ? (
                  <div className="flex items-center gap-2 text-zinc-500 p-4">
                    <Loading03Icon className="animate-spin" size={16} /> Fetching managers...
                  </div>
                ) : (isEdit && Array.isArray(existingAdmins) && existingAdmins.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {existingAdmins.map(admin => (
                      <div key={admin.id} className="flex items-center gap-3 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                        <div className="h-10 w-10 shrink-0 rounded-full bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 flex items-center justify-center font-bold text-lg">
                          {admin.name ? admin.name.charAt(0).toUpperCase() : <UserIcon size={20} />}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{admin.name || 'Unnamed Admin'}</span>
                          <span className="text-xs text-zinc-500">{admin.email}</span>
                          <span className="text-[10px] font-mono mt-1 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 w-max text-zinc-500">STORE MANAGER</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="bg-zinc-50/50 dark:bg-zinc-900/30 p-4 rounded-lg border border-zinc-100 dark:border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Assign a new Manager</p>
                    <div className="flex bg-zinc-100 dark:bg-zinc-900 rounded-lg p-1 border border-zinc-200 dark:border-zinc-800">
                      <button 
                        type="button" 
                        onClick={() => setProvisionMode('CREATE')} 
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${provisionMode === 'CREATE' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                      >
                        Create New
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setProvisionMode('SELECT')} 
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${provisionMode === 'SELECT' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                      >
                        Select Existing
                      </button>
                    </div>
                  </div>

                  {provisionMode === 'CREATE' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="adminName">Manager Name</Label>
                        <Input 
                          id="adminName" 
                          value={adminData.name}
                          onChange={(e) => handleAdminChange('name', e.target.value)}
                          placeholder="Alice Founder"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="adminEmail">Manager Email</Label>
                        <Input 
                          id="adminEmail" 
                          type="email"
                          value={adminData.email}
                          onChange={(e) => handleAdminChange('email', e.target.value)}
                          placeholder="alice@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="adminPhone">Manager Phone</Label>
                        <Input 
                          id="adminPhone" 
                          type="tel"
                          value={adminData.phone}
                          onChange={(e) => handleAdminChange('phone', e.target.value)}
                          placeholder="+1 555-0123"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="adminPassword">Initial Password</Label>
                        <Input 
                          id="adminPassword" 
                          type="password"
                          value={adminData.password}
                          onChange={(e) => handleAdminChange('password', e.target.value)}
                          placeholder="Minimum 8 characters"
                          minLength={8}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-w-md pt-2">
                      <Label>Select Existing User from Brand</Label>
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger><SelectValue placeholder="Choose a user" /></SelectTrigger>
                        <SelectContent>
                          {tenantUsers.length === 0 && <SelectItem value="none" disabled>No users found in this brand</SelectItem>}
                          {tenantUsers.map(u => (
                            <SelectItem key={u.id} value={u.id}>{u.name} ({u.email}) - {u.role}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-zinc-400 mt-1">Warning: Re-assigning an existing user will move them to manage this store.</p>
                    </div>
                  )}
                </div>
              </div>
            </>

            <div className="flex justify-end pt-4">
              <Button type="button" variant="ghost" onClick={() => navigate('/stores')} className="mr-3">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || (!isEdit && isSuperAdmin && formData.tenantId === 'none')}
              >
                {isSubmitting ? (
                  <><Loading03Icon className="animate-spin mr-2" size={16} /> {isEdit ? 'Saving...' : 'Creating...'}</>
                ) : (
                  isEdit ? 'Save Changes' : 'Create Store'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
