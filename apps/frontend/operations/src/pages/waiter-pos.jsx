import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { WaiterPOSTerminal } from '../components/waiter-pos-terminal';

export const WaiterPOS = () => {
  const { user, token } = useAuthStore();
  const [selectedStoreId, setSelectedStoreId] = useState(user?.store?.id || null);

  useEffect(() => {
    if (!user?.store) {
      api.get('/stores').then(res => {
        if (res.data.success && res.data.data.length > 0) {
          if (!selectedStoreId) setSelectedStoreId(res.data.data[0].id);
        }
      });
    }
  }, [user, selectedStoreId]);

  if (!selectedStoreId) {
    return <div className="flex items-center justify-center h-full text-zinc-500">Loading store...</div>;
  }

  return (
    <div className="h-full">
      <WaiterPOSTerminal selectedStoreId={selectedStoreId} token={token} />
    </div>
  );
};
