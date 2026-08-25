import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { Skeleton } from '@smo/ui';
import { Store01Icon } from 'hugeicons-react';

const TAILWIND_COLORS = {
  red: '#ef4444', orange: '#f97316', amber: '#f59e0b', yellow: '#eab308',
  lime: '#84cc16', green: '#22c55e', emerald: '#10b981', teal: '#14b8a6',
  cyan: '#06b6d4', sky: '#0ea5e9', blue: '#3b82f6', indigo: '#6366f1',
  violet: '#8b5cf6', purple: '#a855f7', fuchsia: '#d946ef', pink: '#ec4899',
  rose: '#f43f5e', slate: '#64748b', zinc: '#71717a',
};

export const BrandPage = () => {
  const { brandSlug } = useParams();
  const [brand, setBrand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBrand = async () => {
      try {
        const res = await api.get(`/public/resolve/${brandSlug}`);
        setBrand(res.data.data);
      } catch (err) {
        setError('Brand not found');
      } finally {
        setLoading(false);
      }
    };
    fetchBrand();
  }, [brandSlug]);

  if (loading) return <div className="p-8 space-y-4 max-w-md mx-auto"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /></div>;
  if (error || !brand) return <div className="p-8 text-center text-red-500">Brand not found</div>;

  const resolvedColor = brand.brandColor;
  const brandColorHex = TAILWIND_COLORS[resolvedColor] || resolvedColor;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white dark:bg-zinc-950 pb-10">
      <div 
        className="pt-16 pb-8 px-6 text-center"
        style={{ backgroundColor: brandColorHex ? `${brandColorHex}15` : '#f4f4f5' }}
      >
        {brand.logo ? (
          <img src={brand.logo} alt={brand.name} className="w-24 h-24 object-contain mx-auto mb-4" />
        ) : (
          <div className="w-24 h-24 bg-zinc-200 dark:bg-zinc-800 rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl font-bold text-zinc-500">{brand.name[0]}</span>
          </div>
        )}
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{brand.name}</h1>
        {brand.description && <p className="text-zinc-600 dark:text-zinc-400 mt-2">{brand.description}</p>}
      </div>

      <div className="p-6 space-y-4">
        <h2 className="text-lg font-semibold mb-4">Select Location</h2>
        {brand.stores?.length === 0 ? (
          <p className="text-zinc-500 text-center py-8">No active locations found.</p>
        ) : (
          brand.stores?.map(store => (
            <Link 
              key={store.id} 
              to={`/${brandSlug}/${store.slug}`}
              className="flex items-center gap-4 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors bg-zinc-50 dark:bg-zinc-900"
            >
              <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-xl flex items-center justify-center shadow-sm">
                <Store01Icon size={24} className="text-zinc-700 dark:text-zinc-300" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{store.name}</h3>
                <p className="text-sm text-zinc-500 line-clamp-1">{store.address || 'View Menu'}</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};
