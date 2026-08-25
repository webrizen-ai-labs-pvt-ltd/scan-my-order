import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { StoreForm } from '../components/store-form';
import { StoreMenuManager } from '../components/store-menu-manager';
import { StoreTablesManager } from '../components/store-tables-manager';
import { StorePromoManager } from '../components/store-promo-manager';
import { Loading03Icon, Settings01Icon, Menu01Icon, QrCodeIcon, Tag01Icon } from 'hugeicons-react';

export const StoreEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('settings');

  useEffect(() => {
    const fetchStore = async () => {
      try {
        const response = await api.get(`/stores/${id}`);
        if (response.data.success) {
          setInitialData(response.data.data);
        } else {
          setError('Store not found');
        }
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Failed to fetch store');
      } finally {
        setLoading(false);
      }
    };
    fetchStore();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading03Icon className="animate-spin text-zinc-400" size={32} />
      </div>
    );
  }

  if (error || !initialData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-red-500 font-medium">{error || 'Store not found'}</p>
        <button onClick={() => navigate('/dashboard/stores')} className="text-sm text-yellow-500 hover:underline">
          Back to Stores
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{initialData.name}</h2>
          <p className="text-sm text-zinc-500">Manage store settings, menu, and tables.</p>
        </div>
        <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'settings' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Settings01Icon size={16} /> Settings
          </button>
          <button
            onClick={() => setActiveTab('menu')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'menu' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Menu01Icon size={16} /> Menu Builder
          </button>
          <button
            onClick={() => setActiveTab('tables')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'tables' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <QrCodeIcon size={16} /> Tables & QR
          </button>
          <button
            onClick={() => setActiveTab('promos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'promos' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Tag01Icon size={16} /> Promo Codes
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden min-h-[500px]">
        {activeTab === 'settings' && (
          <div className="p-6">
            <StoreForm isEdit={true} initialData={initialData} />
          </div>
        )}
        {activeTab === 'menu' && (
          <StoreMenuManager storeId={initialData.id} />
        )}
        {activeTab === 'tables' && (
          <StoreTablesManager storeId={initialData.id} storeSlug={initialData.slug} brandSlug={initialData.tenant?.slug}  />
        )}
        {activeTab === 'promos' && (
          <StorePromoManager storeId={initialData.id} />
        )}
      </div>
    </div>
  );
};
