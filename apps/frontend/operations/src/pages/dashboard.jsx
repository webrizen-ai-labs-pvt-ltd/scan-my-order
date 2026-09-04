import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
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
  Restaurant01Icon,
  Store01Icon,
  Clock01Icon,
  CheckmarkBadge01Icon,
  AlertCircleIcon,
  Layers01Icon,
  DashboardSquare01Icon,
  Tick02Icon
} from 'hugeicons-react';

export const Dashboard = () => {
  const { user, token } = useAuthStore();
  const navigate = useNavigate();

  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(user?.storeId || user?.store?.id || null);
  const [floorStatus, setFloorStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [activeFloorView, setActiveFloorView] = useState('live_floor'); // 'live_floor' | 'pipeline'

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

    // Background 5s polling fallback
    const intervalId = setInterval(() => {
      fetchFloorStatus(selectedStoreId, true);
    }, 5000);

    // Live Server-Sent Events (SSE) stream for zero-latency instant updates
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
          const relevantEvents = [
            'ORDER_PENDING_VERIFICATION',
            'ORDER_PROCESSING',
            'ORDER_READY',
            'ORDER_SERVED',
            'ORDER_SETTLED',
            'ORDER_CANCELLED',
            'WAITER_CALL_CREATED',
            'WAITER_CALL_ACKNOWLEDGED',
            'WAITER_CALL_RESOLVED'
          ];

          if (relevantEvents.includes(data.type)) {
            // Immediate real-time refresh when tables or orders change
            fetchFloorStatus(selectedStoreId, true);
          }
        } catch (err) {
          console.error('Error parsing SSE event:', err);
        }
      };
    } catch (sseErr) {
      console.error('SSE initialization error:', sseErr);
      setConnectionStatus('disconnected');
    }

    return () => {
      clearInterval(intervalId);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [selectedStoreId, token, fetchFloorStatus]);

  // Handle resolving a waiter call from table floor plan
  const handleResolveWaiterCall = async (callId) => {
    if (!selectedStoreId || !callId) return;
    try {
      await api.patch(`/stores/${selectedStoreId}/calls/${callId}/resolve`);
      fetchFloorStatus(selectedStoreId, true);
    } catch (err) {
      console.error('Failed to resolve waiter call:', err);
    }
  };

  // Open POS with table pre-selected
  const handleOpenPOS = (tableNumber) => {
    navigate(`/dashboard/pos?table=${tableNumber}`);
  };

  // Derived metrics
  const tables = floorStatus?.tables || [];
  const totalTables = tables.length;
  const occupiedTables = tables.filter((t) => t.status !== 'AVAILABLE').length;
  const occupancyPercent = totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0;
  const kitchenOrders = floorStatus?.orders?.filter((o) => o.status === 'PROCESSING').length || 0;
  const readyOrders = floorStatus?.orders?.filter((o) => o.status === 'READY').length || 0;
  const waiterCallsCount = floorStatus?.waiterCalls || 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Store Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
            Welcome back, {user?.name?.split(' ')[0] || 'Staff'}!
            {/* Live SSE Status Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
              }`}
              title={connectionStatus === 'connected' ? 'Zero-latency SSE Connected' : 'Connecting stream...'}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
                }`}
              />
              {connectionStatus === 'connected' ? 'Live Floor Sync' : 'Reconnecting...'}
            </span>
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Real-time operations & live architectural table floor overview.
          </p>
        </div>

        {/* Store Selector for Admin/Multi-store Managers */}
        {stores.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger className="w-[220px] h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-xs font-medium">
                <Store01Icon size={16} className="mr-1.5 text-zinc-400" />
                <SelectValue placeholder="Select a location" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Real-Time Operational KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Table Occupancy */}
        <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Floor Occupancy</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
              <Restaurant01Icon size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-3xl font-black text-zinc-900 dark:text-zinc-50">
              {occupiedTables} <span className="text-lg font-medium text-zinc-400">/ {totalTables}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${occupancyPercent}%` }}
                />
              </div>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{occupancyPercent}%</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Active Kitchen Orders */}
        <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">In Kitchen (KDS)</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
              <Clock01Icon size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-3xl font-black text-zinc-900 dark:text-zinc-50">{kitchenOrders}</div>
            <p className="text-xs text-zinc-400 mt-1">Dishes currently being prepared</p>
          </div>
        </div>

        {/* Metric 3: Ready for Serving */}
        <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Ready on Pass</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500">
              <CheckmarkBadge01Icon size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-3xl font-black text-purple-600 dark:text-purple-400">{readyOrders}</div>
            <p className="text-xs text-zinc-400 mt-1">Hot dishes awaiting table pickup</p>
          </div>
        </div>

        {/* Metric 4: Waiter Calls */}
        <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Waiter Calls</span>
            <div className={`p-1.5 rounded-lg ${waiterCallsCount > 0 ? 'bg-red-500/10 text-red-500 animate-bounce' : 'bg-zinc-500/10 text-zinc-400'}`}>
              <AlertCircleIcon size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className={`text-3xl font-black ${waiterCallsCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-50'}`}>
              {waiterCallsCount}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {waiterCallsCount > 0 ? 'Active customer call alerts!' : 'All customer requests resolved'}
            </p>
          </div>
        </div>
      </div>

      {/* Floor Plan Header & View Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            Live Floor Plan
          </h2>
          <p className="text-xs text-zinc-500">
            Interactive visual map with live table color transitions & guest status.
          </p>
        </div>

        {/* Switcher: Architectural Live Floor vs Flow Pipeline */}
        <div className="flex bg-zinc-200/80 dark:bg-zinc-800/80 rounded-xl p-1 border border-zinc-300/50 dark:border-zinc-700/50">
          <button
            onClick={() => setActiveFloorView('live_floor')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFloorView === 'live_floor'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Layers01Icon size={15} />
            Interactive SVG Floor
          </button>
          <button
            onClick={() => setActiveFloorView('pipeline')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFloorView === 'pipeline'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <DashboardSquare01Icon size={15} />
            Department Pipeline
          </button>
        </div>
      </div>

      {/* Main Floor Plan Component */}
      {activeFloorView === 'live_floor' ? (
        <LiveTableFloorPlan
          floorStatus={floorStatus}
          onResolveWaiterCall={handleResolveWaiterCall}
          onOpenPOS={handleOpenPOS}
        />
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
          <FloorMap floorStatus={floorStatus} />
        </div>
      )}
    </div>
  );
};

export default Dashboard;
