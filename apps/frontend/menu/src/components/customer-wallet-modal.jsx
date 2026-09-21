import React from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle 
} from '@smo/ui';
import { 
  Cancel01Icon, 
  Coins01Icon, 
  GiftIcon, 
  Tag01Icon, 
  CheckmarkCircle02Icon, 
  AlertCircleIcon,
  CreditCardIcon,
  Loading03Icon
} from 'hugeicons-react';
import { GoogleLogin } from '@react-oauth/google';

export const CustomerWalletModal = ({ 
  open, 
  onClose, 
  walletData, 
  store, 
  brandColor = '#059669',
  onGoogleSuccess,
  authLoading = false
}) => {
  const wallet = walletData?.wallet;
  const settings = walletData?.settings || walletData?.storeRules || {};
  const transactions = walletData?.transactions || [];
  const isAuthenticated = walletData?.isAuthenticated;
  const balance = Number(wallet?.balance || 0);

  const getTransactionInfo = (type) => {
    switch (type) {
      case 'WELCOME_BONUS':
        return { 
          label: 'Welcome Bonus', 
          isCredit: true, 
          icon: <GiftIcon size={16} className="text-amber-500" /> 
        };
      case 'CASHBACK_EARNED':
        return { 
          label: 'Order Cashback', 
          isCredit: true, 
          icon: <Coins01Icon size={16} className="text-emerald-500" /> 
        };
      case 'ORDER_REDEMPTION':
        return { 
          label: 'Redeemed on Order', 
          isCredit: false, 
          icon: <Tag01Icon size={16} className="text-purple-500" /> 
        };
      case 'MANUAL_CREDIT':
        return { 
          label: 'Store Credit Grant', 
          isCredit: true, 
          icon: <Coins01Icon size={16} className="text-blue-500" /> 
        };
      case 'MANUAL_DEBIT':
        return { 
          label: 'Adjustment', 
          isCredit: false, 
          icon: <AlertCircleIcon size={16} className="text-zinc-500" /> 
        };
      case 'REFUND_CREDIT':
        return { 
          label: 'Cancelled Order Refund', 
          isCredit: true, 
          icon: <CheckmarkCircle02Icon size={16} className="text-emerald-500" /> 
        };
      default:
        return { 
          label: type?.replace('_', ' ') || 'Transaction', 
          isCredit: true, 
          icon: <Coins01Icon size={16} className="text-amber-500" /> 
        };
    }
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent 
        side="bottom" 
        className="w-full sm:max-w-md mx-auto p-0 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-t-3xl shadow-2xl max-h-[88vh] flex flex-col overflow-hidden"
      >
        {/* Top Drag Indicator */}
        <div className="w-full pt-3 pb-1 flex justify-center">
          <div className="h-1.5 w-12 rounded-full bg-zinc-200 dark:bg-zinc-700" />
        </div>

        {/* Sheet Header */}
        <div className="px-6 pt-2 pb-4 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Coins01Icon size={20} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50 leading-tight">
                Store Credits
              </h2>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {store?.name || 'Store'} Loyalty Wallet
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Main Balance Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 p-5 text-white shadow-lg shadow-amber-500/20">
            <div className="relative z-10">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold tracking-wider uppercase text-amber-100/90">
                  Available Balance
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-1.5">
                <span className="text-3xl font-black tracking-tight">
                  ₹{isAuthenticated ? balance.toFixed(2) : '0.00'}
                </span>
                <span className="text-xs text-amber-100 font-medium">Credits</span>
              </div>
              <p className="text-[11px] text-amber-100/80 mt-1">
                1 Credit = ₹1.00 • Usable exclusively at {store?.name || 'this store'}
              </p>
            </div>

            {/* Background Watermark Icon */}
            <div className="absolute -right-3 -bottom-5 text-white/15 pointer-events-none select-none">
              <Coins01Icon size={95} />
            </div>
          </div>

          {/* If Not Authenticated: Prompt to Log In */}
          {!isAuthenticated && (
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20 p-4 text-center space-y-3">
              <div className="flex items-center justify-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold text-sm">
                <GiftIcon size={18} />
                <span>Instant ₹{settings.welcomeBonusCredits || 50} Welcome Bonus!</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Log in with your Google account to unlock your store wallet and claim free credits to spend right now.
              </p>

              <div className="flex justify-center pt-1 min-h-[44px] items-center">
                {authLoading ? (
                  <div className="flex items-center justify-center gap-2.5 py-2.5 px-5 rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs font-semibold border border-amber-500/20 animate-pulse">
                    <Loading03Icon className="animate-spin text-amber-600 dark:text-amber-400" size={16} />
                    <span>Signing in with Google...</span>
                  </div>
                ) : (
                  <GoogleLogin
                    onSuccess={(res) => {
                      if (onGoogleSuccess) onGoogleSuccess(res);
                    }}
                    onError={() => alert('Google sign-in failed. Please try again.')}
                    theme="outline"
                    shape="pill"
                    text="continue_with"
                  />
                )}
              </div>
            </div>
          )}

          {/* Perks & Rules Overview */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Wallet Rewards Rules
            </h4>
            
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 text-xs">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                  <GiftIcon size={16} />
                </div>
                <div>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    Welcome Gift: ₹{settings.welcomeBonusCredits || 50} Credits
                  </span>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Granted automatically upon first signing in to this store.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 text-xs">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                  <Coins01Icon size={16} />
                </div>
                <div>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    {settings.cashbackPercentage || 5}% Cashback on Every Order
                  </span>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Earned automatically on orders above ₹{settings.minOrderToEarn || 100} once bill is settled.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 text-xs">
                <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
                  <Tag01Icon size={16} />
                </div>
                <div>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    Direct Checkout Discount
                  </span>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Redeem up to {settings.maxRedemptionPercent || 50}% of cart subtotal on orders of ₹{settings.minOrderToRedeem || 200}+.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Ledger (if authenticated) */}
          {isAuthenticated && (
            <div className="space-y-2.5 pt-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Recent Wallet Activity
              </h4>

              {transactions.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400">
                  No credit transactions yet. Place an order to start earning cashback!
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => {
                    const info = getTransactionInfo(tx.type);
                    return (
                      <div 
                        key={tx.id} 
                        className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-800/30 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0">
                            {info.icon}
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-800 dark:text-zinc-200 leading-tight">
                              {info.label}
                            </p>
                            <p className="text-[10px] text-zinc-400">
                              {new Date(tx.createdAt).toLocaleDateString(undefined, { 
                                month: 'short', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`font-bold ${info.isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-purple-600 dark:text-purple-400'}`}>
                            {info.isCredit ? '+' : '-'}₹{Number(tx.amount).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-sm text-white shadow-md transition active:scale-95"
            style={{ backgroundColor: brandColor }}
          >
            Got It
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
