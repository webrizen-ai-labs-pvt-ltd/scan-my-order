import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './components/protected-route';
import { AdminLayout } from './layouts/admin-layout';
import { Login } from './pages/login';
import { Dashboard } from './pages/dashboard';
import { Stores } from './pages/stores';
import { StoreCreate } from './pages/store-create';
import { StoreEdit } from './pages/store-edit';
import { Users } from './pages/users';
import { UserCreate } from './pages/user-create';
import { UserEdit } from './pages/user-edit';
import { Brands } from './pages/brands';
import { BrandCreate } from './pages/brand-create';
import { BrandEdit } from './pages/brand-edit';
import { Billing } from './pages/billing';
import { Settings } from './pages/settings';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/stores/create" element={<StoreCreate />} />
          <Route path="/stores/:id/edit" element={<StoreEdit />} />
          <Route path="/brands" element={<Brands />} />
          <Route path="/brands/new" element={<BrandCreate />} />
          <Route path="/brands/:id/edit" element={<BrandEdit />} />
          <Route path="/users" element={<Users />} />
          <Route path="/users/create" element={<UserCreate />} />
          <Route path="/users/:id/edit" element={<UserEdit />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;