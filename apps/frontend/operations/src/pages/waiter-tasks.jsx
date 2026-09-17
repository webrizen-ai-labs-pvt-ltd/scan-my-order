import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent, Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Skeleton } from '@smo/ui';
import { Tick02Icon, Cancel01Icon, Store01Icon, Clock01Icon, Money01Icon, QrCodeIcon, CheckmarkBadge01Icon, PrinterIcon, AlertCircleIcon, CheckmarkCircle02Icon } from 'hugeicons-react';
import { QRCodeSVG } from 'qrcode.react';
import { Receipt } from '../components/receipt';
import { PaymentBifurcationModal } from '../components/payment-bifurcation-modal';

// Synthesized audio chime for new incoming waiter calls
const playChime = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    // Safely ignore if user has not interacted with the browser yet
  }
};

// Toast component for notifications
const Toast = ({ message, type, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  if (!isVisible) return null;

  const bgColor = type === 'success'
    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    : type === 'error'
      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';

  const textColor = type === 'success'
    ? 'text-green-800 dark:text-green-400'
    : type === 'error'
      ? 'text-red-800 dark:text-red-400'
      : 'text-blue-800 dark:text-blue-400';

  const iconColor = type === 'success'
    ? 'text-green-500'
    : type === 'error'
      ? 'text-red-500'
      : 'text-blue-500';

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 p-4 rounded-lg border ${bgColor} shadow-lg animate-slide-in`}>
      {type === 'success' ? (
        <Tick02Icon size={20} className={iconColor} />
      ) : type === 'error' ? (
        <Cancel01Icon size={20} className={iconColor} />
      ) : (
        <Clock01Icon size={20} className={iconColor} />
      )}
      <span className={`text-sm font-medium ${textColor}`}>{message}</span>
      <button onClick={() => { setIsVisible(false); onClose(); }} className="ml-2">
        <Cancel01Icon size={16} className="text-zinc-400 hover:text-zinc-600" />
      </button>
    </div>
  );
};

// Loading skeleton component
const OrderSkeleton = () => (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <Card key={i} className="border-zinc-200 dark:border-zinc-800 shadow-sm">
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
          <Skeleton className="h-16 w-full mb-4" />
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

// Empty state component
const EmptyState = ({ title, description, icon: Icon }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4">
    <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
      {Icon ? <Icon size={32} className="text-zinc-400" /> : (
        <svg className="w-8 h-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      )}
    </div>
    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{title}</h3>
    <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center max-w-sm">{description}</p>
  </div>
);

export const WaiterTasks = () => {
  const { user, token } = useAuthStore();
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(user?.store?.id || null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [storesLoading, setStoresLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  // Payment Modal State
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [qrUrl, setQrUrl] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeTab, setActiveTab] = useState('SERVE');
  
  const [storeData, setStoreData] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const receiptRef = useRef();

  // Active Waiter Calls & Availability State
  const [waiterCalls, setWaiterCalls] = useState([]);
  const [waiterAvailability, setWaiterAvailability] = useState('AVAILABLE');
  const [callActionLoading, setCallActionLoading] = useState(null);
  const [nowTime, setNowTime] = useState(Date.now());

  // 1-second interval to tick countdown timers smoothly
  useEffect(() => {
    const timer = setInterval(() => setNowTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const fetchWaiterCalls = useCallback(async (storeIdToFetch) => {
    if (!storeIdToFetch) return;
    try {
      const res = await api.get(`/stores/${storeIdToFetch}/waiter-calls`);
      if (res.data?.success) {
        setWaiterCalls(res.data.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch waiter calls", e);
    }
  }, []);

  const fetchWaiterAvailability = useCallback(async (storeIdToFetch) => {
    if (!storeIdToFetch) return;
    try {
      const res = await api.get(`/stores/${storeIdToFetch}/waiter-calls/availability`);
      if (res.data?.success && res.data.data?.status) {
        setWaiterAvailability(res.data.data.status);
      }
    } catch (e) {
      // Fallback to default AVAILABLE
    }
  }, []);

  const toggleAvailability = async () => {
    const nextStatus = waiterAvailability === 'AVAILABLE' ? 'BUSY' : 'AVAILABLE';
    try {
      setWaiterAvailability(nextStatus);
      await api.post(`/stores/${selectedStoreId}/waiter-calls/availability`, { status: nextStatus });
      showToast(nextStatus === 'AVAILABLE' ? 'You are now marked Available for calls' : 'You are now marked Busy / On Break', 'info');
    } catch (e) {
      showToast('Failed to update availability status', 'error');
    }
  };

  const handleAcknowledgeCall = async (callId) => {
    setCallActionLoading(callId);
    try {
      const res = await api.patch(`/stores/${selectedStoreId}/waiter-calls/${callId}/acknowledge`);
      if (res.data?.success) {
        showToast('Assistance acknowledged! On your way.', 'success');
        fetchWaiterCalls(selectedStoreId);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to acknowledge call', 'error');
    } finally {
      setCallActionLoading(null);
    }
  };

  const handleResolveCall = async (callId) => {
    setCallActionLoading(callId);
    try {
      const res = await api.patch(`/stores/${selectedStoreId}/waiter-calls/${callId}/resolve`);
      if (res.data?.success) {
        showToast('Table assistance completed!', 'success');
        fetchWaiterCalls(selectedStoreId);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to resolve call', 'error');
    } finally {
      setCallActionLoading(null);
    }
  };

  const fetchOrders = useCallback(async (storeIdToFetch, silent = false) => {
    if (!storeIdToFetch) return;

    if (!silent) setLoading(true);
    setError('');

    try {
      const res = await api.get(`/stores/${storeIdToFetch}/orders?statuses=PENDING_VERIFICATION,READY,SERVED`);
      if (res.data.success) {
        setOrders(res.data.data);
      }
    } catch (err) {
      setError('Failed to fetch orders. Please try again.');
      showToast('Failed to fetch orders', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStores = useCallback(async () => {
    setStoresLoading(true);
    try {
      const res = await api.get('/stores');
      if (res.data.success && res.data.data.length > 0) {
        setStores(res.data.data);
        if (!selectedStoreId) {
          setSelectedStoreId(res.data.data[0].id);
        }
      }
    } catch (err) {
      showToast('Failed to fetch stores', 'error');
    } finally {
      setStoresLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    if (!user?.store) {
      fetchStores();
    }
  }, [user, fetchStores]);

  useEffect(() => {
    if (selectedStoreId) {
      fetchOrders(selectedStoreId);
      fetchWaiterCalls(selectedStoreId);
      fetchWaiterAvailability(selectedStoreId);
      
      api.get(`/stores/${selectedStoreId}`).then(res => {
        if (res.data.success) setStoreData(res.data.data);
      }).catch(err => console.error("Failed to fetch store data", err));

      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      let eventSource;

      try {
        eventSource = new EventSource(`${baseUrl}/stores/${selectedStoreId}/orders/stream?token=${token}`);

        eventSource.onopen = () => {
          setConnectionStatus('connected');
        };

        eventSource.onerror = () => {
          setConnectionStatus('disconnected');
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (['ORDER_PENDING_VERIFICATION', 'ORDER_READY', 'ORDER_SERVED', 'ORDER_PROCESSING', 'ORDER_CANCELLED', 'ORDER_SETTLED'].includes(data.type)) {
              fetchOrders(selectedStoreId, true);
              
              // If we are currently showing a payment modal for this order and it was settled
              if (data.type === 'ORDER_SETTLED') {
                 setPaymentOrder(prev => {
                   if (prev && prev.id === data.data.id) {
                     showToast('Payment verified successfully!', 'success');
                     
                     // Show receipt
                     api.get(`/stores/${selectedStoreId}/orders/${data.data.id}`).then(orderRes => {
                       if (orderRes.data.success) {
                         setReceiptOrder(orderRes.data.data);
                       }
                     });
                     
                     return null;
                   }
                   return prev;
                 });
                 setQrUrl(null);
              }
            }

            // Real-time Waiter Call SSE Events
            if ([
              'WAITER_CALL_CREATED',
              'WAITER_CALL_DISPATCHED',
              'WAITER_CALL_ESCALATED',
              'WAITER_CALL_ESCALATED_MANAGER',
              'WAITER_CALL_ACKNOWLEDGED',
              'WAITER_CALL_RESOLVED',
              'WAITER_CALL_CANCELLED'
            ].includes(data.type)) {
              fetchWaiterCalls(selectedStoreId);

              if (['WAITER_CALL_CREATED', 'WAITER_CALL_DISPATCHED', 'WAITER_CALL_ESCALATED'].includes(data.type)) {
                const assignedId = data.data?.assignedWaiterId || data.data?.dispatch?.assignedWaiterId;
                if (assignedId === user?.id) {
                  playChime();
                  showToast(`Table ${data.data?.tableNumber || ''} requested assistance! You are assigned.`, 'info');
                }
              } else if (data.type === 'WAITER_CALL_ESCALATED_MANAGER') {
                if (['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER'].includes(user?.role)) {
                  playChime();
                  showToast(data.data?.message || 'Urgent table call escalated to manager!', 'error');
                }
              }
            }

            if (data.type === 'WAITER_AVAILABILITY_CHANGED' && data.data?.waiterId === user?.id) {
              setWaiterAvailability(data.data.status);
            }
          } catch (e) {
            // Silently ignore
          }
        };
      } catch (err) {
        setConnectionStatus('disconnected');
      }

      return () => {
        if (eventSource) eventSource.close();
      };
    }
  }, [selectedStoreId, token, fetchOrders, fetchWaiterCalls, fetchWaiterAvailability, user]);

  const updateStatus = async (orderId, status) => {
    setActionLoading(orderId);
    setError('');

    try {
      await api.patch(`/stores/${selectedStoreId}/orders/${orderId}/status`, { status });
      setOrders(prev => prev.filter(o => o.id !== orderId));

      const statusMessages = {
        'CANCELLED': 'Order cancelled successfully',
        'PROCESSING': 'Order approved successfully',
        'SERVED': 'Order marked as served',
        'SETTLED': 'Order settled successfully'
      };

      showToast(statusMessages[status] || 'Order updated successfully', 'success');
      
      if (status === 'SETTLED' && paymentOrder?.id === orderId) {
        setPaymentOrder(null);
      }
    } catch (err) {
      console.error(err);
      const errorMessage = err.response?.data?.message || 'Failed to update order';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const generatePaymentQr = async (orderOrGroup) => {
    setQrLoading(true);
    setQrUrl(null);
    try {
      let res;
      if (orderOrGroup?.tableSessionId) {
        res = await api.post(`/stores/${selectedStoreId}/orders/sessions/${orderOrGroup.tableSessionId}/payment-link`);
      } else {
        const orderId = orderOrGroup?.id || orderOrGroup;
        res = await api.post(`/stores/${selectedStoreId}/orders/${orderId}/payment-link`);
      }
      if (res.data.success && res.data.data.short_url) {
        setQrUrl(res.data.data.short_url);
      } else {
        showToast('Failed to generate QR', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to generate QR', 'error');
    } finally {
      setQrLoading(false);
    }
  };

  const handleSettlePayment = async (orderOrGroup) => {
    setActionLoading('settle');
    try {
      if (orderOrGroup?.tableSessionId) {
        const sessId = orderOrGroup.tableSessionId;
        await api.post(`/stores/${selectedStoreId}/orders/sessions/${sessId}/settle`);
        const billRes = await api.get(`/stores/${selectedStoreId}/orders/sessions/${sessId}`);
        if (billRes.data.success) {
          const b = billRes.data.data;
          setReceiptOrder({
            id: `TAB-${b.session.pin}`,
            createdAt: b.session.createdAt,
            type: 'DINE_IN',
            paymentModel: 'POSTPAID',
            table: { tableNumber: b.session.tableNumber },
            subTotal: b.subTotal,
            discountAmount: b.discountAmount,
            taxAmount: b.taxAmount,
            totalAmount: b.totalAmount,
            items: b.aggregatedItems.map(i => ({
              quantity: i.quantity,
              priceAtOrder: i.price,
              menuItem: { name: i.name },
              modifiers: (i.modifiers || []).map(m => ({ modifierOption: { name: m } }))
            }))
          });
        }
        setPaymentOrder(null);
        setQrUrl(null);
        showToast('Table settled successfully!', 'success');
        fetchOrders(selectedStoreId, true);
      } else {
        await updateStatus(orderOrGroup.id, 'SETTLED');
      }
    } catch (err) {
      showToast('Failed to settle table', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  /* ─── Waiter Payment Bifurcation Handlers ───────────────────────── */
  const handleWaiterGenerateQR = async (onlineAmount) => {
    if (!paymentOrder) return;
    try {
      let res;
      if (paymentOrder.tableSessionId) {
        res = await api.post(`/stores/${selectedStoreId}/orders/sessions/${paymentOrder.tableSessionId}/payment-link`, {
          onlineAmount
        });
      } else {
        res = await api.post(`/stores/${selectedStoreId}/orders/${paymentOrder.id}/payment-link`, {
          onlineAmount
        });
      }
      if (res.data.success && res.data.data.short_url) {
        setQrUrl(res.data.data.short_url);
        return { url: res.data.data.short_url };
      }
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to generate QR', 'error');
    }
  };

  const handleWaiterModalSettle = async (tenderDetails) => {
    if (!paymentOrder) return;
    setActionLoading('settle');
    try {
      if (paymentOrder.tableSessionId) {
        const sessId = paymentOrder.tableSessionId;
        await api.post(`/stores/${selectedStoreId}/orders/sessions/${sessId}/settle`, {
          paymentMethod: tenderDetails.paymentMethod,
          cashAmount: tenderDetails.cashAmount,
          onlineAmount: tenderDetails.onlineAmount,
        });
        const billRes = await api.get(`/stores/${selectedStoreId}/orders/sessions/${sessId}`);
        if (billRes.data.success) {
          const b = billRes.data.data;
          setReceiptOrder({
            id: `TAB-${b.session.pin}`,
            createdAt: b.session.createdAt,
            type: 'DINE_IN',
            paymentModel: 'POSTPAID',
            paymentMethod: tenderDetails.paymentMethod,
            cashAmount: tenderDetails.cashAmount,
            onlineAmount: tenderDetails.onlineAmount,
            table: { tableNumber: b.session.tableNumber },
            subTotal: b.subTotal,
            discountAmount: b.discountAmount,
            taxAmount: b.taxAmount,
            totalAmount: b.totalAmount,
            items: b.aggregatedItems.map(i => ({
              quantity: i.quantity,
              priceAtOrder: i.price,
              menuItem: { name: i.name },
              modifiers: (i.modifiers || []).map(m => ({ modifierOption: { name: m } }))
            }))
          });
        }
        setPaymentOrder(null);
        setQrUrl(null);
        showToast('Table settled successfully!', 'success');
        fetchOrders(selectedStoreId, true);
      } else {
        await api.patch(`/stores/${selectedStoreId}/orders/${paymentOrder.id}/status`, {
          status: 'SETTLED',
          paymentMethod: tenderDetails.paymentMethod,
          cashAmount: tenderDetails.cashAmount,
          onlineAmount: tenderDetails.onlineAmount,
        });
        const orderRes = await api.get(`/stores/${selectedStoreId}/orders/${paymentOrder.id}`);
        if (orderRes.data.success) {
          setReceiptOrder(orderRes.data.data);
        }
        setPaymentOrder(null);
        setQrUrl(null);
        showToast('Order settled successfully!', 'success');
        fetchOrders(selectedStoreId, true);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to settle: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleWaiterModalVerify = async () => {
    if (!paymentOrder) return { success: false, message: 'No active payment' };
    setIsVerifying(true);
    try {
      if (paymentOrder.tableSessionId) {
        const res = await api.post(`/stores/${selectedStoreId}/orders/sessions/${paymentOrder.tableSessionId}/verify-payment`, { manual: true });
        if (res.data.success && res.data.data.status === 'SETTLED') {
          const sessId = paymentOrder.tableSessionId;
          const billRes = await api.get(`/stores/${selectedStoreId}/orders/sessions/${sessId}`);
          if (billRes.data.success) {
            const b = billRes.data.data;
            setReceiptOrder({
              id: `TAB-${b.session.pin}`,
              createdAt: b.session.createdAt,
              type: 'DINE_IN',
              paymentModel: 'POSTPAID',
              paymentMethod: b.session.paymentMethod || 'ONLINE',
              cashAmount: b.session.cashAmount || 0,
              onlineAmount: b.session.onlineAmount || b.totalAmount,
              table: { tableNumber: b.session.tableNumber },
              subTotal: b.subTotal,
              discountAmount: b.discountAmount,
              taxAmount: b.taxAmount,
              totalAmount: b.totalAmount,
              items: b.aggregatedItems.map(i => ({
                quantity: i.quantity,
                priceAtOrder: i.price,
                menuItem: { name: i.name },
                modifiers: (i.modifiers || []).map(m => ({ modifierOption: { name: m } }))
              }))
            });
          }
          setPaymentOrder(null);
          setQrUrl(null);
          showToast('Payment verified successfully!', 'success');
          fetchOrders(selectedStoreId, true);
          return { success: true };
        } else {
          return { success: false, message: res.data.data?.message || 'Payment not yet confirmed.' };
        }
      } else {
        let isSuccess = false;
        try {
          const verifyRes = await api.post(`/stores/${selectedStoreId}/orders/${paymentOrder.id}/verify-payment`, { manual: true });
          if (verifyRes.data.success && (verifyRes.data.data.status === 'PROCESSING' || verifyRes.data.data.status === 'SETTLED' || verifyRes.data.data.success)) {
            isSuccess = true;
          }
        } catch (e) {}

        if (!isSuccess) {
          const res = await api.get(`/stores/${selectedStoreId}/orders/${paymentOrder.id}/payment-status`);
          if (res.data.success && res.data.data.status === 'success') {
            isSuccess = true;
          }
        }

        if (isSuccess) {
          const orderRes = await api.get(`/stores/${selectedStoreId}/orders/${paymentOrder.id}`);
          if (orderRes.data.success) {
            setReceiptOrder(orderRes.data.data);
          }
          setPaymentOrder(null);
          setQrUrl(null);
          showToast('Payment verified successfully!', 'success');
          fetchOrders(selectedStoreId, true);
          return { success: true };
        } else {
          return { success: false, message: 'Payment not received yet.' };
        }
      }
    } catch (err) {
      console.error(err);
      return { success: false, message: 'Verification error' };
    } finally {
      setIsVerifying(false);
    }
  };

  // Payment Polling logic
  useEffect(() => {
    let intervalId;
    let attempts = 0;
    
    if (qrUrl && paymentOrder && selectedStoreId) {
      intervalId = setInterval(async () => {
        attempts++;
        if (attempts > 100) {
          clearInterval(intervalId);
          showToast('Payment QR Expired (timeout). Please generate again.', 'error');
          setQrUrl(null);
          return;
        }
        
        try {
          if (paymentOrder.tableSessionId) {
            const res = await api.post(`/stores/${selectedStoreId}/orders/sessions/${paymentOrder.tableSessionId}/verify-payment`, { polling: true });
            if (res.data.success && res.data.data.status === 'SETTLED') {
              clearInterval(intervalId);
              showToast('Payment verified successfully!', 'success');
              const sessId = paymentOrder.tableSessionId;
              setPaymentOrder(null);
              setQrUrl(null);
              
              const billRes = await api.get(`/stores/${selectedStoreId}/orders/sessions/${sessId}`);
              if (billRes.data.success) {
                const b = billRes.data.data;
                setReceiptOrder({
                  id: `TAB-${b.session.pin}`,
                  createdAt: b.session.createdAt,
                  type: 'DINE_IN',
                  paymentModel: 'POSTPAID',
                  table: { tableNumber: b.session.tableNumber },
                  subTotal: b.subTotal,
                  discountAmount: b.discountAmount,
                  taxAmount: b.taxAmount,
                  totalAmount: b.totalAmount,
                  items: b.aggregatedItems.map(i => ({
                    quantity: i.quantity,
                    priceAtOrder: i.price,
                    menuItem: { name: i.name },
                    modifiers: (i.modifiers || []).map(m => ({ modifierOption: { name: m } }))
                  }))
                });
              }
              fetchOrders(selectedStoreId, true);
            }
          } else {
            const res = await api.get(`/stores/${selectedStoreId}/orders/${paymentOrder.id}/payment-status`);
            if (res.data.success && res.data.data.status === 'success') {
              clearInterval(intervalId);
              showToast('Payment verified successfully!', 'success');
              
              const orderId = paymentOrder.id;
              setPaymentOrder(null);
              setQrUrl(null);
              
              const orderRes = await api.get(`/stores/${selectedStoreId}/orders/${orderId}`);
              if (orderRes.data.success) {
                setReceiptOrder(orderRes.data.data);
              }
              fetchOrders(selectedStoreId, true);
            }
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 3000); // Poll every 3 seconds
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [qrUrl, paymentOrder, selectedStoreId, fetchOrders]);

  const handleStoreChange = (storeId) => {
    setSelectedStoreId(storeId);
    setOrders([]);
  };

  const pendingOrders = orders.filter(o => o.status === 'PENDING_VERIFICATION');
  const readyOrders = orders.filter(o => o.status === 'READY');
  
  // Group served postpaid orders by table session or table
  const servedGroups = useMemo(() => {
    const postPaidServed = orders.filter(o => o.status === 'SERVED' && o.paymentModel === 'POSTPAID');
    const groups = [];
    const map = new Map();
    for (const ord of postPaidServed) {
      const key = ord.tableSessionId || (ord.table ? `tbl_${ord.table.id}` : `ord_${ord.id}`);
      if (map.has(key)) {
        map.get(key).orders.push(ord);
      } else {
        const grp = {
          key,
          tableSessionId: ord.tableSessionId,
          tableSession: ord.tableSession,
          table: ord.table,
          orders: [ord]
        };
        map.set(key, grp);
        groups.push(grp);
      }
    }
    return groups;
  }, [orders]);

  return (
    <div className="flex flex-col h-full relative">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Payment Bifurcation Modal */}
      <PaymentBifurcationModal
        isOpen={Boolean(paymentOrder)}
        onClose={() => {
          setPaymentOrder(null);
          setQrUrl(null);
        }}
        totalAmount={paymentOrder?.totalAmount || 0}
        title="Collect Payment"
        subtitle={paymentOrder?.table ? `Table ${paymentOrder.table.tableNumber}` : 'Takeaway'}
        onSettle={handleWaiterModalSettle}
        onGenerateQR={handleWaiterGenerateQR}
        isSubmitting={actionLoading === 'settle'}
        isVerifying={isVerifying}
        onVerifyPayment={handleWaiterModalVerify}
        externalQrUrl={qrUrl}
      />

      {/* Receipt Modal Overlay */}
      {receiptOrder && (
        <div className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl flex flex-col w-full max-w-md max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
              <h3 className="font-bold flex items-center gap-2"><Tick02Icon size={20}/> Payment Successful</h3>
              <button onClick={() => setReceiptOrder(null)} className="p-1 hover:bg-green-100 dark:hover:bg-green-800 rounded-full">
                <Cancel01Icon size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-zinc-100 dark:bg-black">
              {receiptOrder && storeData && (
                <Receipt ref={receiptRef} order={receiptOrder} storeData={storeData} />
              )}
            </div>

            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setReceiptOrder(null)}
              >
                Close
              </Button>
              <Button 
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white flex items-center justify-center gap-2"
                onClick={() => {
                  const printWindow = window.open('', '', 'width=400,height=600');
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>Receipt</title>
                        <style>
                          body { font-family: monospace; font-size: 14px; margin: 0; padding: 20px; }
                          .flex { display: flex; }
                          .justify-between { justify-content: space-between; }
                          .text-center { text-align: center; }
                          .text-right { text-align: right; }
                          .font-bold { font-weight: bold; }
                          .text-xl { font-size: 1.25rem; }
                          .text-lg { font-size: 1.125rem; }
                          .mb-4 { margin-bottom: 1rem; }
                          .mb-2 { margin-bottom: 0.5rem; }
                          .mb-1 { margin-bottom: 0.25rem; }
                          .pb-2 { padding-bottom: 0.5rem; }
                          .pl-2 { padding-left: 0.5rem; }
                          .uppercase { text-transform: uppercase; }
                          .border-b { border-bottom: 1px dashed black; }
                          .flex-1 { flex: 1; }
                          .w-10 { width: 2.5rem; }
                          .w-16 { width: 4rem; }
                          .text-xs { font-size: 0.75rem; }
                          .pr-2 { padding-right: 0.5rem; }
                        </style>
                      </head>
                      <body>${receiptRef.current.innerHTML}</body>
                    </html>
                  `);
                  printWindow.document.close();
                  printWindow.focus();
                  setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
                }}
              >
                <PrinterIcon size={18} /> Print Receipt
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header with Waiter Status & Controls */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        {/* Availability Toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAvailability}
            className={`h-9 px-3 gap-2 font-medium border text-xs transition-all shadow-sm ${
              waiterAvailability === 'AVAILABLE'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-100'
            }`}
            title="Click to toggle between Available and Busy / Break"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${waiterAvailability === 'AVAILABLE' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>Status: <strong>{waiterAvailability === 'AVAILABLE' ? 'Available' : 'Busy / Break'}</strong></span>
          </Button>

          {waiterCalls.length > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 animate-pulse">
              <AlertCircleIcon size={14} />
              {waiterCalls.length} Table {waiterCalls.length === 1 ? 'Call' : 'Calls'} Active
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected'
                ? 'bg-green-500 animate-pulse'
                : connectionStatus === 'connecting'
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-red-500'
              }`} />
            <span className="text-zinc-500 capitalize">{connectionStatus}</span>
          </div>

          {!user?.store && (
            <Select value={selectedStoreId} onValueChange={handleStoreChange} disabled={storesLoading}>
              <SelectTrigger className="w-[200px] h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                <Store01Icon size={16} className="mr-1 text-zinc-400" />
                <SelectValue placeholder={storesLoading ? "Loading stores..." : "Select a store"} />
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
        <div className="mb-4 flex items-center gap-2 p-4 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg shadow-sm">
          <Cancel01Icon size={18} />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto">
            <Cancel01Icon size={16} className="text-red-400 hover:text-red-600" />
          </button>
        </div>
      )}

      {/* Active Table Assistance Requests Section */}
      {waiterCalls.length > 0 && (
        <div className="mb-6 bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-transparent border border-amber-300/60 dark:border-amber-700/60 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Active Table Assistance Requests
                <span className="text-xs bg-amber-500 text-black px-2 py-0.5 rounded-full font-extrabold">
                  {waiterCalls.length}
                </span>
              </h3>
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:inline">
              Auto-escalates to next server in 60s if unacknowledged
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {waiterCalls.map((call) => {
              const isAssignedToMe = call.assignedWaiterId === user?.id;
              const isManagerAlert = call.escalationLevel === 2;
              const isAcknowledged = call.status === 'ACKNOWLEDGED';

              // Calculate countdown remaining seconds
              const assignedTimestamp = call.assignedAt ? new Date(call.assignedAt).getTime() : new Date(call.createdAt).getTime();
              const elapsedSeconds = Math.floor((nowTime - assignedTimestamp) / 1000);
              const remainingSec = Math.max(0, 60 - elapsedSeconds);

              // Category icons & labels
              const getCallMeta = (type) => {
                switch (type) {
                  case 'WATER':
                    return { icon: '💧', label: 'Water Request', color: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200' };
                  case 'BILL':
                    return { icon: '💳', label: 'Request Bill', color: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200' };
                  case 'CUTLERY':
                    return { icon: '🍴', label: 'Extra Cutlery', color: 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border-orange-200' };
                  case 'CLEAN_TABLE':
                    return { icon: '🧹', label: 'Clean Table', color: 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200' };
                  default:
                    return { icon: '🔔', label: 'Call Server', color: 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200' };
                }
              };

              const meta = getCallMeta(call.type);

              return (
                <div
                  key={call.id}
                  className={`relative p-3.5 rounded-xl border transition-all shadow-sm flex flex-col justify-between ${
                    isAssignedToMe
                      ? 'bg-amber-500/10 border-amber-500 dark:border-amber-400 ring-2 ring-amber-500/30'
                      : isManagerAlert
                        ? 'bg-red-500/10 border-red-400 dark:border-red-600 ring-2 ring-red-500/30'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <div>
                    {/* Header: Table & Service Type */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-base text-zinc-900 dark:text-zinc-50">
                          Table {call.table?.tableNumber || 'N/A'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${meta.color}`}>
                          {meta.icon} {meta.label}
                        </span>
                      </div>

                      {isAcknowledged ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                          <CheckmarkCircle02Icon size={12} /> On the way
                        </span>
                      ) : (
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          remainingSec <= 15
                            ? 'bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 animate-pulse border border-red-300'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300'
                        }`}>
                          <Clock01Icon size={12} /> {remainingSec}s
                        </span>
                      )}
                    </div>

                    {/* Customer note if any */}
                    {call.note && (
                      <p className="text-xs italic text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/60 px-2.5 py-1.5 rounded-lg mb-2.5">
                        "{call.note}"
                      </p>
                    )}

                    {/* Assignment & Escalation status */}
                    <div className="text-xs mb-3 flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                      {isAssignedToMe ? (
                        <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          👉 Assigned to You
                        </span>
                      ) : isManagerAlert ? (
                        <span className="font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                          ⚠️ Escalated: Floor Lead Alert
                        </span>
                      ) : (
                        <span>Assigned to: <strong className="text-zinc-700 dark:text-zinc-200">{call.assignedWaiterName || 'Available Staff'}</strong></span>
                      )}

                      {call.escalationLevel > 0 && !isManagerAlert && (
                        <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                          Escalation Lv {call.escalationLevel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60">
                    {!isAcknowledged ? (
                      <Button
                        size="sm"
                        onClick={() => handleAcknowledgeCall(call.id)}
                        disabled={callActionLoading === call.id}
                        className="flex-1 h-8 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black shadow-sm"
                      >
                        {callActionLoading === call.id ? 'Updating...' : 'On My Way'}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleResolveCall(call.id)}
                        disabled={callActionLoading === call.id}
                        className="flex-1 h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                      >
                        {callActionLoading === call.id ? 'Completing...' : 'Done / Resolved'}
                      </Button>
                    )}

                    {!isAcknowledged && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResolveCall(call.id)}
                        disabled={callActionLoading === call.id}
                        className="h-8 text-xs px-2.5 text-zinc-600 dark:text-zinc-300"
                        title="Mark as completed directly"
                      >
                        Done
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile Tabs */}
      <div className="flex lg:hidden bg-zinc-100 dark:bg-zinc-900 p-1 mb-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('VERIFY')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'VERIFY'
              ? 'bg-white dark:bg-zinc-800 text-yellow-600 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Verify <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 px-1.5 py-0.5 rounded-full text-xs ml-1">{pendingOrders.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('SERVE')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'SERVE'
              ? 'bg-white dark:bg-zinc-800 text-green-600 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Serve <span className="bg-green-100 dark:bg-green-900/30 text-green-700 px-1.5 py-0.5 rounded-full text-xs ml-1">{readyOrders.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('COLLECT')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'COLLECT'
              ? 'bg-white dark:bg-zinc-800 text-blue-600 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Collect <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 px-1.5 py-0.5 rounded-full text-xs ml-1">{servedGroups.length}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">

        {/* Verification Inbox */}
        <div className={`flex-col h-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-lg overflow-hidden transition-all hover:shadow-xl ${activeTab === 'VERIFY' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 px-4 py-4 border-b border-yellow-200 dark:border-yellow-800/50 flex justify-between items-center">
            <div>
              <h2 className="font-semibold text-yellow-800 dark:text-yellow-400 text-lg">Needs Verification</h2>
              <p className="text-xs text-yellow-600 dark:text-yellow-500">Review and approve incoming orders</p>
            </div>
            <span className="bg-yellow-200 dark:bg-yellow-800/50 text-yellow-800 dark:text-yellow-300 text-sm px-3 py-1.5 rounded-full font-bold shadow-sm">
              {pendingOrders.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
              <OrderSkeleton />
            ) : pendingOrders.length === 0 ? (
              <EmptyState title="No Pending Orders" description="All caught up!" />
            ) : (
              pendingOrders.map(order => (
                <Card key={order.id} className="border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-lg transition-all duration-200">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-bold text-lg flex items-center gap-2">
                          Table {order.table?.tableNumber || 'N/A'}
                        </div>
                        <div className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                          <Clock01Icon size={12} /> {Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000)} min ago
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">₹{order.totalAmount}</div>
                        <div className="text-xs font-bold text-amber-600 dark:text-amber-500 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full inline-block mt-1">
                          {order.paymentModel}
                        </div>
                      </div>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 mb-4 max-h-32 overflow-y-auto space-y-1">
                      {order.items.map(item => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-zinc-700 dark:text-zinc-300">
                            <span className="font-semibold mr-2">{item.quantity}x</span>{item.menuItem?.name}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Button className="flex-1" variant="outline" onClick={() => updateStatus(order.id, 'CANCELLED')} disabled={actionLoading === order.id}>
                         <Cancel01Icon size={16} className="mr-1 text-red-500" /> Reject
                      </Button>
                      <Button className="flex-1 bg-gradient-to-r from-yellow-500 to-amber-500 text-white" onClick={() => updateStatus(order.id, 'PROCESSING')} disabled={actionLoading === order.id}>
                         <Tick02Icon size={16} className="mr-1" /> Approve
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Service Queue */}
        <div className={`flex-col h-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-lg overflow-hidden transition-all hover:shadow-xl ${activeTab === 'SERVE' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 px-4 py-4 border-b border-green-200 dark:border-green-800/50 flex justify-between items-center">
            <div>
              <h2 className="font-semibold text-green-800 dark:text-green-400 text-lg">Ready to Serve</h2>
              <p className="text-xs text-green-600 dark:text-green-500">Deliver orders to their tables</p>
            </div>
            <span className="bg-green-200 dark:bg-green-800/50 text-green-800 dark:text-green-300 text-sm px-3 py-1.5 rounded-full font-bold shadow-sm">
              {readyOrders.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
              <OrderSkeleton />
            ) : readyOrders.length === 0 ? (
              <EmptyState title="No Orders Ready" description="Kitchen is cooking!" />
            ) : (
              readyOrders.map(order => (
                <Card key={order.id} className="border-green-200 dark:border-green-900/30 shadow-sm hover:shadow-lg transition-all duration-200 bg-green-50/30 dark:bg-green-900/10">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="font-bold text-2xl text-green-900 dark:text-green-100 mb-1">
                          Table {order.table?.tableNumber || 'N/A'}
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-500 flex items-center gap-1">
                          <Clock01Icon size={12} /> Ready since {new Date(order.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">₹{order.totalAmount}</div>
                        {order.paymentModel === 'PREPAID' ? (
                          <div className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full mt-1 flex items-center gap-1">
                            <CheckmarkBadge01Icon size={12} /> PREPAID
                          </div>
                        ) : (
                          <div className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full inline-block mt-1">
                            TO COLLECT
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="mb-4 bg-white/50 dark:bg-zinc-950/50 p-3 rounded-lg border border-green-100 dark:border-green-900/30 space-y-1">
                       {order.items.map(item => (
                         <div key={item.id} className="flex justify-between text-sm text-zinc-700 dark:text-zinc-300">
                           <span><span className="font-semibold mr-1">{item.quantity}x</span> {item.menuItem?.name}</span>
                         </div>
                       ))}
                    </div>

                    <Button
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md text-base h-12"
                      onClick={() => updateStatus(order.id, 'SERVED')}
                      disabled={actionLoading === order.id}
                    >
                      <Tick02Icon size={20} className="mr-2" /> Mark as Served
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Pending Payment Queue */}
        <div className={`flex-col h-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-lg overflow-hidden transition-all hover:shadow-xl ${activeTab === 'COLLECT' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 px-4 py-4 border-b border-blue-200 dark:border-blue-800/50 flex justify-between items-center">
            <div>
              <h2 className="font-semibold text-blue-800 dark:text-blue-400 text-lg">Pending Payment</h2>
              <p className="text-xs text-blue-600 dark:text-blue-500">Collect payment from served tables</p>
            </div>
            <span className="bg-blue-200 dark:bg-blue-800/50 text-blue-800 dark:text-blue-300 text-sm px-3 py-1.5 rounded-full font-bold shadow-sm">
              {servedGroups.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
              <OrderSkeleton />
            ) : servedGroups.length === 0 ? (
              <EmptyState title="No Pending Payments" description="All tables settled!" />
            ) : (
              servedGroups.map(group => {
                const groupTotal = group.orders.reduce((sum, o) => sum + o.totalAmount, 0);
                return (
                  <Card key={group.key} className="border-blue-200 dark:border-blue-900/30 shadow-sm hover:shadow-lg transition-all duration-200 bg-blue-50/30 dark:bg-blue-900/10">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-bold text-2xl text-blue-900 dark:text-blue-100 mb-1 flex items-center gap-2">
                            Table {group.table?.tableNumber || 'N/A'}
                            {group.tableSession?.pin && (
                              <span className="text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 px-2 py-0.5 rounded-md font-bold">
                                PIN: {group.tableSession.pin}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-blue-600 dark:text-blue-500 flex items-center gap-2">
                            <span>{group.orders.length} Batch{group.orders.length > 1 ? 'es' : ''}</span>
                            <span>•</span>
                            <span>Last served {new Date(group.orders[group.orders.length - 1].updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">₹{groupTotal}</div>
                          <div className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full inline-block mt-1">
                            TOTAL DUE
                          </div>
                        </div>
                      </div>
                      
                      <div className="mb-4 bg-white/60 dark:bg-zinc-950/50 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30 max-h-32 overflow-y-auto space-y-1">
                        {group.orders.map(order => order.items.map(item => (
                          <div key={item.id} className="flex justify-between text-sm text-zinc-700 dark:text-zinc-300">
                            <span><span className="font-semibold mr-1">{item.quantity}x</span> {item.menuItem?.name}</span>
                            <span className="text-zinc-400 text-xs">₹{item.priceAtOrder * item.quantity}</span>
                          </div>
                        )))}
                      </div>

                      <Button
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md text-base h-12 font-bold"
                        onClick={() => {
                          setPaymentOrder({
                            id: group.orders[0].id,
                            tableSessionId: group.tableSessionId,
                            table: group.table,
                            totalAmount: groupTotal,
                            orders: group.orders
                          });
                          setQrUrl(null);
                        }}
                      >
                        <Money01Icon size={20} className="mr-2" /> Collect Payment (₹{groupTotal})
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

      </div>

      <style jsx>{`
        @keyframes slide-in {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.2s ease-out; }
      `}</style>
    </div>
  );
};