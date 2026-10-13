import { useCallback, useEffect, useState } from 'react';
import api from '../lib/api';
import { subscribeStore } from '../lib/live-stream';
import { useAuthStore } from '../store/authStore';

const CONFIRM_ROLES = ['CASHIER', 'STORE_MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'];
const RECHECK_MS = 30000;
const REFRESH_ON = new Set(['GUEST_UPI_UPDATED', 'PAYMENT_UPDATED', 'ORDER_PENDING_VERIFICATION', 'ORDER_PROCESSING', 'ORDER_CANCELLED', 'STREAM_RECONNECTED']);

/**
 * How many things are waiting for someone on the POS, for the store this user is working on:
 * guest UPI payments to confirm, and pay-later QR orders to accept. Shown next to the POS link
 * so it is seen from any page.
 * Re-checks on its own as well as on live updates, so a missed update can't hide a payment.
 */
export function usePendingGuestUpi() {
  const { user, token } = useAuthStore();
  const ownStoreId = user?.store?.id || user?.storeId || null;
  const [storeId, setStoreId] = useState(() => ownStoreId || localStorage.getItem('smo_active_store_id') || null);
  const [count, setCount] = useState(0);
  const allowed = CONFIRM_ROLES.includes(user?.role);

  useEffect(() => { if (ownStoreId) setStoreId(ownStoreId); }, [ownStoreId]);
  // Owners aren't tied to one store: start with their first, as the notification bell does
  useEffect(() => {
    if (storeId || !token || !allowed) return;
    api.get('/stores')
      .then(res => setStoreId(prev => prev || res.data.data?.[0]?.id || null))
      .catch(() => {});
  }, [storeId, token, allowed]);
  useEffect(() => {
    const onStoreChange = (e) => { if (e.detail?.storeId) setStoreId(e.detail.storeId); };
    window.addEventListener('smo:store-changed', onStoreChange);
    return () => window.removeEventListener('smo:store-changed', onStoreChange);
  }, []);

  const load = useCallback(async () => {
    if (!storeId || !token || !allowed) return;
    try {
      const [upi, orders] = await Promise.all([
        api.get(`/stores/${storeId}/payments/guest-upi`),
        api.get(`/stores/${storeId}/orders`, { params: { statuses: 'PENDING_VERIFICATION' } }),
      ]);
      setCount((upi.data.data || []).length + (orders.data.data || []).filter(o => o.status === 'PENDING_VERIFICATION').length);
    } catch { /* keeps the last count */ }
  }, [storeId, token, allowed]);

  useEffect(() => {
    if (!storeId || !token || !allowed) { setCount(0); return undefined; }
    load();
    const timer = setInterval(load, RECHECK_MS);
    const unsubscribe = subscribeStore(storeId, (msg) => {
      if (REFRESH_ON.has(msg.type)) load();
    });
    return () => { clearInterval(timer); unsubscribe(); };
  }, [storeId, token, allowed, load]);

  return count;
}
