import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeStore } from '../lib/live-stream';

/**
 * Live updates for the POS: one shared connection per store (see lib/live-stream), handed to
 * every POS page through `subscribe`. Listeners also receive `{ type: 'STREAM_RECONNECTED' }`
 * after a dropped connection comes back, so they can re-fetch.
 *
 * @returns {{ subscribe: Function, status: string }} subscribe(fn) → unsubscribe; status is the connection state
 */
export function useStoreStream(storeId, token) {
  const listeners = useRef(new Set());
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    if (!storeId || !token) return undefined;
    return subscribeStore(storeId, (message) => {
      listeners.current.forEach((fn) => {
        try { fn(message); } catch (err) { console.error('Stream listener failed:', err); }
      });
    }, setStatus);
  }, [storeId, token]);

  /** Register a listener; returns an unsubscribe function (use inside useEffect). */
  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);
  return { subscribe, status };
}
