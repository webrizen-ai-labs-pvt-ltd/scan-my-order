import { useCallback, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

/**
 * One live SSE connection per store, shared by every POS page through `subscribe`.
 * Browsers cap concurrent connections per origin, so pages must not open their own.
 */
export function useStoreStream(storeId, token) {
  const listeners = useRef(new Set());

  useEffect(() => {
    if (!storeId || !token) return undefined;
    const source = new EventSource(`${API_BASE}/stores/${storeId}/orders/stream?token=${encodeURIComponent(token)}`);
    source.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      listeners.current.forEach((fn) => {
        try { fn(message); } catch (err) { console.error('Stream listener failed:', err); }
      });
    };
    return () => source.close();
  }, [storeId, token]);

  /** Register a listener; returns an unsubscribe function (use inside useEffect). */
  return useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);
}
