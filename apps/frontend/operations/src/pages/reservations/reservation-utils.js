import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

export const STATUSES = {
  CONFIRMED: { label: 'Confirmed', tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  SEATED: { label: 'Seated', tone: 'bg-sky-500/10 text-sky-700 dark:text-sky-400', dot: 'bg-sky-500' },
  COMPLETED: { label: 'Completed', tone: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400', dot: 'bg-zinc-400' },
  CANCELLED: { label: 'Cancelled', tone: 'bg-red-500/10 text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  NO_SHOW: { label: 'No show', tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
};

/** YYYY-MM-DD in the device's own time zone (toISOString would give the UTC date) */
export const localDateStr = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const shiftDate = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return localDateStr(new Date(y, m - 1, d + days));
};

export const formatDay = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
};

export const formatTime = (date) => new Date(date).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

/**
 * Store the reservation pages work on: ?store=, else the user's own store, else the first one.
 * Keeps ?store= in the URL so the list and the new-booking page agree.
 */
export function useReservationStore() {
  const { user } = useAuthStore();
  const [params, setParams] = useSearchParams();
  const [stores, setStores] = useState([]);
  const own = user?.store?.id || user?.storeId || null;

  useEffect(() => {
    api.get('/stores')
      .then(res => setStores(Array.isArray(res.data.data) ? res.data.data : []))
      .catch(() => setStores([]));
  }, []);

  const storeId = params.get('store') || own || stores[0]?.id || null;
  const setStoreId = (id) => setParams(prev => {
    const next = new URLSearchParams(prev);
    next.set('store', id);
    return next;
  }, { replace: true });

  return { storeId, setStoreId, stores, canSwitch: !own && stores.length > 1 };
}
