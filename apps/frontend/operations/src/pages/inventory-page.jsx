import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@smo/ui';
import { Store01Icon } from 'hugeicons-react';
import api from '../lib/api';
import { useStoreSelection } from '../hooks/use-store-selection';
import { useEntitlements } from '../lib/entitlements';
import { useAuthStore } from '../store/authStore';
import { Inventory } from './inventory';
import { AdvancedInventory } from '../components/inventory/advanced-inventory';

/**
 * Inventory for the chosen store, in whichever system that store runs: Basic (stock and
 * recipes) or Advanced (also lots, suppliers, wastage and food cost). The mode is set per
 * store under Store settings → Inventory.
 */
export const InventoryPage = () => {
  const { storeId, setStoreId, stores, canSwitch } = useStoreSelection();
  const role = useAuthStore(s => s.user?.role);
  const isManager = ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER'].includes(role);
  const included = useEntitlements(s => s.loaded && s.features.includes('ADVANCED_INVENTORY'));
  const [modes, setModes] = useState({}); // storeId → 'BASIC' | 'ADVANCED'
  const mode = storeId ? modes[storeId] : null;

  useEffect(() => {
    if (!storeId) return undefined;
    let current = true;
    api.get(`/stores/${storeId}`)
      .then(res => { if (current) setModes(prev => ({ ...prev, [storeId]: res.data.data.inventoryMode === 'ADVANCED' ? 'ADVANCED' : 'BASIC' })); })
      // Not knowing falls back to Basic, which every store can use
      .catch(() => { if (current) setModes(prev => ({ ...prev, [storeId]: 'BASIC' })); });
    return () => { current = false; };
  }, [storeId]);

  if (!storeId || !mode) return <p className="text-sm text-zinc-500">Loading…</p>;

  if (mode === 'ADVANCED' && included) {
    const storeSelect = canSwitch ? (
      <Select value={storeId} onValueChange={setStoreId}>
        <SelectTrigger className="w-[200px] h-9 text-sm"><Store01Icon size={15} className="mr-1.5 text-zinc-400" /><SelectValue placeholder="Store" /></SelectTrigger>
        <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
      </Select>
    ) : null;
    return <AdvancedInventory key={storeId} storeId={storeId} storeSelect={storeSelect} />;
  }

  // Basic inventory is a manager's screen; staff work in Advanced (receiving, wastage, counts, checks)
  if (!isManager) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-10 text-center">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Inventory is looked after by your manager</p>
        <p className="mt-1 text-sm text-zinc-500 max-w-md mx-auto">When this store switches to Advanced inventory, you’ll receive deliveries, record wastage and do the daily checks here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {included && (
        <p className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm text-zinc-600 dark:text-zinc-300">
          Your plan includes Advanced inventory: use-by dates, suppliers, wastage and food cost.{' '}
          <Link to={`/dashboard/stores/${storeId}/edit?section=inventory`} className="font-semibold text-zinc-900 dark:text-zinc-100 underline underline-offset-2">Turn it on for this store</Link>
        </p>
      )}
      <Inventory storeId={storeId} stores={stores} onStoreChange={setStoreId} />
    </div>
  );
};
