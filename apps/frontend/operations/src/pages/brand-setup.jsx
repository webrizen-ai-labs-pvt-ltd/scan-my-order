import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { BrandForm } from '../components/brand-form';
import { Loading03Icon, AlertCircleIcon } from 'hugeicons-react';

export const BrandSetup = () => {
  const { user, refreshUser } = useAuthStore();
  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchBrand = async () => {
    if (!user?.tenantId) {
      setError('No brand associated with your account.');
      setLoading(false);
      return;
    }

    try {
      const res = await api.get(`/tenants/${user.tenantId}`);
      if (res.data.success) {
        setInitialData(res.data.data);
      } else {
        setError('Failed to load brand data.');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || 'Failed to fetch brand details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrand();
  }, [user?.tenantId]);

  const handleSuccess = async () => {
    // Refresh user context in case brand name/logo changed and we need to update the sidebar
    await refreshUser();
    // Refetch the form data
    await fetchBrand();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loading03Icon className="animate-spin text-zinc-500" size={32} />
      </div>
    );
  }

  if (error || !initialData) {
    return (
      <div className="flex justify-center items-center h-64 text-red-500 flex-col gap-2">
        <AlertCircleIcon size={32} />
        <p>{error || 'Brand not found'}</p>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto">
      <BrandForm initialData={initialData} onSuccess={handleSuccess} />
    </div>
  );
};
