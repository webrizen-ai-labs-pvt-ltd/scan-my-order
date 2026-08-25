import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { UserForm } from '../components/user-form';
import { Loading03Icon } from 'hugeicons-react';

export const UserEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get(`/users/${id}`);
        if (response.data.success) {
          setInitialData(response.data.data);
        } else {
          setError('User not found');
        }
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Failed to fetch user');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
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
        <p className="text-red-500 font-medium">{error || 'User not found'}</p>
        <button onClick={() => navigate('/users')} className="text-sm text-blue-500 hover:underline">
          Back to Users
        </button>
      </div>
    );
  }

  return <UserForm isEdit={true} initialData={initialData} />;
};
