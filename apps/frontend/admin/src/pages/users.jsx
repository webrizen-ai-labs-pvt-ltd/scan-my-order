import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent, Button, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, Badge, Avatar, AvatarFallback, AvatarImage, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@smo/ui';
import { Search01Icon, PlusSignIcon, Delete01Icon, Edit02Icon, Loading03Icon, Shield01Icon, UserIcon } from 'hugeicons-react';

export const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search) query.append('search', search);
      if (roleFilter !== 'ALL') query.append('role', roleFilter);
      
      const response = await api.get(`/users?${query.toString()}`);
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleDelete = async (id) => {
    if (id === currentUser.id) {
      alert("You cannot delete your own account.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    
    setDeletingId(id);
    try {
      const response = await api.delete(`/users/${id}`);
      if (response.data.success) {
        setUsers(users.filter(u => u.id !== id));
      }
    } catch (error) {
      console.error(error);
      alert("Failed to delete user: " + (error.response?.data?.error?.message || error.message));
    } finally {
      setDeletingId(null);
    }
  };

  const getRoleBadgeColor = (role) => {
    if (role === 'SUPER_ADMIN') return 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border-purple-200 dark:border-purple-500/20';
    if (role === 'TENANT_ADMIN') return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20';
    if (role === 'STORE_MANAGER') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20';
    return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Users & Staff</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage access and roles across your organization.</p>
        </div>
        <Button onClick={() => navigate('/users/create')} className="shrink-0 flex items-center gap-2">
          <PlusSignIcon size={16} /> Add User
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative w-full sm:max-w-xs">
          <Search01Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input 
            placeholder="Search users..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white dark:bg-zinc-950" 
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-zinc-950">
            <SelectValue placeholder="Filter by Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
            <SelectItem value="TENANT_ADMIN">Tenant Admin</SelectItem>
            <SelectItem value="STORE_MANAGER">Store Manager</SelectItem>
            <SelectItem value="WAITER">Waiter</SelectItem>
            <SelectItem value="CASHIER">Cashier</SelectItem>
            <SelectItem value="KITCHEN_STAFF">Kitchen Staff</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-950 overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <TableHead className="w-[300px]">User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center">
                    <Loading03Icon className="animate-spin mx-auto h-6 w-6 text-zinc-400 mb-2" />
                    <p className="text-sm text-zinc-500">Loading users...</p>
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center">
                    <UserIcon className="mx-auto h-8 w-8 text-zinc-400 mb-2" />
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No users found</p>
                    <p className="text-xs text-zinc-500">Try adjusting your search or filters.</p>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className="border-zinc-100 dark:border-zinc-800 group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.profilePhoto || ''} />
                          <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-xs font-medium border border-zinc-200 dark:border-zinc-700">
                            {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col max-w-[200px]">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100 text-sm truncate" title={user.name}>{user.name || 'Unknown'}</span>
                          <span className="text-xs text-zinc-500 truncate" title={user.email}>{user.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] font-semibold tracking-wider ${getRoleBadgeColor(user.role)}`}>
                        {user.role.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm text-zinc-900 dark:text-zinc-100 truncate max-w-[150px]" title={user.tenant?.name || 'Platform'}>
                          {user.tenant ? user.tenant.name : <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium"><Shield01Icon size={12}/> Platform</span>}
                        </span>
                        {user.store && <span className="text-xs text-zinc-500 truncate max-w-[150px]">{user.store.name}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${user.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          {user.status}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-zinc-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          onClick={() => navigate(`/users/${user.id}/edit`)}
                        >
                          <Edit02Icon size={16} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => handleDelete(user.id)}
                          disabled={deletingId === user.id}
                        >
                          {deletingId === user.id ? <Loading03Icon className="animate-spin" size={16} /> : <Delete01Icon size={16} />}
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
