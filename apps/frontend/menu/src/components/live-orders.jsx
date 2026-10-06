import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { 
  ChefHatIcon, 
  CheckmarkBadge01Icon, 
  DeliveryBox01Icon, 
  Time02Icon, 
  Cancel01Icon, 
  Invoice01Icon, 
  PrinterIcon,
  Notification03Icon,
  VolumeHighIcon,
  VolumeOffIcon
} from 'hugeicons-react';
import api from '../lib/api';
import { getSessionId } from '../lib/session';
import { openCustomerStream } from '../lib/customer-stream';
import { initAudioUnlock, playNotificationChime, getAudioMuted, setAudioMuted } from '@smo/shared/audio';
import { usePushNotifications } from '../hooks/use-push-notifications';

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

const clockTime = (date) => new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/**
 * When the guest can expect their food, from the time promised when it reached the kitchen
 * (the kitchen's "running late" pushes it back).
 * @returns {{ headline: string, detail?: string } | null}
 */
function readyEstimate(order, now) {
  if (order.status === 'READY') {
    return order.pickupNumber != null
      ? { headline: `Ready! Collect it at the counter`, detail: `Show pickup number #${order.pickupNumber}` }
      : { headline: 'Ready, coming to your table' };
  }
  if (order.status === 'PENDING_VERIFICATION') return { headline: 'Waiting for the staff to confirm' };
  if (order.status !== 'PROCESSING' || !order.estimatedReadyAt) return null;
  const minutes = Math.ceil((new Date(order.estimatedReadyAt).getTime() - now) / 60000);
  if (minutes > 1) return { headline: `Ready in about ${minutes} min`, detail: `by ${clockTime(order.estimatedReadyAt)}` };
  if (minutes >= -3) return { headline: 'Almost ready' };
  return { headline: 'Taking a little longer than usual', detail: "It's nearly there" };
}

/**
 * @param {object} props
 * @param {'aboveCart'|'besideWaiter'|'bottom'} [props.placement] where the "Live orders" pill sits:
 *   above the cart bar, at the bottom next to the corner waiter, or at the bottom on its own
 */
