import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './components/protected-route';
import { OperationsLayout } from './layouts/operations-layout';
import { Login } from './pages/login';
import { Home } from './pages/home';
import { Dashboard } from './pages/dashboard';
import { POS } from './pages/pos';
import { KDS } from './pages/kds';
import { Waiter } from './pages/waiter';
import { WaiterTasks } from './pages/waiter-tasks';
import { WaiterPOS } from './pages/waiter-pos';
import { Orders } from './pages/orders';
import { Inventory } from './pages/inventory';
import { Settings } from './pages/settings';
import { Stores } from './pages/stores';
import { StoreCreate } from './pages/store-create';
import { StoreEdit } from './pages/store-edit';
import { BrandSetup } from './pages/brand-setup';
import { Subscriptions } from './pages/subscriptions';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      
      <Route element={<ProtectedRoute />}>
        <Route element={<OperationsLayout />}>
          {/* Universal Dashboard Routes */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/settings" element={<Settings />} />

          {/* POS & Orders (Cashier + Manager/Admin) */}
          <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER', 'CASHIER']} />}>
            <Route path="/dashboard/pos" element={<POS />} />
            <Route path="/dashboard/orders" element={<Orders />} />
          </Route>

          {/* KDS (Kitchen + Manager/Admin) */}
          <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER', 'KITCHEN_STAFF']} />}>
            <Route path="/dashboard/kds" element={<KDS />} />
          </Route>

          {/* Waiter (Waiter + Manager/Admin) */}
          <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER', 'WAITER']} />}>
            <Route path="/dashboard/waiter" element={<Waiter />}>
              <Route index element={<WaiterTasks />} />
              <Route path="pos" element={<WaiterPOS />} />
            </Route>
          </Route>

          {/* Inventory (Manager/Admin) */}
          <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER']} />}>
            <Route path="/dashboard/inventory" element={<Inventory />} />
            <Route path="/dashboard/stores" element={<Stores />} />
            <Route path="/dashboard/stores/:id/edit" element={<StoreEdit />} />
          </Route>

          {/* Tenant Setup & Subscriptions (Tenant/Super Admin) */}
          <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'TENANT_ADMIN']} />}>
            <Route path="/dashboard/brand" element={<BrandSetup />} />
            <Route path="/dashboard/stores/create" element={<StoreCreate />} />
            <Route path="/dashboard/subscriptions" element={<Subscriptions />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
