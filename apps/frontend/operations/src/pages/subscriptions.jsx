import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { 
  Card, CardContent, CardHeader, CardTitle, 
  Button, Badge, Input, Label, Separator, Skeleton 
} from '@smo/ui';
import { 
  FlashIcon, 
  CheckmarkCircle02Icon, 
  AlertCircleIcon, 
  Coins01Icon, 
  RupeeIcon, 
  Store01Icon, 
  QrCodeIcon, 
  ComputerIcon,
  CreditCardIcon,
  LinkSquare02Icon
} from 'hugeicons-react';

export const Subscriptions = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('subscription');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState({ text: '', error: false });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Subscription State
  const [plans, setPlans] = useState([]);
  const [mySubscription, setMySubscription] = useState(null);

  // Gateway State
  const [gateways, setGateways] = useState([]);
  const [gatewayForm, setGatewayForm] = useState({
    provider: 'RAZORPAY',
    merchantId: '',
    apiKey: '',
    secretKey: ''
  });

  // Check URL params for payment redirects
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') {
      setStatusMsg({ text: 'Payment successful! Your subscription has been updated.', error: false });
      // Remove query param
      setSearchParams({});
    } else if (paymentStatus === 'failed') {
      setStatusMsg({ text: `Payment failed (Code: ${searchParams.get('code') || 'UNKNOWN'}). Please try again.`, error: true });
      setSearchParams({});
    } else if (paymentStatus === 'error') {
      setStatusMsg({ text: 'An error occurred during payment verification.', error: true });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [plansRes, subRes, gatewaysRes] = await Promise.all([
        api.get('/billing/plans'),
        api.get('/billing/subscription'),
        api.get('/billing/gateways')
      ]);
      
      if (plansRes.data.success) setPlans(Array.isArray(plansRes.data.data) ? plansRes.data.data : []);
      if (subRes.data.success) setMySubscription(subRes.data.data);
      if (gatewaysRes.data.success) {
        setGateways(Array.isArray(gatewaysRes.data.data) ? gatewaysRes.data.data : []);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch billing data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpgrade = async (planId) => {
    setIsSubmitting(true);
    setStatusMsg({ text: '', error: false });
    try {
      const res = await api.post('/billing/subscription/initiate', { planId, sourceApp: 'operations' });
      if (res.data.success && res.data.data.paymentUrl) {
        window.location.href = res.data.data.paymentUrl;
      } else {
        throw new Error('Failed to generate payment link');
      }
    } catch (err) {
      setStatusMsg({ text: err.response?.data?.error?.message || 'Error initiating checkout', error: true });
      setIsSubmitting(false);
    }
  };

  const handleSaveGateway = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMsg({ text: '', error: false });
    try {
      await api.post('/billing/gateways', gatewayForm);
      setStatusMsg({ text: 'Payment Gateway credentials saved successfully!', error: false });
      setGatewayForm({ provider: 'RAZORPAY', merchantId: '', apiKey: '', secretKey: '' });
      fetchData(); // Refresh to show Active status
    } catch (err) {
      setStatusMsg({ text: err.response?.data?.error?.message || 'Failed to save gateway credentials', error: true });
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

  const razorpayGateway = gateways.find(g => g.provider === 'RAZORPAY');

  if (loading) {
    return (
      <div className="space-y-6 w-full mx-auto">
        <Skeleton className="h-8 w-48 bg-zinc-100 dark:bg-zinc-800" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-40 bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Billing & Subscriptions</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage your SaaS subscription and configure payment gateways for your stores.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg px-4 py-3">
          <AlertCircleIcon size={16} />
          {error}
        </div>
      )}

      {statusMsg.text && (
        <div
          className={`flex items-center gap-2 text-sm rounded-lg px-4 py-3 border ${
            statusMsg.error
              ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400"
              : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30 text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {statusMsg.error ? <AlertCircleIcon size={16} /> : <CheckmarkCircle02Icon size={16} />}
          {statusMsg.text}
        </div>
      )}

      <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg p-1 w-fit border border-zinc-200 dark:border-zinc-800">
        <button
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'subscription'
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
          }`}
          onClick={() => setActiveTab('subscription')}
        >
          <div className="flex items-center gap-2">
            <CreditCardIcon size={16} />
            SaaS Subscription
          </div>
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'gateways'
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
          }`}
          onClick={() => setActiveTab('gateways')}
        >
          <div className="flex items-center gap-2">
            <LinkSquare02Icon size={16} />
            Payment Gateways
          </div>
        </button>
      </div>

      {activeTab === 'subscription' && (
        <div className="grid gap-8 md:grid-cols-[.5fr_1fr]">
          {/* Current Subscription Card */}
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm h-fit">
            <CardHeader>
              <CardTitle className="text-base text-zinc-900 dark:text-zinc-100">Current Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mySubscription ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                        <FlashIcon size={24} className="text-yellow-600 dark:text-yellow-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">{mySubscription.plan.name}</h3>
                        <p className="text-sm text-zinc-500">Billed {mySubscription.plan.interval.toLowerCase()}</p>
                      </div>
                    </div>
                    <Badge variant={mySubscription.status === 'ACTIVE' ? 'default' : 'destructive'} className="px-3 py-1 text-xs">
                      {mySubscription.status}
                    </Badge>
                  </div>
                  
                  <Separator className="bg-zinc-100 dark:bg-zinc-800" />
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Max Stores</span>
                      <span className="text-zinc-900 dark:text-zinc-100 font-medium">{mySubscription.plan.maxStores}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Current Period Ends</span>
                      <span className="text-zinc-900 dark:text-zinc-100 font-medium">{formatDate(mySubscription.currentPeriodEnd)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Provider Ref</span>
                      <span className="text-zinc-400 font-mono text-xs">{mySubscription.providerSubId || '—'}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-10">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center mx-auto mb-4 border border-zinc-100 dark:border-zinc-800">
                    <Coins01Icon className="h-8 w-8 text-zinc-400" />
                  </div>
                  <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No active subscription</h3>
                  <p className="text-sm text-zinc-500 mt-2 max-w-[250px] mx-auto">
                    Choose a plan from the available upgrades to unlock full platform features.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Available Upgrades */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">Available Upgrades</h3>
            <div className="grid gap-6 grid-cols-3">
              {plans.filter(p => p.isActive).map(plan => {
                const isCurrent = mySubscription?.planId === plan.id;
                
                return (
                  <Card key={plan.id} className={`border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden transition-all ${isCurrent ? 'ring-2 ring-emerald-500/50' : 'hover:border-zinc-300 dark:hover:border-zinc-700'}`}>
                    {isCurrent && <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold py-1 px-3 text-center border-b border-emerald-500/20">CURRENT PLAN</div>}
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">{plan.name}</h4>
                          <div className="mt-1 flex items-center gap-1 font-semibold text-zinc-700 dark:text-zinc-300">
                            <RupeeIcon size={16} /> 
                            <span className="text-xl">{plan.price}</span>
                            <span className="text-sm font-normal text-zinc-500">/{plan.interval.toLowerCase()}</span>
                          </div>
                        </div>
                        
                        {!isCurrent && (
                          <Button 
                            variant="secondary" 
                            disabled={isSubmitting} 
                            onClick={() => handleUpgrade(plan.id)}
                            >
                            {isSubmitting ? 'Loading...' : 'Upgrade Now'}
                          </Button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 gap-y-2 gap-x-4 text-sm text-zinc-600 dark:text-zinc-400 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                          <Store01Icon size={14} className="text-zinc-400" />
                          <span>Up to {plan.maxStores} Stores</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <QrCodeIcon size={14} className="text-zinc-400" />
                          <span>QR Menu Orders</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ComputerIcon size={14} className="text-zinc-400" />
                          <span>POS System</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'gateways' && (
        <div className="max-w-3xl">
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-blue-600 to-blue-400" />
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg text-zinc-900 dark:text-zinc-100">Razorpay Integration (BYOAK)</CardTitle>
                  <p className="text-sm text-zinc-500 mt-1">Configure your own Razorpay keys to process payments directly to your bank account.</p>
                </div>
                {razorpayGateway?.hasKeys && razorpayGateway?.isActive && (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
                    <CheckmarkCircle02Icon size={12} className="mr-1" /> Active
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveGateway} className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-4 rounded-lg text-sm text-blue-800 dark:text-blue-300">
                  <p><strong>Bring Your Own API Key (BYOAK)</strong> allows your stores to accept digital payments from customers placing orders via QR menus or POS.</p>
                  <p className="mt-1">The keys are securely encrypted before being saved in our database.</p>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="merchantId">Razorpay Merchant ID (Optional)</Label>
                    <Input 
                      id="merchantId" 
                      value={gatewayForm.merchantId} 
                      onChange={e => setGatewayForm(p => ({...p, merchantId: e.target.value}))} 
                      placeholder="e.g. M1234567890" 
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="apiKey">Key ID *</Label>
                      <Input 
                        id="apiKey" 
                        required 
                        value={gatewayForm.apiKey} 
                        onChange={e => setGatewayForm(p => ({...p, apiKey: e.target.value}))} 
                        placeholder={razorpayGateway?.hasKeys ? "••••••••••••" : "rzp_live_..."} 
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="secretKey">Key Secret *</Label>
                      <Input 
                        id="secretKey" 
                        type="password"
                        required 
                        value={gatewayForm.secretKey} 
                        onChange={e => setGatewayForm(p => ({...p, secretKey: e.target.value}))} 
                        placeholder={razorpayGateway?.hasKeys ? "••••••••••••••••••••" : "Your Razorpay secret"} 
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : razorpayGateway?.hasKeys ? 'Update Keys' : 'Save Configuration'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
