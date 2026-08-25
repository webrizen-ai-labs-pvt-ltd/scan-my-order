import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import { BrandForm } from '../components/brand-form';
import { Loading03Icon } from 'hugeicons-react';

export const BrandEdit = () => {
  const { id } = useParams();
  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBrand = async () => {
      try {
        const res = await api.get(`/tenants/${id}`);
        if (res.data.success) {
          setInitialData(res.data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchBrand();
  }, [id]);

  if (loading) {
    return <div className="flex justify-center p-8"><Loading03Icon className="animate-spin text-zinc-500" /></div>;
  }

  if (!initialData) {
    return <div className="p-8 text-center text-zinc-500">Brand not found</div>;
  }

  return (
    <div className="w-full">
      <BrandForm initialData={initialData} />
    </div>
  );
};
