import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent, Button, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, Badge, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@smo/ui';
import { Search01Icon, PlusSignIcon, Cancel01Icon, Edit02Icon, Loading03Icon, Store01Icon } from 'hugeicons-react';

export const Stores = () => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [disablingId, setDisablingId] = useState(null);
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();

  const fetchStores = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/stores');
      if (response.data.success) {
        let filteredStores = response.data.data;
        if (search) {
          filteredStores = filteredStores.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.slug.toLowerCase().includes(search.toLowerCase()));
        }
        if (statusFilter !== 'ALL') {
          filteredStores = filteredStores.filter(s => s.status === statusFilter);
        }
        setStores(filteredStores);
      }
    } catch (error) {
      console.error("Failed to fetch stores", error);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStores();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchStores]);

  const handleDisable = async (store) => {
    if (store.status === 'DISABLED') {
      alert("This store is already disabled.");
      return;
    }
    
    if (!window.confirm("Are you sure you want to disable this store? It will no longer be active for staff or customers.")) return;
    
    setDisablingId(store.id);
    try {
      const response = await api.patch(`/stores/${store.id}`, { status: 'DISABLED' });
      if (response.data.success) {
        setStores(stores.map(s => s.id === store.id ? { ...s, status: 'DISABLED' } : s));
      }
    } catch (error) {
      console.error(error);
      alert("Failed to disable store: " + (error.response?.data?.error?.message || error.message));
    } finally {
      setDisablingId(null);
    }
  };

  const getStatusBadgeColor = (status) => {
    if (status === 'ACTIVE') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20';
    if (status === 'SUSPENDED') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
    if (status === 'DISABLED') return 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-200 dark:border-red-500/20';
    return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Stores</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage your brand's physical locations.</p>
        </div>
        {(currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'TENANT_ADMIN') && (
          <Button onClick={() => navigate('/dashboard/stores/create')} className="shrink-0 flex items-center gap-2">
            <PlusSignIcon size={16} /> Add Store
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full">
          <Search01Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input 
            placeholder="Search stores..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-full" 
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-zinc-950">
            <SelectValue placeholder="Filter by Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
            <SelectItem value="DISABLED">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-950 overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <TableHead className="w-[300px]">Store</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center">
                    <Loading03Icon className="animate-spin mx-auto h-6 w-6 text-zinc-400 mb-2" />
                    <p className="text-sm text-zinc-500">Loading stores...</p>
                  </TableCell>
                </TableRow>
              ) : stores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center">
                    <Store01Icon className="mx-auto h-8 w-8 text-zinc-400 mb-2" />
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No stores found</p>
                    <p className="text-xs text-zinc-500">Try adjusting your search or add a new store.</p>
                  </TableCell>
                </TableRow>
              ) : (
                stores.map((store) => (
                  <TableRow key={store.id} className="border-zinc-100 dark:border-zinc-800 group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                          {store.logo && store.logo !== 'https://placehold.co/400x400/png' ? (
                            <img src={store.logo} alt={store.name} className="h-full w-full object-cover" />
                          ) : (
                            <Store01Icon size={20} className="text-zinc-400" />
                          )}
                        </div>
                        <div className="flex flex-col max-w-[200px]">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100 text-sm truncate" title={store.name}>{store.name}</span>
                          <span className="text-xs text-zinc-500 truncate bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded w-max mt-1" title={store.slug}>/{store.slug}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs text-zinc-900 dark:text-zinc-100">{store.contactPhone || 'No phone'}</span>
                        <span className="text-xs text-zinc-500">{store.contactEmail || 'No email'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] font-semibold tracking-wider ${getStatusBadgeColor(store.status)}`}>
                        {store.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          title="Edit Store"
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-zinc-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          onClick={() => navigate(`/dashboard/stores/${store.id}/edit`)}
                        >
                          <Edit02Icon size={16} />
                        </Button>
                        <Button
                          title={store.status === 'DISABLED' ? "Store Disabled" : "Disable Store"}
                          variant="ghost" 
                          size="icon" 
                          className={`h-8 w-8 text-zinc-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 ${store.status === 'DISABLED' ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={() => handleDisable(store)}
                          disabled={disablingId === store.id || store.status === 'DISABLED'}
                        >
                          {disablingId === store.id ? <Loading03Icon className="animate-spin" size={16} /> : <Cancel01Icon size={16} />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
