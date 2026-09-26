import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

export const MANAGE_ROLES = ['STORE_MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'];

export const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const METHOD_LABEL = { CASH: 'Cash', UPI: 'UPI', BANK_TRANSFER: 'Bank transfer', CARD: 'Card', CHEQUE: 'Cheque', OTHER: 'Other' };

/** "3 days" / "today" since a date */
export const ageOf = (date) => {
  if (!date) return '—';
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day';
  if (days < 60) return `${days} days`;
  return `${Math.floor(days / 30)} months`;
};

/**
 * Which store the Dues pages look at. Store staff: always their own. Owners: ?store= or all stores.
 * The platform admin has no brand of their own, so they always pick a store.
 */
export function useDuesScope() {
  const { user } = useAuthStore();
  const [params, setParams] = useSearchParams();
  const [stores, setStores] = useState([]);
  const own = user?.store?.id || user?.storeId || null;
  const isSuper = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (own) return;
    api.get('/stores')
      .then(res => setStores(Array.isArray(res.data.data) ? res.data.data : []))
      .catch(() => setStores([]));
  }, [own]);

  const picked = params.get('store') || '';
  const storeId = own || picked || (isSuper ? stores[0]?.id || null : null);
  const setStoreId = (id) => setParams(prev => {
    const next = new URLSearchParams(prev);
    if (id) next.set('store', id); else next.delete('store');
    return next;
  }, { replace: true });

  return {
    storeId,
    setStoreId,
    stores,
    canPickStore: !own && stores.length > 0,
    allowAllStores: !own && !isSuper,
    ready: Boolean(own) || !isSuper || Boolean(storeId),
    apiParams: storeId ? { storeId } : {},
    storeQuery: !own && storeId ? `store=${storeId}` : '',
    canManage: MANAGE_ROLES.includes(user?.role),
  };
}
