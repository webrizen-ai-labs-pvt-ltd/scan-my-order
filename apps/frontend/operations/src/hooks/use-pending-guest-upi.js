import { useCallback, useEffect, useState } from 'react';
import api from '../lib/api';
import { subscribeStore } from '../lib/live-stream';
import { useAuthStore } from '../store/authStore';

const CONFIRM_ROLES = ['CASHIER', 'STORE_MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'];
const RECHECK_MS = 30000;

/**
 * How many guest UPI payments are waiting for someone to confirm them on the POS, for the store
 * this user is working on. Shown next to the POS link so it is seen from any page.
 * Re-checks on its own as well as on live updates, so a missed update can't hide a payment.
 */
export function usePendingGuestUpi() {
  const { user, token } = useAuthStore();
  const ownStoreId = user?.store?.id || user?.storeId || null;
  const [storeId, setStoreId] = useState(() => ownStoreId || localStorage.getItem('smo_active_store_id') || null);
  const [count, setCount] = useState(0);
  const allowed = CONFIRM_ROLES.includes(user?.role);

  useEffect(() => { if (ownStoreId) setStoreId(ownStoreId); }, [ownStoreId]);
  useEffect(() => {
    const onStoreChange = (e) => { if (e.detail?.storeId) setStoreId(e.detail.storeId); };
    window.addEventListener('smo:store-changed', onStoreChange);
    return () => window.removeEventListener('smo:store-changed', onStoreChange);
  }, []);

  const load = useCallback(async () => {
    if (!storeId || !token || !allowed) return;
    try {
      const res = await api.get(`/stores/${storeId}/payments/guest-upi`);
      setCount((res.data.data || []).length);
    } catch { /* keeps the last count */ }
  }, [storeId, token, allowed]);

  useEffect(() => {
    if (!storeId || !token || !allowed) { setCount(0); return undefined; }
    load();
    const timer = setInterval(load, RECHECK_MS);
    const unsubscribe = subscribeStore(storeId, (msg) => {
      if (msg.type === 'GUEST_UPI_UPDATED' || msg.type === 'PAYMENT_UPDATED' || msg.type === 'STREAM_RECONNECTED') load();
    });
    return () => { clearInterval(timer); unsubscribe(); };
  }, [storeId, token, allowed, load]);

  return count;
}