export const LiveOrders = ({ storeId, tableNumber, activeSessionId, placement = 'bottom' }) => {
  const { token } = useAuthStore();
  const [orders, setOrders] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [billData, setBillData] = useState(null);
  const [loadingBill, setLoadingBill] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [toastNotification, setToastNotification] = useState(null);
  const [isMuted, setIsMuted] = useState(getAudioMuted());
  const { isSupported, permission, isSubscribed, subscribe } = usePushNotifications(storeId);

  useEffect(() => {
    initAudioUnlock();
  }, []);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  
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

    // Reconnects by itself; after a drop we reload the orders so no status change is missed
    return openCustomerStream({ signedIn: !!token, sessionId }, (data) => {
      try {
        if (data.type === 'STREAM_RECONNECTED') {
          fetchOrders();
        } else if (data.type === 'NOTIFICATION') {
          playNotificationChime({ haptic: true });
          setToastNotification({
            title: data.title,
            body: data.body,
            id: Date.now()
          });
          setTimeout(() => setToastNotification(null), 5000);
        } else if (data.type === 'ORDER_DELAYED') {
          playNotificationChime({ haptic: true });
          setToastNotification({
            title: 'Your order is running a little late',
            body: data.data?.message || 'Your order needs a few more minutes.',
            id: Date.now()
          });
          setTimeout(() => setToastNotification(null), 10000);
          const updated = data.data?.order;
          if (updated?.id) setOrders(prev => prev.map(o => (o.id === updated.id ? updated : o)));
        } else if (data.type === 'ORDER_ITEMS_REJECTED') {
          // Kitchen couldn't make something: tell the guest why and what happens next
          playNotificationChime({ haptic: true });
          setToastNotification({
            title: 'Update on your order',
            body: data.data?.message || 'The kitchen could not prepare part of your order. A staff member will help you.',
            id: Date.now()
          });
          setTimeout(() => setToastNotification(null), 12000);
          const updated = data.data?.order;
          if (updated?.id) {
            setOrders(prev => prev.map(o => (o.id === updated.id ? updated : o)));
          }
        } else if (data.type?.startsWith('ORDER_') && data.data?.id) {
          playNotificationChime({ haptic: true });
          const status = data.data?.status;
          const statusLabel = STATUS_MAPPING[status]?.label || 'Order Update';
          setToastNotification({
            title: `Order Update: ${statusLabel}`,
            body: `Order #${data.data?.id?.slice(-6).toUpperCase()} is now ${statusLabel.toLowerCase()}.`,
            id: Date.now()
          });
          setTimeout(() => setToastNotification(null), 5000);

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
        console.error('Live order update failed', err);
      }
    });
  }, [token, storeId]);

  const activeOrders = orders.filter(o => ['PENDING_VERIFICATION', 'PROCESSING', 'READY', 'SERVED'].includes(o.status));

  // Determine effective tableSessionId
  const effectiveSessionId = activeSessionId || orders.find(o => o.tableSessionId)?.tableSessionId;

  const handleFetchBill = async () => {
    if (!effectiveSessionId) return;
    setLoadingBill(true);
    try {
      // The bill (and PIN) is only served to guests holding this table's session token
      const tableToken = localStorage.getItem(`smo_table_token_${storeId}_${tableNumber}`) || '';
      const res = await api.get(`/public/stores/${storeId}/sessions/${effectiveSessionId}/bill`, {
        headers: { 'x-table-session-token': tableToken },
      });
      if (res.data.success) {
        setBillData(res.data.data);
        setShowBillModal(true);
      }
    } catch (err) {
      console.error("Failed to load session bill", err);
    } finally {
      setLoadingBill(false);
    }
  };

  if (activeOrders.length === 0 && !showBillModal) return null;

  return (
    <>
      {/* Real-time Floating Notification Toast */}
      {toastNotification && (
        <div className="fixed top-4 left-4 right-4 z-50 mx-auto max-w-md animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white/95 p-3.5 px-4 shadow-2xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <Notification03Icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{toastNotification.title}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{toastNotification.body}</p>
            </div>
            <button
              onClick={() => setToastNotification(null)}
              className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <Cancel01Icon size={16} />
            </button>
          </div>
        </div>
      )}

      {activeOrders.length > 0 && (
        // Click-through container: only the pill takes taps, so the corner waiter beside it stays tappable
        <div className={`pointer-events-none fixed inset-x-0 z-40 mx-auto max-w-md px-4 transition-[bottom,padding] duration-300 animate-in slide-in-from-bottom-5 ${placement === 'aboveCart'
          ? 'bottom-[88px]'
          : placement === 'besideWaiter'
            ? 'bottom-[calc(14px+env(safe-area-inset-bottom))] pr-[120px]'
            : 'bottom-[calc(14px+env(safe-area-inset-bottom))]'}`}>
          <button
            onClick={() => setIsOpen(true)}
            className="pointer-events-auto flex w-full items-center justify-between rounded-2xl bg-zinc-900 p-3.5 px-4 text-white shadow-xl dark:bg-zinc-800"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                <ChefHatIcon size={20} />
              </div>
              <div className="text-left">
                {(() => {
                  // Counter orders: the pickup number and how long, right on the pill
                  const pickup = activeOrders.find(o => o.pickupNumber != null);
                  const eta = pickup && readyEstimate(pickup, now);
                  return pickup ? (
                    <>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-white/80">Pickup #{pickup.pickupNumber}</p>
                      <p className="text-sm font-bold leading-none">{eta?.headline || STATUS_MAPPING[pickup.status]?.label}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-white/80">Live Orders</p>
                      <p className="text-sm font-bold leading-none">{activeOrders.length} active</p>
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="text-xs font-semibold px-2 py-1 bg-white/20 rounded-lg">View</div>
          </button>
        </div>
      )}

      {/* Live Orders Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="flex max-h-[75vh] w-full max-w-md flex-col rounded-t-3xl border-t border-zinc-200 bg-white shadow-2xl animate-in slide-in-from-bottom-full dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Live Orders</h2>
                {tableNumber && <p className="text-xs text-zinc-500">Table {tableNumber}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const nextMuted = !isMuted;
                    setIsMuted(nextMuted);
                    setAudioMuted(nextMuted);
                    if (!nextMuted) {
                      playNotificationChime({ force: true });
                    }
                  }}
                  title={isMuted ? "Unmute Sound" : "Mute Sound"}
                  className="rounded-full bg-zinc-100 p-2 text-zinc-500 hover:text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400"
                >
                  {isMuted ? <VolumeOffIcon size={18} /> : <VolumeHighIcon size={18} />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-full bg-zinc-100 p-2 text-zinc-500 hover:text-zinc-800 dark:bg-zinc-800"
                >
                  <Cancel01Icon size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Push Permission Prompt Card */}
              {isSupported && !isSubscribed && permission === 'default' && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                      <Notification03Icon size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-950 dark:text-amber-100">Background Alerts</p>
                      <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">Get notified when food is cooking & ready</p>
                    </div>
                  </div>
                  <button
                    onClick={() => subscribe()}
                    className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold shadow-sm hover:bg-amber-600 transition"
                  >
                    Enable
                  </button>
                </div>
              )}
              {activeOrders.map(order => {
                const conf = STATUS_MAPPING[order.status] || STATUS_MAPPING.PROCESSING;
                const Icon = conf.icon;
                const eta = readyEstimate(order, now);
                return (
                  <div key={order.id} className={`rounded-2xl border p-4 ${order.status === 'READY' ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {order.pickupNumber != null && (
                          <div className="flex h-14 min-w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-zinc-900 px-2 text-white dark:bg-white dark:text-zinc-900">
                            <span className="text-[9px] font-semibold uppercase tracking-wider opacity-70">Pickup</span>
                            <span className="text-xl font-black leading-none tabular-nums">#{order.pickupNumber}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-mono text-zinc-500">Order #{order.id.slice(-5).toUpperCase()}</p>
                          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">₹{order.totalAmount}</p>
                        </div>
                      </div>
                      <div className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${conf.bg} ${conf.color}`}>
                        <Icon size={14} />
                        {conf.label}
                      </div>
                    </div>
                    {eta && (
                      <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-zinc-200/70 pt-2.5 dark:border-zinc-800">
                        <p className={`text-sm font-bold ${order.status === 'READY' ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-900 dark:text-zinc-100'}`}>{eta.headline}</p>
                        {eta.detail && <p className="shrink-0 text-xs text-zinc-500">{eta.detail}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Consolidated Bill Action Button */}
            {effectiveSessionId && (
              <div className="border-t border-zinc-200 p-4 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50">
                <button
                  onClick={handleFetchBill}
                  disabled={loadingBill}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-md transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
                >
                  <Invoice01Icon size={18} />
                  {loadingBill ? 'Generating Bill...' : 'View Consolidated Bill'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Printable Consolidated Bill Modal */}
      {showBillModal && billData && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="flex max-h-[90vh] w-full max-w-sm flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-200 p-4 bg-zinc-50">
              <h3 className="font-bold text-zinc-900">Table Consolidated Bill</h3>
              <button
                onClick={() => setShowBillModal(false)}
                className="rounded-full bg-zinc-200/70 p-1.5 text-zinc-600 hover:text-zinc-900"
              >
                <Cancel01Icon size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 font-mono text-xs text-zinc-900 bg-white">
              {/* Receipt Header */}
              <div className="text-center pb-4 border-b border-dashed border-zinc-300">
                <h4 className="text-base font-bold uppercase">{billData.store.name}</h4>
                {billData.store.address && <p className="text-[11px] text-zinc-600">{billData.store.address}</p>}
                {billData.store.contactPhone && <p className="text-[11px] text-zinc-600">Tel: {[billData.store.contactPhone, ...(billData.store.extraPhones || [])].join(', ')}</p>}
                {billData.store.registrationNumber && <p className="text-[11px] text-zinc-600">Reg. No: {billData.store.registrationNumber}</p>}
                {billData.store.gstin && <p className="text-[11px] text-zinc-600">GSTIN: {billData.store.gstin}</p>}
              </div>

              {/* Session Meta */}
              <div className="py-3 border-b border-dashed border-zinc-300 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span>Table: {billData.session.tableNumber}</span>
                  <span>PIN: {billData.session.pin}</span>
                </div>
                <div className="flex justify-between">
                  <span>Orders Placed: {billData.ordersCount}</span>
                  <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="py-3 border-b border-dashed border-zinc-300">
                <div className="flex justify-between font-bold pb-1 text-[11px] uppercase">
                  <span className="flex-1">Item</span>
                  <span className="w-8 text-center">Qty</span>
                  <span className="w-16 text-right">Price</span>
                </div>
                {billData.aggregatedItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-1 text-[11px]">
                    <span className="flex-1 pr-2 truncate">{item.name}</span>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <span className="w-16 text-right font-semibold">₹{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>

              {/* Math Totals */}
              <div className="py-3 space-y-1.5 border-b border-dashed border-zinc-300 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₹{billData.subTotal}</span>
                </div>
                {billData.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount</span>
                    <span>-₹{billData.discountAmount}</span>
                  </div>
                )}
                {billData.taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Taxes (GST)</span>
                    <span>₹{billData.taxAmount}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-zinc-200">
                  <span>Grand Total</span>
                  <span>₹{billData.totalAmount}</span>
                </div>
              </div>

              <div className="pt-4 text-center text-[11px] text-zinc-500">
                <p>Thank you for dining with us!</p>
              </div>
            </div>

            {/* Print action footer */}
            <div className="border-t border-zinc-200 p-4 bg-zinc-50 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-zinc-900 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-zinc-800"
              >
                <PrinterIcon size={16} /> Print / Save
              </button>
              <button
                onClick={() => setShowBillModal(false)}
                className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
