import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './components/protected-route';
import { OperationsLayout } from './layouts/operations-layout';
import { Login } from './pages/login';
import { Home } from './pages/home';
import { Dashboard } from './pages/dashboard';
import { PosLayout } from './pages/pos/pos-layout';
import { PosNewOrderPage } from './pages/pos/pos-new-order-page';
import { PosOrderEditPage } from './pages/pos/pos-order-edit-page';
import { PosActiveOrdersPage } from './pages/pos/pos-active-orders-page';
import { PosCheckoutPage } from './pages/pos/pos-checkout-page';
import { PosCustomDishPage } from './pages/pos/pos-custom-dish-page';
import { PosDeliveryPage } from './pages/pos/pos-delivery-page';
import { PosCorporateDetailsPage, PosInvoicePage } from './pages/pos/pos-invoice-pages';
import { PosDuesPage } from './pages/pos/pos-dues-page';
import { Dues } from './pages/dues/dues-page';
import { DuesPaymentPage, DuesAccountPage } from './pages/dues/dues-child-pages';
import { KDS } from './pages/kds';
import { Waiter } from './pages/waiter';
import { WaiterTasks } from './pages/waiter-tasks';
import { WaiterPOS } from './pages/waiter-pos';
import { Orders } from './pages/orders';
import { OrderDetailPage } from './pages/orders/order-detail-page';
import { OrderInvoicePage, OrderRefundPage, OrderCancelPage } from './pages/orders/order-action-pages';
import { Inventory } from './pages/inventory';
import { Settings } from './pages/settings';
import { Stores } from './pages/stores';
import { StoreCreate } from './pages/store-create';
import { StoreEdit } from './pages/store-edit';
import { BrandSetup } from './pages/brand-setup';
import { Subscriptions } from './pages/subscriptions';
import { Reservations } from './pages/reservations';
import { NewReservationPage } from './pages/reservations/new-reservation-page';
import { Employees } from './pages/employees';
import { TableAnalytics } from './pages/table-analytics';
import { Invoices } from './pages/invoices';
import { AuditLog } from './pages/audit-log';
import { Leakages } from './pages/leakages';
import { Sales } from './pages/sales/sales-page';

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

          {/* Reservations (Cashier + Waiter + Manager/Admin) */}
          <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER', 'CASHIER', 'WAITER']} />}>
            <Route path="/dashboard/reservations" element={<Reservations />} />
            <Route path="/dashboard/reservations/new" element={<NewReservationPage />} />
          </Route>

          {/* POS & Orders (Cashier + Manager/Admin) */}
          <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER', 'CASHIER']} />}>
            <Route path="/dashboard/pos" element={<PosLayout />}>
              <Route index element={<PosNewOrderPage />} />
              <Route path="orders" element={<PosActiveOrdersPage />} />
              <Route path="orders/:orderId/edit" element={<PosOrderEditPage />} />
              <Route path="custom-dish" element={<PosCustomDishPage />} />
              <Route path="delivery" element={<PosDeliveryPage />} />
              <Route path="checkout/:kind/:id" element={<PosCheckoutPage />} />
              <Route path="checkout/:kind/:id/corporate" element={<PosCorporateDetailsPage />} />
              <Route path="checkout/:kind/:id/invoice" element={<PosInvoicePage />} />
              <Route path="checkout/:kind/:id/dues" element={<PosDuesPage />} />
            </Route>
            <Route path="/dashboard/orders" element={<Orders />} />
            <Route path="/dashboard/orders/:orderId" element={<OrderDetailPage />} />
            <Route path="/dashboard/orders/:orderId/invoice" element={<OrderInvoicePage />} />
            <Route path="/dashboard/orders/:orderId/refund" element={<OrderRefundPage />} />
            <Route path="/dashboard/orders/:orderId/cancel" element={<OrderCancelPage />} />
            <Route path="/dashboard/invoices" element={<Invoices />} />
            <Route path="/dashboard/dues" element={<Dues />} />
            <Route path="/dashboard/dues/record-payment" element={<DuesPaymentPage />} />
            <Route path="/dashboard/dues/accounts/new" element={<DuesAccountPage />} />
            <Route path="/dashboard/dues/accounts/:accountId" element={<DuesAccountPage />} />
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
            <Route path="/dashboard/audit" element={<AuditLog />} />
            <Route path="/dashboard/leakages" element={<Leakages />} />
            <Route path="/dashboard/sales" element={<Sales />} />
          </Route>

          {/* Tenant Setup, Staff & Subscriptions (Tenant/Super Admin) */}
          <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'TENANT_ADMIN']} />}>
            <Route path="/dashboard/employees" element={<Employees />} />
            <Route path="/dashboard/brand" element={<BrandSetup />} />
            <Route path="/dashboard/stores/create" element={<StoreCreate />} />
            <Route path="/dashboard/subscriptions" element={<Subscriptions />} />
            <Route path="/dashboard/table-analytics" element={<TableAnalytics />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
