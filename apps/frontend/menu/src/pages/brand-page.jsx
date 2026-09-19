import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { Skeleton, AnimatedThemeToggler } from '@smo/ui';
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

  // Loading State (Glassmorphism)
  if (loading) {
    return (
      <div className="w-full min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/10 dark:bg-zinc-900/20 backdrop-blur-2xl rounded-3xl border border-white/20 p-6 space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl opacity-50" />
          <Skeleton className="h-20 w-full rounded-2xl opacity-50" />
          <Skeleton className="h-20 w-full rounded-2xl opacity-50" />
        </div>
      </div>
    );
  }

  // Error State (Glassmorphism)
  if (error || !brand) {
    return (
      <div className="w-full min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/10 dark:bg-zinc-900/50 backdrop-blur-2xl rounded-3xl border border-white/20 p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/30">
            <Store01Icon size={32} className="text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Brand not found</h2>
          <p className="text-zinc-400">The page you are looking for does not exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const resolvedColor = brand.brandColor || 'zinc';
  const brandColorHex = TAILWIND_COLORS[resolvedColor] || resolvedColor;

  return (
    <div className="relative w-full min-h-screen flex flex-col items-center justify-center py-12 px-4 overflow-hidden">
      
      {/* Background Overlay (Darkens the images slightly for text contrast) */}
      <div className="absolute inset-0 bg-black/60 z-10 pointer-events-none"></div>
      
      {/* Background Grid */}
      <div className="absolute inset-0 grid grid-cols-[1fr_auto_1fr_auto_1fr] z-0">
        
        {/* Column 1 */}
        <div className="relative w-full h-full group overflow-hidden">
          <img
            src="https://i.pinimg.com/736x/c9/86/2d/c9862d63ff3e532bfbed3ce9e3279922.jpg"
            alt="Restaurant Atmosphere"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 opacity-60 group-hover:opacity-80"
          />
        </div>

        {/* Reflective Divider 1 */}
        <div className="relative z-20 w-[1px] md:w-[2px] h-full flex items-center justify-center">
          <div className="absolute inset-y-0 w-full bg-gradient-to-b from-transparent via-zinc-300 to-transparent opacity-80" />
          <div className="absolute inset-y-1/4 w-[2px] md:w-[4px] bg-gradient-to-b from-transparent via-white to-transparent blur-[2px] md:blur-[3px]" />
          <div className="absolute inset-y-1/3 w-[10px] md:w-[20px] bg-gradient-to-b from-transparent via-white/30 to-transparent blur-[8px]" />
        </div>

        {/* Column 2 */}
        <div className="relative w-full h-full group overflow-hidden">
          <img
            src="https://i.pinimg.com/736x/a6/28/ca/a628ca7122986fbdd10a869d70606b8c.jpg"
            alt="Chef Preparing Food"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 opacity-60 group-hover:opacity-80"
          />
        </div>

        {/* Reflective Divider 2 */}
        <div className="relative z-20 w-[1px] md:w-[2px] h-full flex items-center justify-center">
          <div className="absolute inset-y-0 w-full bg-gradient-to-b from-transparent via-zinc-300 to-transparent opacity-80" />
          <div className="absolute inset-y-1/4 w-[2px] md:w-[4px] bg-gradient-to-b from-transparent via-white to-transparent blur-[2px] md:blur-[3px]" />
          <div className="absolute inset-y-1/3 w-[10px] md:w-[20px] bg-gradient-to-b from-transparent via-white/30 to-transparent blur-[8px]" />
        </div>

        {/* Column 3 */}
        <div className="relative w-full h-full group overflow-hidden">
          <img
            src="https://i.pinimg.com/1200x/aa/0a/a8/aa0aa8cd141c50964913505fda5196a6.jpg"
            alt="Delicious Meal"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 opacity-60 group-hover:opacity-80"
          />
        </div>
      </div>

      {/* Floating Glassmorphism Card */}
      <div className="relative z-20 w-full max-w-md mx-auto bg-white/85 dark:bg-zinc-950/80 backdrop-blur-xl rounded-[2rem] shadow-2xl overflow-hidden border border-white/40 dark:border-zinc-800/60">
        
        {/* Brand Hero Section */}
        <div className="relative pt-12 pb-8 px-6 text-center border-b border-zinc-200/50 dark:border-zinc-800/50">
          
          {/* Subtle Brand Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: brandColorHex }} />

          <div className="relative z-10">
            {brand.logo ? (
              <img
                src={brand.logo}
                alt={brand.name}
                className="w-24 h-24 object-contain mx-auto mb-5 rounded-2xl shadow-sm border border-white/50 dark:border-zinc-700/50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md"
              />
            ) : (
              <div
                className="w-24 h-24 rounded-2xl shadow-sm mx-auto mb-5 flex items-center justify-center border border-white/50 dark:border-zinc-700/50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md"
                style={{ color: brandColorHex }}
              >
                <span className="text-4xl font-bold">{brand.name[0]}</span>
              </div>
            )}
            <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">{brand.name}</h1>
            {brand.description && (
              <p className="text-zinc-600 dark:text-zinc-300 mt-3 text-sm leading-relaxed max-w-sm mx-auto">
                {brand.description}
              </p>
            )}
          </div>
        </div>

        {/* Locations List */}
        <div className="p-6">
          <h2 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-4 px-1">
            Select a Location
          </h2>

          <div className="space-y-3">
            {brand.stores?.length === 0 ? (
              <div className="text-center py-10 px-4 rounded-3xl border-2 border-dashed border-zinc-300/50 dark:border-zinc-700/50">
                <p className="text-zinc-500 dark:text-zinc-400">No active locations available right now.</p>
              </div>
            ) : (
              brand.stores?.map(store => (
                <Link
                  key={store.id}
                  to={`/${brandSlug}/${store.slug}`}
                  className="group flex items-center p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-700/50 bg-white/50 dark:bg-zinc-900/50 hover:bg-white dark:hover:bg-zinc-800 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                    style={{ backgroundColor: `${brandColorHex}20`, color: brandColorHex }}
                  >
                    <Store01Icon size={24} variant="bulk" />
                  </div>

                  <div className="ml-4 flex-1">
                    <h3 className="font-semibold text-zinc-900 dark:text-white group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">
                      {store.name}
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5 line-clamp-1">
                      {store.address || 'Tap to view menu'}
                    </p>
                  </div>

                  <div className="ml-2 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Theme Toggler positioned at bottom */}
      <AnimatedThemeToggler className="relative z-40 mt-8" />
    </div>
  );
};