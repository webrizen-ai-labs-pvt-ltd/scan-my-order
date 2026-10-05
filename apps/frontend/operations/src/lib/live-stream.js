import api from './api';

/**
 * Live updates for a store, shared by every page in this browser tab (one connection per store).
 *
 * - Each (re)connect asks the server for a short-lived stream ticket, so the login token never
 *   goes in a URL and an expired ticket can't leave a screen dead.
 * - The server sends a `ping` every 25 s; if nothing arrives for a minute, we reconnect.
 * - After a reconnect, listeners get `{ type: 'STREAM_RECONNECTED' }` so they re-fetch anything
 *   they may have missed while the connection was down.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const WATCHDOG_MS = 60 * 1000;
const BACKOFF_MS = [1000, 2000, 5000, 10000, 20000, 30000];

const streams = new Map(); // storeId -> stream

function createStream(storeId) {
  const stream = {
    storeId,
    listeners: new Set(),
    statusListeners: new Set(),
    status: 'connecting', // connecting | live | reconnecting | revoked
    source: null,
    attempts: 0,
    everConnected: false,
    retryTimer: null,
    watchdog: null,
    closed: false,
  };

  const setStatus = (status) => {
    if (stream.status === status) return;
    stream.status = status;
    stream.statusListeners.forEach(fn => { try { fn(status); } catch { /* ignore */ } });
  };

  const emit = (message) => {
    stream.listeners.forEach(fn => {
      try { fn(message); } catch (err) { console.error('Live update listener failed:', err); }
    });
  };

  const armWatchdog = () => {
    clearTimeout(stream.watchdog);
    stream.watchdog = setTimeout(() => {
      // Silent connection (e.g. a proxy dropped it without telling us): start over
      stream.source?.close();
      scheduleReconnect();
    }, WATCHDOG_MS);
  };

  const scheduleReconnect = () => {
    if (stream.closed || stream.status === 'revoked') return;
    clearTimeout(stream.retryTimer);
    clearTimeout(stream.watchdog);
    setStatus(stream.everConnected ? 'reconnecting' : 'connecting');
    const delay = BACKOFF_MS[Math.min(stream.attempts, BACKOFF_MS.length - 1)];
    stream.attempts += 1;
    stream.retryTimer = setTimeout(connect, delay);
  };

  async function connect() {
    if (stream.closed) return;
    let ticket;
    try {
      const res = await api.post('/auth/stream-ticket');
      ticket = res.data.data.ticket;
    } catch {
      // Offline or server down; a 401 here signs the user out through the API interceptor
      scheduleReconnect();
      return;
    }
    if (stream.closed) return;

    const source = new EventSource(`${API_BASE}/stores/${storeId}/orders/stream?token=${encodeURIComponent(ticket)}`);
    stream.source = source;

    source.onopen = () => {
      const wasConnected = stream.everConnected;
      stream.attempts = 0;
      stream.everConnected = true;
      setStatus('live');
      armWatchdog();
      if (wasConnected) emit({ type: 'STREAM_RECONNECTED' });
    };
    source.addEventListener('ping', armWatchdog);
    source.onmessage = (event) => {
      armWatchdog();
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === 'STREAM_REVOKED') {
        // Account deactivated or password changed: don't keep retrying
        source.close();
        clearTimeout(stream.watchdog);
        setStatus('revoked');
        return;
      }
      emit(message);
    };
    source.onerror = () => {
      // Handle every drop ourselves: the browser's own retry would reuse an expired ticket
      source.close();
      if (stream.source === source) scheduleReconnect();
    };
  }

  stream.start = () => connect();
  stream.reconnectNow = () => {
    if (stream.closed || stream.status === 'live') return;
    clearTimeout(stream.retryTimer);
    stream.attempts = 0;
    stream.source?.close();
    connect();
  };
  stream.stop = () => {
    stream.closed = true;
    clearTimeout(stream.retryTimer);
    clearTimeout(stream.watchdog);
    stream.source?.close();
  };
  return stream;
}

// Back online: don't wait for the next retry
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => streams.forEach(s => s.reconnectNow()));
}

function acquire(storeId) {
  let stream = streams.get(storeId);
  if (!stream) {
    stream = createStream(storeId);
    streams.set(storeId, stream);
    stream.start();
  }
  return stream;
}

function release(storeId) {
  const stream = streams.get(storeId);
  if (stream && stream.listeners.size === 0 && stream.statusListeners.size === 0) {
    stream.stop();
    streams.delete(storeId);
  }
}

/**
 * Listen to a store's live updates.
 * @param {string} storeId
 * @param {(message: {type: string, data?: any}) => void} onMessage
 * @param {(status: 'connecting'|'live'|'reconnecting'|'revoked') => void} [onStatus]
 * @returns {() => void} unsubscribe
 */
export function subscribeStore(storeId, onMessage, onStatus) {
  if (!storeId) return () => {};
  const stream = acquire(storeId);
  if (onMessage) stream.listeners.add(onMessage);
  if (onStatus) {
    stream.statusListeners.add(onStatus);
    onStatus(stream.status);
  }
  return () => {
    if (onMessage) stream.listeners.delete(onMessage);
    if (onStatus) stream.statusListeners.delete(onStatus);
    // Let a page switch (unmount then mount) reuse the connection
    setTimeout(() => release(storeId), 2000);
  };
}
