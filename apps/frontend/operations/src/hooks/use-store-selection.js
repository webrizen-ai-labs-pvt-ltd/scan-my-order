import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';

/**
 * Store the page works on: the user's own store, or a pick from the brand's stores.
 */
export function useStoreSelection() {
  const { user } = useAuthStore();
  const ownStoreId = user?.store?.id || user?.storeId || null;
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState(ownStoreId);

  useEffect(() => {
    if (ownStoreId) return;
    api.get('/stores')
      .then(res => {
        const list = Array.isArray(res.data.data) ? res.data.data : [];
        setStores(list);
        setStoreId(prev => prev || list[0]?.id || null);
      })
      .catch(() => setStores([]));
  }, [ownStoreId]);

  return { storeId, setStoreId, stores, canSwitch: !ownStoreId && stores.length > 1 };
}

/** Downloads an authenticated CSV endpoint as a file */
export async function downloadCsv(url, params, filename) {
  const res = await api.get(url, { params, responseType: 'blob' });
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}
