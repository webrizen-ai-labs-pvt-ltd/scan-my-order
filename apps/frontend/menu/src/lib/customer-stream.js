import api from './api';

/**
 * Live order updates for the guest: reconnects by itself after a dropped connection.
 *
 * - Signed-in guests get a short-lived stream ticket on each (re)connect, so the login token never
 *   goes in a URL; anonymous guests use their session id.
 * - The server sends a `ping` every 25 s; if nothing arrives for a minute, we reconnect.
 * - After a reconnect, `onMessage` gets `{ type: 'STREAM_RECONNECTED' }` so the page can re-fetch.
 *
 * @param {{ signedIn: boolean, sessionId?: string }} who
 * @param {(message: object) => void} onMessage
 * @returns {() => void} close
 */
export function openCustomerStream({ signedIn, sessionId }, onMessage) {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
  const WATCHDOG_MS = 60 * 1000;
  const BACKOFF_MS = [1000, 2000, 5000, 10000, 20000, 30000];

  let source = null;
  let attempts = 0;
  let everConnected = false;
  let retryTimer = null;
  let watchdog = null;
  let closed = false;
  let connecting = false; // waiting for a ticket

  const armWatchdog = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => { source?.close(); scheduleReconnect(); }, WATCHDOG_MS);
  };

  const scheduleReconnect = () => {
    if (closed) return;
    clearTimeout(retryTimer);
    clearTimeout(watchdog);
    const delay = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)];
    attempts += 1;
    retryTimer = setTimeout(connect, delay);
  };

  async function connect() {
    if (closed) return;
    let query;
    if (signedIn) {
      connecting = true;
      try {
        const res = await api.post('/auth/stream-ticket');
        query = `token=${encodeURIComponent(res.data.data.ticket)}`;
      } catch {
        connecting = false;
        scheduleReconnect();
        return;
      }
      connecting = false;
    } else {
      query = `sessionId=${encodeURIComponent(sessionId)}`;
    }
    if (closed) return;

    const current = new EventSource(`${API_BASE}/public/customer/stream?${query}`);
    source = current;
    current.onopen = () => {
      const wasConnected = everConnected;
      attempts = 0;
      everConnected = true;
      armWatchdog();
      if (wasConnected) onMessage({ type: 'STREAM_RECONNECTED' });
    };
    current.addEventListener('ping', armWatchdog);
    current.onmessage = (event) => {
      armWatchdog();
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      onMessage(message);
    };
    current.onerror = () => {
      // Handle every drop ourselves: the browser's own retry would reuse an expired ticket
      current.close();
      if (source === current) scheduleReconnect();
    };
  }

  // Phones drop connections when the screen locks; reconnect as soon as the guest is back
  const wake = () => {
    if (closed || connecting || document.visibilityState === 'hidden') return;
    if (source && source.readyState !== EventSource.CLOSED) return;
    clearTimeout(retryTimer);
    attempts = 0;
    source?.close();
    source = null;
    connect();
  };
  window.addEventListener('online', wake);
  document.addEventListener('visibilitychange', wake);

  connect();

  return () => {
    closed = true;
    clearTimeout(retryTimer);
    clearTimeout(watchdog);
    source?.close();
    window.removeEventListener('online', wake);
    document.removeEventListener('visibilitychange', wake);
  };
}
