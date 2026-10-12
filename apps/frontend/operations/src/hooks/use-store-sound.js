import { useEffect } from 'react';
import { setNotificationSound } from '@smo/shared/audio';
import api from '../lib/api';

// storeId -> the sound that store chose (filled as stores are loaded or their settings saved)
const chosen = new Map();

/** Remember a store's sound, e.g. right after its settings are saved, and start using it */
export function rememberStoreSound(storeId, sound) {
  if (!storeId || !sound) return;
  chosen.set(storeId, sound);
  setNotificationSound(sound);
}

/**
 * Makes this screen's notifications use the store's chosen sound.
 * Pass the sound when the store is already loaded; otherwise it is looked up once.
 *
 * @param {string | null} storeId
 * @param {string} [knownSound] The store's notificationSound, if the caller has the store
 */
export function useStoreSound(storeId, knownSound) {
  useEffect(() => {
    if (!storeId) return undefined;
    if (knownSound) { rememberStoreSound(storeId, knownSound); return undefined; }
    if (chosen.has(storeId)) { setNotificationSound(chosen.get(storeId)); return undefined; }
    let cancelled = false;
    api.get(`/stores/${storeId}`)
      .then(res => { if (!cancelled) rememberStoreSound(storeId, res.data.data?.notificationSound); })
      .catch(() => { /* the default sound keeps playing */ });
    return () => { cancelled = true; };
  }, [storeId, knownSound]);
}
