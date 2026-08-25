import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Badge, Skeleton } from '@smo/ui';
import { 
  Loading03Icon, 
  Mail01Icon, 
  Store01Icon, 
  Building02Icon, 
  Shield01Icon, 
  AlertCircleIcon, 
  CheckmarkCircle02Icon, 
  UserIcon, 
  PlusSignIcon 
} from 'hugeicons-react';

const TAILWIND_COLORS = [
  { name: 'Red', value: 'red', hex: '#ef4444' },
  { name: 'Orange', value: 'orange', hex: '#f97316' },
  { name: 'Amber', value: 'amber', hex: '#f59e0b' },
  { name: 'Yellow', value: 'yellow', hex: '#eab308' },
  { name: 'Lime', value: 'lime', hex: '#84cc16' },
  { name: 'Green', value: 'green', hex: '#22c55e' },
  { name: 'Emerald', value: 'emerald', hex: '#10b981' },
  { name: 'Teal', value: 'teal', hex: '#14b8a6' },
  { name: 'Cyan', value: 'cyan', hex: '#06b6d4' },
  { name: 'Sky', value: 'sky', hex: '#0ea5e9' },
  { name: 'Blue', value: 'blue', hex: '#3b82f6' },
  { name: 'Indigo', value: 'indigo', hex: '#6366f1' },
  { name: 'Violet', value: 'violet', hex: '#8b5cf6' },
  { name: 'Purple', value: 'purple', hex: '#a855f7' },
  { name: 'Fuchsia', value: 'fuchsia', hex: '#d946ef' },
  { name: 'Pink', value: 'pink', hex: '#ec4899' },
  { name: 'Rose', value: 'rose', hex: '#f43f5e' },
  { name: 'Slate', value: 'slate', hex: '#64748b' },
  { name: 'Zinc', value: 'zinc', hex: '#71717a' },
];

