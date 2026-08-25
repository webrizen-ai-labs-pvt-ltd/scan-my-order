import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent, Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Skeleton } from '@smo/ui';
import { Store01Icon, Money01Icon } from 'hugeicons-react';

export const POS = () => {
  const { user, token } = useAuthStore();
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(user?.store?.id || null);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrders = async (storeIdToFetch) => {
    if (!storeIdToFetch) return;
    setLoading(true);
    try {
      const res = await api.get(`/stores/${storeIdToFetch}/orders`); // Gets all active (not settled/cancelled)
      if (res.data.success) {
        setOrders(res.data.data);
      }
    } catch (err) {
      setError('Failed to fetch orders');
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
      fetchOrders(selectedStoreId);
      
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const eventSource = new EventSource(`${baseUrl}/stores/${selectedStoreId}/orders/stream?token=${token}`);
      
      eventSource.onmessage = (event) => {
        try {
          // Refresh on any order event for POS to stay perfectly synced
          fetchOrders(selectedStoreId);
        } catch(e) {}
      };

      return () => eventSource.close();
    }
  }, [selectedStoreId, token]);

  const settleOrder = async (orderId) => {
    try {
      await api.patch(`/stores/${selectedStoreId}/orders/${orderId}/status`, { status: 'SETTLED' });
      setOrders(prev => prev.filter(o => o.id !== orderId));
    } catch (err) {
      console.error(err);
      setError('Failed to settle order');
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'PENDING_VERIFICATION': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'PENDING_PAYMENT': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'PROCESSING': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'READY': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'SERVED': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-zinc-100 text-zinc-800 border-zinc-200';
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Point of Sale (POS)</h1>
          <p className="text-sm text-zinc-500">Manage all active orders and settlements.</p>
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

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <Money01Icon size={48} className="text-zinc-300 mb-4" />
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">No Active Orders</h3>
          <p className="text-zinc-500">All tables are clear.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max">
          {orders.map(order => (
            <Card key={order.id} className="border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-0">
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/50 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-xl text-zinc-900 dark:text-zinc-100">Table {order.table?.tableNumber || 'N/A'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getStatusColor(order.status)}`}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">
                      {order.origin} • {order.paymentModel}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-xl text-zinc-900 dark:text-zinc-100">₹{order.totalAmount}</div>
                  </div>
                </div>
                
                <div className="p-4 bg-zinc-50/50 dark:bg-zinc-900/50 max-h-32 overflow-y-auto">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm mb-1 last:mb-0">
                      <span className="text-zinc-700 dark:text-zinc-300">
                        <span className="font-medium mr-1 text-zinc-500">{item.quantity}x</span> 
                        {item.menuItem?.name}
                      </span>
                      <span className="text-zinc-500">₹{item.priceAtOrder * item.quantity}</span>
                    </div>
                  ))}
                </div>

                <div className="p-3 border-t border-zinc-100 dark:border-zinc-800/50 bg-white dark:bg-zinc-900">
                  <Button 
                    className="w-full h-10 font-semibold"
                    disabled={order.status === 'PENDING_PAYMENT'} 
                    onClick={() => settleOrder(order.id)}
                  >
                    <Money01Icon size={18} className="mr-2" />
                    {order.paymentModel === 'PREPAID' ? 'Settle (Prepaid)' : 'Collect Cash & Settle'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
