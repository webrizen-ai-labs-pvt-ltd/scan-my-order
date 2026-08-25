import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Button, Badge, Card, CardContent } from '@smo/ui';
import { PlusSignIcon, Building04Icon, Loading03Icon, Store01Icon, UserGroupIcon, MoreVerticalIcon } from 'hugeicons-react';

export const Brands = () => {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      const res = await api.get('/tenants');
      if (res.data.success) {
        setBrands(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loading03Icon className="animate-spin text-zinc-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Brands</h2>
          <p className="text-zinc-500 dark:text-zinc-400">Manage all tenant companies and their umbrella configurations.</p>
        </div>
        <Button onClick={() => navigate('/brands/new')} className="flex items-center gap-2">
          <PlusSignIcon size={16} /> Add Brand
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {brands.map(brand => (
          <Card key={brand.id} className="cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors" onClick={() => navigate(`/brands/${brand.id}/edit`)}>
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                    <Building04Icon size={20} className="text-yellow-600 dark:text-yellow-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{brand.name}</h3>
                    <p className="text-xs text-zinc-500">/{brand.slug}</p>
                  </div>
                </div>
                <Badge variant={brand.status === 'ACTIVE' ? 'default' : 'secondary'}>{brand.status}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <div>
                  <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
                    <Store01Icon size={14} />
                    <span className="text-xs font-medium uppercase tracking-wider">Stores</span>
                  </div>
                  <p className="font-semibold">{brand.stores?.length || 0}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
                    <UserGroupIcon size={14} />
                    <span className="text-xs font-medium uppercase tracking-wider">Owners</span>
                  </div>
                  <p className="font-semibold">{brand.users?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {brands.length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
            <Building04Icon size={32} className="mx-auto text-zinc-400 mb-3" />
            <h3 className="text-lg font-medium">No brands found</h3>
            <p className="text-zinc-500 mb-4">Get started by creating a new brand entity.</p>
            <Button onClick={() => navigate('/brands/new')}>Add Brand</Button>
          </div>
        )}
      </div>
    </div>
  );
};
