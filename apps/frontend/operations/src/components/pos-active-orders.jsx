import React, { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import { Card, CardContent, Button, Skeleton } from '@smo/ui';
import { Money01Icon, QrCodeIcon, Search01Icon, Cancel01Icon, Tick02Icon } from 'hugeicons-react';
import { QRCodeSVG } from 'qrcode.react';

export const POSActiveOrders = ({ selectedStoreId, token }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [qrModal, setQrModal] = useState({ isOpen: false, url: '', orderId: '', totalAmount: 0 });

  const qrModalRef = useRef(qrModal);
  useEffect(() => {
    qrModalRef.current = qrModal;
  }, [qrModal]);

  const fetchOrders = async (storeIdToFetch) => {
    if (!storeIdToFetch) return;
    try {
      const res = await api.get(`/stores/${storeIdToFetch}/orders`);
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
    if (selectedStoreId) {
      setLoading(true);
      fetchOrders(selectedStoreId);
      
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const eventSource = new EventSource(`${baseUrl}/stores/${selectedStoreId}/orders/stream?token=${token}`);
      
      eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          fetchOrders(selectedStoreId);
          
          const currentModal = qrModalRef.current;
          if ((message.type === 'ORDER_PROCESSING' || message.type === 'ORDER_SETTLED') && currentModal.isOpen && message.data?.id === currentModal.orderId) {
             setQrModal({ isOpen: false, url: '', orderId: '', totalAmount: 0 });
          }
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

  const approveOrder = async (orderId) => {
    try {
      await api.patch(`/stores/${selectedStoreId}/orders/${orderId}/verify`);
      fetchOrders(selectedStoreId);
    } catch (err) {
      console.error(err);
      setError('Failed to approve order');
    }
  };

  const handleGenerateQR = async (order) => {
    try {
      const linkRes = await api.post(`/stores/${selectedStoreId}/orders/${order.id}/payment-link`);
      setQrModal({ isOpen: true, url: linkRes.data.data.short_url, orderId: order.id, totalAmount: order.totalAmount });
    } catch (err) {
      console.error(err);
      alert("Failed to generate QR code");
    }
  };

  const verifyOrder = async () => {
    setIsVerifying(true);
    try {
      const res = await api.post(`/stores/${selectedStoreId}/orders/${qrModal.orderId}/verify-payment`);
      if (res.data.success && res.data.data.success) {
         setQrModal({ isOpen: false, url: '', orderId: '', totalAmount: 0 });
         fetchOrders(selectedStoreId);
      } else {
         alert(res.data.data?.message || `Payment not received yet.`);
      }
    } catch (err) {
       const msg = err.response?.data?.error?.message || "Failed to verify order.";
       alert("Error: " + msg);
    } finally {
       setIsVerifying(false);
    }
  };

  useEffect(() => {
    let interval;
    if (qrModal.isOpen && qrModal.orderId) {
      interval = setInterval(async () => {
        try {
          const res = await api.post(`/stores/${selectedStoreId}/orders/${qrModal.orderId}/verify-payment`);
          if (res.data.success && res.data.data.success) {
             setQrModal({ isOpen: false, url: '', orderId: '', totalAmount: 0 });
             fetchOrders(selectedStoreId);
          }
        } catch (err) {
          // Silent failure for polling
        }
      }, 5000); // Poll every 5 seconds
    }
    return () => clearInterval(interval);
  }, [qrModal.isOpen, qrModal.orderId, selectedStoreId]);

  const getStatusDisplay = (status) => {
    switch(status) {
      case 'PENDING_VERIFICATION': return { label: 'Awaiting Approval', color: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800' };
      case 'PENDING_PAYMENT': return { label: 'Awaiting Payment', color: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' };
      case 'PROCESSING': return { label: 'In Kitchen', color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' };
      case 'READY': return { label: 'Ready', color: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800' };
      case 'SERVED': return { label: 'Served', color: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' };
      default: return { label: status, color: 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700' };
    }
  };

  if (error) {
    return (
      <div className="mb-4 flex items-center gap-2 p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md">
        {error}
      </div>
    );
  }

  if (loading && orders.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
      </div>
    );
  }

  const filteredOrders = orders.filter(o => {
    if (!searchQuery) return true;
    const term = searchQuery.toLowerCase();
    if (o.table && String(o.table.tableNumber).toLowerCase().includes(term)) return true;
    if (o.id.toLowerCase().includes(term)) return true;
    return false;
  });

  return (
    <div className="h-full flex flex-col overflow-hidden pb-4">
      {/* Search Bar */}
      <div className="mb-4 shrink-0">
        <div className="relative w-full">
          <Search01Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by table number or Order ID..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 min-h-[400px]">
          <Money01Icon size={48} className="text-zinc-300 mb-4" />
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">
            {searchQuery ? 'No matching orders' : 'No Active Orders'}
          </h3>
          <p className="text-zinc-500">
            {searchQuery ? 'Try a different table number.' : 'All tables are clear.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-max flex-1 overflow-y-auto pr-2 pb-20">
          {filteredOrders.map(order => {
            const statusInfo = getStatusDisplay(order.status);
            return (
              <Card key={order.id} className="border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full bg-white dark:bg-zinc-900">
                <CardContent className="p-0 flex flex-col h-full">
                  
                  {/* Header */}
                  <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/50 flex justify-between items-start bg-zinc-50/50 dark:bg-zinc-900/50 rounded-t-xl">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-xl text-zinc-900 dark:text-zinc-100">
                          {order.table ? `Table ${order.table.tableNumber}` : 'Takeaway'}
                        </span>
                        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md border font-semibold ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500 uppercase font-semibold tracking-wider flex gap-2">
                        <span>{order.origin}</span>
                        <span>•</span>
                        <span>{order.paymentModel}</span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <div className="font-bold text-xl text-zinc-900 dark:text-zinc-100">₹{order.totalAmount}</div>
                      <span className="text-[10px] text-zinc-400 font-mono mt-1">#{order.id.slice(-6).toUpperCase()}</span>
                    </div>
                  </div>
                  
                  {/* Items List */}
                  <div className="p-4 flex-1 overflow-y-auto max-h-[200px]">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex flex-col text-sm mb-3 last:mb-0">
                        <div className="flex justify-between items-start">
                          <span className="text-zinc-800 dark:text-zinc-200 leading-tight">
                            <span className="font-semibold text-zinc-500 w-6 inline-block">{item.quantity}x</span> 
                            <span className="font-medium">{item.menuItem?.name}</span>
                          </span>
                          <span className="text-zinc-500 font-medium">₹{item.priceAtOrder * item.quantity}</span>
                        </div>
                        {item.modifiers && item.modifiers.length > 0 && (
                          <div className="text-xs text-zinc-500 pl-6 mt-1 flex flex-wrap gap-1">
                            {item.modifiers.map(m => (
                              <span key={m.id} className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                +{m.modifierOption?.name}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.kitchenNotes && (
                          <div className="text-xs text-orange-500 pl-6 mt-1 italic flex items-center gap-1">
                            📝 {item.kitchenNotes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Actions Footer */}
                  <div className="p-4 border-t border-zinc-100 dark:border-zinc-800/50 bg-zinc-50 dark:bg-zinc-950/50 rounded-b-xl mt-auto">
                    {order.status === 'PENDING_VERIFICATION' ? (
                      <Button 
                        className="w-full h-11 font-semibold bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={() => approveOrder(order.id)}
                      >
                        <Tick02Icon size={18} className="mr-2" />
                        Approve Order
                      </Button>
                    ) : order.status === 'PENDING_PAYMENT' ? (
                      <Button 
                        variant="outline"
                        className="w-full h-11 font-semibold text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700"
                        onClick={() => handleGenerateQR(order)}
                      >
                        <QrCodeIcon size={18} className="mr-2" />
                        View QR & Verify
                      </Button>
                    ) : order.paymentModel === 'PREPAID' ? (
                      <Button 
                        className="w-full h-11 font-semibold bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white"
                        onClick={() => settleOrder(order.id)}
                      >
                        <Tick02Icon size={18} className="mr-2" />
                        Close Order (Paid)
                      </Button>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline"
                          className="w-full h-11 font-semibold text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700"
                          onClick={() => handleGenerateQR(order)}
                        >
                          <QrCodeIcon size={18} className="mr-2" />
                          Generate QR
                        </Button>
                        <Button 
                          className="w-full h-11 font-semibold bg-green-600 hover:bg-green-700 text-white border-0 shadow-sm"
                          onClick={() => settleOrder(order.id)}
                        >
                          <Money01Icon size={18} className="mr-2" />
                          Cash & Close
                        </Button>
                      </div>
                    )}
                  </div>

                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* QR Payment Modal Overlay */}
      {qrModal.isOpen && (
        <div className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center text-center">
            <div className="bg-indigo-50 dark:bg-indigo-500/10 p-4 rounded-full mb-4">
              <QrCodeIcon size={32} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="font-bold text-xl mb-1">Scan to Pay</h3>
            <p className="text-sm text-zinc-500 mb-4">Ask the customer to scan this QR code.</p>
            
            <div className="bg-white p-4 rounded-xl shadow-inner border border-zinc-100 inline-block mb-4">
              <QRCodeSVG value={qrModal.url} size={200} level="M" includeMargin={false} />
            </div>
            
            <div className="font-bold text-2xl text-zinc-900 dark:text-zinc-100 mb-2">
              ₹{qrModal.totalAmount}
            </div>

            <div className="flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium mb-6">
               <span className="relative flex h-3 w-3">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
               </span>
               Waiting for payment...
            </div>
            
            <div className="w-full flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 h-11"
                disabled={isVerifying}
                onClick={() => setQrModal({ isOpen: false, url: '', orderId: '', totalAmount: 0 })}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1 h-11 bg-amber-500 hover:bg-amber-600 text-white"
                disabled={isVerifying}
                onClick={verifyOrder}
              >
                {isVerifying ? 'Verifying...' : 'Verify Payment'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