export const BrandForm = ({ initialData }) => {
  const isEditing = !!initialData;
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', error: false });
  
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    slug: initialData?.slug || '',
    status: initialData?.status || 'ACTIVE',
    logo: initialData?.logo || '',
    brandColor: initialData?.brandColor || 'blue',
    description: initialData?.description || '',
    gstin: initialData?.gstin || '',
    companyLegalName: initialData?.companyLegalName || '',
    registeredAddress: initialData?.registeredAddress || ''
  });

  const [provisionMode, setProvisionMode] = useState('CREATE');
  const [existingUsers, setExistingUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const [adminData, setAdminData] = useState({
    name: '',
    email: '',
    phone: '',
    password: ''
  });

  useEffect(() => {
    if (!isEditing) {
      setIsLoadingUsers(true);
      api.get('/users?role=TENANT_ADMIN&limit=1000').then(res => {
        if (res.data.success) {
          setExistingUsers(Array.isArray(res.data.data) ? res.data.data : []);
        }
      }).catch(console.error).finally(() => setIsLoadingUsers(false));
    }
  }, [isEditing]);

  const generateSlug = (name) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    setFormData(prev => ({
      ...prev,
      name,
      slug: !isEditing ? generateSlug(name) : prev.slug
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMsg({ text: '', error: false });
    try {
      if (isEditing) {
        await api.put(`/tenants/${initialData.id}`, formData);
        navigate('/brands');
      } else {
        await api.post('/tenants', {
          ...formData,
          ...(provisionMode === 'CREATE' ? { adminUser: adminData } : { adminUserId: selectedUserId })
        });
        navigate('/brands');
      }
    } catch (error) {
      setStatusMsg({ 
        text: error.response?.data?.error?.message || 'Failed to save brand', 
        error: true 
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure? This will delete the brand, all its stores, and all its users permanently.")) {
      setSubmitting(true);
      try {
        await api.delete(`/tenants/${initialData.id}`);
        navigate('/brands');
      } catch (error) {
        setStatusMsg({ 
          text: error.response?.data?.error?.message || 'Failed to delete brand', 
          error: true 
        });
        setSubmitting(false);
      }
    }
  };

  const selectedColor = TAILWIND_COLORS.find(c => c.value === formData.brandColor);

  return (
    <div className="space-y-8 w-full">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {isEditing ? 'Edit Brand' : 'Create Brand'}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isEditing ? 'Manage brand details and associated stores.' : 'Set up a new brand and its first owner.'}
          </p>
        </div>
        {formData.brandColor && selectedColor && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border border-zinc-200 dark:border-zinc-800" style={{ backgroundColor: selectedColor.hex }} />
            <span className="text-xs text-zinc-500">{selectedColor.name}</span>
          </div>
        )}
      </div>

      {statusMsg.text && (
        <div
          className={`flex items-center gap-2 text-sm rounded-lg px-4 py-3 border ${
            statusMsg.error
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}
        >
          {statusMsg.error ? <AlertCircleIcon size={16} /> : <CheckmarkCircle02Icon size={16} />}
          {statusMsg.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-mono">01</span>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Building02Icon size={16} className="text-zinc-500" />
              Brand Information
            </h3>
            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-zinc-600 dark:text-zinc-400">Brand Name *</Label>
                  <Input id="name" required value={formData.name} onChange={handleNameChange} placeholder="e.g. Starbucks" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="slug" className="text-zinc-600 dark:text-zinc-400">URL Slug</Label>
                  <Input id="slug" required disabled={isEditing} value={formData.slug} onChange={e => setFormData(p => ({...p, slug: e.target.value}))} placeholder="starbucks" className="font-mono" />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="logo" className="text-zinc-600 dark:text-zinc-400">Logo URL</Label>
                  <Input id="logo" value={formData.logo} onChange={e => setFormData(p => ({...p, logo: e.target.value}))} placeholder="https://example.com/logo.png" />
                  <p className="text-xs text-zinc-400">This logo will be inherited by all your stores.</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-zinc-600 dark:text-zinc-400">Primary Brand Color</Label>
                  <Select value={formData.brandColor} onValueChange={v => setFormData(p => ({...p, brandColor: v}))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a color" />
                    </SelectTrigger>
                    <SelectContent>
                      {TAILWIND_COLORS.map(color => (
                        <SelectItem key={color.value} value={color.value}>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full border border-zinc-200 dark:border-zinc-800" style={{ backgroundColor: color.hex }} />
                            {color.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="description" className="text-zinc-600 dark:text-zinc-400">Brand Description</Label>
                  <Input id="description" value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} placeholder="A short description of the brand" />
                </div>

                {isEditing && (
                  <div className="space-y-1.5">
                    <Label className="text-zinc-600 dark:text-zinc-400">Status</Label>
                    <Select value={formData.status} onValueChange={v => setFormData(p => ({...p, status: v}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="SUSPENDED">Suspended</SelectItem>
                        <SelectItem value="DISABLED">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-mono">02</span>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Shield01Icon size={16} className="text-zinc-500" />
              Legal & Compliance
            </h3>
            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <Label htmlFor="companyLegalName" className="text-zinc-600 dark:text-zinc-400">Company Legal Name</Label>
                  <Input id="companyLegalName" value={formData.companyLegalName} onChange={e => setFormData(p => ({...p, companyLegalName: e.target.value}))} placeholder="e.g. Starbucks Coffee Company Ltd." />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gstin" className="text-zinc-600 dark:text-zinc-400">GSTIN (Tax ID)</Label>
                  <Input id="gstin" value={formData.gstin} onChange={e => setFormData(p => ({...p, gstin: e.target.value}))} placeholder="e.g. 22AAAAA0000A1Z5" className="uppercase font-mono" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="registeredAddress" className="text-zinc-600 dark:text-zinc-400">Registered Address</Label>
                  <Input id="registeredAddress" value={formData.registeredAddress} onChange={e => setFormData(p => ({...p, registeredAddress: e.target.value}))} placeholder="Full legal headquarters address" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {!isEditing && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-mono">03</span>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <UserIcon size={16} className="text-zinc-500" />
                Provision Owner
              </h3>
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
            </div>

            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-500">A brand requires at least one owner to manage billing and global settings.</p>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <Label className="text-zinc-600 dark:text-zinc-400">Full Name *</Label>
                      <Input required={provisionMode === 'CREATE'} value={adminData.name} onChange={e => setAdminData(p => ({...p, name: e.target.value}))} placeholder="John Doe" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zinc-600 dark:text-zinc-400">Email *</Label>
                      <Input required={provisionMode === 'CREATE'} type="email" value={adminData.email} onChange={e => setAdminData(p => ({...p, email: e.target.value}))} placeholder="john@example.com" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zinc-600 dark:text-zinc-400">Phone (Optional)</Label>
                      <Input value={adminData.phone} onChange={e => setAdminData(p => ({...p, phone: e.target.value}))} placeholder="+91 98765 43210" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zinc-600 dark:text-zinc-400">Initial Password *</Label>
                      <Input required={provisionMode === 'CREATE'} type="password" value={adminData.password} onChange={e => setAdminData(p => ({...p, password: e.target.value}))} placeholder="••••••••" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 max-w-md">
                    <Label className="text-zinc-600 dark:text-zinc-400">Select Existing Tenant Admin</Label>
                    {isLoadingUsers ? (
                      <Skeleton className="h-10 w-full bg-zinc-100 dark:bg-zinc-800" />
                    ) : (
                      <>
                        <Select value={selectedUserId} onValueChange={setSelectedUserId} required={provisionMode === 'SELECT'}>
                          <SelectTrigger><SelectValue placeholder="Choose a user" /></SelectTrigger>
                          <SelectContent>
                            {existingUsers.length === 0 && <SelectItem value="none" disabled>No users found</SelectItem>}
                            {existingUsers.map(u => (
                              <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-zinc-400">Warning: Re-assigning an existing Tenant Admin will move them to this new Brand.</p>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <Button type="button" variant="ghost" onClick={() => navigate('/brands')} disabled={submitting} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loading03Icon className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create Brand'}
          </Button>
        </div>
      </form>

      {isEditing && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <CardHeader>
              <CardTitle className="text-base text-zinc-900 dark:text-zinc-100">Owners</CardTitle>
            </CardHeader>
            <CardContent>
              {initialData.users && initialData.users.length > 0 ? (
                <ul className="space-y-2">
                  {initialData.users.map(u => (
                    <li key={u.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                          <span className="font-semibold text-xs text-zinc-600 dark:text-zinc-300">{u.name?.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{u.name}</p>
                          <div className="flex items-center gap-1 text-xs text-zinc-500">
                            <Mail01Icon size={12} /> <span className="truncate">{u.email}</span>
                          </div>
                        </div>
                      </div>
                      <Badge variant={u.status === 'ACTIVE' ? 'default' : 'secondary'}>{u.status}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">No owners found.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base text-zinc-900 dark:text-zinc-100">Stores</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => navigate('/stores/create')} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                <PlusSignIcon size={14} /> Add
              </Button>
            </CardHeader>
            <CardContent>
              {initialData.stores && initialData.stores.length > 0 ? (
                <ul className="space-y-2">
                  {initialData.stores.map(s => (
                    <li key={s.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                          <Store01Icon size={14} className="text-zinc-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{s.name}</p>
                          <p className="text-xs text-zinc-500 font-mono">/{s.slug}</p>
                        </div>
                      </div>
                      <Badge variant={s.status === 'ACTIVE' ? 'default' : 'secondary'}>{s.status}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">No stores linked to this brand.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {isEditing && (
        <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800 mt-8">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Danger Zone</h3>
          <p className="text-sm text-zinc-500 mb-4">Permanently delete this brand and all its associated stores, users, and data. This action cannot be undone.</p>
          <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
            Delete Brand
          </Button>
        </div>
      )}
    </div>
  );
};