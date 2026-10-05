import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import { subscribeStore } from '../lib/live-stream';
import {
  FloorMap,
  LiveTableFloorPlan,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@smo/ui';
import {
  Store01Icon,
  Clock01Icon,
  DashboardSquare01Icon,
  Tick02Icon,
  Cancel01Icon
} from 'hugeicons-react';

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
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 p-4 rounded-lg border ${bgColor} animate-slide-in`}>
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

export const Dashboard = () => {
  const { user, token } = useAuthStore();
  const navigate = useNavigate();

  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(user?.storeId || user?.store?.id || null);
  const [floorStatus, setFloorStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [toast, setToast] = useState(null);

  // Fetch available stores if multi-store user
  useEffect(() => {
    if (!user?.storeId && !user?.store?.id) {
      api.get('/stores').then((res) => {
        if (res.data.success && res.data.data.length > 0) {
          setStores(res.data.data);
          if (!selectedStoreId) {
            setSelectedStoreId(res.data.data[0].id);
          }
        }
      }).catch((err) => console.error('Failed to fetch stores:', err));
    }
  }, [user, selectedStoreId]);

  // Fetch Floor Status
  const fetchFloorStatus = useCallback(async (storeIdToFetch, silent = false) => {
    if (!storeIdToFetch) return;
    if (!silent) setLoading(true);

    try {
      const res = await api.get(`/stores/${storeIdToFetch}/floor-status`);
      if (res.data.success) {
        setFloorStatus(res.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch floor status:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Sync and SSE Stream connection
  useEffect(() => {
    if (!selectedStoreId) return;

    // Initial fetch
    fetchFloorStatus(selectedStoreId);

    // Safety net only: the event stream below delivers changes instantly
    const intervalId = setInterval(() => {
      fetchFloorStatus(selectedStoreId, true);
    }, 30000);

    // Live updates over the shared connection (reconnects by itself, see lib/live-stream)
    const relevantEvents = new Set([
      'STREAM_RECONNECTED',
      'ORDER_PENDING_PAYMENT', 'ORDER_UPDATED', 'ORDER_ITEMS_REJECTED',
      'TABLE_SESSION_SETTLED', 'TABLE_UPDATED',
      'RESERVATION_CREATED', 'RESERVATION_UPDATED', 'RESERVATION_DELETED',
      'ORDER_PENDING_VERIFICATION', 'ORDER_PROCESSING', 'ORDER_READY', 'ORDER_SERVED', 'ORDER_SETTLED', 'ORDER_CANCELLED',
      'WAITER_CALL_CREATED', 'WAITER_CALL_DISPATCHED', 'WAITER_CALL_ESCALATED', 'WAITER_CALL_ESCALATED_MANAGER',
      'WAITER_CALL_ACKNOWLEDGED', 'WAITER_CALL_RESOLVED', 'WAITER_CALL_CANCELLED',
    ]);
    let refreshTimer;
    const unsubscribe = subscribeStore(selectedStoreId, (data) => {
      if (!relevantEvents.has(data.type)) return;
      // One refresh per burst of events (e.g. a bill settling several orders at once)
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => fetchFloorStatus(selectedStoreId, true), 400);
    }, (status) => setConnectionStatus(status === 'live' ? 'connected' : 'disconnected'));

    return () => {
      clearInterval(intervalId);
      clearTimeout(refreshTimer);
      unsubscribe();
    };
  }, [selectedStoreId, token, fetchFloorStatus]);

  // Handle resolving a waiter call from table floor plan
  const handleResolveWaiterCall = async (callId) => {
    if (!selectedStoreId || !callId) return;
    try {
      await api.patch(`/stores/${selectedStoreId}/calls/${callId}/resolve`);
      setToast({ message: 'Table assistance call marked as resolved!', type: 'success' });
      await fetchFloorStatus(selectedStoreId, true);
    } catch (err) {
      console.error('Failed to resolve waiter call:', err);
      const errMsg = err.response?.data?.message || 'Failed to resolve call';
      setToast({ message: errMsg, type: 'error' });
      throw err;
    }
  };

  // Open POS with table pre-selected
  const handleOpenPOS = (tableNumber) => {
    navigate(`/dashboard/pos?table=${tableNumber}`);
  };

  // Seat a pre-booked reservation directly from floor plan
  const handleSeatReservation = async (reservationId) => {
    if (!selectedStoreId || !reservationId) return;
    try {
      await api.patch(`/stores/${selectedStoreId}/reservations/${reservationId}`, {
        status: 'SEATED'
      });
      fetchFloorStatus(selectedStoreId, true);
    } catch (err) {
      console.error('Failed to seat reservation:', err);
    }
  };

  // Derived metrics
  const tables = floorStatus?.tables || [];
  const totalTables = tables.length;
  const occupiedTables = tables.filter((t) => t.status !== 'AVAILABLE').length;
  const occupancyPercent = totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0;
  const kitchenOrders = floorStatus?.orders?.filter((o) => o.status === 'PROCESSING').length || 0;
  const readyOrders = floorStatus?.orders?.filter((o) => o.status === 'READY').length || 0;
  const waiterCallsCount = floorStatus?.waiterCalls || 0;
  const activeReservationsCount = floorStatus?.activeReservations || 0;
  const storeName = stores.find((st) => st.id === selectedStoreId)?.name || user?.store?.name;
  const isLive = connectionStatus === 'connected';

  // One flat strip; colour only when a number needs someone's attention
  const stats = [
    {
      key: 'occupancy',
      label: 'Tables occupied',
      value: occupiedTables,
      suffix: `/ ${totalTables}`,
      detail: `${occupancyPercent}% of the floor`,
      progress: occupancyPercent,
    },
    {
      key: 'kitchen',
      label: 'In kitchen',
      value: kitchenOrders,
      detail: kitchenOrders === 1 ? 'order cooking' : 'orders cooking',
      to: '/dashboard/kds',
    },
    {
      key: 'ready',
      label: 'Ready to serve',
      value: readyOrders,
      detail: readyOrders > 0 ? 'waiting at the pass' : 'nothing waiting',
      tone: readyOrders > 0 ? 'text-violet-600 dark:text-violet-400' : '',
      to: '/dashboard/waiter',
    },
    {
      key: 'calls',
      label: 'Waiter calls',
      value: waiterCallsCount,
      detail: waiterCallsCount > 0 ? 'guests waiting' : 'all handled',
      tone: waiterCallsCount > 0 ? 'text-rose-600 dark:text-rose-400' : '',
      to: '/dashboard/waiter',
    },
    {
      key: 'bookings',
      label: 'Bookings today',
      value: activeReservationsCount,
      detail: 'confirmed or seated',
      to: '/dashboard/reservations',
    },
  ];

  return (
    <div className="space-y-5 pb-12">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Welcome back, {user?.name?.split(' ')[0] || 'there'}</p>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2.5">
            <span className="truncate">{storeName || 'Floor overview'}</span>
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400"
              title={isLive ? 'Updates arrive instantly' : 'Reconnecting to live updates'}
            >
              <span className={`size-1.5 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
              {isLive ? 'Live' : 'Reconnecting…'}
            </span>
          </h1>
        </div>

        {stores.length > 0 && (
          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger className="w-full sm:w-[220px] h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm">
              <Store01Icon size={16} className="mr-1.5 text-zinc-400" />
              <SelectValue placeholder="Select a store" />
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
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-zinc-200 dark:divide-zinc-800 lg:divide-x overflow-hidden">
        {stats.map((stat, i) => {
          const body = (
            <>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{stat.label}</span>
              <span className="mt-1 flex items-baseline gap-1">
                <span className={`text-2xl font-semibold tabular-nums ${stat.tone || 'text-zinc-900 dark:text-zinc-50'}`}>
                  {loading && !floorStatus ? '–' : stat.value}
                </span>
                {stat.suffix && <span className="text-sm text-zinc-400 tabular-nums">{stat.suffix}</span>}
              </span>
              {stat.progress !== undefined ? (
                <span className="mt-2 h-1 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden" aria-hidden="true">
                  <span className="block h-full bg-zinc-900 dark:bg-zinc-100 transition-[width] duration-500" style={{ width: `${stat.progress}%` }} />
                </span>
              ) : null}
              <span className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">{stat.detail}</span>
            </>
          );
          // Borders between cells on small screens (2-column grid)
          const cellClass = `flex flex-col p-4 text-left ${i % 2 === 1 ? 'border-l lg:border-l-0' : ''} ${i >= 2 ? 'border-t lg:border-t-0' : ''} border-zinc-200 dark:border-zinc-800 ${i === stats.length - 1 && stats.length % 2 === 1 ? 'col-span-2 lg:col-span-1' : ''}`;
          return stat.to ? (
            <button
              key={stat.key}
              type="button"
              onClick={() => navigate(stat.to)}
              className={`${cellClass} hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors`}
            >
              {body}
            </button>
          ) : (
            <div key={stat.key} className={cellClass}>{body}</div>
          );
        })}
      </div>

      {/* Floor */}
      <LiveTableFloorPlan
        floorStatus={floorStatus}
        onResolveWaiterCall={handleResolveWaiterCall}
        onOpenPOS={handleOpenPOS}
        onSeatReservation={handleSeatReservation}
        onBookTable={(table) => {
          if (table) {
            navigate(`/dashboard/reservations/new?tableId=${table.id}${selectedStoreId ? `&store=${selectedStoreId}` : ''}`);
          } else {
            navigate(`/dashboard/reservations/new${selectedStoreId ? `?store=${selectedStoreId}` : ''}`);
          }
        }}
        extraViews={[
          {
            id: 'pipeline',
            label: 'Pipeline',
            icon: DashboardSquare01Icon,
            render: () => <FloorMap floorStatus={floorStatus} />,
          },
        ]}
      />
    </div>
  );
};

export default Dashboard;
  