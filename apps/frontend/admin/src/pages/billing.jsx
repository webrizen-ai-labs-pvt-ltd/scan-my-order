import React, { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Separator, Skeleton } from '@smo/ui';
import { 
  FlashIcon, 
  PlusSignIcon, 
  CheckmarkCircle02Icon, 
  Building04Icon, 
  Coins01Icon, 
  AlertCircleIcon, 
  RupeeIcon, 
  Store01Icon, 
  QrCodeIcon, 
  ComputerIcon 
} from 'hugeicons-react';

export const Billing = () => {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [activeTab, setActiveTab] = useState('subscriptions');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState({ text: '', error: false });

  const [plans, setPlans] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [mySubscription, setMySubscription] = useState(null);

  const [showPlanForm, setShowPlanForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [planFormData, setPlanFormData] = useState({
    name: '',
    price: '',
    interval: 'MONTHLY',
    maxStores: ''
  });

  const [assigningTenant, setAssigningTenant] = useState(null);
  const [assigningPlanId, setAssigningPlanId] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isSuperAdmin) {
        const [plansRes, tenantsRes] = await Promise.all([
          api.get('/billing/plans'),
          api.get('/tenants')
        ]);
        if (plansRes.data.success) setPlans(Array.isArray(plansRes.data.data) ? plansRes.data.data : []);
        if (tenantsRes.data.success) setTenants(Array.isArray(tenantsRes.data.data) ? tenantsRes.data.data : []);
      } else {
        const [plansRes, subRes] = await Promise.all([
          api.get('/billing/plans'),
          api.get('/billing/subscription')
        ]);
        if (plansRes.data.success) setPlans(Array.isArray(plansRes.data.data) ? plansRes.data.data : []);
        if (subRes.data.success) setMySubscription(subRes.data.data);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch billing data');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreatePlan = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMsg({ text: '', error: false });
    try {
      await api.post('/billing/plans', planFormData);
      setShowPlanForm(false);
      setPlanFormData({ name: '', price: '', interval: 'MONTHLY', maxStores: '' });
      setStatusMsg({ text: 'Plan created successfully!', error: false });
      fetchData();
    } catch (err) {
      setStatusMsg({ text: err.response?.data?.error?.message || 'Error creating plan', error: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignDirectly = async () => {
    if (!assigningPlanId) {
      setStatusMsg({ text: 'Select a plan first.', error: true });
      return;
    }
    setIsSubmitting(true);
    setStatusMsg({ text: '', error: false });
    try {
      await api.post('/billing/subscription/assign', { tenantId: assigningTenant.id, planId: assigningPlanId });
      setStatusMsg({ text: `Plan assigned to ${assigningTenant.name}!`, error: false });
      setAssigningTenant(null);
      setAssigningPlanId('');
      fetchData();
    } catch (err) {
      setStatusMsg({ text: err.response?.data?.error?.message || 'Error assigning plan', error: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendPaymentLink = async () => {
    if (!assigningPlanId) {
      setStatusMsg({ text: 'Select a plan first.', error: true });
      return;
    }
    setIsSubmitting(true);
    setStatusMsg({ text: '', error: false });
    try {
      await api.post('/billing/subscription/send-link', { tenantId: assigningTenant.id, planId: assigningPlanId });
      setStatusMsg({ text: 'Payment link sent successfully!', error: false });
      setAssigningTenant(null);
      setAssigningPlanId('');
    } catch (err) {
      setStatusMsg({ text: err.response?.data?.error?.message || 'Error sending link', error: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return '—';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 w-full">
        <Skeleton className="h-8 w-48 bg-zinc-100 dark:bg-zinc-800" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40 bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Billing & Plans</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isSuperAdmin ? 'Manage subscription plans and tenant billing' : 'Manage your subscription and invoices'}
          </p>
        </div>
        {isSuperAdmin && activeTab === 'plans' && (
          <Button onClick={() => setShowPlanForm(!showPlanForm)} size="sm">
            <PlusSignIcon size={14} /> Add Plan
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <AlertCircleIcon size={16} />
          {error}
        </div>
      )}

      {statusMsg.text && (
        <div
          className={`flex items-center gap-2 text-sm rounded-lg px-4 py-3 border ${
            statusMsg.error
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}
        >
          {statusMsg.error ? <AlertCircleIcon size={16} /> : <CheckmarkCircle02Icon size={16} />}
          {statusMsg.text}
        </div>
      )}

      {isSuperAdmin && (
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg p-1 w-fit border border-zinc-200 dark:border-zinc-800">
          <button
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'subscriptions'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
            onClick={() => setActiveTab('subscriptions')}
          >
            Subscriptions
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'plans'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
            onClick={() => setActiveTab('plans')}
          >
            Plans
          </button>
        </div>
      )}

      {isSuperAdmin && activeTab === 'plans' && (
        <div className="space-y-6">
          {showPlanForm && (
            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
              <CardContent className="p-6">
                <form onSubmit={handleCreatePlan} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <Label className="text-zinc-600 dark:text-zinc-400">Plan Name *</Label>
                      <Input required value={planFormData.name} onChange={e => setPlanFormData(p => ({...p, name: e.target.value}))} placeholder="e.g. Pro Tier" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zinc-600 dark:text-zinc-400">Price (₹) *</Label>
                      <Input required type="number" min="0" value={planFormData.price} onChange={e => setPlanFormData(p => ({...p, price: e.target.value}))} placeholder="1499" className="font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zinc-600 dark:text-zinc-400">Interval</Label>
                      <Select value={planFormData.interval} onValueChange={v => setPlanFormData(p => ({...p, interval: v}))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MONTHLY">Monthly</SelectItem>
                          <SelectItem value="YEARLY">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zinc-600 dark:text-zinc-400">Max Stores *</Label>
                      <Input required type="number" min="1" value={planFormData.maxStores} onChange={e => setPlanFormData(p => ({...p, maxStores: e.target.value}))} placeholder="5" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                    <Button type="button" variant="ghost" onClick={() => setShowPlanForm(false)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Creating...' : 'Create Plan'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map(plan => (
              <Card key={plan.id} className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-zinc-400 to-transparent opacity-50" />
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">{plan.name}</h3>
                    {!plan.isActive && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  <div className="mb-4 flex items-end gap-1">
                    <RupeeIcon size={20} className="text-zinc-400 mb-1" />
                    <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{plan.price}</span>
                    <span className="text-sm text-zinc-500 mb-1">/{plan.interval === 'MONTHLY' ? 'mo' : 'yr'}</span>
                  </div>
                  <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                    <li className="flex items-center gap-2">
                      <Store01Icon size={16} className="text-zinc-400 shrink-0" />
                      Up to {plan.maxStores} Stores
                    </li>
                    <li className="flex items-center gap-2">
                      <QrCodeIcon size={16} className="text-zinc-400 shrink-0" />
                      QR Menu Ordering
                    </li>
                    <li className="flex items-center gap-2">
                      <ComputerIcon size={16} className="text-zinc-400 shrink-0" />
                      POS System
                    </li>
                  </ul>
                  <Button 
                    variant="ghost" 
                    className="w-full text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 text-sm"
                    onClick={async () => {
                      if(window.confirm('Deactivate plan?')) {
                        await api.delete(`/billing/plans/${plan.id}`);
                        fetchData();
                      }
                    }}
                  >
                    Deactivate
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {isSuperAdmin && activeTab === 'subscriptions' && (
        <div className="space-y-6">
          {assigningTenant && (
            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <Building04Icon size={18} className="text-zinc-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Assign Plan to {assigningTenant.name}</h3>
                    <p className="text-xs text-zinc-500">Choose a plan and select assignment method</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-600 dark:text-zinc-400">Select Plan</Label>
                  <Select value={assigningPlanId} onValueChange={setAssigningPlanId}>
                    <SelectTrigger><SelectValue placeholder="Choose a plan" /></SelectTrigger>
                    <SelectContent>
                      {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name} - ₹{p.price}/{p.interval.toLowerCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <Button variant="ghost" onClick={() => { setAssigningTenant(null); setAssigningPlanId(''); }} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                    Cancel
                  </Button>
                  <Button variant="secondary" onClick={handleAssignDirectly} disabled={isSubmitting || !assigningPlanId}>
                    Assign Directly
                  </Button>
                  <Button onClick={handleSendPaymentLink} disabled={isSubmitting || !assigningPlanId}>
                    Send Payment Link
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenants.map(tenant => (
              <Card key={tenant.id} className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                      <Building04Icon size={16} className="text-zinc-500" />
                    </div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{tenant.name}</h3>
                  </div>
                  <div className="flex-1 space-y-2 mb-4">
                    {tenant.subscription ? (
                      <>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-zinc-500">Plan</span>
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">{tenant.subscription.plan.name}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-zinc-500">Status</span>
                          <Badge variant={tenant.subscription.status === 'ACTIVE' ? 'default' : 'destructive'} className="text-[10px]">
                            {tenant.subscription.status}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-zinc-500">Renews</span>
                          <span className="text-zinc-400">{formatDate(tenant.subscription.currentPeriodEnd)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-zinc-500 text-center py-4">No active subscription</div>
                    )}
                  </div>
                  <Button className="w-full text-sm" onClick={() => setAssigningTenant(tenant)}>
                    {tenant.subscription ? 'Change Plan' : 'Assign Plan'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!isSuperAdmin && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <CardHeader>
              <CardTitle className="text-base text-zinc-900 dark:text-zinc-100">Current Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mySubscription ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <FlashIcon size={18} className="text-zinc-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{mySubscription.plan.name}</h3>
                        <p className="text-xs text-zinc-500">Billed {mySubscription.plan.interval.toLowerCase()}</p>
                      </div>
                    </div>
                    <Badge variant={mySubscription.status === 'ACTIVE' ? 'default' : 'destructive'}>{mySubscription.status}</Badge>
                  </div>
                  <Separator className="bg-zinc-200 dark:bg-zinc-800" />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Max Stores</span>
                      <span className="text-zinc-900 dark:text-zinc-100 font-medium">{mySubscription.plan.maxStores}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Period Ends</span>
                      <span className="text-zinc-900 dark:text-zinc-100 font-medium">{formatDate(mySubscription.currentPeriodEnd)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                    <Coins01Icon className="h-7 w-7 text-zinc-400" />
                  </div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No active subscription</p>
                  <p className="text-xs text-zinc-500 mt-1">Please upgrade to unlock full features.</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          <div className="space-y-4">
            <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100">Available Upgrades</h3>
            {plans.filter(p => !mySubscription || p.id !== mySubscription.planId).map(plan => (
              <Card key={plan.id} className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-zinc-900 dark:text-zinc-100">{plan.name}</h4>
                    <p className="text-sm text-zinc-500 flex items-center gap-1">
                      <RupeeIcon size={14} /> {plan.price} / {plan.interval.toLowerCase()}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setStatusMsg({ text: 'Self-serve checkout coming soon! Your admin can send you a payment link.', error: false })}>
                    Upgrade
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};