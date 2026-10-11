import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { getSessionId } from '../lib/session';
import { useAuthStore } from '../store/authStore';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// The guest's choice about offers from the store on this device: '1' yes, '0' no, unset = never asked
const OFFERS_KEY = 'smo_push_offers';
// Set when the guest turns notifications off themselves, so we don't quietly turn them back on
const OFF_KEY = 'smo_push_off';
const turnedOff = () => {
  try { return localStorage.getItem(OFF_KEY) === '1'; } catch { return false; }
};
const readOffers = () => {
  try { return localStorage.getItem(OFFERS_KEY); } catch { return null; }
};
const writeOffers = (on) => {
  try { localStorage.setItem(OFFERS_KEY, on ? '1' : '0'); } catch { /* private mode */ }
};

/**
 * Push notifications for a guest on this device: order updates, and (only if they agree) offers from the store.
 * @returns {{ isSupported: boolean, permission: string, isSubscribed: boolean, loading: boolean, error: string,
 *             subscribe: (options?: { offers?: boolean }) => Promise<boolean>, unsubscribe: () => Promise<void>,
 *             offers: boolean, setOffers: (on: boolean) => Promise<void> }}
 */
export function usePushNotifications(storeId) {
  const { token } = useAuthStore();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(''); // why the last turn-on didn't work, in the guest's words
  const [offers, setOffersState] = useState(() => readOffers() === '1');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);

      // Register service worker
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) {
            setIsSubscribed(true);
          }
        });
      }).catch(err => {
        console.warn('[Push] Service worker registration error:', err);
      });
    }
  }, []);

  const subscribe = useCallback(async (options = {}) => {
    if (!isSupported) return false;
    // Offers are only switched when the guest answers; a silent re-subscribe repeats their saved answer
    const saved = readOffers();
    const offersChoice = typeof options.offers === 'boolean' ? options.offers : saved === null ? undefined : saved === '1';
    // Only a turn-on the guest asked for explains itself; background retries stay quiet
    const fail = (message) => { if (!options.silent) setError(message); return false; };
    setLoading(true);
    setError('');

    try {
      const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      setPermission(perm);
      if (perm === 'denied') return fail('');
      if (perm !== 'granted') {
        return fail('Your browser didn’t allow notifications. If no question appeared, tap the lock or bell icon next to the web address and allow notifications there, then try again.');
      }

      // The page's own worker receives the notifications; don't wait forever if it can't start
      const reg = await Promise.race([
        navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready),
        new Promise((_, reject) => setTimeout(() => reject(new Error('worker-timeout')), 10000)),
      ]);

      const keyRes = await api.get('/public/notifications/vapid-public-key');
      const publicKey = keyRes.data?.data?.publicKey;
      if (!publicKey) throw new Error('VAPID public key not received from server');
      const pushOptions = { userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) };

      let subscription;
      try {
        subscription = await reg.pushManager.subscribe(pushOptions);
      } catch (firstError) {
        // A leftover registration made with an older server key blocks a new one: drop it and retry once
        const stale = await reg.pushManager.getSubscription();
        if (!stale) throw firstError;
        await stale.unsubscribe();
        subscription = await reg.pushManager.subscribe(pushOptions);
      }

      const subData = subscription.toJSON();
      await api.post('/public/notifications/subscribe', {
        endpoint: subData.endpoint,
        keys: subData.keys,
        storeId,
        sessionId: getSessionId(),
        token: token || undefined,
        offers: offersChoice
      });
      if (typeof offersChoice === 'boolean') {
        writeOffers(offersChoice);
        setOffersState(offersChoice);
      }

      setIsSubscribed(true);
      try { localStorage.setItem('smo_push_subscribed', 'true'); localStorage.removeItem(OFF_KEY); } catch { /* private mode */ }
      return true;
    } catch (err) {
      console.error('[Push] Subscription failed:', err);
      if (err?.message === 'worker-timeout') return fail('Notifications couldn’t start on this browser. Reload the page and try again.');
      if (err?.name === 'AbortError' || /push service/i.test(err?.message || '')) {
        // Brave ships with push switched off; other Chromium builds may have no push service at all
        if (navigator.brave) {
          return fail('Brave has push notifications switched off. Open brave://settings/privacy, turn on “Use Google services for push messaging”, restart Brave and try again.');
        }
        return fail('This browser has no working notification service, so it can’t receive alerts. Please open this menu in Chrome (or Edge or Firefox).');
      }
      if (err?.response || err?.request) return fail('Couldn’t reach the restaurant’s server. Check your internet and try again.');
      return fail('Couldn’t turn on notifications on this browser. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isSupported, storeId, token]);

  // Auto-subscribe if permission is already granted but backend doesn't have it
  useEffect(() => {
    if (isSupported && Notification.permission === 'granted' && !isSubscribed && storeId && !turnedOff()) {
      subscribe({ silent: true }).catch(() => {});
    }
  }, [isSupported, storeId, isSubscribed, subscribe]);

  /** The guest turns all notifications off for this device (order alerts and offers) */
  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      try { localStorage.setItem(OFF_KEY, '1'); localStorage.removeItem('smo_push_subscribed'); } catch { /* private mode */ }
      if (sub) {
        await api.delete('/public/notifications/subscribe', { data: { endpoint: sub.endpoint } }).catch(() => {});
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Turn offers from the store on or off for this device */
  const setOffers = useCallback(async (on) => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    setOffersState(on);
    writeOffers(on);
    try {
      await api.patch('/public/notifications/offers', { endpoint: sub.endpoint, offers: on });
    } catch {
      setOffersState(!on);
      writeOffers(!on);
    }
  }, []);

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    error,
    subscribe,
    unsubscribe,
    offers,
    setOffers
  };
}
