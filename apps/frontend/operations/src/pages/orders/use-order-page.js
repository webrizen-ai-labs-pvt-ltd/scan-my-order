import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

const errorText = (err, fallback) => err?.response?.data?.error?.message || err?.message || fallback;

/**
 * Shared state for the /dashboard/orders/:orderId pages: which store, the order itself, and
 * links between the list, the order and its child pages (the store travels as ?store=).
 */
export function useOrderPage() {
  const { orderId } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const storeId = params.get('store') || user?.store?.id || user?.storeId || null;

  const [order, setOrder] = useState(null);
  const [store, setStore] = useState(user?.store || null);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!storeId) {
      setError('Pick a store from Order History first.');
      return null;
    }
    try {
      const res = await api.get(`/stores/${storeId}/orders/${orderId}`);
      setOrder(res.data.data);
      setError('');
      return res.data.data;
    } catch (err) {
      setError(errorText(err, 'Could not load this order'));
      return null;
    }
  }, [storeId, orderId]);

  useEffect(() => { reload(); }, [reload]);

  // Receipt header needs the store's name, address and brand
  useEffect(() => {
    if (!storeId || store?.id === storeId) return;
    api.get(`/stores/${storeId}`).then(res => setStore(res.data.data)).catch(() => {});
  }, [storeId, store?.id]);

  const query = storeId ? `?store=${storeId}` : '';
  const detailPath = `/dashboard/orders/${orderId}${query}`;
  const listPath = `/dashboard/orders${query}`;

  /** Back to where the user came from inside the app, else to `fallback` */
  const goBack = useCallback((fallback) => {
    if (location.key !== 'default') navigate(-1);
    else navigate(fallback);
  }, [location.key, navigate]);

  return { orderId, storeId, store, order, setOrder, error, reload, query, detailPath, listPath, goBack, navigate };
}
