import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent, Button, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Skeleton } from '@smo/ui';
import { PlusSignIcon, RefreshIcon, AlertCircleIcon, Tick02Icon, Cancel01Icon, Store01Icon } from 'hugeicons-react';

export const Inventory = () => {
  const { user } = useAuthStore();
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(user?.store?.id || null);

  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals / Forms
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ name: '', unit: 'KG', lowStockThreshold: 0 });

  const [transactionModal, setTransactionModal] = useState({ isOpen: false, materialId: null, type: 'RESTOCK' });
  const [transactionForm, setTransactionForm] = useState({ quantity: '', reference: '' });

  const fetchMaterials = async (storeIdToFetch) => {
    if (!storeIdToFetch) return;
    setLoading(true);
    try {
      const res = await api.get(`/stores/${storeIdToFetch}/inventory/materials`);
      if (res.data.success) {
        setMaterials(res.data.data);
      }
    } catch (err) {
      setError('Failed to fetch inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.store) {
      api.get('/stores').then(res => {
        if (res.data.success && res.data.data.length > 0) {
          setStores(res.data.data);
          if (!selectedStoreId) setSelectedStoreId(res.data.data[0].id);
        }
      });
    }
  }, [user]);

  useEffect(() => {
    if (selectedStoreId) {
      fetchMaterials(selectedStoreId);
    }
  }, [selectedStoreId]);

  const handleCreateMaterial = async () => {
    if (!newMaterial.name || !selectedStoreId) return;
    try {
      await api.post(`/stores/${selectedStoreId}/inventory/materials`, {
        ...newMaterial,
        lowStockThreshold: parseFloat(newMaterial.lowStockThreshold) || 0
      });
      setIsAddingMaterial(false);
      setNewMaterial({ name: '', unit: 'KG', lowStockThreshold: 0 });
      fetchMaterials(selectedStoreId);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Error creating material');
    }
  };

  const handleTransaction = async () => {
    if (!transactionForm.quantity || !selectedStoreId) return;
    try {
      await api.post(`/stores/${selectedStoreId}/inventory/transactions`, {
        materialId: transactionModal.materialId,
        type: transactionModal.type,
        quantity: parseFloat(transactionForm.quantity),
        reference: transactionForm.reference
      });
      setTransactionModal({ isOpen: false, materialId: null, type: 'RESTOCK' });
      setTransactionForm({ quantity: '', reference: '' });
      fetchMaterials(selectedStoreId);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Error creating transaction');
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Inventory Management</h2>
          <p className="text-sm text-zinc-500">Manage raw materials and track stock levels</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {!user?.store && stores.length > 0 && (
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger className="w-[200px] h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-l-full">
                <Store01Icon size={16} className="mr-1 text-zinc-400" />
                <SelectValue placeholder="Select a store" />
              </SelectTrigger>
              <SelectContent>
                {stores.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={() => fetchMaterials(selectedStoreId)} disabled={!selectedStoreId} className="rounded-l-none rounded-r-none">
            <RefreshIcon size={16} className="mr-1" /> Refresh
          </Button>
          <Button onClick={() => setIsAddingMaterial(true)} disabled={!selectedStoreId} className="rounded-l-none">
            <PlusSignIcon size={16} className="mr-1" /> Add Material
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md">
          <AlertCircleIcon size={16} /> {error}
        </div>
      )}

      {isAddingMaterial && (
        <Card className="mb-6 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5">
              <Label>Material Name *</Label>
              <Input placeholder="e.g. Coffee Beans" value={newMaterial.name} onChange={e => setNewMaterial(p => ({...p, name: e.target.value}))} />
            </div>
            <div className="space-y-1.5">
              <Label>Unit of Measure *</Label>
              <Select value={newMaterial.unit} onValueChange={v => setNewMaterial(p => ({...p, unit: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="KG">Kilogram (KG)</SelectItem>
                  <SelectItem value="GRAM">Gram (g)</SelectItem>
                  <SelectItem value="LITER">Liter (L)</SelectItem>
                  <SelectItem value="MILLILITER">Milliliter (mL)</SelectItem>
                  <SelectItem value="PIECE">Piece / Unit</SelectItem>
                  <SelectItem value="DOZEN">Dozen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Low Stock Threshold</Label>
              <Input type="number" placeholder="0" value={newMaterial.lowStockThreshold} onChange={e => setNewMaterial(p => ({...p, lowStockThreshold: e.target.value}))} />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setIsAddingMaterial(false)}><Cancel01Icon size={16} /></Button>
              <Button className="flex-1" onClick={handleCreateMaterial}><Tick02Icon size={16} className="mr-2" /> Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {transactionModal.isOpen && (
        <Card className="mb-6 border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-900/10">
          <CardContent className="p-4">
            <h4 className="font-semibold mb-4 text-blue-800 dark:text-blue-300">
              {transactionModal.type === 'RESTOCK' ? 'Add Stock' : transactionModal.type === 'CONSUME' ? 'Consume Stock' : 'Adjust Stock'} 
              for {materials.find(m => m.id === transactionModal.materialId)?.name}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-1.5">
                <Label>Transaction Type</Label>
                <Select value={transactionModal.type} onValueChange={v => setTransactionModal(p => ({...p, type: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RESTOCK">Restock (+)</SelectItem>
                    <SelectItem value="CONSUME">Consume (-)</SelectItem>
                    <SelectItem value="ADJUST">Adjust (+/-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quantity *</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={transactionForm.quantity} onChange={e => setTransactionForm(p => ({...p, quantity: e.target.value}))} />
              </div>
              <div className="space-y-1.5">
                <Label>Reference / Notes (Optional)</Label>
                <Input placeholder="e.g. Invoice #123" value={transactionForm.reference} onChange={e => setTransactionForm(p => ({...p, reference: e.target.value}))} />
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setTransactionModal({ isOpen: false, materialId: null, type: 'RESTOCK' })}>Cancel</Button>
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleTransaction}>Confirm</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : materials.length > 0 ? (
          <div className="grid gap-3">
            {materials.map((mat) => {
              const isLowStock = mat.currentStock <= mat.lowStockThreshold;
              return (
                <div key={mat.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-zinc-300 transition-colors shadow-sm">
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      {mat.name}
                      {isLowStock && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Low Stock</span>}
                    </h3>
                    <p className="text-sm text-zinc-500 mt-1">Threshold: {mat.lowStockThreshold} {mat.unit}</p>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className={`text-xl font-bold ${isLowStock ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                        {mat.currentStock.toFixed(2)}
                      </div>
                      <div className="text-xs text-zinc-500 uppercase tracking-wider">{mat.unit}</div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        setTransactionModal({ isOpen: true, materialId: mat.id, type: 'RESTOCK' });
                        setTransactionForm({ quantity: '', reference: '' });
                      }}>
                        Update Stock
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 text-zinc-500">
            <div className="bg-zinc-100 dark:bg-zinc-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <PlusSignIcon size={24} className="text-zinc-400" />
            </div>
            <p>No raw materials found.</p>
            <p className="text-sm mt-1">Click 'Add Material' to get started with inventory tracking.</p>
          </div>
        )}
      </div>
    </div>
  );
};
