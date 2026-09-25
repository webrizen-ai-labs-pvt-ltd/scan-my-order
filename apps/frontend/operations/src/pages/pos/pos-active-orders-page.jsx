import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Skeleton } from '@smo/ui';
import { Money01Icon, Search01Icon, Tick02Icon, Edit02Icon, LockKeyIcon, PlusSignIcon } from 'hugeicons-react';
import api from '../../lib/api';
import { usePos } from './pos-layout';
import { useAuthStore } from '../../store/authStore';
import { usePosCartStore } from '../../store/pos-cart-store';
import { CancelOrderDialog } from '../../components/pos/cancel-order-dialog';
import { apiErrorMessage } from '../../components/pos/pos-toasts';

const STATUS_DISPLAY = {
  PENDING_VERIFICATION: { label: 'Awaiting approval', tone: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800' },
  PENDING_PAYMENT: { label: 'Awaiting payment', tone: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' },
  PROCESSING: { label: 'In kitchen', tone: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' },
  READY: { label: 'Ready', tone: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800' },
  SERVED: { label: 'Served', tone: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' },
};

const REFRESH_EVENTS = /^(ORDER_|PAYMENT_UPDATED|TABLE_SESSION_SETTLED)/;

export const PosActiveOrdersPage = () => {
  const { storeId, subscribe, toast, data } = usePos();
  const setCartTable = usePosCartStore(s => s.setTableId);
  const cartLineCount = usePosCartStore(s => s.lines.length);
  const cartTableId = usePosCartStore(s => s.tableId);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isManager = ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER'].includes(user?.role);

  const [orders, setOrders] = useState(null);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  // Waiters only reject unapproved orders; cashiers and managers can cancel any unpaid order
  const canCancel = (order) => !order.paidAt && (user?.role !== 'WAITER' || order.status === 'PENDING_VERIFICATION');

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.get(`/stores/${storeId}/orders`);
      setOrders(res.data.data || []);
    } catch (err) {
      toast(apiErrorMessage(err, 'Failed to load orders'), 'error');
      setOrders(prev => prev || []);
    }
  }, [storeId, toast]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => subscribe((msg) => { if (REFRESH_EVENTS.test(msg.type)) fetchOrders(); }), [subscribe, fetchOrders]);

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = (orders || []).filter(o => !term
      || String(o.table?.tableNumber ?? '').includes(term)
      || String(o.tableSession?.pin ?? '').includes(term)
      || o.id.toLowerCase().includes(term));

    const map = new Map();
    for (const o of list) {
      const key = o.tableSessionId || `ord_${o.id}`;
      if (!map.has(key)) map.set(key, { key, tableSessionId: o.tableSessionId, tableSession: o.tableSession, table: o.table, orders: [] });
      map.get(key).orders.push(o);
    }
    return [...map.values()];
  }, [orders, search]);

  const approve = async (orderId) => {
    setBusyId(orderId);
    try {
      await api.patch(`/stores/${storeId}/orders/${orderId}/verify`);
      fetchOrders();
    } catch (err) {
      toast(apiErrorMessage(err, 'Failed to approve order'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  // New items for a seated table go on a new batch in the same session — no PIN needed
  const addItemsToTable = (table) => {
    if (cartLineCount > 0 && cartTableId && cartTableId !== table.id) {
      const from = data.tables.find(t => t.id === cartTableId);
      toast(`Cart moved${from ? ` from Table ${from.tableNumber}` : ''} to Table ${table.tableNumber}`, 'info');
    }
    setCartTable(table.id);
    navigate('/dashboard/pos');
  };

  const markServed = async (orderId) => {
    setBusyId(orderId);
    try {
      await api.patch(`/stores/${storeId}/orders/${orderId}/status`, { status: 'SERVED' });
      fetchOrders();
    } catch (err) {
      toast(apiErrorMessage(err, 'Failed to update order'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (orders === null) {
    return (
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden p-4">
      <div className="mb-4 shrink-0 relative">
        <Search01Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
        <input
          type="text"
          aria-label="Search orders"
          placeholder="Search by table number, table PIN or order ID…"
          className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {groups.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <Money01Icon size={48} className="text-zinc-300 mb-4" />
          <h3 className="text-lg font-medium">{search ? 'No matching orders' : 'No active orders'}</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-max flex-1 overflow-y-auto pr-1 pb-6">
          {groups.map(group => {
            const unpaid = group.orders.filter(o => !o.paidAt);
            const dueTotal = unpaid.reduce((s, o) => s + o.totalAmount, 0);
            const pendingApproval = group.orders.filter(o => o.status === 'PENDING_VERIFICATION');
            const collectHref = group.tableSessionId
              ? `/dashboard/pos/checkout/table/${group.tableSessionId}`
              : `/dashboard/pos/checkout/order/${group.orders[0].id}`;

            return (
              <div key={group.key} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col">
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-start gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xl">{group.table ? `Table ${group.table.tableNumber}` : 'Takeaway'}</span>
                      {group.tableSession?.pin && (
                        <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs px-2 py-0.5 rounded-md font-bold dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-300">
                          <LockKeyIcon size={11} /> PIN {group.tableSession.pin}
                        </span>
                      )}
                      {group.orders.length > 1 && (
                        <span className="bg-zinc-200 dark:bg-zinc-800 text-[11px] px-2 py-0.5 rounded-md font-bold">{group.orders.length} batches</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-2xl tabular-nums">₹{dueTotal}</div>
                    <div className="text-[10px] uppercase font-bold text-zinc-400">{dueTotal > 0 ? 'due' : 'paid'}</div>
                  </div>
                </div>

                <div className="p-4 flex-1 overflow-y-auto max-h-[240px] space-y-3">
                  {group.orders.map((order, idx) => {
                    const status = STATUS_DISPLAY[order.status] || { label: order.status, tone: 'bg-zinc-100 text-zinc-700 border-zinc-200' };
                    return (
                      <div key={order.id} className="border-b pb-2 last:border-b-0 border-zinc-100 dark:border-zinc-800">
                        <div className="text-[10px] uppercase font-bold text-zinc-400 mb-1.5 flex items-center justify-between gap-2">
                          <span>
                            {group.orders.length > 1 ? `Batch ${idx + 1}` : `#${order.id.slice(-6).toUpperCase()}`} ·{' '}
                            {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="flex items-center gap-1">
                            {order.paidAt && <span className="px-1.5 py-0.5 rounded border text-[9px] bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">Paid</span>}
                            <span className={`px-1.5 py-0.5 rounded border text-[9px] ${status.tone}`}>{status.label}</span>
                          </span>
                        </div>
                        {order.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm mb-1">
                            <span className="leading-tight">
                              <span className="font-semibold text-zinc-500 w-6 inline-block">{item.quantity}×</span>
                              {item.displayName || item.customName || item.menuItem?.name}
                            </span>
                            <span className="text-zinc-500 tabular-nums">₹{item.priceAtOrder * item.quantity}</span>
                          </div>
                        ))}
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                          {order.status === 'PENDING_VERIFICATION' && (
                            <Button size="sm" className="h-7 text-[11px] bg-amber-500 hover:bg-amber-600 text-white" disabled={busyId === order.id} onClick={() => approve(order.id)}>
                              <Tick02Icon size={13} className="mr-1" /> Approve
                            </Button>
                          )}
                          {order.status === 'READY' && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={busyId === order.id} onClick={() => markServed(order.id)}>
                              Mark served
                            </Button>
                          )}
                          {canCancel(order) && order.status !== 'SERVED' && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px] text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-950/30" onClick={() => setCancelling({ ...order, table: group.table })}>
                              Cancel
                            </Button>
                          )}
                          {isManager && !order.paidAt && ['PROCESSING', 'READY', 'SERVED', 'PENDING_PAYMENT'].includes(order.status) && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => navigate(`/dashboard/pos/orders/${order.id}/edit`)}>
                              <Edit02Icon size={12} className="mr-1" /> Edit items
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 rounded-b-xl flex flex-col gap-2">
                  {group.table && (
                    <Button variant="outline" className="w-full h-10 font-semibold" onClick={() => addItemsToTable(group.table)}>
                      <PlusSignIcon size={16} className="mr-2" /> Add items to Table {group.table.tableNumber}
                    </Button>
                  )}
                  {pendingApproval.length > 0 ? (
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold text-center">Approve or cancel pending batches before billing.</p>
                  ) : dueTotal > 0 ? (
                    <Button className="w-full h-11 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => navigate(collectHref)}>
                      <Money01Icon size={18} className="mr-2" /> Collect ₹{dueTotal}
                    </Button>
                  ) : (
                    <p className="text-xs text-zinc-500 text-center">Paid — closes automatically once served.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CancelOrderDialog
        storeId={storeId}
        order={cancelling}
        onClose={() => setCancelling(null)}
        onCancelled={(_, reason) => {
          toast(`Order #${cancelling.id.slice(-6).toUpperCase()} cancelled — ${reason}`, 'info');
          fetchOrders();
          data.refreshTables();
        }}
      />
    </div>
  );
};
