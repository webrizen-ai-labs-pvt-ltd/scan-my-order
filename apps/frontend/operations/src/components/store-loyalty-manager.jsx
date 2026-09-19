import React, { useState, useEffect } from 'react';
import { 
  Card, CardContent, CardHeader, CardTitle, 
  Button, Input, Label, Badge, Separator 
} from '@smo/ui';
import { 
  Loading03Icon, Coins01Icon, CheckmarkCircle02Icon, 
  AlertCircleIcon, UserMultiple02Icon, ArrowRight01Icon,
  Search01Icon, RefreshIcon, DollarSquareIcon, Settings01Icon
} from 'hugeicons-react';
import api from '../lib/api';

export const StoreLoyaltyManager = ({ storeId }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Settings & Metrics
  const [metrics, setMetrics] = useState({
    totalWallets: 0,
    currentOutstandingBalance: 0,
    totalCreditsIssued: 0,
    totalCreditsRedeemed: 0
  });

  const [settings, setSettings] = useState({
    isEnabled: false,
    welcomeBonusCredits: 50,
    cashbackPercentage: 5,
    minOrderToEarn: 100,
    minOrderToRedeem: 200,
    maxRedemptionPercent: 50,
    allowPromoStacking: true,
    creditExpiryDays: 90
  });

  // Customers with wallets
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Adjustment Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const fetchLoyaltyData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/stores/${storeId}/loyalty`);
      if (res.data.success) {
        setSettings(res.data.data.settings || {});
        setMetrics(res.data.data.metrics || {});
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load loyalty settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async (search = '') => {
    try {
      setLoadingCustomers(true);
      const res = await api.get(`/stores/${storeId}/loyalty/customers`, {
        params: search ? { search } : {}
      });
      if (res.data.success) {
        setCustomers(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch customer wallets:', err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  useEffect(() => {
    fetchLoyaltyData();
    fetchCustomers();
  }, [storeId]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSaveSuccess(false);
      setError('');
      const payload = {
        isEnabled: Boolean(settings.isEnabled),
        welcomeBonusCredits: Math.max(0, parseInt(settings.welcomeBonusCredits) || 0),
        cashbackPercentage: Math.min(100, Math.max(0, parseFloat(settings.cashbackPercentage) || 0)),
        minOrderToEarn: Math.max(0, parseInt(settings.minOrderToEarn) || 0),
        minOrderToRedeem: Math.max(0, parseInt(settings.minOrderToRedeem) || 0),
        maxRedemptionPercent: Math.min(100, Math.max(1, parseInt(settings.maxRedemptionPercent) || 50)),
        allowPromoStacking: Boolean(settings.allowPromoStacking),
        creditExpiryDays: Math.max(0, parseInt(settings.creditExpiryDays) || 0)
      };

      const res = await api.patch(`/stores/${storeId}/loyalty`, payload);
      if (res.data.success) {
        setSettings(res.data.data.settings);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleManualAdjust = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount === 0) {
      alert('Please enter a non-zero credit amount');
      return;
    }
    if (!adjustReason.trim()) {
      alert('Please provide a reason for the adjustment');
      return;
    }

    try {
      setAdjusting(true);
      const res = await api.post(`/stores/${storeId}/loyalty/adjust`, {
        customerId: selectedCustomer.id,
        amount,
        reason: adjustReason.trim()
      });

      if (res.data.success) {
        setAdjustModalOpen(false);
        setSelectedCustomer(null);
        setAdjustAmount('');
        setAdjustReason('');
        // Refresh customer list & metrics
        fetchCustomers(customerSearch);
        fetchLoyaltyData();
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to adjust credits');
    } finally {
      setAdjusting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-3">
        <Loading03Icon className="animate-spin text-amber-500" size={32} />
        <p className="text-sm text-zinc-500">Loading Loyalty & Wallet Program...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Coins01Icon className="text-amber-500" size={24} />
              Store Credit Wallet & Loyalty Rewards
            </h3>
            <Badge variant={settings.isEnabled ? 'default' : 'secondary'} className={settings.isEnabled ? 'bg-emerald-600' : ''}>
              {settings.isEnabled ? 'Active' : 'Disabled'}
            </Badge>
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            Domino's-style customer store credit wallet. Customers earn and redeem direct credits (1 Credit = ₹1) specifically at this store.
          </p>
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => { fetchLoyaltyData(); fetchCustomers(customerSearch); }}
          className="flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshIcon size={15} /> Refresh Stats
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 flex items-center gap-2 text-sm">
          <AlertCircleIcon size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center gap-2 text-sm">
          <CheckmarkCircle02Icon size={18} className="shrink-0" />
          <span>Loyalty rules updated successfully! Changes are live on customer menus immediately.</span>
        </div>
      )}

      {/* Aggregate Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Customer Wallets</span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <UserMultiple02Icon size={18} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-zinc-900 dark:text-white">
                {metrics.totalWallets.toLocaleString()}
              </span>
              <p className="text-xs text-zinc-500 mt-0.5">Enrolled registered patrons</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Outstanding Balance</span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Coins01Icon size={18} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                ₹{Number(metrics.currentOutstandingBalance || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
              <p className="text-xs text-zinc-500 mt-0.5">Available for customer checkout</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Lifetime Issued</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <DollarSquareIcon size={18} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                ₹{Number(metrics.totalCreditsIssued || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
              <p className="text-xs text-zinc-500 mt-0.5">Welcome + Cashbacks + Bonuses</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Credits Redeemed</span>
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Coins01Icon size={18} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                ₹{Number(metrics.totalCreditsRedeemed || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
              <p className="text-xs text-zinc-500 mt-0.5">Applied directly as order discounts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Program Settings Form */}
      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <Settings01Icon size={18} className="text-zinc-500" />
            <span>Store Loyalty & Credit Rules</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* Master Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <div className="space-y-0.5">
                <Label className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Enable Store Credit Wallet Program
                </Label>
                <p className="text-xs text-zinc-500">
                  When enabled, customers can view their store credit balance on the menu and redeem credits during online checkout.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.isEnabled}
                  onChange={(e) => setSettings({ ...settings, isEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {/* Config Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Welcome Bonus */}
              <div className="space-y-2">
                <Label htmlFor="welcomeBonus" className="flex items-center justify-between text-xs font-semibold">
                  <span>Welcome Bonus Credits (₹)</span>
                  <span className="text-zinc-400 font-normal">One-time per customer</span>
                </Label>
                <Input
                  id="welcomeBonus"
                  type="number"
                  min="0"
                  value={settings.welcomeBonusCredits}
                  onChange={(e) => setSettings({ ...settings, welcomeBonusCredits: e.target.value })}
                  placeholder="e.g. 50"
                  className="font-medium"
                />
                <p className="text-[11px] text-zinc-500">
                  Auto-credited when customer creates an account or visits menu while logged in.
                </p>
              </div>

              {/* Cashback Percentage */}
              <div className="space-y-2">
                <Label htmlFor="cashbackPercent" className="flex items-center justify-between text-xs font-semibold">
                  <span>Order Cashback (%)</span>
                  <span className="text-zinc-400 font-normal">Credited on settlement</span>
                </Label>
                <Input
                  id="cashbackPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={settings.cashbackPercentage}
                  onChange={(e) => setSettings({ ...settings, cashbackPercentage: e.target.value })}
                  placeholder="e.g. 5"
                  className="font-medium"
                />
                <p className="text-[11px] text-zinc-500">
                  Earned on subtotal when an order is completed & paid (SETTLED).
                </p>
              </div>

              {/* Min Order to Earn */}
              <div className="space-y-2">
                <Label htmlFor="minEarn" className="flex items-center justify-between text-xs font-semibold">
                  <span>Min Order to Earn (₹)</span>
                  <span className="text-zinc-400 font-normal">Subtotal threshold</span>
                </Label>
                <Input
                  id="minEarn"
                  type="number"
                  min="0"
                  value={settings.minOrderToEarn}
                  onChange={(e) => setSettings({ ...settings, minOrderToEarn: e.target.value })}
                  placeholder="e.g. 100"
                  className="font-medium"
                />
                <p className="text-[11px] text-zinc-500">
                  Orders below this subtotal will not earn cashback credits.
                </p>
              </div>

              {/* Min Order to Redeem */}
              <div className="space-y-2">
                <Label htmlFor="minRedeem" className="flex items-center justify-between text-xs font-semibold">
                  <span>Min Order to Redeem (₹)</span>
                  <span className="text-zinc-400 font-normal">Checkout threshold</span>
                </Label>
                <Input
                  id="minRedeem"
                  type="number"
                  min="0"
                  value={settings.minOrderToRedeem}
                  onChange={(e) => setSettings({ ...settings, minOrderToRedeem: e.target.value })}
                  placeholder="e.g. 200"
                  className="font-medium"
                />
                <p className="text-[11px] text-zinc-500">
                  Cart subtotal required before customer can apply store credits.
                </p>
              </div>

              {/* Max Redemption % */}
              <div className="space-y-2">
                <Label htmlFor="maxRedemptionPercent" className="flex items-center justify-between text-xs font-semibold">
                  <span>Max Subtotal Payable by Credits (%)</span>
                  <span className="text-zinc-400 font-normal">Redemption cap</span>
                </Label>
                <Input
                  id="maxRedemptionPercent"
                  type="number"
                  min="1"
                  max="100"
                  value={settings.maxRedemptionPercent}
                  onChange={(e) => setSettings({ ...settings, maxRedemptionPercent: e.target.value })}
                  placeholder="e.g. 50"
                  className="font-medium"
                />
                <p className="text-[11px] text-zinc-500">
                  E.g. 50% means up to half the cart can be covered by store credits.
                </p>
              </div>

              {/* Credit Expiry Days */}
              <div className="space-y-2">
                <Label htmlFor="expiryDays" className="flex items-center justify-between text-xs font-semibold">
                  <span>Credit Expiry (Days)</span>
                  <span className="text-zinc-400 font-normal">0 = Never expire</span>
                </Label>
                <Input
                  id="expiryDays"
                  type="number"
                  min="0"
                  value={settings.creditExpiryDays}
                  onChange={(e) => setSettings({ ...settings, creditExpiryDays: e.target.value })}
                  placeholder="e.g. 90"
                  className="font-medium"
                />
                <p className="text-[11px] text-zinc-500">
                  Validity window for issued credits (informational & redemption expiry).
                </p>
              </div>
            </div>

            {/* Promo Stacking Checkbox */}
            <div className="flex items-center space-x-3 pt-2">
              <input 
                type="checkbox"
                id="allowPromoStacking"
                checked={settings.allowPromoStacking}
                onChange={(e) => setSettings({ ...settings, allowPromoStacking: e.target.checked })}
                className="w-4 h-4 text-amber-600 rounded border-zinc-300 focus:ring-amber-500"
              />
              <Label htmlFor="allowPromoStacking" className="text-sm font-medium cursor-pointer text-zinc-700 dark:text-zinc-300">
                Allow stacking store credits with discount promo coupon codes in a single order
              </Label>
            </div>

            <Separator />

            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={saving}
                className="bg-amber-500 hover:bg-amber-600 text-white font-medium flex items-center gap-2"
              >
                {saving && <Loading03Icon className="animate-spin" size={16} />}
                Save Loyalty Rules
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Customer Wallets Ledger */}
      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">
                Customer Store Credit Wallets
              </CardTitle>
              <p className="text-xs text-zinc-500 mt-0.5">
                View customer balances and manually grant promotional credits or adjustments.
              </p>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search01Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <Input
                  placeholder="Search customer..."
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    fetchCustomers(e.target.value);
                  }}
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loadingCustomers ? (
            <div className="p-12 flex justify-center">
              <Loading03Icon className="animate-spin text-zinc-400" size={24} />
            </div>
          ) : customers.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-500">
              No customer wallets found for this store yet. Customers will automatically receive wallets when they log in to the menu.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold uppercase text-zinc-500">
                  <tr>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3">Current Balance</th>
                    <th className="px-6 py-3">Total Earned</th>
                    <th className="px-6 py-3">Total Spent</th>
                    <th className="px-6 py-3">Recent Activity</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {customers.map((c) => {
                    const wallet = c.wallet;
                    return (
                      <tr key={c.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40">
                        <td className="px-6 py-4">
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">{c.name}</div>
                          <div className="text-xs text-zinc-500">{c.phone || c.email || 'No contact info'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400 text-base">
                            <Coins01Icon size={18} />
                            ₹{wallet ? Number(wallet.balance).toFixed(2) : '0.00'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-medium">
                          +₹{wallet ? Number(wallet.totalEarned).toFixed(2) : '0.00'}
                        </td>
                        <td className="px-6 py-4 text-purple-600 dark:text-purple-400 font-medium">
                          -₹{wallet ? Number(wallet.totalSpent).toFixed(2) : '0.00'}
                        </td>
                        <td className="px-6 py-4 text-xs text-zinc-500">
                          {wallet?.transactions?.[0] ? (
                            <div>
                              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                {wallet.transactions[0].type.replace('_', ' ')}
                              </span>
                              <p className="text-[11px] text-zinc-400">
                                {new Date(wallet.transactions[0].createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          ) : (
                            <span>No transactions</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedCustomer(c);
                              setAdjustModalOpen(true);
                              setAdjustAmount('');
                              setAdjustReason('');
                            }}
                            className="text-xs h-8"
                          >
                            Adjust Credits
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Credit Adjustment Modal */}
      {adjustModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Coins01Icon className="text-amber-500" size={20} />
                Adjust Customer Credits
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                For <strong>{selectedCustomer.name}</strong> ({selectedCustomer.phone || selectedCustomer.email})
              </p>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl flex items-center justify-between text-xs">
              <span className="text-zinc-500">Current Balance:</span>
              <span className="font-bold text-amber-500 text-sm">
                ₹{selectedCustomer.wallet ? Number(selectedCustomer.wallet.balance).toFixed(2) : '0.00'}
              </span>
            </div>

            <form onSubmit={handleManualAdjust} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="adjustAmount" className="text-xs font-semibold">
                  Amount (Positive to Grant, Negative to Deduct)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-zinc-400">₹</span>
                  <Input
                    id="adjustAmount"
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 50 or -20"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    className="pl-8 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adjustReason" className="text-xs font-semibold">
                  Reason for Adjustment
                </Label>
                <Input
                  id="adjustReason"
                  type="text"
                  required
                  placeholder="e.g. Service apology compensation, VIP bonus"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setAdjustModalOpen(false)}
                  disabled={adjusting}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={adjusting}
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  {adjusting && <Loading03Icon className="animate-spin mr-1.5" size={16} />}
                  Confirm Adjustment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
