import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent, Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Skeleton } from '@smo/ui';
import {
  Tick02Icon,
  Cancel01Icon,
  Store01Icon,
  Clock01Icon,
  Money01Icon,
  CheckmarkBadge01Icon,
  PrinterIcon,
  AlertCircleIcon,
} from 'hugeicons-react';
import { Receipt } from '../components/receipt';
import { PaymentCollectorSheet } from '../components/payments/payment-collector-sheet';
import { sessionBillToReceipt } from '../lib/session-receipt';
import { CancelOrderDialog } from '../components/pos/cancel-order-dialog';
import { initAudioUnlock, playNotificationChime } from '@smo/shared/audio';

const playChime = () => {
  playNotificationChime({ haptic: true });
};

// One brand color drives every primary action — like Swiggy/Zomato,
// status is communicated with small text/pills, not whole-card recoloring.
const BRAND = 'bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700';
const BRAND_TEXT = 'text-yellow-600 dark:text-yellow-400';
const BRAND_SOFT = 'bg-yellow-500/10';

const TABS = [
  { key: 'VERIFY', label: 'New' },
  { key: 'SERVE', label: 'Ready' },
  { key: 'COLLECT', label: 'Bill' },
];

const CALL_LABEL = {
  WATER: 'Water',
  BILL: 'Bill',
  CUTLERY: 'Cutlery',
  CLEAN_TABLE: 'Clean up',
  DEFAULT: 'Assistance',
};

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

  const dot = { success: 'bg-emerald-500', error: 'bg-red-500', info: 'bg-zinc-400' }[type] || 'bg-zinc-400';

  return (
    <div className="fixed left-0 right-0 bottom-2 top-auto mx-auto z-[9999] flex max-w-sm items-center gap-3 rounded-full bg-zinc-900 py-3 pl-6 pr-3 text-white shadow-lg animate-slide-in dark:bg-zinc-800 w-min whitespace-nowrap">
      <span className="flex-1 text-sm font-medium">{message}</span>
      <button onClick={() => { setIsVisible(false); onClose(); }} aria-label="Dismiss" className="shrink-0 p-1 text-zinc-400">
        <Cancel01Icon size={15} />
      </button>
    </div>
  );
};

const OrderSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <Card key={i} className="rounded-2xl border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-6 w-28 rounded-lg" />
            <Skeleton className="h-6 w-16 rounded-lg" />
          </div>
          <Skeleton className="mb-4 h-10 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-full" />
        </CardContent>
      </Card>
    ))}
  </div>
);

