import React from 'react';
import { useAuthStore } from '../store/authStore';

export const Dashboard = () => {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Welcome back, {user?.name?.split(' ')[0] || 'Staff'}!
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Here is what's happening at your store today.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Placeholder metric cards */}
        <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
          <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Active Orders</div>
          <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mt-2">12</div>
        </div>
        <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
          <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Pending Waiter Calls</div>
          <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-500 mt-2">3</div>
        </div>
      </div>
    </div>
  );
};
