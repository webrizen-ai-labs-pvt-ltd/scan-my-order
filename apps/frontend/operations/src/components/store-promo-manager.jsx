import React, { useState, useEffect } from 'react';
import { Card, CardContent, Button, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@smo/ui';
import { Loading03Icon, PlusSignIcon, Delete01Icon } from 'hugeicons-react';
import api from '../lib/api';

export const StorePromoManager = ({ storeId }) => {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    code: '',
    discountType: 'PERCENTAGE',
    discountValue: '',
    minOrderValue: 0,
    maxDiscount: '',
    isActive: true,
  });

  const fetchPromos = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/stores/${storeId}/promos`);
      setPromos(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch promo codes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromos();
  }, [storeId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        code: formData.code.toUpperCase(),
        discountValue: parseFloat(formData.discountValue),
        minOrderValue: parseInt(formData.minOrderValue) || 0,
        maxDiscount: formData.maxDiscount ? parseInt(formData.maxDiscount) : null
      };
      
      await api.post(`/stores/${storeId}/promos`, payload);
      setFormData({
        code: '', discountType: 'PERCENTAGE', discountValue: '', minOrderValue: 0, maxDiscount: '', isActive: true
      });
      setIsCreating(false);
      fetchPromos();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this promo code?")) return;
    try {
      await api.delete(`/stores/${storeId}/promos/${id}`);
      fetchPromos();
    } catch (err) {
      alert("Failed to delete promo code");
    }
  };

  if (loading) {
    return <div className="p-6 flex justify-center"><Loading03Icon className="animate-spin" size={24} /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Promo Codes</h3>
          <p className="text-sm text-zinc-500">Create coupons for discounts on customer orders.</p>
        </div>
        {!isCreating && (
          <Button onClick={() => setIsCreating(true)} size="sm">
            <PlusSignIcon size={16} className="mr-1" /> Create Promo
          </Button>
        )}
      </div>

      {isCreating && (
        <Card className="bg-zinc-50 dark:bg-zinc-900">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Promo Code</Label>
                  <Input 
                    required 
                    placeholder="e.g. FLAT50" 
                    value={formData.code} 
                    onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Discount Type</Label>
                  <Select value={formData.discountType} onValueChange={v => setFormData({...formData, discountType: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                      <SelectItem value="FLAT">Flat Amount (₹)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Discount Value {formData.discountType === 'PERCENTAGE' ? '(%)' : '(₹)'}</Label>
                  <Input 
                    type="number" 
                    required 
                    min="1"
                    max={formData.discountType === 'PERCENTAGE' ? '100' : undefined}
                    value={formData.discountValue} 
                    onChange={e => setFormData({...formData, discountValue: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Minimum Order Value (₹)</Label>
                  <Input 
                    type="number" 
                    min="0"
                    value={formData.minOrderValue} 
                    onChange={e => setFormData({...formData, minOrderValue: e.target.value})}
                  />
                </div>
                {formData.discountType === 'PERCENTAGE' && (
                  <div className="space-y-2">
                    <Label>Max Discount Cap (₹) - Optional</Label>
                    <Input 
                      type="number" 
                      min="0"
                      placeholder="e.g. 150"
                      value={formData.maxDiscount} 
                      onChange={e => setFormData({...formData, maxDiscount: e.target.value})}
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
                <Button type="submit">Create Promo</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-red-500">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {promos.map(promo => (
          <div key={promo.id} className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex justify-between items-start bg-white dark:bg-zinc-950">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-lg text-emerald-600 tracking-wide">{promo.code}</span>
                {!promo.isActive && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Inactive</span>}
              </div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {promo.discountType === 'PERCENTAGE' ? `${promo.discountValue}% OFF` : `₹${promo.discountValue} OFF`}
                {promo.maxDiscount && ` (Up to ₹${promo.maxDiscount})`}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Min Order: ₹{promo.minOrderValue}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(promo.id)} className="text-zinc-400 hover:text-red-500">
              <Delete01Icon size={18} />
            </Button>
          </div>
        ))}
        {promos.length === 0 && !isCreating && (
          <div className="col-span-full py-8 text-center text-zinc-500 border border-dashed rounded-xl border-zinc-300 dark:border-zinc-800">
            No promo codes found.
          </div>
        )}
      </div>
    </div>
  );
};
