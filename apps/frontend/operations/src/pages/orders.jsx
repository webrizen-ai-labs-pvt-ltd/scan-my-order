import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import {
  Card, CardContent,
  Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Badge, Skeleton
} from '@smo/ui';
import { Search01Icon, Store01Icon, CheckmarkCircle02Icon, AlertCircleIcon } from 'hugeicons-react';
import { ORDER_STATUSES, statusTone } from './orders/order-status';

const PAYMENT_MODELS = ['PREPAID', 'POSTPAID'];
const ORIGINS = ['POS', 'QR_MENU', 'KIOSK', 'AGGREGATOR'];
const PAGE_SIZE = 10;

/**
 * Order History list. Store, filters and page live in the URL, so returning from an order
 * (Back, or the breadcrumb) lands on the same view.
 */
export const Orders = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const isManager = ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER'].includes(user?.role);
  const ownStoreId = user?.store?.id || null;

  const [stores, setStores] = useState([]);
  const storeId = params.get('store') || ownStoreId || stores[0]?.id || null;
  const status = params.get('status') || 'all';
  const paymentModel = params.get('payment') || 'all';
  const origin = params.get('origin') || 'all';
  const q = params.get('q') || '';
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);

  const [search, setSearch] = useState(q);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, current: 1 });
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [feedback, setFeedback] = useState({ text: '', error: false });

  /** Updates URL params; any filter change goes back to page 1 */
  const setFilter = useCallback((changes) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(changes)) {
        if (v === null || v === undefined || v === '' || v === 'all') next.delete(k);
        else next.set(k, String(v));
      }
      if (!('page' in changes)) next.delete('page');
      return next;
    }, { replace: true });
  }, [setParams]);

  useEffect(() => {
    if (ownStoreId) return;
    api.get('/stores')
      .then(res => setStores(Array.isArray(res.data.data) ? res.data.data : []))
      .catch(() => setStores([]));
  }, [ownStoreId]);

  // Pin the chosen store in the URL so the order pages know it
  useEffect(() => {
    if (storeId && !params.get('store') && !ownStoreId) setFilter({ store: storeId, page: params.get('page') });
  }, [storeId, params, ownStoreId, setFilter]);

  useEffect(() => {
    if (!storeId) return undefined;
    let stale = false;
    setLoading(true);
    const query = new URLSearchParams({ page, limit: PAGE_SIZE });
    if (q) query.append('search', q);
    if (status !== 'all') query.append('status', status);
    if (paymentModel !== 'all') query.append('paymentModel', paymentModel);
    if (origin !== 'all') query.append('origin', origin);
    api.get(`/stores/${storeId}/orders/history?${query}`)
      .then(res => {
        if (stale) return;
        setOrders(res.data.data.orders);
        setPagination(res.data.data.pagination);
      })
      .catch(err => { if (!stale) console.error('Failed to fetch orders history:', err); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [storeId, page, q, status, paymentModel, origin]);

  const storeQuery = storeId && !ownStoreId ? `?store=${storeId}` : '';
  const openOrder = (id) => navigate(`/dashboard/orders/${id}${storeQuery}`);

  const quickStatus = async (order, next) => {
    if (order.status === next) return;
    // Cancelling needs a reason, collected on the cancel page
    if (next === 'CANCELLED') {
      navigate(`/dashboard/orders/${order.id}/cancel${storeQuery}`);
      return;
    }
    setUpdatingOrderId(order.id);
    setFeedback({ text: '', error: false });
    try {
      const res = await api.patch(`/stores/${storeId}/orders/${order.id}/status`, { status: next });
      setOrders(prev => prev.map(o => (o.id === order.id ? { ...o, ...res.data.data, status: next } : o)));
      setFeedback({ text: `Order #${order.id.slice(-6).toUpperCase()} changed to ${next.replace('_', ' ').toLowerCase()}.`, error: false });
    } catch (err) {
      setFeedback({ text: 'Could not change the status: ' + (err.response?.data?.error?.message || err.message), error: true });
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <Card>
        <CardContent className="p-4">
          <form
            onSubmit={(e) => { e.preventDefault(); setFilter({ q: search.trim() }); }}
            className="flex flex-col md:flex-row gap-4"
          >
            <div className="relative flex-1">
              <Search01Icon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input placeholder="Search by Order ID..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div className="flex flex-wrap gap-2">
              {!ownStoreId && stores.length > 1 && (
                <Select value={storeId || undefined} onValueChange={(v) => setFilter({ store: v })}>
                  <SelectTrigger className="w-[180px]"><Store01Icon size={15} className="mr-1.5 text-zinc-400" /><SelectValue placeholder="Store" /></SelectTrigger>
                  <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
              <Select value={status} onValueChange={(v) => setFilter({ status: v })}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {ORDER_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={paymentModel} onValueChange={(v) => setFilter({ payment: v })}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Payment" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  {PAYMENT_MODELS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={origin} onValueChange={(v) => setFilter({ origin: v })}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Origin" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Origins</SelectItem>
                  {ORIGINS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="submit">Search</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {feedback.text && (
        <div className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between border ${feedback.error
          ? 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/40'
          : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/40'}`}>
          <div className="flex items-center gap-2">
            {feedback.error ? <AlertCircleIcon size={16} className="text-red-500" /> : <CheckmarkCircle02Icon size={16} className="text-emerald-500" />}
            <span>{feedback.text}</span>
          </div>
          <button type="button" onClick={() => setFeedback({ text: '', error: false })} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">Dismiss</button>
        </div>
      )}

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="p-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Table / Origin</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {['w-24', 'w-32', 'w-20', 'w-16', 'w-20'].map((w, j) => <TableCell key={j}><Skeleton className={`h-5 ${w}`} /></TableCell>)}
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-zinc-500">No orders found matching your criteria.</TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id} className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50" onClick={() => openOrder(order.id)}>
                    <TableCell className="font-medium text-xs font-mono">{order.id.slice(-8).toUpperCase()}</TableCell>
                    <TableCell>{new Date(order.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{order.table ? `Table ${order.table.tableNumber}` : order.origin}</TableCell>
                    <TableCell className="text-xs font-semibold">{order.paymentModel}</TableCell>
                    <TableCell className="text-xs font-mono text-zinc-500">{order.invoice?.number || '—'}</TableCell>
                    <TableCell onClick={(e) => isManager && e.stopPropagation()}>
                      {isManager ? (
                        <select
                          value={order.status}
                          disabled={updatingOrderId === order.id}
                          onChange={(e) => quickStatus(order, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-full border-0 cursor-pointer focus:ring-2 focus:ring-zinc-400 focus:outline-none ${statusTone(order.status)}`}
                          title="Change status"
                        >
                          {ORDER_STATUSES.map(s => (
                            <option key={s} value={s} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-medium">{s.replace('_', ' ')}</option>
                          ))}
                        </select>
                      ) : (
                        <Badge className={`border-none ${statusTone(order.status)}`}>{order.status.replace('_', ' ')}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold">₹{order.totalAmount}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950">
          <div className="text-sm text-zinc-500">
            Page {pagination.current} of {pagination.pages || 1} ({pagination.total} orders)
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setFilter({ page: page - 1 })}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= pagination.pages || loading} onClick={() => setFilter({ page: page + 1 })}>Next</Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
