import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@smo/ui';
import { RefreshIcon } from 'hugeicons-react';
import api from '../../lib/api';
import { card, errorText } from './inv-format';
import { Notice } from './inv-shared';
import { InvToday } from './inv-today';
import { InvStock } from './inv-stock';
import { InvReceive } from './inv-receive';
import { InvStanding } from './inv-standing';
import { InvWastage } from './inv-wastage';
import { InvSuppliers } from './inv-suppliers';
import { InvFoodCost } from './inv-food-cost';
import { WasteDialog } from './waste-dialog';

const TABS = [
  ['today', 'Today'],
  ['stock', 'Stock'],
  ['receive', 'Receive'],
  ['standing', 'Standing deliveries'],
  ['wastage', 'Wastage'],
  ['suppliers', 'Suppliers'],
  ['food-cost', 'Food cost'],
];

/**
 * Advanced inventory for one store: deliveries in lots with use-by dates, suppliers, wastage,
 * daily counts and food cost. The stock figure itself is the same one Basic inventory uses.
 *
 * @param {{ storeId: string, storeSelect?: React.ReactNode }} props
 */
export const AdvancedInventory = ({ storeId, storeSelect }) => {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([id]) => id === params.get('tab')) ? params.get('tab') : 'today';
  const setTab = (id) => setParams(prev => {
    const next = new URLSearchParams(prev);
    if (id === 'today') next.delete('tab'); else next.set('tab', id);
    return next;
  }, { replace: true });

  const [overview, setOverview] = useState(null);
  const [suppliers, setSuppliers] = useState(null);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);
  const [waste, setWaste] = useState(null); // { material, lot? }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, s] = await Promise.all([
        api.get(`/stores/${storeId}/inventory/advanced/overview`),
        api.get(`/stores/${storeId}/inventory/advanced/suppliers`),
      ]);
      setOverview(o.data.data);
      setSuppliers(s.data.data);
      setVersion(v => v + 1);
    } catch (err) {
      setNotice({ text: errorText(err, 'Could not load inventory'), error: true });
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { setOverview(null); setSuppliers(null); setNotice(null); load(); }, [load]);

  /** Something changed stock or setup: say so, and show the new figures */
  const onChanged = (message) => {
    setNotice(message ? { text: message, error: false } : null);
    load();
  };
  const openWaste = (material, lot) => { if (material) setWaste({ material, lot }); };

  const attention = overview ? overview.attention.expired.length : 0;

  return (
    <div className="flex flex-col gap-5 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Inventory</h1>
          <p className="text-sm text-zinc-500">Deliveries, use-by dates, wastage and what each dish costs to make.</p>
        </div>
        <div className="flex items-center gap-2">
          {storeSelect}
          <Button variant="outline" size="sm" className="h-9" disabled={loading} onClick={() => { setNotice(null); load(); }}>
            <RefreshIcon size={14} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-zinc-200 dark:border-zinc-800" aria-label="Inventory sections">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}
            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 ${tab === id ? 'border-amber-500 font-semibold text-zinc-900 dark:text-zinc-50' : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>
            {label}
            {id === 'today' && attention > 0 && <span className="ml-1.5 inline-block min-w-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-semibold text-center tabular-nums" aria-label={`${attention} expired`}>{attention}</span>}
          </button>
        ))}
      </nav>

      <Notice msg={notice} />

      {overview === null ? (
        !notice?.error && <p className={`${card} px-5 py-5 text-sm text-zinc-500`}>Loading…</p>
      ) : (
        <>
          {tab === 'today' && <InvToday storeId={storeId} overview={overview} onChanged={onChanged} onWaste={openWaste} onReceive={() => setTab('receive')} />}
          {tab === 'stock' && <InvStock storeId={storeId} overview={overview} onChanged={onChanged} onWaste={openWaste} />}
          {tab === 'receive' && <InvReceive storeId={storeId} overview={overview} suppliers={suppliers || []} onChanged={onChanged} onGoTo={setTab} />}
          {tab === 'standing' && <InvStanding storeId={storeId} overview={overview} suppliers={suppliers || []} onChanged={onChanged} />}
          {tab === 'wastage' && <InvWastage storeId={storeId} overview={overview} version={version} onWaste={openWaste} />}
          {tab === 'suppliers' && <InvSuppliers storeId={storeId} suppliers={suppliers} onChanged={onChanged} />}
          {tab === 'food-cost' && <InvFoodCost storeId={storeId} version={version} />}
        </>
      )}

      {waste && (
        <WasteDialog
          storeId={storeId}
          material={waste.material}
          lot={waste.lot}
          reasons={overview.wasteReasons}
          defaultReason={waste.lot?.state === 'EXPIRED' ? 'Expired' : ''}
          onClose={() => setWaste(null)}
          onDone={() => { const name = waste.material.name; setWaste(null); onChanged(`Wastage of ${name} recorded.`); }}
        />
      )}
    </div>
  );
};
