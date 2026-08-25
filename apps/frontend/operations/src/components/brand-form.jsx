import React, { useState } from 'react';
import api from '../lib/api';
import { Card, CardContent, Input, Label, Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@smo/ui';
import { 
  Loading03Icon, 
  Building02Icon, 
  Shield01Icon, 
  AlertCircleIcon, 
  CheckmarkCircle02Icon 
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

export const BrandForm = ({ initialData, onSuccess }) => {
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', error: false });
  
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    logo: initialData?.logo || '',
    brandColor: initialData?.brandColor || 'blue',
    description: initialData?.description || '',
    gstin: initialData?.gstin || '',
    companyLegalName: initialData?.companyLegalName || '',
    registeredAddress: initialData?.registeredAddress || ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMsg({ text: '', error: false });
    try {
      await api.put(`/tenants/${initialData.id}`, formData);
      setStatusMsg({ text: 'Brand updated successfully!', error: false });
      if (onSuccess) onSuccess();
    } catch (error) {
      setStatusMsg({ 
        text: error.response?.data?.error?.message || 'Failed to save brand', 
        error: true 
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedColor = TAILWIND_COLORS.find(c => c.value === formData.brandColor);

  return (
    <div className="space-y-8 w-full">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Brand Settings
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage your brand details, identity, and legal information.
          </p>
        </div>
        {formData.brandColor && selectedColor && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border border-zinc-200 dark:border-zinc-800 shadow-sm" style={{ backgroundColor: selectedColor.hex }} />
            <span className="text-xs text-zinc-500 font-medium">{selectedColor.name}</span>
          </div>
        )}
      </div>

      {statusMsg.text && (
        <div
          className={`flex items-center gap-2 text-sm rounded-lg px-4 py-3 border ${
            statusMsg.error
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
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
                  <Input 
                    id="name" 
                    required 
                    value={formData.name} 
                    onChange={e => setFormData(p => ({...p, name: e.target.value}))} 
                    placeholder="e.g. Starbucks" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="slug" className="text-zinc-600 dark:text-zinc-400">URL Slug (Read-only)</Label>
                  <Input 
                    id="slug" 
                    disabled 
                    value={initialData?.slug || ''} 
                    className="font-mono text-zinc-500 bg-zinc-50 dark:bg-zinc-900/50" 
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="logo" className="text-zinc-600 dark:text-zinc-400">Logo URL</Label>
                  <Input 
                    id="logo" 
                    value={formData.logo} 
                    onChange={e => setFormData(p => ({...p, logo: e.target.value}))} 
                    placeholder="https://example.com/logo.png" 
                  />
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
                  <Input 
                    id="description" 
                    value={formData.description} 
                    onChange={e => setFormData(p => ({...p, description: e.target.value}))} 
                    placeholder="A short description of the brand" 
                  />
                </div>
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
                  <Input 
                    id="companyLegalName" 
                    value={formData.companyLegalName} 
                    onChange={e => setFormData(p => ({...p, companyLegalName: e.target.value}))} 
                    placeholder="e.g. Starbucks Coffee Company Ltd." 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gstin" className="text-zinc-600 dark:text-zinc-400">GSTIN (Tax ID)</Label>
                  <Input 
                    id="gstin" 
                    value={formData.gstin} 
                    onChange={e => setFormData(p => ({...p, gstin: e.target.value}))} 
                    placeholder="e.g. 22AAAAA0000A1Z5" 
                    className="uppercase font-mono" 
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="registeredAddress" className="text-zinc-600 dark:text-zinc-400">Registered Address</Label>
                  <Input 
                    id="registeredAddress" 
                    value={formData.registeredAddress} 
                    onChange={e => setFormData(p => ({...p, registeredAddress: e.target.value}))} 
                    placeholder="Full legal headquarters address" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <div className="flex justify-end pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <Button type="submit" disabled={submitting} className="min-w-[120px]">
            {submitting ? (
              <Loading03Icon className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};
