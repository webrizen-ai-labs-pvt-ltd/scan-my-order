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

export function usePushNotifications(storeId) {
  const { token } = useAuthStore();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

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

  const subscribe = useCallback(async () => {
    if (!isSupported) return false;
    setLoading(true);

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        setLoading(false);
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      
      // Fetch VAPID public key from backend
      const keyRes = await api.get('/public/notifications/vapid-public-key');
      const publicKey = keyRes.data?.data?.publicKey;

      if (!publicKey) {
        throw new Error('VAPID public key not received from server');
      }

      const convertedKey = urlBase64ToUint8Array(publicKey);
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });

      const subData = subscription.toJSON();
      const sessionId = getSessionId();

      await api.post('/public/notifications/subscribe', {
        endpoint: subData.endpoint,
        keys: subData.keys,
        storeId,
        sessionId,
        token: token || undefined
      });

      setIsSubscribed(true);
      localStorage.setItem('smo_push_subscribed', 'true');
      return true;
    } catch (err) {
      console.error('[Push] Subscription failed:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported, storeId, token]);

  // Auto-subscribe if permission is already granted but backend doesn't have it
  useEffect(() => {
    if (isSupported && Notification.permission === 'granted' && !isSubscribed && storeId) {
      subscribe().catch(() => {});
    }
  }, [isSupported, storeId, isSubscribed, subscribe]);

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    subscribe
  };
}
