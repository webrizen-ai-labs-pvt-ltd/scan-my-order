import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { StoreForm } from '../components/store-form';
import { Loading03Icon } from 'hugeicons-react';

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

  return <StoreForm isEdit={true} initialData={initialData} />;
};
