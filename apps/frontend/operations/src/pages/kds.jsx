import React, { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Skeleton } from '@smo/ui';
import { Store01Icon, Clock01Icon, Tick02Icon, Cancel01Icon, Alert01Icon, CheckmarkBadge01Icon } from 'hugeicons-react';

// Specialized Toast for KDS (Large, High Contrast)
const KdsToast = ({ message, type, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!isVisible) return null;

  const config = {
    success: { bg: 'bg-green-500', text: 'text-white', icon: Tick02Icon },
    error: { bg: 'bg-red-600', text: 'text-white', icon: Cancel01Icon },
    info: { bg: 'bg-blue-600', text: 'text-white', icon: Alert01Icon },
  }[type] || config.info;

  const Icon = config.icon;

  return (
    <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 rounded-full shadow-2xl animate-bounce-up ${config.bg}`}>
      <Icon size={28} className={config.text} />
      <span className={`text-xl font-bold tracking-wide ${config.text}`}>{message}</span>
    </div>
  );
};

export const KDS = () => {
  const { user, token } = useAuthStore();
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(user?.store?.id || null);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  
  // UI Zoom Control
  const [zoom, setZoom] = useState(1);
  
  // Track tickets that are animating away
  const [completingTickets, setCompletingTickets] = useState(new Set());

  const showToast = (message, type = 'info') => setToast({ message, type });

  const fetchOrders = useCallback(async (storeIdToFetch, silent = false) => {
    if (!storeIdToFetch) return;
    if (!silent) setLoading(true);
    setError('');
    
    try {
      const res = await api.get(`/stores/${storeIdToFetch}/orders/kds`);
      if (res.data.success) {
        setOrders(res.data.data);
      }
    } catch (err) {
      setError('Failed to connect to KDS server');
    } finally {
      setLoading(false);
    }
  }, []);

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
          const data = JSON.parse(event.data);
          if (['ORDER_PROCESSING', 'ORDER_READY', 'ORDER_CANCELLED'].includes(data.type)) {
            fetchOrders(selectedStoreId, true);
          }
        } catch(e) {}
      };

      return () => eventSource.close();
    }
  }, [selectedStoreId, token, fetchOrders]);

  const markAsReady = async (orderId) => {
    // 1. Trigger micro-interaction (slide away / green flash)
    setCompletingTickets(prev => new Set(prev).add(orderId));
    
    try {
      await api.patch(`/stores/${selectedStoreId}/orders/${orderId}/status`, { status: 'READY' });
      
      // 2. Remove from state after animation completes
      setTimeout(() => {
         setOrders(prev => prev.filter(o => o.id !== orderId));
         setCompletingTickets(prev => {
           const newSet = new Set(prev);
           newSet.delete(orderId);
           return newSet;
         });
         showToast(`Order ${orderId.slice(-4)} marked Ready`, 'success');
      }, 400); // 400ms CSS animation match
      
    } catch (err) {
      console.error(err);
      showToast('Failed to update order', 'error');
      // Revert animation state
      setCompletingTickets(prev => {
         const newSet = new Set(prev);
         newSet.delete(orderId);
         return newSet;
      });
    }
  };

  // Helper to calculate time waiting
  const getWaitTime = (createdAt) => {
    return Math.floor((new Date() - new Date(createdAt)) / 60000);
  };

  // Force re-render every minute so timers update
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col h-full bg-zinc-950 min-h-screen text-zinc-100 overflow-hidden">
      {toast && <KdsToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* KDS Header - Highly Visible */}
      <div className="flex justify-between items-center px-8 py-4 bg-zinc-900 border-b border-zinc-800 shadow-lg shrink-0">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">KDS</h1>
            <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest mt-1">Kitchen Display</p>
          </div>
          <div className="h-10 w-px bg-zinc-700 mx-2"></div>
          <div className="flex gap-4 text-sm font-bold">
             <div className="flex flex-col">
                <span className="text-zinc-500">Total Active</span>
                <span className="text-2xl text-white">{orders.length}</span>
             </div>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded-full">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse" />
            <span className="text-xs font-bold text-zinc-300">LIVE</span>
          </div>

          {/* Zoom Slider */}
          <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700">
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="text-zinc-400 hover:text-white font-bold px-2">-</button>
            <span className="text-xs font-bold text-zinc-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="text-zinc-400 hover:text-white font-bold px-2">+</button>
          </div>
          
          {!user?.store && (
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger className="w-[240px] h-12 text-lg font-bold bg-zinc-950 border-zinc-700 text-white rounded-xl focus:ring-green-500">
                <Store01Icon size={20} className="mr-2 text-zinc-400" />
                <SelectValue placeholder="Select Kitchen" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700 text-white text-lg font-bold">
                {stores.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {error && (
        <div className="m-6 flex items-center gap-4 p-6 bg-red-950 border-2 border-red-900 rounded-2xl">
          <Alert01Icon size={32} className="text-red-500" />
          <div>
            <h3 className="text-xl font-bold text-red-100">Connection Error</h3>
            <p className="text-red-400 font-medium">{error}</p>
          </div>
          <Button className="ml-auto bg-red-800 hover:bg-red-700 text-white font-bold" onClick={() => fetchOrders(selectedStoreId)}>
            Retry Connection
          </Button>
        </div>
      )}

      {/* Main KDS Board */}
      <div className="flex-1 overflow-y-auto p-6 bg-zinc-950">
        <div style={{ zoom }}>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {[1,2,3,4,5].map(i => (
                 <Skeleton key={i} className="h-64 rounded-xl bg-zinc-900/50 border border-zinc-800/50" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-600 animate-fade-in py-20">
              <div className="w-24 h-24 rounded-full bg-zinc-900 flex items-center justify-center mb-4 shadow-inner">
                 <Tick02Icon size={48} className="text-zinc-700" />
              </div>
              <h2 className="text-2xl font-bold text-zinc-500 mb-2 tracking-tight">KITCHEN CLEAR</h2>
              <p className="text-lg font-medium text-zinc-600">Waiting for new orders...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 items-start auto-rows-max">
              {orders.map(order => {
                const waitTime = getWaitTime(order.createdAt);
                const isLate = waitTime >= 15; // >15 mins turns header red
                const isCompleting = completingTickets.has(order.id);
                
                return (
                  <div 
                    key={order.id} 
                    className={`
                      relative rounded-xl overflow-hidden flex flex-col shadow-xl transition-all duration-400 ease-in-out
                      ${isCompleting ? 'scale-95 opacity-0 translate-y-4 bg-green-900' : 'scale-100 opacity-100 translate-y-0 bg-zinc-900 border border-zinc-800'}
                    `}
                  >
                    {/* Ticket Header */}
                    <div className={`px-4 py-3 flex justify-between items-start transition-colors ${
                        isCompleting ? 'bg-green-600' :
                        isLate ? 'bg-red-600 border-b-2 border-red-800 shadow-[inset_0_-5px_10px_rgba(0,0,0,0.2)]' 
                               : 'bg-zinc-800 border-b border-zinc-700'
                      }`}>
                      <div>
                        <span className={`text-[10px] uppercase tracking-widest font-bold block mb-0.5 ${isLate || isCompleting ? 'text-white/80' : 'text-zinc-400'}`}>
                          {order.type}
                        </span>
                        <span className="text-xl font-bold text-white leading-none">
                          Tbl {order.table?.tableNumber || '?'}
                        </span>
                      </div>
                      <div className={`flex flex-col items-end ${isLate ? 'animate-pulse' : ''}`}>
                        <div className={`flex items-center gap-1 font-mono text-lg font-bold ${isLate || isCompleting ? 'text-white' : 'text-zinc-300'}`}>
                          <Clock01Icon size={18} className={isLate ? 'text-red-200' : 'text-zinc-500'} />
                          {waitTime}m
                        </div>
                      </div>
                    </div>
                  
                  {/* Ticket Items */}
                  <div className="flex-1 p-4 space-y-4 bg-zinc-900">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="relative pl-10 border-b border-zinc-800/80 pb-4 last:border-0 last:pb-0">
                        {/* Normal Quantity Badge */}
                        <div className="absolute left-0 top-0 w-7 h-7 bg-zinc-100 text-zinc-950 font-bold rounded-md flex items-center justify-center text-sm shadow-sm">
                          {item.quantity}
                        </div>
                        
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg leading-tight text-white mb-0.5">{item.menuItem?.name}</h3>
                          
                          {item.modifiers?.length > 0 && (
                            <ul className="space-y-1 mt-1">
                              {item.modifiers.map((mod, midx) => (
                                <li key={midx} className="text-sm font-medium text-amber-400 flex items-start">
                                  <span className="mr-1.5 text-amber-600/50 select-none">↳</span>
                                  {mod.modifierOption?.name}
                                </li>
                              ))}
                            </ul>
                          )}
                          
                          {item.kitchenNotes && (
                            <div className="mt-2 text-sm bg-red-950/40 text-red-400 p-2.5 rounded-md border border-red-900/50">
                              <span className="font-bold text-red-500 block uppercase text-[10px] tracking-wider mb-0.5">Kitchen Note</span>
                              {item.kitchenNotes}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Action Footer */}
                  <div className={`p-3 bg-zinc-950 border-t transition-colors ${isCompleting ? 'border-green-800 bg-green-950' : 'border-zinc-800'}`}>
                    <Button 
                      className={`w-full h-12 text-lg font-bold rounded-lg transition-all shadow-md active:scale-95 ${
                        isCompleting 
                          ? 'bg-green-500 hover:bg-green-500 text-white' 
                          : 'bg-zinc-100 hover:bg-green-500 hover:text-white text-zinc-950'
                      }`}
                      onClick={() => markAsReady(order.id)}
                      disabled={isCompleting}
                    >
                      {isCompleting ? (
                        <><CheckmarkBadge01Icon size={24} className="mr-2 animate-bounce" /> DONE</>
                      ) : (
                        'MARK READY'
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>

      <style jsx>{`
        @keyframes bounce-up {
          0% { transform: translate(-50%, 100%); opacity: 0; }
          60% { transform: translate(-50%, -10%); opacity: 1; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
        .animate-bounce-up {
          animation: bounce-up 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};
