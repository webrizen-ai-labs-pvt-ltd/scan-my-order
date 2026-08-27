import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { StoreForm } from '../components/store-form';
import { StoreMenuBuilder } from '../components/store-menu-builder';
import { Loading03Icon } from 'hugeicons-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@smo/ui';

export const StoreEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        <button onClick={() => navigate('/stores')} className="text-sm text-blue-500 hover:underline">
          Back to Stores
        </button>
      </div>
    );
  }

  return (
    <Tabs defaultValue="details" className="w-full">
      <div className="flex justify-between items-center mb-6">
        <TabsList>
          <TabsTrigger value="details">Store Details</TabsTrigger>
          <TabsTrigger value="menu">Menu Build Up</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="details" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
        <StoreForm isEdit={true} initialData={initialData} />
      </TabsContent>
      <TabsContent value="menu" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
        <StoreMenuBuilder storeId={id} />
      </TabsContent>
    </Tabs>
  );
};
