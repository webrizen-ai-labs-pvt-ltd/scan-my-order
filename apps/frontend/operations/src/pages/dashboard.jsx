import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import { FloorMap } from '@smo/ui';

export const Dashboard = () => {
  const { user } = useAuthStore();
  const [floorStatus, setFloorStatus] = useState(null);

  useEffect(() => {
    let intervalId;
    if (user?.storeId) {
      const fetchFloorStatus = async () => {
        try {
          const res = await api.get(`/stores/${user.storeId}/floor-status`);
          if (res.data.success) {
            setFloorStatus(res.data.data);
          }
        } catch (error) {
          console.error("Failed to fetch floor status", error);
        }
      };

      fetchFloorStatus(); // initial fetch
      intervalId = setInterval(fetchFloorStatus, 5000); // Poll every 5 seconds
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user?.storeId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Welcome back, {user?.name?.split(' ')[0] || 'Staff'}!
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Here is what's happening at your store right now.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Placeholder metric cards updated with real data */}
        <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
          <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Active Orders</div>
          <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mt-2">
            {floorStatus?.orders?.filter(o => o.status !== 'SERVED').length || 0}
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
          <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Pending Waiter Calls</div>
          <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-500 mt-2">
            {floorStatus?.waiterCalls || 0}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold mb-4 text-zinc-900 dark:text-zinc-100">Live Floor Operations</h2>
        <FloorMap floorStatus={floorStatus} />
      </div>
    </div>
  );
};
