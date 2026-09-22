import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { 
  initAudioUnlock, 
  playNotificationChime, 
  getAudioMuted, 
  setAudioMuted, 
  getAudioVolume, 
  setAudioVolume 
} from '@smo/shared/audio';

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

export function useStaffNotifications() {
  const { user, token } = useAuthStore();
  const storeId = user?.storeId || user?.store?.id;

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isMuted, setIsMutedState] = useState(getAudioMuted());
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');

  const sseRef = useRef(null);

  // Initialize browser audio unlocking
  useEffect(() => {
    initAudioUnlock();
  }, []);

  // Check push support and registration
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
      setIsPushSupported(true);
      setPushPermission(Notification.permission);

      navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) setIsPushSubscribed(true);
        });
      }).catch((err) => {
        console.warn('[StaffPush] ServiceWorker registration warning:', err.message);
      });
    }
  }, []);

  // Fetch notification history
  const fetchNotifications = useCallback(async () => {
    if (!storeId || !token) return;
    try {
      setLoading(true);
      const res = await api.get(`/notifications?storeId=${storeId}&limit=30`);
      if (res.data?.success) {
        const items = res.data.data || [];
        setNotifications(items);
        setUnreadCount(items.filter(n => !n.isRead).length);
      }
    } catch (err) {
      console.warn('[StaffNotifications] Error loading history:', err.message);
    } finally {
      setLoading(false);
    }
  }, [storeId, token]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Subscribe to Push Notifications
  const subscribePush = useCallback(async () => {
    if (!isPushSupported || !storeId || !token) return false;
    try {
      const perm = await Notification.requestPermission();
      setPushPermission(perm);
      if (perm !== 'granted') return false;

      const reg = await navigator.serviceWorker.ready;
      const keyRes = await api.get('/notifications/vapid-public-key');
      const publicKey = keyRes.data?.data?.publicKey;

      if (!publicKey) return false;

      const convertedKey = urlBase64ToUint8Array(publicKey);
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });

      const subData = subscription.toJSON();
      await api.post('/notifications/subscribe', {
        endpoint: subData.endpoint,
        keys: subData.keys,
        storeId
      });

      setIsPushSubscribed(true);
      return true;
    } catch (err) {
      console.error('[StaffNotifications] Push subscription failed:', err);
      return false;
    }
  }, [isPushSupported, storeId, token]);

  // Auto-subscribe if already granted
  useEffect(() => {
    if (isPushSupported && Notification.permission === 'granted' && !isPushSubscribed && storeId && token) {
      subscribePush().catch(() => {});
    }
  }, [isPushSupported, storeId, token, isPushSubscribed, subscribePush]);

  // Connect SSE for Real-Time notifications and sound chime
  useEffect(() => {
    if (!storeId || !token) return;

    const streamUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/stores/${storeId}/orders/stream?token=${token}`;
    const sse = new EventSource(streamUrl);
    sseRef.current = sse;

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'CONNECTED') return;

        // Play chime on incoming alerts
        playNotificationChime({ haptic: true });

        if (data.type === 'NOTIFICATION') {
          setNotifications(prev => [data.data, ...prev.slice(0, 49)]);
          setUnreadCount(prev => prev + 1);
        } else {
          // Re-fetch notification list to keep in sync
          fetchNotifications();
        }
      } catch (err) {
        console.error('[StaffNotifications] SSE message error:', err);
      }
    };

    return () => {
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, [storeId, token, fetchNotifications]);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMutedState(next);
    setAudioMuted(next);
    if (!next) {
      playNotificationChime({ force: true });
    }
  };

  const testAudio = () => {
    playNotificationChime({ force: true, haptic: true });
  };

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Failed to mark read', e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/mark-all-read', { storeId });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error('Failed to mark all read', e);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    isMuted,
    toggleMute,
    testAudio,
    markAsRead,
    markAllAsRead,
    isPushSupported,
    isPushSubscribed,
    pushPermission,
    subscribePush,
    refresh: fetchNotifications
  };
}
