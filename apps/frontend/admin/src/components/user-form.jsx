import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@smo/ui';
import { Loading03Icon, UserIcon, ArrowLeft02Icon, Store01Icon, Building04Icon } from 'hugeicons-react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';

export const UserForm = ({ initialData, isEdit }) => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    password: '',
    role: initialData?.role || 'CUSTOMER',
    status: initialData?.status || 'ACTIVE',
    tenantId: initialData?.tenantId || 'none',
    storeId: initialData?.storeId || 'none'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [tenants, setTenants] = useState([]);
  const [stores, setStores] = useState([]);
  
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (isSuperAdmin) {
      api.get('/tenants').then(res => {
        if (res.data.success) setTenants(res.data.data);
      }).catch(console.error);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (formData.tenantId && formData.tenantId !== 'none') {
      api.get(`/stores?tenantId=${formData.tenantId}`).then(res => {
        if (res.data.success) setStores(res.data.data);
      }).catch(console.error);
    } else {
      setStores([]);
    }
  }, [formData.tenantId]);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'tenantId' && value === 'none') {
        next.storeId = 'none';
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const payload = { ...formData };
    
    // Clean up empty fields
    if (payload.tenantId === 'none') delete payload.tenantId;
    if (payload.storeId === 'none') delete payload.storeId;
    if (isEdit && !payload.password) delete payload.password;

    try {
      if (isEdit) {
        await api.patch(`/users/${initialData.id}`, payload);
      } else {
        await api.post('/users', payload);
      }
      navigate('/users');
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/users')} className="shrink-0 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          <ArrowLeft02Icon size={20} />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {isEdit ? 'Edit User' : 'Create User'}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isEdit ? 'Update the details and permissions of this user.' : 'Add a new user and assign their access level.'}
          </p>
        </div>
      </div>

      <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-md">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input 
                  id="name" 
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input 
                  id="email" 
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="john@example.com"
                  required
                  disabled={isEdit}
                  className={isEdit ? "bg-zinc-50 dark:bg-zinc-900 cursor-not-allowed" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input 
                  id="phone" 
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+1 555-0123"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">
                  {isEdit ? 'New Password (Optional)' : 'Password'}
                </Label>
                <Input 
                  id="password" 
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder={isEdit ? "Leave blank to keep current" : "Minimum 8 characters"}
                  required={!isEdit}
                  minLength={8}
                />
              </div>
            </div>

            <hr className="border-zinc-200 dark:border-zinc-800" />

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <UserIcon size={16} className="text-zinc-500" /> Access & Permissions
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={formData.role} onValueChange={(val) => handleChange('role', val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                      {isSuperAdmin && <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>}
                      <SelectItem value="TENANT_ADMIN">Tenant Admin</SelectItem>
                      <SelectItem value="STORE_MANAGER">Store Manager</SelectItem>
                      <SelectItem value="WAITER">Waiter</SelectItem>
                      <SelectItem value="CASHIER">Cashier</SelectItem>
                      <SelectItem value="KITCHEN_STAFF">Kitchen Staff</SelectItem>
                      <SelectItem value="CUSTOMER">Customer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(val) => handleChange('status', val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INVITED">Invited</SelectItem>
                      <SelectItem value="SUSPENDED">Suspended</SelectItem>
                      <SelectItem value="DISABLED">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Tenant Context (Super Admin Only) */}
                {isSuperAdmin && formData.role !== 'SUPER_ADMIN' && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><Building04Icon size={14}/> Tenant Assignment</Label>
                    <Select value={formData.tenantId} onValueChange={(val) => handleChange('tenantId', val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Tenant" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (Platform level)</SelectItem>
                        {tenants.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Store Context */}
                {['STORE_MANAGER', 'WAITER', 'CASHIER', 'KITCHEN_STAFF'].includes(formData.role) && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><Store01Icon size={14}/> Store Assignment</Label>
                    <Select 
                      value={formData.storeId} 
                      onValueChange={(val) => handleChange('storeId', val)}
                      disabled={isSuperAdmin && formData.tenantId === 'none'}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Store" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {stores.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="button" variant="ghost" onClick={() => navigate('/users')} className="mr-3">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={
                  isSubmitting || 
                  (isSuperAdmin && ['TENANT_ADMIN', 'CUSTOMER', 'STORE_MANAGER', 'WAITER', 'CASHIER', 'KITCHEN_STAFF'].includes(formData.role) && formData.tenantId === 'none') ||
                  (isSuperAdmin && ['STORE_MANAGER', 'WAITER', 'CASHIER', 'KITCHEN_STAFF'].includes(formData.role) && formData.storeId === 'none')
                }
              >
                {isSubmitting ? (
                  <><Loading03Icon className="animate-spin mr-2" size={16} /> {isEdit ? 'Saving...' : 'Creating...'}</>
                ) : (
                  isEdit ? 'Save Changes' : 'Create User'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