const EmptyState = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
    <div className="mb-3 text-4xl">🍽️</div>
    <h3 className="mb-1 text-[15px] font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
    <p className="max-w-[220px] text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
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

  const [paymentOrder, setPaymentOrder] = useState(null);
  const [rejectingOrder, setRejectingOrder] = useState(null);
  const [activeTab, setActiveTab] = useState('SERVE');

  const [storeData, setStoreData] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const receiptRef = useRef();

  const [waiterCalls, setWaiterCalls] = useState([]);
  const [waiterAvailability, setWaiterAvailability] = useState('AVAILABLE');
  const [callActionLoading, setCallActionLoading] = useState(null);
  const [nowTime, setNowTime] = useState(Date.now());

  useEffect(() => {
    initAudioUnlock();
    const timer = setInterval(() => setNowTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (message, type = 'info') => setToast({ message, type });

  const fetchWaiterCalls = useCallback(async (storeIdToFetch) => {
    if (!storeIdToFetch) return;
    try {
      const res = await api.get(`/stores/${storeIdToFetch}/waiter-calls`);
      if (res.data?.success) setWaiterCalls(res.data.data || []);
    } catch (e) {
      console.error('Failed to fetch waiter calls', e);
    }
  }, []);

  const fetchWaiterAvailability = useCallback(async (storeIdToFetch) => {
    if (!storeIdToFetch) return;
    try {
      const res = await api.get(`/stores/${storeIdToFetch}/waiter-calls/availability`);
      if (res.data?.success && res.data.data?.status) setWaiterAvailability(res.data.data.status);
    } catch (e) { }
  }, []);

  const toggleAvailability = async () => {
    const nextStatus = waiterAvailability === 'AVAILABLE' ? 'BUSY' : 'AVAILABLE';
    try {
      setWaiterAvailability(nextStatus);
      await api.post(`/stores/${selectedStoreId}/waiter-calls/availability`, { status: nextStatus });
      showToast(nextStatus === 'AVAILABLE' ? 'You are now available' : 'You are now busy / on break', 'info');
    } catch (e) {
      showToast('Failed to update availability status', 'error');
    }
  };

  const handleAcknowledgeCall = async (callId) => {
    setCallActionLoading(callId);
    try {
      const res = await api.patch(`/stores/${selectedStoreId}/waiter-calls/${callId}/acknowledge`);
      if (res.data?.success) {
        showToast('On your way!', 'success');
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
        showToast('Marked as done', 'success');
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
      if (res.data.success) setOrders(res.data.data);
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
        if (!selectedStoreId) setSelectedStoreId(res.data.data[0].id);
      }
    } catch (err) {
      showToast('Failed to fetch stores', 'error');
    } finally {
      setStoresLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    if (!user?.store) fetchStores();
  }, [user, fetchStores]);

  useEffect(() => {
    if (!selectedStoreId) return;

    fetchOrders(selectedStoreId);
    fetchWaiterCalls(selectedStoreId);
    fetchWaiterAvailability(selectedStoreId);

    api.get(`/stores/${selectedStoreId}`)
      .then((res) => { if (res.data.success) setStoreData(res.data.data); })
      .catch((err) => console.error('Failed to fetch store data', err));

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    let eventSource;

    try {
      eventSource = new EventSource(`${baseUrl}/stores/${selectedStoreId}/orders/stream?token=${token}`);
      eventSource.onopen = () => setConnectionStatus('connected');
      eventSource.onerror = () => setConnectionStatus('disconnected');

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (['ORDER_PENDING_VERIFICATION', 'ORDER_READY', 'ORDER_SERVED', 'ORDER_PROCESSING', 'ORDER_CANCELLED', 'ORDER_SETTLED', 'ORDER_ITEMS_REJECTED', 'ORDER_ITEM_READY', 'ORDER_RECALLED', 'ORDER_DELAYED'].includes(data.type)) {
            fetchOrders(selectedStoreId, true);

            if (data.type === 'ORDER_READY') {
              playChime();
              showToast(`Table ${data.data?.table?.tableNumber || ''}: order ready`, 'success');
            } else if (data.type === 'ORDER_ITEM_READY' && data.data?.ready) {
              playChime();
              showToast(`Table ${data.data.tableNumber ?? '–'}: ${data.data.label} ready to serve`, 'success');
            } else if (data.type === 'ORDER_RECALLED') {
              playChime();
              showToast(`Table ${data.data?.tableNumber ?? '–'}: kitchen recalled the order — don't serve yet`, 'error');
            } else if (data.type === 'ORDER_DELAYED') {
              showToast(`Table ${data.data?.tableNumber ?? '–'}: kitchen running ${data.data?.minutes} min late (guest notified)`, 'info');
            } else if (data.type === 'ORDER_ITEMS_REJECTED') {
              // Kitchen can't make something: the waiter must tell the guest
              const e = data.data || {};
              playChime();
              showToast(`Table ${e.tableNumber ?? '–'}: kitchen can't make ${(e.items || []).join(', ')} (${e.reason}). Please inform the guest.`, 'error');
            } else if (data.type === 'ORDER_PENDING_VERIFICATION') {
              playChime();
              showToast(`Table ${data.data?.table?.tableNumber || ''}: new order`, 'info');
            }

          }

          if ([
            'WAITER_CALL_CREATED',
            'WAITER_CALL_DISPATCHED',
            'WAITER_CALL_ESCALATED',
            'WAITER_CALL_ESCALATED_MANAGER',
            'WAITER_CALL_ACKNOWLEDGED',
            'WAITER_CALL_RESOLVED',
            'WAITER_CALL_CANCELLED',
          ].includes(data.type)) {
            fetchWaiterCalls(selectedStoreId);

            if (['WAITER_CALL_CREATED', 'WAITER_CALL_DISPATCHED', 'WAITER_CALL_ESCALATED'].includes(data.type)) {
              const assignedId = data.data?.assignedWaiterId || data.data?.dispatch?.assignedWaiterId;
              if (assignedId === user?.id) {
                playChime();
                showToast(`Table ${data.data?.tableNumber || ''} needs you`, 'info');
              }
            } else if (data.type === 'WAITER_CALL_ESCALATED_MANAGER') {
              if (['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER'].includes(user?.role)) {
                playChime();
                showToast(data.data?.message || 'Urgent call escalated to manager', 'error');
              }
            }
          }

          if (data.type === 'WAITER_AVAILABILITY_CHANGED' && data.data?.waiterId === user?.id) {
            setWaiterAvailability(data.data.status);
          }
        } catch (e) { }
      };
    } catch (err) {
      setConnectionStatus('disconnected');
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [selectedStoreId, token, fetchOrders, fetchWaiterCalls, fetchWaiterAvailability, user]);

  const updateStatus = async (orderId, status) => {
    setActionLoading(orderId);
    setError('');
    try {
      await api.patch(`/stores/${selectedStoreId}/orders/${orderId}/status`, { status });
      setOrders((prev) => prev.filter((o) => o.id !== orderId));

      const statusMessages = {
        CANCELLED: 'Order cancelled',
        PROCESSING: 'Order approved',
        SERVED: 'Marked as served',
        SETTLED: 'Order settled',
      };
      showToast(statusMessages[status] || 'Order updated', 'success');

      if (status === 'SETTLED' && paymentOrder?.id === orderId) setPaymentOrder(null);
    } catch (err) {
      console.error(err);
      const errorMessage = err.response?.data?.message || 'Failed to update order';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStoreChange = (storeId) => {
    setSelectedStoreId(storeId);
    setOrders([]);
  };

  const pendingOrders = orders.filter((o) => o.status === 'PENDING_VERIFICATION');
  const readyOrders = orders.filter((o) => o.status === 'READY');

  const servedGroups = useMemo(() => {
    const postPaidServed = orders.filter((o) => o.status === 'SERVED' && o.paymentModel === 'POSTPAID');
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
          orders: [ord],
        };
        map.set(key, grp);
        groups.push(grp);
      }
    }
    return groups;
  }, [orders]);

  const counts = {
    VERIFY: pendingOrders.length,
    SERVE: readyOrders.length,
    COLLECT: servedGroups.length,
  };

  const handlePrint = () => {
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
  };

  return (
    <div className="relative flex h-full flex-col bg-[#FAFAF9] dark:bg-zinc-950">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <CancelOrderDialog
        storeId={selectedStoreId}
        order={rejectingOrder}
        onClose={() => setRejectingOrder(null)}
        onCancelled={() => {
          const id = rejectingOrder.id;
          setOrders((prev) => prev.filter((o) => o.id !== id));
          showToast('Order rejected', 'success');
        }}
      />

      <PaymentCollectorSheet
        open={Boolean(paymentOrder)}
        title="Collect payment"
        subtitle={paymentOrder?.table ? `Table ${paymentOrder.table.tableNumber}` : 'Takeaway'}
        storeId={selectedStoreId}
        orderId={paymentOrder?.tableSessionId ? undefined : paymentOrder?.id}
        tableSessionId={paymentOrder?.tableSessionId || undefined}
        onClose={() => setPaymentOrder(null)}
        onSettled={async (summary) => {
          const target = paymentOrder;
          setPaymentOrder(null);
          showToast('Payment received!', 'success');
          fetchOrders(selectedStoreId, true);
          try {
            if (target?.tableSessionId) {
              const billRes = await api.get(`/stores/${selectedStoreId}/orders/sessions/${target.tableSessionId}`);
              setReceiptOrder(sessionBillToReceipt(billRes.data.data, summary.payments));
            } else if (target) {
              const orderRes = await api.get(`/stores/${selectedStoreId}/orders/${target.id}`);
              setReceiptOrder(orderRes.data.data);
            }
          } catch { /* receipt is optional */ }
        }}
      />

      {receiptOrder && (
        <div className="fixed inset-0 z-70 flex items-end justify-center bg-black/50 sm:items-center">
          <div className="flex max-h-sheet w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl animate-sheet-up dark:bg-zinc-900 sm:max-w-md sm:rounded-3xl">
            <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-zinc-200 dark:bg-zinc-700 sm:hidden" />

            <div className="flex flex-col items-center gap-1 px-5 py-5 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                <Tick02Icon size={26} />
              </div>
              <h3 className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-100">Payment successful</h3>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain bg-zinc-50 px-4 pb-4 dark:bg-black">
              {receiptOrder && storeData && <Receipt ref={receiptRef} order={receiptOrder} storeData={storeData} />}
            </div>

            <div className="flex gap-3 p-4 pb-safe">
              <Button variant="outline" className="h-12 flex-1 rounded-full" onClick={() => setReceiptOrder(null)}>
                Close
              </Button>
              <Button className={`h-12 flex-1 rounded-full text-white ${BRAND}`} onClick={handlePrint}>
                <PrinterIcon size={17} className="mr-2" /> Print
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-zinc-200/70 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:border-zinc-800/70 dark:bg-zinc-950/80 dark:supports-[backdrop-filter]:bg-zinc-950/60">
        {/* ── Store / status / availability row ── */}
        <div className="flex items-center gap-2.5 px-3 pt-3 sm:gap-3 sm:px-4 sm:pt-4">

          <div className="w-full flex flex-row justify-between items-center">
            {user?.store ? (
              <div
                title={storeData?.name || 'Your store'}
                className="truncate text-sm font-bold leading-tight text-zinc-900 sm:text-[15px] dark:text-zinc-100"
              >
                {storeData?.name || 'Your store'}
              </div>
            ) : (
              <Select
                value={selectedStoreId}
                onValueChange={handleStoreChange}
                disabled={storesLoading}
              >
                <SelectTrigger className="w-full max-w-[220px] rounded-full">
                  <Store01Icon size={14} className="shrink-0 text-yellow-500" />
                  <SelectValue
                    placeholder={storesLoading ? '…' : 'Choose store'}
                    className="truncate"
                  />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 sm:text-xs">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${connectionStatus === 'connected'
                  ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]'
                  : connectionStatus === 'connecting'
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-red-500'
                  }`}
              />
              <span className="truncate">
                {connectionStatus === 'connected'
                  ? 'Live'
                  : connectionStatus === 'connecting'
                    ? 'Connecting…'
                    : 'Offline'}
              </span>
            </div>
          </div>

          <button
            onClick={toggleAvailability}
            aria-label={
              waiterAvailability === 'AVAILABLE' ? 'Set as on break' : 'Set as available'
            }
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition active:scale-95 sm:px-3.5 sm:py-2 sm:text-xs ${waiterAvailability === 'AVAILABLE'
              ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20'
              : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
          >
            <span className="hidden xs:inline sm:inline">
              {waiterAvailability === 'AVAILABLE' ? 'Available' : 'On break'}
            </span>
            <span className="xs:hidden sm:hidden">
              {waiterAvailability === 'AVAILABLE' ? 'On' : 'Break'}
            </span>
          </button>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="mx-3 mt-2.5 rounded-2xl bg-red-500/10 px-3.5 py-2.5 text-xs font-medium text-red-600 sm:mx-4 sm:mt-3 dark:text-red-400">
            {error}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="px-3 pb-2 pt-3 sm:px-4 sm:pt-4">
          <div
            role="tablist"
            className="-mx-1 flex overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {TABS.map(({ key, label }, i) => {
              const isActive = activeTab === key;
              const count = counts[key] ?? 0;
              const isFirst = i === 0;
              const isLast = i === TABS.length - 1;

              return (
                <Button
                  key={key}
                  role="tab"
                  aria-selected={isActive}
                  variant="ghost"
                  onClick={() => setActiveTab(key)}
                  className={`min-w-fit mx-3 flex-1 gap-1.5 rounded-none ${isFirst ? 'rounded-l-full' : ''
                    } ${isLast ? 'rounded-r-full' : ''} ${!isFirst ? '-ml-px' : ''
                    } ${isActive
                      ? `${BRAND} text-white shadow-sm`
                      : 'bg-white text-zinc-500 hover:bg-white hover:text-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200'
                    }`}
                >
                  <span>{label}</span>
                  {count > 0 && (
                    <span
                      className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-extrabold tabular-nums sm:text-[11px] ${isActive
                        ? 'bg-white/25 text-white'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                    >
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-safe">
        {waiterCalls.length > 0 && (
          <div className="hide-scrollbar -mx-4 mt-1 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1">
            {waiterCalls.map((call) => {
              const isAssignedToMe = call.assignedWaiterId === user?.id;
              const isAcknowledged = call.status === 'ACKNOWLEDGED';
              const assignedTimestamp = call.assignedAt ? new Date(call.assignedAt).getTime() : new Date(call.createdAt).getTime();
              const remainingSec = Math.max(0, 60 - Math.floor((nowTime - assignedTimestamp) / 1000));
              const label = CALL_LABEL[call.type] || CALL_LABEL.DEFAULT;

              return (
                <div key={call.id} className="flex w-60 shrink-0 snap-start items-center gap-3 rounded-2xl bg-white p-3 shadow-sm dark:bg-zinc-900">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                    <AlertCircleIcon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      T{call.table?.tableNumber || '—'} · {label}
                    </div>
                    {call.note && <div className="truncate text-xs italic text-zinc-500" title={call.note}>“{call.note}”</div>}
                    <div className="text-xs text-zinc-400">
                      {isAcknowledged ? 'On the way' : isAssignedToMe ? `${remainingSec}s to respond` : call.assignedWaiterName || 'Unassigned'}
                    </div>
                  </div>
                  <button
                    onClick={() => (isAcknowledged ? handleResolveCall(call.id) : handleAcknowledgeCall(call.id))}
                    disabled={callActionLoading === call.id}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold text-white active:scale-95 ${isAcknowledged ? 'bg-emerald-500' : 'bg-yellow-500'}`}
                  >
                    {callActionLoading === call.id ? '…' : isAcknowledged ? 'Done' : 'Go'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-3 py-3">
          {activeTab === 'VERIFY' && (
            loading ? <OrderSkeleton /> : pendingOrders.length === 0 ? (
              <EmptyState title="No new orders" description="They'll show up here the moment a guest submits one." />
            ) : (
              pendingOrders.map((order) => (
                <Card key={order.id} className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50">Table {order.table?.tableNumber || 'N/A'}</span>
                        <span className="text-xs text-zinc-400">{Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000)}m ago</span>
                      </div>
                      <span className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50">₹{order.totalAmount}</span>
                    </div>

                    <p className="mb-4 truncate text-sm text-zinc-500 dark:text-zinc-400">
                      {order.items.map((i) => `${i.quantity}× ${i.menuItem?.name}`).join(', ')}
                    </p>

                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="lg"
                        onClick={() => setRejectingOrder(order)}
                        disabled={actionLoading === order.id}
                        className="rounded-none rounded-l-full w-full"
                      >
                        Reject
                      </Button>
                      <Button
                      size="lg"
                        onClick={() => updateStatus(order.id, 'PROCESSING')}
                        disabled={actionLoading === order.id}
                        className="rounded-none rounded-r-full w-full"
                      >
                        Approve
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )
          )}

          {activeTab === 'SERVE' && (
            loading ? <OrderSkeleton /> : readyOrders.length === 0 ? (
              <EmptyState title="Nothing ready yet" description="Ready orders from the kitchen will land here." />
            ) : (
              readyOrders.map((order) => (
                <Card key={order.id} className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50">Table {order.table?.tableNumber || 'N/A'}</span>
                        {order.paymentModel === 'PREPAID' ? (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckmarkBadge01Icon size={11} /> Paid
                          </span>
                        ) : (
                          <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[11px] font-bold text-yellow-600 dark:text-yellow-400">To collect</span>
                        )}
                      </div>
                      <span className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50">₹{order.totalAmount}</span>
                    </div>

                    <p className="mb-4 truncate text-sm text-zinc-500 dark:text-zinc-400">
                      {order.items.map((i) => `${i.quantity}× ${i.menuItem?.name}`).join(', ')}
                    </p>

                    <Button
                      className={`h-12 w-full rounded-full text-[15px] text-white active:scale-[0.98] ${BRAND}`}
                      onClick={() => updateStatus(order.id, 'SERVED')}
                      disabled={actionLoading === order.id}
                    >
                      Mark as served
                    </Button>
                  </CardContent>
                </Card>
              ))
            )
          )}

          {activeTab === 'COLLECT' && (
            loading ? <OrderSkeleton /> : servedGroups.length === 0 ? (
              <EmptyState title="All settled up" description="Bills for served tables will appear here." />
            ) : (
              servedGroups.map((group) => {
                const groupTotal = group.orders.reduce((sum, o) => sum + o.totalAmount, 0);
                return (
                  <Card key={group.key} className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50">Table {group.table?.tableNumber || 'N/A'}</span>
                          {group.tableSession?.pin && (
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${BRAND_SOFT} ${BRAND_TEXT}`}>PIN {group.tableSession.pin}</span>
                          )}
                        </div>
                        <span className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50">₹{groupTotal}</span>
                      </div>

                      <p className="mb-4 text-xs text-zinc-400">
                        {group.orders.length} batch{group.orders.length > 1 ? 'es' : ''} · last served{' '}
                        {new Date(group.orders[group.orders.length - 1].updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>

                      <Button
                        className={`h-12 w-full rounded-full text-[15px] font-bold text-white active:scale-[0.98] ${BRAND}`}
                        onClick={() => {
                          setPaymentOrder({
                            id: group.orders[0].id,
                            tableSessionId: group.tableSessionId,
                            table: group.table,
                            totalAmount: groupTotal,
                            orders: group.orders,
                          });
                        }}
                      >
                        <Money01Icon size={18} className="mr-2" /> Collect ₹{groupTotal}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )
          )}
        </div>
      </div>
    </div>
  );
};