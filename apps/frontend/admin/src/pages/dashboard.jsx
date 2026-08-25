import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@smo/ui';
import { Money01Icon, Store01Icon, UserGroupIcon, Invoice01Icon } from 'hugeicons-react';

export const Dashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await api.get('/dashboard');
        if (response.data.success) {
          setMetrics(response.data.data);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard metrics", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading metrics...</div>;
  if (!metrics) return <div className="p-8 text-center text-red-500">Failed to load dashboard.</div>;

  const icons = [Money01Icon, Store01Icon, UserGroupIcon, Invoice01Icon];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Dashboard</h2>
        <p className="text-zinc-500 dark:text-zinc-400">Overview of your multi-location dining ecosystem.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.metrics.map((metric, index) => {
          const Icon = icons[index % icons.length];
          return (
            <Card key={index} className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {metric.title}
                </CardTitle>
                <Icon size={16} className="text-zinc-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{metric.value}</div>
                <p className="text-xs text-green-500 mt-1">
                  {metric.trend} from last month
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
             {metrics.recentOrders.length === 0 ? (
               <p className="text-sm text-zinc-500">No recent orders found.</p>
             ) : (
               <div className="space-y-4">
                 {metrics.recentOrders.map(order => (
                   <div key={order.id} className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2 last:border-0">
                     <div className="flex flex-col">
                       <span className="text-sm font-medium">{order.store.name}</span>
                       <span className="text-xs text-zinc-500">{new Date(order.createdAt).toLocaleString()}</span>
                     </div>
                     <div className="flex items-center gap-4">
                        <span className="text-xs px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300">{order.status}</span>
                        <span className="text-sm font-bold">₹{order.totalAmount / 100}</span>
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
