import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../lib/api';

const errorText = (err, fallback) =>
  err?.response?.data?.error?.message || err?.response?.data?.message || fallback;

/**
 * The table's waiter call: current request (if any), plus send / cancel.
 * Polls while a request is open or the call sheet is showing, and survives a page refresh.
 *
 * @param {{ storeId: string, tableNumber: string|number, tableId?: string, watching?: boolean }} opts
 */
export function useWaiterCall({ storeId, tableNumber, tableId, watching = false }) {
  const storageKey = `smo_call_${storeId}_${tableNumber}`;
  const [activeCall, setActiveCall] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || null;
    } catch {
      return null;
    }
  });
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true; // StrictMode mounts twice in dev
    return () => { mounted.current = false; };
  }, []);

  // The store id arrives after the first render: pick up a request saved under the real key
  useEffect(() => {
    try {
      setActiveCall(JSON.parse(localStorage.getItem(storageKey)) || null);
    } catch {
      setActiveCall(null);
    }
  }, [storageKey]);

  const remember = useCallback((call) => {
    setActiveCall(call);
    try {
      if (call) localStorage.setItem(storageKey, JSON.stringify(call));
      else localStorage.removeItem(storageKey);
    } catch { /* private mode */ }
  }, [storageKey]);

  const refresh = useCallback(async () => {
    if (!storeId || !tableNumber) return;
    try {
      const res = await api.get(`/public/stores/${storeId}/tables/${tableNumber}/calls/status`);
      if (!mounted.current) return;
      remember(res.data?.data?.hasActiveCall ? res.data.data : null);
    } catch {
      // Network blip: keep what we have and try again on the next tick
    }
  }, [storeId, tableNumber, remember]);

  const hasCall = Boolean(activeCall);
  useEffect(() => {
    if (!hasCall && !watching) return undefined;
    refresh();
    const timer = setInterval(refresh, 3500);
    return () => clearInterval(timer);
  }, [hasCall, watching, refresh]);

  const send = useCallback(async ({ type, note }) => {
    if (!storeId || !tableNumber) return false;
    setSending(true);
    setError('');
    try {
      await api.post(`/public/stores/${storeId}/calls`, {
        tableId,
        tableNumber: parseInt(tableNumber, 10),
        type,
        note: note?.trim() || undefined,
      });
      await refresh();
      return true;
    } catch (err) {
      setError(errorText(err, 'Could not reach the staff. Please wave to a waiter.'));
      return false;
    } finally {
      if (mounted.current) setSending(false);
    }
  }, [storeId, tableNumber, tableId, refresh]);

  const cancel = useCallback(async () => {
    if (!activeCall?.callId) return;
    setCancelling(true);
    setError('');
    try {
      await api.post(`/public/stores/${storeId}/calls/${activeCall.callId}/cancel`);
      remember(null);
    } catch (err) {
      setError(errorText(err, 'Could not cancel the request'));
    } finally {
      if (mounted.current) setCancelling(false);
    }
  }, [activeCall?.callId, storeId, remember]);

  return { activeCall, send, cancel, sending, cancelling, error, setError };
}
