import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@smo/ui';
import { Store01Icon } from 'hugeicons-react';
import { POSTerminal } from '../components/pos-terminal';
import { POSActiveOrders } from '../components/pos-active-orders';

export const POS = () => {
  const { user, token } = useAuthStore();
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(user?.store?.id || null);
  const [activeTab, setActiveTab] = useState('terminal'); // 'terminal' | 'active_orders'

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

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6 shrink-0 gap-x-2">
        <div className="flex items-center justify-between gap-6 w-full">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Point of Sale</h1>
            <p className="text-sm text-zinc-500">Enterprise terminal & active orders.</p>
          </div>
          
          {/* Tabs */}
          <div className="flex bg-zinc-200 dark:bg-zinc-800 p-1 rounded-lg ml-8 h-10">
            <button 
              className={`px-6 text-sm font-semibold rounded-md transition-colors ${activeTab === 'terminal' ? 'bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              onClick={() => setActiveTab('terminal')}
            >
              New Order
            </button>
            <button 
              className={`px-6 text-sm font-semibold rounded-md transition-colors ${activeTab === 'active_orders' ? 'bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              onClick={() => setActiveTab('active_orders')}
            >
              Active Orders
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!user?.store && (
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger className="w-[200px] h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
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
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden h-full">
        {selectedStoreId ? (
          activeTab === 'terminal' ? (
            <POSTerminal selectedStoreId={selectedStoreId} token={token} />
          ) : (
            <POSActiveOrders selectedStoreId={selectedStoreId} token={token} />
          )
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-500">
            Please select a store to continue.
          </div>
        )}
      </div>

    </div>
  );
};
