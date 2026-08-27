import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { ChefHatIcon, CheckmarkBadge01Icon, DeliveryBox01Icon, Time02Icon, Cancel01Icon } from 'hugeicons-react';
import api from '../lib/api';
import { getSessionId } from '../lib/session';

const STATUS_MAPPING = {
  DRAFT: { label: 'Draft', icon: Time02Icon, color: 'text-zinc-500', bg: 'bg-zinc-100' },
  PENDING_VERIFICATION: { label: 'Waiting for Waiter', icon: Time02Icon, color: 'text-amber-600', bg: 'bg-amber-100' },
  PENDING_PAYMENT: { label: 'Pending Payment', icon: Time02Icon, color: 'text-amber-600', bg: 'bg-amber-100' },
  PROCESSING: { label: 'In Kitchen', icon: ChefHatIcon, color: 'text-blue-600', bg: 'bg-blue-100' },
  READY: { label: 'Ready', icon: CheckmarkBadge01Icon, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  SERVED: { label: 'Served', icon: DeliveryBox01Icon, color: 'text-purple-600', bg: 'bg-purple-100' },
  SETTLED: { label: 'Completed', icon: CheckmarkBadge01Icon, color: 'text-zinc-600', bg: 'bg-zinc-100' },
  CANCELLED: { label: 'Cancelled', icon: Cancel01Icon, color: 'text-rose-600', bg: 'bg-rose-100' },
};

export const LiveOrders = ({ storeId }) => {
  const { token, user } = useAuthStore();
  const [orders, setOrders] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    const sessionId = getSessionId();
    if (!token && !sessionId) return;
    if (!storeId) return;

    // Fetch initial active orders
    const fetchOrders = async () => {
      try {
        const queryParams = token ? '' : `?sessionId=${sessionId}`;
        const res = await api.get(`/public/stores/${storeId}/orders/me${queryParams}`);
        setOrders(res.data.data || []);
      } catch (err) {
        console.error("Failed to fetch initial active orders", err);
      }
    };
    fetchOrders();

    const sseUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/public/customer/stream?${token ? `token=${token}` : `sessionId=${sessionId}`}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type.startsWith('ORDER_')) {
          setOrders(prev => {
            const existingIdx = prev.findIndex(o => o.id === data.data.id);
            if (existingIdx >= 0) {
              const newOrders = [...prev];
              newOrders[existingIdx] = data.data;
              return newOrders;
            }
            return [data.data, ...prev];
          });
        }
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };

    return () => eventSource.close();
  }, [token, storeId]);

  const activeOrders = orders.filter(o => ['PENDING_VERIFICATION', 'PROCESSING', 'READY', 'SERVED'].includes(o.status));

  if (activeOrders.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-[88px] left-4 right-4 z-40 mx-auto max-w-md animate-in slide-in-from-bottom-5">
        <button
          onClick={() => setIsOpen(true)}
          className="flex w-full items-center justify-between rounded-2xl bg-zinc-900 p-3.5 px-4 text-white shadow-xl dark:bg-zinc-800"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <ChefHatIcon size={20} />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/80">Live Orders</p>
              <p className="text-sm font-bold leading-none">{activeOrders.length} active</p>
            </div>
          </div>
          <div className="text-xs font-semibold px-2 py-1 bg-white/20 rounded-lg">View</div>
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="flex max-h-[75vh] w-full max-w-md flex-col rounded-t-3xl border-t border-zinc-200 bg-white shadow-2xl animate-in slide-in-from-bottom-full dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Live Orders</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full bg-zinc-100 p-2 text-zinc-500 hover:text-zinc-800 dark:bg-zinc-800"
              >
                <Cancel01Icon size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeOrders.map(order => {
                const conf = STATUS_MAPPING[order.status] || STATUS_MAPPING.PROCESSING;
                const Icon = conf.icon;
                return (
                  <div key={order.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs text-zinc-500">Order #{order.id.slice(-5).toUpperCase()}</p>
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">₹{order.totalAmount}</p>
                      </div>
                      <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${conf.bg} ${conf.color}`}>
                        <Icon size={14} />
                        {conf.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
