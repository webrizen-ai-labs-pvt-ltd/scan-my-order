import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { getSessionId } from '../lib/session';
import { computePromoDiscount, computeOrderTotals } from '@smo/shared/pricing';
import { checkIndianMobile } from '@smo/shared/phone';
import { useCartStore } from '../store/cart-store';
import { useAuthStore } from '../store/authStore';
import { GoogleLogin } from '@react-oauth/google';
import { Skeleton, Button, Input, AnimatedThemeToggler, Sheet, SheetContent, SheetTitle } from '@smo/ui';
import { UserProfile } from '../components/user-profile';
import { LiveOrders } from '../components/live-orders';
import {
  ShoppingCart01Icon,
  PlusSignIcon,
  MinusSignIcon,
  Store01Icon,
  Cancel01Icon,
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  CreditCardIcon,
  UserGroupIcon,
  Search01Icon,
  ArrowRight01Icon,
  Tag01Icon,
  HotelBellIcon,
  Coins01Icon,
  GiftIcon,
  Loading03Icon,
  ArrowLeft01Icon,
  SmartPhone01Icon,
  PlayIcon,
} from 'hugeicons-react';
import { CallWaiterModal } from '../components/call-waiter-modal';
import { WaiterFab } from '../components/waiter-fab';
import { useWaiterCall } from '../hooks/use-waiter-call';
import { CustomerWalletModal } from '../components/customer-wallet-modal';
import { ItemVideoSheet } from '../components/item-video-sheet';
import { UpiPaySheet } from '../components/upi-pay-sheet';

// ─── Dietary Badge (FSSAI-style, refined) ────────────────────────────────────
const DietaryBadge = ({ type, size = 'sm' }) => {
  const isVeg = type === 'VEG' || type === 'VEGAN';
  const isEgg = type === 'EGG';

  const borderColor = isVeg ? 'border-emerald-600' : isEgg ? 'border-amber-500' : 'border-rose-600';
  const dotColor = isVeg ? 'bg-emerald-600' : isEgg ? 'bg-amber-500' : 'bg-rose-600';
  const dim = size === 'lg' ? 'w-[18px] h-[18px]' : 'w-4 h-4';
  const dotDim = size === 'lg' ? 'w-2.5 h-2.5' : 'w-2 h-2';

  return (
    <span
      className={`${dim} border-[1.5px] ${borderColor} rounded-[3px] flex items-center justify-center shrink-0`}
      title={type}
      aria-label={type}
    >
      <span className={`${dotDim} ${dotColor} ${isEgg ? 'rounded-[2px]' : 'rounded-full'}`} />
    </span>
  );
};



// ─── Quantity Stepper ────────────────────────────────────────────────────────
const QuantityStepper = ({ quantity, onDecrease, onIncrease, brandColor }) => (
  <div
    className="inline-flex items-center gap-0 rounded-lg border overflow-hidden shadow-sm bg-white"
    style={{ borderColor: brandColor }}
  >
    <button
      onClick={onDecrease}
      className="flex h-8 w-8 items-center justify-center transition active:scale-90 hover:bg-zinc-50 dark:hover:bg-zinc-200"
      style={{ color: brandColor }}
      aria-label="Decrease quantity"
    >
      <MinusSignIcon size={14} strokeWidth={2.5} />
    </button>
    <span
      className="flex h-8 w-7 items-center justify-center text-sm font-bold"
      style={{ color: brandColor }}
    >
      {quantity}
    </span>
    <button
      onClick={onIncrease}
      className="flex h-8 w-8 items-center justify-center transition active:scale-90 hover:bg-zinc-50 dark:hover:bg-zinc-200"
      style={{ color: brandColor }}
      aria-label="Increase quantity"
    >
      <PlusSignIcon size={14} strokeWidth={2.5} />
    </button>
  </div>
);

// ─── Menu Item Card (Zomato-style) ───────────────────────────────────────────
const MenuItemCard = ({ item, cartItem, onAdd, onUpdateQuantity, onPlayVideo, brandColor }) => {
  const hasImage = !!item.image;
  const hasVideo = !!item.videoUrl;

  return (
    <article className="relative flex gap-3 bg-white p-4 transition dark:bg-zinc-900">
      {/* Left: Info */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-1 flex items-center gap-2">
          <DietaryBadge type={item.dietary || 'VEG'} size="lg" />
          {item.isBestseller && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-600 dark:text-amber-400">
              ★ BESTSELLER
            </span>
          )}
        </div>
        <h3 className="text-[15px] font-bold leading-snug text-zinc-900 dark:text-zinc-50">
          {item.name}
        </h3>
        <p className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-100">
          ₹{item.price}
        </p>
        {item.description && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-400 dark:text-zinc-500">
            {item.description}
          </p>
        )}
        {/* No photo to tap: offer the video here */}
        {hasVideo && !hasImage && (
          <button
            type="button"
            onClick={() => onPlayVideo(item)}
            className="mt-2 inline-flex items-center gap-1 self-start text-xs font-bold"
            style={{ color: brandColor }}
          >
            <PlayIcon size={14} /> Watch video
          </button>
        )}

        {/* ADD button (no image variant) */}
        {!hasImage && (
          <div className="mt-3">
            {cartItem ? (
              <QuantityStepper
                quantity={cartItem.quantity}
                onDecrease={() => onUpdateQuantity(item.id, -1)}
                onIncrease={() => onUpdateQuantity(item.id, 1)}
                brandColor={brandColor}
              />
            ) : (
              <button
                onClick={() => onAdd(item)}
                className="rounded-lg border px-5 py-[7px] text-sm font-bold uppercase tracking-wide shadow-sm transition-all duration-150 active:scale-95"
                style={{
                  color: brandColor,
                  borderColor: brandColor,
                  backgroundColor: `${brandColor}08`,
                }}
              >
                ADD
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right: Image + overlapping ADD */}
      {hasImage && (
        <div className="relative flex flex-col items-center shrink-0">
          {hasVideo ? (
            // Tap the photo to watch the dish (the video loads only then)
            <button
              type="button"
              onClick={() => onPlayVideo(item)}
              aria-label={`Watch a video of ${item.name}`}
              className="relative h-[104px] w-[104px] overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800 sm:h-[118px] sm:w-[118px]"
            >
              <img src={item.image} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
              <span className="absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
                <PlayIcon size={14} />
              </span>
            </button>
          ) : (
            <div className="h-[104px] w-[104px] overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50 shadow-sm dark:border-zinc-800 dark:bg-zinc-800 sm:h-[118px] sm:w-[118px]">
              <img
                src={item.image}
                alt={item.name}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          )}
          {/* Overlapping ADD button on image */}
          <div className="absolute -bottom-3 z-10">
            {cartItem ? (
              <QuantityStepper
                quantity={cartItem.quantity}
                onDecrease={() => onUpdateQuantity(item.id, -1)}
                onIncrease={() => onUpdateQuantity(item.id, 1)}
                brandColor={brandColor}
              />
            ) : (
              <button
                onClick={() => onAdd(item)}
                className="rounded-lg border-[1.5px] bg-white px-6 py-[6px] text-sm font-extrabold uppercase tracking-wide shadow-md transition-all duration-150 active:scale-95 dark:bg-zinc-900"
                style={{
                  color: brandColor,
                  borderColor: brandColor,
                }}
              >
                ADD
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
};


// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export const StoreMenuPage = () => {
  const { brandSlug, storeSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tableParam = searchParams.get('table');

  const [store, setStore] = useState(null);
  // Counter stores (malls, food courts): takeaway, paid on the phone, pickup number, no table or waiter
  const isCounter = store?.serviceMode === 'COUNTER';
  const tableNumber = isCounter ? null : tableParam;

  // Counter guests leave a mobile number instead of logging in (remembered on this phone)
  const savedGuest = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('smo_guest_contact') || '{}'); } catch { return {}; }
  }, []);
  const [guestPhone, setGuestPhone] = useState(savedGuest.phone || '');
  const [guestName, setGuestName] = useState(savedGuest.name || '');
  const [phoneError, setPhoneError] = useState('');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);

  const [activeCategory, setActiveCategory] = useState('');
  const [toast, setToast] = useState(null);

  // Promo Code State
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [showPromoSection, setShowPromoSection] = useState(false);

  // Cart Store
  const { items, setStoreId, addItem, updateQuantity, getTotalPrice, getTotalItems, clearCart } = useCartStore();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [videoItem, setVideoItem] = useState(null); // dish whose video sheet is open
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [paymentModel, setPaymentModel] = useState('POSTPAID');
  const payModel = store?.serviceMode === 'COUNTER' ? 'PREPAID' : paymentModel;

  // Ways to pay upfront here: online (Razorpay), else UPI to the store's own ID (a cashier confirms),
  // plus "pay at counter" where a counter store allows it
  const payOptions = store?.paymentOptions || { online: Boolean(store?.razorpayConfigured), upi: false, payAtCounter: false };
  const prepaidMethods = [
    ...(payOptions.online ? ['ONLINE'] : payOptions.upi ? ['UPI'] : []),
    ...(store?.serviceMode === 'COUNTER' && payOptions.payAtCounter ? ['COUNTER'] : []),
  ];
  const [payWithChoice, setPayWith] = useState(null);
  const payWith = prepaidMethods.includes(payWithChoice) ? payWithChoice : prepaidMethods[0] || null;
  const [upiSheet, setUpiSheet] = useState(null); // the UPI payment to make, after placing an order
  const [ordersVersion, setOrdersVersion] = useState(0); // tells Live Orders to reload
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Table Session / PIN State
  const [tableSessionInfo, setTableSessionInfo] = useState(null);
  const [activeTablePin, setActiveTablePin] = useState('');
  const [activeTableToken, setActiveTableToken] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [sessionPinBanner, setSessionPinBanner] = useState('');

  // Call Waiter Modal State
  const [showCallWaiter, setShowCallWaiter] = useState(false);

  // Store Loyalty & Wallet State
  const [walletData, setWalletData] = useState(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [useWalletCredits, setUseWalletCredits] = useState(false);
  const [isGoogleAuthLoading, setIsGoogleAuthLoading] = useState(false);

  // Scroll state for compact header
  const [isScrolled, setIsScrolled] = useState(false);

  const { token, setAuth } = useAuthStore();

  const categoryRefs = useRef({});
  const categoryNavRef = useRef(null);
  const searchInputRef = useRef(null);

  const resolvedTable = useMemo(() => {
    if (!store?.tables || !tableNumber) return null;
    const num = parseInt(tableNumber, 10);
    return store.tables.find(t => t.tableNumber === num) || null;
  }, [store?.tables, tableNumber]);

  // Waiter call for this table (shared by the corner waiter, the header bell and the call sheet)
  const waiterCall = useWaiterCall({ storeId: store?.id, tableNumber, tableId: resolvedTable?.id, watching: showCallWaiter });
  const isCallActive = Boolean(waiterCall.activeCall);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getErrorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
    const apiError = err?.response?.data?.error;
    let msg = apiError?.message || err?.response?.data?.message || err?.message || fallback;
    if (apiError?.details && typeof apiError.details === 'object') {
      if (Array.isArray(apiError.details) && apiError.details.length > 0) {
        const detailsStr = apiError.details.map((d) => d.message || d).join(', ');
        if (detailsStr) msg = `${msg} (${detailsStr})`;
      } else if (typeof apiError.details.message === 'string') {
        msg = `${msg} (${apiError.details.message})`;
      }
    }
    return msg;
  };

  const fetchWalletData = useCallback(async (currentStoreId) => {
    const sId = currentStoreId || store?.id;
    if (!sId) return;
    try {
      const res = await api.get(`/public/stores/${sId}/wallet/me`);
      if (res.data.success) {
        setWalletData(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load store wallet:', err);
    }
  }, [store?.id]);

  useEffect(() => {
    if (store?.id) {
      fetchWalletData(store.id);
    }
  }, [store?.id, token, fetchWalletData]);

  const fetchMenuData = async () => {
    setLoading(true);
    setError('');
    try {
      const storeRes = await api.get(`/public/resolve/${brandSlug}/${storeSlug}`);
      const resolvedStore = storeRes.data.data;

      if (tableNumber && resolvedStore.serviceMode !== 'COUNTER') {
        const tableNumInt = parseInt(tableNumber, 10);
        const isValidTable = resolvedStore.tables?.some(t => t.tableNumber === tableNumInt);
        if (!isValidTable) {
          showToast(`Table ${tableNumber} is invalid or inactive. Removing from session.`, 'error');
          searchParams.delete('table');
          setSearchParams(searchParams);
        } else {
          try {
            const savedPin = localStorage.getItem(`smo_table_pin_${resolvedStore.id}_${tableNumInt}`);
            const savedToken = localStorage.getItem(`smo_table_token_${resolvedStore.id}_${tableNumInt}`);

            const sessRes = await api.get(`/public/stores/${resolvedStore.id}/tables/${tableNumInt}/session`, {
              params: {
                clientToken: savedToken || undefined,
                clientPin: savedPin || undefined,
              }
            });
            if (sessRes.data.success) {
              const sessionData = sessRes.data.data;
              setTableSessionInfo(sessionData);

              if (sessionData.hasActiveSession) {
                if (sessionData.isJoined) {
                  if (savedPin) {
                    setActiveTablePin(savedPin);
                    setSessionPinBanner(savedPin);
                  }
                  if (savedToken) {
                    setActiveTableToken(savedToken);
                  }
                } else {
                  // Active session exists but this browser is not joined
                  localStorage.removeItem(`smo_table_pin_${resolvedStore.id}_${tableNumInt}`);
                  localStorage.removeItem(`smo_table_token_${resolvedStore.id}_${tableNumInt}`);
                  setActiveTablePin('');
                  setActiveTableToken('');
                  setSessionPinBanner('');
                }
              } else {
                // No active session on table (fresh table or settled)
                localStorage.removeItem(`smo_table_pin_${resolvedStore.id}_${tableNumInt}`);
                localStorage.removeItem(`smo_table_token_${resolvedStore.id}_${tableNumInt}`);
                localStorage.removeItem(`smo_table_session_${resolvedStore.id}_${tableNumInt}`);
                setActiveTablePin('');
                setActiveTableToken('');
                setSessionPinBanner('');
              }
            }
          } catch (e) {
            console.warn('Failed to verify table session:', e);
          }
        }
      }

      setStore(resolvedStore);
      setStoreId(resolvedStore.id);
      fetchWalletData(resolvedStore.id);

      const menuRes = await api.get(`/public/stores/${resolvedStore.id}/menu`);
      const menuCategories = menuRes.data.data || [];
      setCategories(menuCategories);
      if (menuCategories.length > 0) {
        setActiveCategory(menuCategories[0].id);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load menu. Please check your connection.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuData();
  }, [brandSlug, storeSlug]);

  // Scroll listener for compact header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ScrollSpy with IntersectionObserver
  useEffect(() => {
    if (loading || categories.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) {
          const catId = visible.target.getAttribute('data-category-id');
          if (catId) setActiveCategory(catId);
        }
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );

    Object.values(categoryRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [loading, categories]);

  // Auto-scroll active category chip into view
  useEffect(() => {
    if (!categoryNavRef.current || !activeCategory) return;
    const activeChip = categoryNavRef.current.querySelector(`[data-cat-chip="${activeCategory}"]`);
    if (activeChip) {
      activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeCategory]);

  const scrollToCategory = (id) => {
    setActiveCategory(id);
    const target = categoryRefs.current[id];
    if (target) {
      const yOffset = -160;
      const y = target.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // Filtered categories (search + dietary filter)
  const filteredCategories = useMemo(() => {
    let cats = categories;

    // Apply veg-only filter
    if (vegOnly) {
      cats = cats
        .map((cat) => ({
          ...cat,
          items: cat.items.filter((item) => {
            const d = item.dietary || 'VEG';
            return d === 'VEG' || d === 'VEGAN';
          }),
        }))
        .filter((cat) => cat.items.length > 0);
    }

    // Apply search query
    if (searchQuery.trim()) {
      cats = cats
        .map((cat) => ({
          ...cat,
          items: cat.items.filter((item) =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter((cat) => cat.items.length > 0);
    }

    return cats;
  }, [categories, searchQuery, vegOnly]);

  const submitOrder = async (overridePin, overrideToken) => {
    setIsPlacingOrder(true);
    const pinToUse = overridePin || activeTablePin || undefined;
    const tokenToUse = overrideToken || activeTableToken || undefined;
    try {
      const payload = {
        tableNumber: isCounter ? undefined : parseInt(tableNumber, 10),
        paymentModel: payModel,
        type: isCounter ? 'TAKEAWAY' : 'DINE_IN',
        ...(isCounter ? { customerPhone: guestPhone, customerName: guestName.trim() || undefined } : {}),
        payWith: payModel === 'PREPAID' ? payWith : undefined,
        promoCode: appliedPromo?.code || undefined,
        applyWalletCredits: useWalletCredits && appliedWalletCredits > 0,
        walletCredits: appliedWalletCredits,
        items: items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          kitchenNotes: '',
        })),
        sessionId: getSessionId(),
        sessionToken: tokenToUse,
        pin: pinToUse
      };

      const res = await api.post(`/public/stores/${store.id}/orders`, payload);
      const { paymentIntent, upiPayment, tableSessionId, sessionPin, sessionToken } = res.data.data;

      if (sessionPin || sessionToken) {
        if (sessionPin) {
          setActiveTablePin(sessionPin);
          localStorage.setItem(`smo_table_pin_${store.id}_${tableNumber}`, sessionPin);
          setSessionPinBanner(sessionPin);
        }
        if (sessionToken) {
          setActiveTableToken(sessionToken);
          localStorage.setItem(`smo_table_token_${store.id}_${tableNumber}`, sessionToken);
        }
        if (tableSessionId) {
          localStorage.setItem(`smo_table_session_${store.id}_${tableNumber}`, tableSessionId);
        }
        setTableSessionInfo(prev => ({ ...prev, hasActiveSession: true, isJoined: true, tableSessionId }));
      }

      if (payModel === 'PREPAID' && res.data.data.order?.id) {
        const pKey = `smo_prepaid_orders_${store.id}_${tableNumber || 'counter'}`;
        const existingPaid = JSON.parse(localStorage.getItem(pKey) || '[]');
        localStorage.setItem(pKey, JSON.stringify([...existingPaid, res.data.data.order.id]));
      }

      const placed = res.data.data.order;
      if (upiPayment) {
        // Pay the store's own UPI ID now; a cashier confirms it
        clearCart();
        setIsCheckoutOpen(false);
        fetchWalletData();
        setOrdersVersion(v => v + 1);
        setUpiSheet({ ...upiPayment, orderId: placed.id, cooking: placed.status === 'PROCESSING' });
      } else if (payModel === 'PREPAID' && payWith === 'COUNTER') {
        clearCart();
        setIsCheckoutOpen(false);
        fetchWalletData();
        setOrdersVersion(v => v + 1);
        showToast(`Order placed! Pay ₹${placed.totalAmount} at the counter and show code SMO-${placed.id.slice(-6).toUpperCase()}.`, 'success');
      } else if (payModel === 'PREPAID' && paymentIntent) {
        const options = {
          key: paymentIntent.key || store.razorpayKeyId,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          name: store.tenant?.name,
          description: `Order at ${store.name}`,
          image: store.tenant?.logo,
          order_id: paymentIntent.id,
          handler: async (response) => {
            // The server checks Razorpay's signature/status; the order only goes to the kitchen once it's confirmed
            try {
              const verifyRes = await api.post(`/public/stores/${store.id}/orders/${res.data.data.order.id}/verify-payment`, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              if (verifyRes.data.data?.success) {
                showToast(isCounter ? 'Paid! Watch your pickup number below.' : 'Payment successful! Order sent to kitchen.', 'success');
              } else {
                showToast('Payment received — confirming with the bank. Your order will start shortly.', 'info');
              }
            } catch {
              showToast('Payment received — confirming with the bank. Your order will start shortly.', 'info');
            }
            clearCart();
            setIsCheckoutOpen(false);
            fetchWalletData();
          },
          prefill: isCounter
            ? { name: guestName.trim() || undefined, contact: checkIndianMobile(guestPhone).phone || undefined }
            : { name: `Table ${tableNumber}` },
          theme: { color: store.tenant?.brandColor || '#059669' },
        };
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', (resp) => {
          showToast(`Payment failed: ${resp.error.description}`, 'error');
        });
        rzp.open();
      } else {
        showToast('Order received! The kitchen is preparing your meal.', 'success');
        clearCart();
        setIsCheckoutOpen(false);
        fetchWalletData();
      }
    } catch (err) {
      const errorMsg = getErrorMessage(err, 'Order failed. Please call a waiter.');
      if (err.response?.status === 403 && (errorMsg.toLowerCase().includes('pin') || errorMsg.toLowerCase().includes('session'))) {
        setPinError(errorMsg);
        setShowPinModal(true);
      } else {
        showToast(errorMsg, 'error');
      }
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
    if (isCounter) {
      const checked = checkIndianMobile(guestPhone);
      if (checked.error) {
        setPhoneError(checked.error);
        return;
      }
      setPhoneError('');
      try { localStorage.setItem('smo_guest_contact', JSON.stringify({ phone: checked.phone, name: guestName.trim() })); } catch { /* private mode */ }
      if (!payWith) {
        showToast("This counter isn't taking orders on the menu yet. Please order at the counter.", 'error');
        return;
      }
      await submitOrder();
      return;
    }
    if (!tableNumber) {
      showToast('Scan a valid table QR code to place an order.', 'error');
      return;
    }

    if (payModel === 'PREPAID' && !token) {
      setShowAuthModal(true);
      return;
    }

    // If table has an active session and this device hasn't joined it, require PIN entry
    if (tableSessionInfo?.hasActiveSession && !tableSessionInfo?.isJoined && !activeTableToken && !activeTablePin) {
      setPinError('');
      setPinInput('');
      setShowPinModal(true);
      return;
    }

    await submitOrder();
  };

  const handleJoinSession = async () => {
    if (pinInput.length !== 4) return;
    setIsPlacingOrder(true);
    setPinError('');
    try {
      const res = await api.post(`/public/stores/${store.id}/tables/${tableNumber}/join-session`, {
        pin: pinInput
      });
      if (res.data.success) {
        const { sessionToken, sessionPin, tableSessionId } = res.data.data;
        setActiveTableToken(sessionToken);
        setActiveTablePin(sessionPin);
        localStorage.setItem(`smo_table_token_${store.id}_${tableNumber}`, sessionToken);
        localStorage.setItem(`smo_table_pin_${store.id}_${tableNumber}`, sessionPin);
        if (tableSessionId) {
          localStorage.setItem(`smo_table_session_${store.id}_${tableNumber}`, tableSessionId);
        }
        setSessionPinBanner(sessionPin);
        setTableSessionInfo(prev => ({ ...prev, hasActiveSession: true, isJoined: true, tableSessionId }));
        setShowPinModal(false);
        showToast(`Joined Table ${tableNumber} session!`, 'success');

        // If checkout is open and user was placing an order, submit it immediately
        if (items.length > 0 && isCheckoutOpen) {
          await submitOrder(sessionPin, sessionToken);
        }
      }
    } catch (err) {
      const errorMsg = getErrorMessage(err, 'Incorrect PIN for this table. Please check with companions.');
      setPinError(errorMsg);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setIsGoogleAuthLoading(true);
    try {
      const res = await api.post('/auth/google', {
        idToken: credentialResponse.credential,
        tenantSlug: store?.tenant?.slug
      });
      if (res.data.success) {
        const { token: newToken, user } = res.data.data;
        setAuth(newToken, user);
        setShowAuthModal(false);
        showToast('Authenticated successfully!', 'success');
        if (store?.id) {
          fetchWalletData(store.id);
        }
        await submitOrder();
      }
    } catch (err) {
      const errorMsg = getErrorMessage(err, 'Authentication failed. Please try again.');
      showToast(errorMsg, 'error');
    } finally {
      setIsGoogleAuthLoading(false);
    }
  };

  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim()) return;
    setValidatingPromo(true);
    try {
      const res = await api.post(`/public/stores/${store.id}/validate-promo`, { code: promoCodeInput.trim(), subTotal: getTotalPrice() });
      setAppliedPromo(res.data.data);
      showToast('Promo code applied successfully!', 'success');
    } catch (err) {
      setAppliedPromo(null);
      const errorMsg = getErrorMessage(err, 'Invalid promo code');
      showToast(errorMsg, 'error');
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCodeInput('');
  };

  const brandColorHex = store?.tenant?.brandColor || '#059669';

  // Bill Math
  const subTotal = getTotalPrice();
  const discountAmount = computePromoDiscount(subTotal, appliedPromo);

  // Wallet Redemption Math
  const loyaltyRules = walletData?.settings || walletData?.storeRules;
  const isLoyaltyEnabled = Boolean(loyaltyRules?.isEnabled);
  const customerBalance = Number(walletData?.wallet?.balance || 0);

  let appliedWalletCredits = 0;
  if (isLoyaltyEnabled && useWalletCredits && customerBalance > 0 && subTotal >= (loyaltyRules.minOrderToRedeem || 0)) {
    if (!appliedPromo || loyaltyRules.allowPromoStacking) {
      const maxAllowedPercent = loyaltyRules.maxRedemptionPercent || 50;
      const maxAllowedByCart = Math.floor(subTotal * (maxAllowedPercent / 100));
      const payableBeforeWallet = Math.max(0, subTotal - discountAmount);
      appliedWalletCredits = Math.min(Math.floor(customerBalance), maxAllowedByCart, payableBeforeWallet);
    }
  }

  // Same formula as the server: tax applies after promo and store-credit discounts
  const billTotals = computeOrderTotals({
    subTotal,
    promo: appliedPromo,
    walletDiscount: appliedWalletCredits,
    taxRules: store?.taxRules,
  });
  const finalTotal = billTotals.totalAmount;

  // ═════════════════════════════════════════════════════════════════════════
  // LOADING SKELETON
  // ═════════════════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col bg-white dark:bg-zinc-950">
        {/* Skeleton top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-3 w-20 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>

        {/* Skeleton banner */}
        <Skeleton className="h-36 w-full rounded-none" />

        {/* Skeleton search + veg toggle */}
        <div className="flex items-center gap-2.5 px-4 py-3">
          <Skeleton className="h-11 flex-1 rounded-xl" />
          <Skeleton className="h-11 w-16 shrink-0 rounded-xl" />
        </div>

        {/* Skeleton category nav */}
        <div className="flex gap-2 border-y border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
          ))}
        </div>

        {/* Skeleton items */}
        <div className="space-y-0">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i}>
              {i === 1 && (
                <div className="px-4 pt-5 pb-2">
                  <Skeleton className="h-5 w-32 rounded" />
                </div>
              )}
              <div className="flex gap-3 p-4">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-[18px] w-[18px] rounded-[3px]" />
                    <Skeleton className="h-4 w-3/4 rounded" />
                  </div>
                  <Skeleton className="h-4 w-16 rounded" />
                  <Skeleton className="h-3 w-full rounded" />
                  <Skeleton className="h-3 w-2/3 rounded" />
                </div>
                <Skeleton className="h-[104px] w-[104px] shrink-0 rounded-xl" />
              </div>
              <div className="mx-4 h-px bg-zinc-100 dark:bg-zinc-800/50" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ERROR STATE
  // ═════════════════════════════════════════════════════════════════════════
  if (error || !store) {
    return (
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col bg-white dark:bg-zinc-950">
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-950/40">
            <AlertCircleIcon size={40} />
          </div>
          <h2 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">Menu Unavailable</h2>
          <p className="mb-8 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{error}</p>
          <button
            onClick={fetchMenuData}
            className="rounded-xl bg-zinc-900 px-8 py-3 text-sm font-bold text-white shadow-lg transition-all active:scale-95 dark:bg-white dark:text-zinc-900"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <>
      <div className="relative mx-auto flex w-full max-w-md flex-col bg-white dark:bg-zinc-950">

        {/* ── Compact Top Bar ────────────────────────────────────────────── */}
        <header
          className={`sticky top-0 z-30 flex items-center justify-between border-b bg-white/95 px-4 py-2.5 backdrop-blur-xl transition-shadow duration-300 dark:bg-zinc-950/95 ${isScrolled ? 'border-zinc-200/80 shadow-sm dark:border-zinc-800' : 'border-transparent'
            }`}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            {store.tenant?.logo ? (
              <img
                src={store.tenant.logo}
                alt={store.tenant.name}
                className="h-9 w-9 shrink-0 rounded-full border border-zinc-200/80 bg-white object-contain p-0.5 dark:border-zinc-700"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200/80 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                <Store01Icon size={18} />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold leading-tight text-zinc-900 dark:text-white">
                {store.tenant?.name}
              </h1>
              <p className="truncate text-[11px] text-zinc-400 dark:text-zinc-500">{store.name}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {/* Table badge */}
            {tableNumber ? (
              tableSessionInfo?.hasActiveSession && !tableSessionInfo?.isJoined && !activeTableToken ? (
                <button
                  type="button"
                  onClick={() => { setPinError(''); setPinInput(''); setShowPinModal(true); }}
                  className="inline-flex h-7 items-center gap-1 rounded-l-full border border-amber-300 bg-amber-50 px-2.5 text-[11px] font-bold text-amber-800 transition hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                  title="Active session. Click to enter PIN"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                  T{tableNumber} • Enter PIN
                </button>
              ) : (
                <div className="inline-flex h-7 items-center gap-1 rounded-l-full border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  T{tableNumber}
                  {activeTablePin && (
                    <span className="ml-1 text-emerald-600/90 dark:text-emerald-400">• PIN {activeTablePin}</span>
                  )}
                </div>
              )
            ) : (
              <div className="inline-flex h-7 items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-medium text-amber-600 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                {isCounter ? 'Takeaway' : 'Browse'}
              </div>
            )}

            {/* Store Credit Wallet Pill */}
            {isLoyaltyEnabled && (
              <button
                type="button"
                onClick={() => setShowWalletModal(true)}
                title="Store Credit Wallet"
                className="inline-flex h-7 items-center gap-1.5 rounded-r-full border border-amber-300 bg-amber-100 px-2.5 text-[11px] font-semibold text-amber-900 transition-colors hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900"
              >
                {token && walletData?.wallet ? (
                  <Coins01Icon size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
                ) : (
                  <GiftIcon size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
                )}
                <span>
                  {token && walletData?.wallet
                    ? `₹${customerBalance.toFixed(0)}`
                    : `₹${loyaltyRules.welcomeBonusCredits || 50} Free`}
                </span>
              </button>
            )}

            {/* Call Waiter (header icon): shown while the corner waiter is tucked away behind the cart bar */}
            {tableNumber && (getTotalItems() > 0 || isCallActive) && (
              <button
                type="button"
                onClick={() => setShowCallWaiter(true)}
                className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-all ${isCallActive
                  ? 'bg-yellow-500 text-zinc-950 shadow-md ring-2 ring-yellow-500/40'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                  }`}
                title="Call a waiter"
              >
                <span className="text-sm">{isCallActive ? <HotelBellIcon size={16} /> : <HotelBellIcon size={16} />}</span>
                {isCallActive && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-yellow-400 ring-2 ring-white dark:ring-zinc-950 animate-ping" />
                )}
              </button>
            )}
            <AnimatedThemeToggler className="!size-8" />
            <UserProfile
              walletBalance={walletData?.wallet?.balance}
              onOpenWallet={() => setShowWalletModal(true)}
            />
          </div>
        </header>

        {/* ── Part of a mall / food court: back to every counter ───────── */}
        {store.venue?.isActive && (
          <Link
            to={`/v/${store.venue.slug}`}
            className="flex items-center gap-1.5 border-b border-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <ArrowLeft01Icon size={14} /> All counters at {store.venue.name}
          </Link>
        )}

        {/* ── Hero Banner (shorter, scrolls away) ────────────────────────── */}
        <div className="relative w-full overflow-hidden">
          <img
            src={store.banner || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80'}
            alt={store.tenant?.name || 'Store banner'}
            className="h-36 w-full object-cover sm:h-44"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent dark:from-zinc-950 dark:via-zinc-950/20" />

          {/* Session PIN Banner overlaid on bottom of hero */}
          {sessionPinBanner ? (
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl border border-indigo-300/60 bg-indigo-50/95 px-3 py-2 text-xs text-indigo-900 shadow-lg backdrop-blur-md dark:border-indigo-800/60 dark:bg-indigo-950/90 dark:text-indigo-200">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                  <UserGroupIcon size={16} />
                </div>
                <div>
                  <p className="font-bold">Table {tableNumber} PIN: {sessionPinBanner}</p>
                  <p className="text-[10px] opacity-75">Share with companions to add dishes</p>
                </div>
              </div>
              <button onClick={() => setSessionPinBanner('')} className="p-1 text-indigo-400 hover:text-indigo-600">
                <Cancel01Icon size={14} />
              </button>
            </div>
          ) : (tableSessionInfo?.hasActiveSession && !tableSessionInfo?.isJoined && !activeTableToken) ? (
            <div
              onClick={() => { setPinError(''); setPinInput(''); setShowPinModal(true); }}
              className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl border border-amber-300/70 bg-amber-50/95 px-3 py-2 text-xs text-amber-950 shadow-lg backdrop-blur-md cursor-pointer hover:bg-amber-100 transition dark:border-amber-800/70 dark:bg-amber-950/90 dark:text-amber-200"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-200/80 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                  <UserGroupIcon size={16} />
                </div>
                <div>
                  <p className="font-bold">Active Table {tableNumber} Session</p>
                  <p className="text-[10px] opacity-80">Tap to enter 4-digit PIN to join this table</p>
                </div>
              </div>
              <span className="rounded-md bg-amber-200/90 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-800/80 dark:text-amber-200">
                Enter PIN
              </span>
            </div>
          ) : null}
        </div>

        {/* ── Search + Dietary Filters ─────────────────────────────────── */}
        <div className="flex items-center gap-2.5 px-4 pb-2 pt-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search01Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search for dishes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-[37px] w-full rounded-none rounded-l-full border border-zinc-200 bg-zinc-50 pl-10 pr-10 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-all focus:border-zinc-300 focus:bg-white focus:shadow-sm focus:ring-1 focus:ring-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-700 dark:focus:bg-zinc-900 dark:focus:ring-zinc-800"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <Cancel01Icon size={15} />
              </button>
            )}
          </div>

          {/* Veg Toggle */}
          <Button
            onClick={() => setVegOnly((v) => !v)}
            className={` rounded-none rounded-r-full ${vegOnly
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
              : ''
              }`}
            title={vegOnly ? 'Showing veg only' : 'Show all items'}
          >
            <span className={`h-2.5 w-2.5 rounded-full border-[1.5px] ${vegOnly
              ? 'border-emerald-600 bg-emerald-600'
              : 'border-zinc-400 bg-transparent dark:border-zinc-500'
              }`} />
            Veg
          </Button>
        </div>

        {/* ── Sticky Category Navigation ──────────────────────────────── */}
        <nav
          ref={categoryNavRef}
          className="sticky top-[53px] z-20 flex gap-2 overflow-x-auto border-b border-t border-zinc-100 bg-white/95 px-4 py-2.5 no-scrollbar backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-950/95"
        >
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                data-cat-chip={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold tracking-wide transition-all duration-200 active:scale-95 ${isActive
                  ? 'text-white shadow-sm'
                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-400 dark:hover:bg-zinc-700/70'
                  }`}
                style={{ backgroundColor: isActive ? brandColorHex : undefined }}
              >
                {cat.name}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${isActive
                    ? 'bg-white/25 text-white'
                    : 'bg-zinc-200/80 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'
                    }`}
                >
                  {cat.items.length}
                </span>
              </button>
            );
          })}
        </nav>

        {/* ── Menu Items ──────────────────────────────────────────────── */}
        <main className="pb-36">
          {filteredCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-3xl dark:bg-zinc-800">
                🍽️
              </div>
              <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {searchQuery ? `No dishes match "${searchQuery}"` : 'No dishes available'}
              </p>
              <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
                {searchQuery
                  ? 'Try a different keyword or clear filters'
                  : vegOnly
                    ? 'No vegetarian items found'
                    : 'Check back later for updated menu'
                }
              </p>
              {(searchQuery || vegOnly) && (
                <button
                  onClick={() => { setSearchQuery(''); setVegOnly(false); }}
                  className="mt-4 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            filteredCategories.map((cat) => (
              <section
                key={cat.id}
                ref={(el) => (categoryRefs.current[cat.id] = el)}
                data-category-id={cat.id}
                className="scroll-mt-[160px]"
              >
                {/* Category Header */}
                <div className="flex items-baseline gap-2 px-4 pb-1 pt-6">
                  <h2 className="text-base font-extrabold text-zinc-900 dark:text-zinc-50">
                    {cat.name}
                  </h2>
                  <span className="text-xs font-medium text-zinc-400">
                    {cat.items.length} {cat.items.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
                <div className="mx-4 mb-2 h-[2px] rounded-full" style={{ backgroundColor: `${brandColorHex}20` }} />

                {/* Items */}
                <div>
                  {cat.items.map((item, idx) => {
                    const cartItem = items.find((i) => i.menuItemId === item.id);
                    return (
                      <React.Fragment key={item.id}>
                        <MenuItemCard
                          item={item}
                          cartItem={cartItem}
                          onAdd={addItem}
                          onUpdateQuantity={updateQuantity}
                          onPlayVideo={setVideoItem}
                          brandColor={brandColorHex}
                        />
                        {idx < cat.items.length - 1 && (
                          <div className="mx-4 h-px bg-zinc-100 dark:bg-zinc-800/40" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </main>

        {/* ── Toast Notification ──────────────────────────────────────── */}
        {toast && (
          <div className="fixed left-4 right-4 top-4 z-[60] mx-auto max-w-md animate-in fade-in slide-in-from-top-4 duration-200">
            <div
              className={`flex items-center gap-3 rounded-2xl border p-3.5 shadow-2xl backdrop-blur-xl ${toast.type === 'error'
                ? 'border-rose-500/30 bg-rose-600/95 text-white'
                : toast.type === 'success'
                  ? 'border-emerald-500/30 bg-emerald-600/95 text-white'
                  : 'border-zinc-700/50 bg-zinc-900/95 text-white'
                }`}
            >
              {toast.type === 'success' ? <CheckmarkCircle02Icon size={18} /> : <AlertCircleIcon size={18} />}
              <p className="flex-1 text-xs font-medium sm:text-sm">{toast.message}</p>
              <button onClick={() => setToast(null)} className="rounded-full p-1 hover:bg-white/20 transition">
                <Cancel01Icon size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── Waiter in the corner: tap to call; tucked away while the cart bar shows ── */}
        {tableNumber && (
          <WaiterFab
            hidden={getTotalItems() > 0 || showCallWaiter}
            activeCall={waiterCall.activeCall}
            tableNumber={tableNumber}
            accentColor={brandColorHex}
            onClick={() => setShowCallWaiter(true)}
          />
        )}

        {/* ── Sticky Cart Footer Bar ─────────────────────────────────── */}
        {getTotalItems() > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-md animate-in slide-in-from-bottom-5 duration-300">
            <div className="px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2 bg-gradient-to-t from-white via-white to-white/0 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-950/0">
              <button
                onClick={() => setIsCheckoutOpen(true)}
                style={{ backgroundColor: brandColorHex }}
                className="flex w-full items-center justify-between rounded-2xl p-3 px-4 text-white shadow-xl transition-transform duration-150 active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-sm font-bold">
                    {getTotalItems()}
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-medium uppercase tracking-widest text-white/70">Total</p>
                    <p className="text-base font-extrabold leading-none">₹{finalTotal}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-xl bg-white/20 px-3.5 py-2 text-sm font-bold">
                  View Cart <ArrowRight01Icon size={16} />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── Checkout Bottom Sheet ──────────────────────────────────── */}
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="flex max-h-[88vh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl animate-in slide-in-from-bottom-full duration-300 dark:bg-zinc-900">

              {/* Handle + Header */}
              <div className="relative flex items-center justify-between border-b border-zinc-100 px-4 pb-3 pt-4 dark:border-zinc-800">
                <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                <div className="mt-2">
                  <h2 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50">Your Order</h2>
                  {tableNumber && (
                    <p className="text-xs text-zinc-400">
                      Table {tableNumber} • {items.length} {items.length === 1 ? 'item' : 'items'}
                    </p>
                  )}
                  {isCounter && (
                    <p className="text-xs text-zinc-400">
                      Takeaway • {items.length} {items.length === 1 ? 'item' : 'items'} • collect at the counter
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setIsCheckoutOpen(false)}
                  className="mt-2 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                >
                  <Cancel01Icon size={16} />
                </button>
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {items.map((item) => (
                    <div key={item.menuItemId} className="flex items-center justify-between gap-2 py-3">
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <DietaryBadge type={item.dietary || 'VEG'} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">{item.name}</p>
                          <p className="text-xs text-zinc-400">₹{item.price} each</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <QuantityStepper
                          quantity={item.quantity}
                          onDecrease={() => updateQuantity(item.menuItemId, -1)}
                          onIncrease={() => updateQuantity(item.menuItemId, 1)}
                          brandColor={brandColorHex}
                        />
                        <span className="w-14 text-right text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          ₹{item.price * item.quantity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer: Promo + Bill + Pay + CTA */}
              <div className="space-y-3 border-t border-zinc-100 bg-zinc-50/80 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:border-zinc-800 dark:bg-zinc-900/80">

                {/* Store Credit Wallet Redemption Card */}
                {isLoyaltyEnabled && (
                  <div>
                    {!token ? (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            <GiftIcon size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                              Claim ₹{loyaltyRules.welcomeBonusCredits || 50} free credits
                            </p>
                            <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80">
                              Log in to apply credits and earn cashback on this order
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAuthModal(true)}
                          className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-600"
                        >
                          Log In
                        </button>
                      </div>
                    ) : (
                      (() => {
                        const minOrder = loyaltyRules.minOrderToRedeem || 0;
                        const canRedeem =
                          customerBalance > 0 &&
                          subTotal >= minOrder &&
                          (!appliedPromo || loyaltyRules.allowPromoStacking);

                        const redeemable = Math.min(
                          Math.floor(customerBalance),
                          Math.floor(subTotal * ((loyaltyRules.maxRedemptionPercent || 50) / 100)),
                        );

                        let status;
                        if (customerBalance <= 0) {
                          status = `You'll earn ${loyaltyRules.cashbackPercentage || 5}% cashback on this order`;
                        } else if (subTotal < minOrder) {
                          status = `Add ₹${minOrder - subTotal} more to redeem credits (min. ₹${minOrder})`;
                        } else if (appliedPromo && !loyaltyRules.allowPromoStacking) {
                          status = 'Credits cannot be combined with promo codes';
                        } else if (useWalletCredits) {
                          status = `Applying ₹${appliedWalletCredits} credits`;
                        } else {
                          status = `Redeem up to ₹${redeemable}`;
                        }

                        return (
                          <div
                            className={`rounded-xl border p-3 transition-colors ${
                              useWalletCredits && canRedeem
                                ? 'border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30'
                                : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                    useWalletCredits && canRedeem
                                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                                  }`}
                                >
                                  <Coins01Icon size={16} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                      Store Credit Wallet
                                    </span>
                                    <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                                      ₹{customerBalance.toFixed(2)}
                                    </span>
                                  </div>
                                  <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                                    {status}
                                  </p>
                                </div>
                              </div>

                              {canRedeem && (
                                <div className="flex items-center gap-2 shrink-0">
                                  {useWalletCredits ? (
                                    <button
                                      type="button"
                                      onClick={() => setUseWalletCredits(false)}
                                      className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 underline"
                                    >
                                      Don't use
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setUseWalletCredits(true)}
                                      className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-amber-600 transition"
                                    >
                                      Apply Credits
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={useWalletCredits}
                                    aria-label="Toggle store credits"
                                    onClick={() => setUseWalletCredits((v) => !v)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                                      useWalletCredits
                                        ? 'bg-amber-500'
                                        : 'bg-zinc-200 dark:bg-zinc-700'
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                        useWalletCredits ? 'translate-x-4' : 'translate-x-0.5'
                                      }`}
                                    />
                                  </button>
                                </div>
                              )}
                            </div>

                            {canRedeem && !useWalletCredits && (
                              <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-2 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400">
                                <span>Save ₹{customerBalance.toFixed(2)} balance for later</span>
                                <button
                                  type="button"
                                  onClick={() => setUseWalletCredits(true)}
                                  className="font-bold text-amber-600 dark:text-amber-400 hover:underline"
                                >
                                  Use ₹{redeemable} now →
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}
                {/* Promo Code (collapsible) */}
                <div>
                  {!appliedPromo ? (
                    <>
                      {!showPromoSection ? (
                        <button
                          onClick={() => setShowPromoSection(true)}
                          className="flex w-full items-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white px-3 py-2.5 text-xs font-medium text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
                        >
                          <Tag01Icon size={14} />
                          Apply promo code
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Enter code"
                            value={promoCodeInput}
                            autoFocus
                            onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                            className="h-10 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold uppercase focus:outline-none focus:ring-1 focus:ring-zinc-300 placeholder:normal-case placeholder:font-normal dark:border-zinc-700 dark:bg-zinc-800"
                          />
                          <button
                            onClick={handleApplyPromo}
                            disabled={validatingPromo || !promoCodeInput}
                            className="h-10 rounded-xl bg-zinc-900 px-5 text-xs font-bold text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
                          >
                            {validatingPromo ? '...' : 'Apply'}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/30">
                      <div className="flex items-center gap-2">
                        <CheckmarkCircle02Icon size={16} className="text-emerald-600" />
                        <div>
                          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{appliedPromo.code}</p>
                          <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/60">Saving ₹{discountAmount}</p>
                        </div>
                      </div>
                      <button onClick={handleRemovePromo} className="p-1 text-emerald-500 hover:text-emerald-700">
                        <Cancel01Icon size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Bill Summary */}
                <div className="space-y-1.5 rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                    <span>Subtotal</span>
                    <span>₹{subTotal}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between font-medium text-emerald-600 dark:text-emerald-400">
                      <span>Discount ({appliedPromo?.code})</span>
                      <span>-₹{discountAmount}</span>
                    </div>
                  )}
                  {appliedWalletCredits > 0 && (
                    <div className="flex justify-between items-center font-medium text-amber-600 dark:text-amber-400">
                      <span className="flex items-center gap-1.5">
                        <Coins01Icon size={14} className="text-amber-500 shrink-0" />
                        <span>Store Credits Used</span>
                        <button
                          type="button"
                          onClick={() => setUseWalletCredits(false)}
                          className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 transition"
                          title="Don't use credits on this order"
                        >
                          Don't use
                        </button>
                      </span>
                      <span>-₹{appliedWalletCredits}</span>
                    </div>
                  )}
                  {billTotals.taxBreakdown.map((tax, idx) => (
                    <div key={idx} className="flex justify-between text-zinc-500 dark:text-zinc-400">
                      <span>{tax.name} ({tax.rate}%)</span>
                      <span>₹{tax.amount}</span>
                    </div>
                  ))}
                  <div className="mt-1.5 flex justify-between border-t border-zinc-100 pt-2 text-base font-extrabold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
                    <span>Total</span>
                    <span>₹{finalTotal}</span>
                  </div>
                </div>

                {/* Counter: who to call when it's ready */}
                {isCounter && (
                  <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Your details</p>
                      <p className="text-[11px] text-zinc-500">You'll get a pickup number. We'll only use your number about this order.</p>
                    </div>
                    <label className={`flex items-center gap-2 rounded-xl border bg-zinc-50 px-3 dark:bg-zinc-950 ${phoneError ? 'border-rose-400' : 'border-zinc-200 focus-within:border-zinc-400 dark:border-zinc-700'}`}>
                      <SmartPhone01Icon size={16} className="shrink-0 text-zinc-400" />
                      <span className="text-sm text-zinc-500">+91</span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        placeholder="Mobile number"
                        aria-label="Mobile number"
                        aria-invalid={Boolean(phoneError)}
                        value={guestPhone}
                        onChange={(e) => { setGuestPhone(e.target.value); if (phoneError) setPhoneError(''); }}
                        className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
                      />
                    </label>
                    {phoneError && <p role="alert" className="text-xs font-medium text-rose-600">{phoneError}</p>}
                    <input
                      type="text"
                      autoComplete="name"
                      placeholder="Name (optional)"
                      aria-label="Your name"
                      maxLength={60}
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
                    />
                  </div>
                )}

                {/* Payment Mode Toggle */}
                {!isCounter && (
                <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
                  <button
                    type="button"
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition-all ${paymentModel === 'POSTPAID'
                      ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                      : 'text-zinc-500 hover:text-zinc-700'
                      }`}
                    onClick={() => setPaymentModel('POSTPAID')}
                  >
                    <UserGroupIcon size={14} /> Pay at Table
                  </button>
                  <button
                    type="button"
                    disabled={prepaidMethods.length === 0}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition-all ${prepaidMethods.length === 0
                      ? 'cursor-not-allowed text-zinc-300 dark:text-zinc-600'
                      : paymentModel === 'PREPAID'
                        ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                        : 'text-zinc-500 hover:text-zinc-700'
                      }`}
                    onClick={() => prepaidMethods.length > 0 && setPaymentModel('PREPAID')}
                  >
                    <CreditCardIcon size={14} /> {payWith === 'UPI' ? 'Pay by UPI' : 'Pay Online'}
                  </button>
                </div>
                )}

                {/* Counter: pay now, or order now and pay at the counter */}
                {isCounter && prepaidMethods.length > 1 && (
                  <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800" role="radiogroup" aria-label="How do you want to pay?">
                    {prepaidMethods.map(m => (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={payWith === m}
                        onClick={() => setPayWith(m)}
                        className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition-all ${payWith === m
                          ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                          : 'text-zinc-500 hover:text-zinc-700'}`}
                      >
                        {m === 'COUNTER' ? <><Store01Icon size={14} /> Pay at counter</> : <><CreditCardIcon size={14} /> {m === 'UPI' ? 'Pay by UPI' : 'Pay online'}</>}
                      </button>
                    ))}
                  </div>
                )}
                {payModel === 'PREPAID' && payWith === 'UPI' && (
                  <p className="text-center text-[11px] text-zinc-500">You'll pay {store.name} directly from your UPI app. The store confirms it.</p>
                )}

                {/* Place Order CTA */}
                <button
                  className="h-[52px] w-full rounded-xl text-base font-extrabold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{ backgroundColor: brandColorHex }}
                  onClick={handlePlaceOrder}
                  disabled={isPlacingOrder || items.length === 0 || (!isCounter && !tableNumber) || (isCounter && !payWith)}
                >
                  {isPlacingOrder
                    ? 'Placing your order...'
                    : isCounter && !payWith
                      ? 'Please order at the counter'
                      : !isCounter && !tableNumber
                        ? 'Scan Table QR to Order'
                        : payModel === 'PREPAID'
                          ? payWith === 'COUNTER'
                            ? `Place order · pay ₹${finalTotal} at counter`
                            : payWith === 'UPI' ? `Pay ₹${finalTotal} by UPI` : `Pay ₹${finalTotal} Now`
                          : 'Place Order'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Pay by UPI to the store (after placing the order) ────────── */}
        <UpiPaySheet
          key={upiSheet?.paymentId || 'none'}
          storeId={store.id}
          payment={upiSheet}
          cooking={upiSheet?.cooking}
          onClose={() => setUpiSheet(null)}
          onClaimed={() => setOrdersVersion(v => v + 1)}
        />

        {/* ── Dish video (loads only when opened) ───────────────────────── */}
        <ItemVideoSheet
          item={videoItem}
          onClose={() => setVideoItem(null)}
          onAdd={(item) => { addItem(item); showToast(`${item.name} added`, 'success'); }}
          inCart={Boolean(videoItem && items.some(i => i.menuItemId === videoItem.id))}
          brandColor={brandColorHex}
        />

        {/* ── Auth Sheet ─────────────────────────────────────────────── */}
        <Sheet open={showAuthModal} onOpenChange={(open) => {
          if (!open && !isGoogleAuthLoading) setShowAuthModal(false);
        }}>
          <SheetContent side="bottom" className="w-full sm:max-w-md mx-auto p-6 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-t-3xl shadow-2xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
              {isGoogleAuthLoading ? (
                <Loading03Icon className="animate-spin text-amber-600 dark:text-amber-400" size={26} />
              ) : (
                <CreditCardIcon size={26} />
              )}
            </div>
            <SheetTitle className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50">
              {isGoogleAuthLoading ? 'Authenticating...' : 'Quick Checkout'}
            </SheetTitle>
            <p className="mb-6 mt-1 text-sm text-zinc-400 dark:text-zinc-500">
              {isGoogleAuthLoading
                ? 'Please wait while we verify your Google account...'
                : 'Verify your identity to secure your pre-paid order and store wallet.'}
            </p>

            <div className="flex justify-center mb-4 min-h-[44px] items-center">
              {isGoogleAuthLoading ? (
                <div className="flex items-center justify-center gap-2.5 py-2.5 px-6 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold animate-pulse border border-zinc-200 dark:border-zinc-700">
                  <Loading03Icon className="animate-spin text-amber-600 dark:text-amber-400" size={16} />
                  <span>Signing in with Google...</span>
                </div>
              ) : (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => showToast('Google login failed', 'error')}
                  theme="outline"
                  shape="rectangular"
                  text="continue_with"
                />
              )}
            </div>

            {!isGoogleAuthLoading && (
              <button
                onClick={() => setShowAuthModal(false)}
                className="mt-2 text-sm font-medium text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                Cancel
              </button>
            )}
          </SheetContent>
        </Sheet>

        {/* ── PIN Entry Sheet ────────────────────────────────────────── */}
        <Sheet open={showPinModal} onOpenChange={(open) => { if (!open) { setShowPinModal(false); setPinError(''); } }}>
          <SheetContent side="bottom" className="w-full sm:max-w-md mx-auto p-6 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-t-3xl shadow-2xl text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
              <UserGroupIcon size={26} />
            </div>
            <SheetTitle className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50">Table {tableNumber} PIN</SheetTitle>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              An active session exists on this table. Enter the 4-digit PIN to join and order.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (pinInput.length === 4 && !isPlacingOrder) {
                  handleJoinSession();
                }
              }}
              className="my-5"
            >
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoFocus
                placeholder="• • • •"
                value={pinInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPinInput(val);
                  setPinError('');
                }}
                className="w-36 text-center text-2xl font-extrabold tracking-[0.5em] py-3 rounded-xl border border-zinc-200 bg-zinc-50 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              {pinError && (
                <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">{pinError}</p>
              )}

              <div className="flex gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setPinError('');
                  }}
                  className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pinInput.length !== 4 || isPlacingOrder}
                  className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-sm font-bold text-white shadow-md transition disabled:opacity-40 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 flex items-center justify-center gap-2"
                >
                  {isPlacingOrder && <Loading03Icon className="animate-spin" size={16} />}
                  <span>{isPlacingOrder ? 'Verifying...' : (items.length > 0 && isCheckoutOpen ? 'Verify & Place Order' : 'Join Table')}</span>
                </button>
              </div>
            </form>
            <p className="mt-2 text-[11px] text-zinc-400">
              Ask companions at your table or call a waiter for the 4-digit PIN.
            </p>
          </SheetContent>
        </Sheet>

        {/* ── Call Waiter Modal ───────────────────────────────────────── */}
        {tableNumber && (
          <CallWaiterModal
            open={showCallWaiter}
            onClose={() => setShowCallWaiter(false)}
            tableNumber={tableNumber}
            accentColor={brandColorHex}
            call={waiterCall}
          />
        )}

        {/* ── Live Orders ────────────────────────────────────────────── */}
        <LiveOrders
          storeId={store.id}
          tableNumber={tableNumber}
          refreshKey={ordersVersion}
          placement={getTotalItems() > 0 ? 'aboveCart' : tableNumber ? 'besideWaiter' : 'bottom'}
          activeSessionId={tableSessionInfo?.tableSessionId || localStorage.getItem(`smo_table_session_${store.id}_${tableNumber}`)}
        />

        {/* ── Store Credit Wallet Modal ───────────────────────────────── */}
        <CustomerWalletModal
          open={showWalletModal}
          onClose={() => setShowWalletModal(false)}
          walletData={walletData}
          store={store}
          brandColor={brandColorHex}
          authLoading={isGoogleAuthLoading}
          onGoogleSuccess={async (credentialResponse) => {
            setIsGoogleAuthLoading(true);
            try {
              const res = await api.post('/auth/google', {
                idToken: credentialResponse.credential,
                tenantSlug: store?.tenant?.slug
              });
              if (res.data.success) {
                const { token: newToken, user } = res.data.data;
                setAuth(newToken, user);
                showToast('Welcome! Your store wallet is now active.', 'success');
                if (store?.id) {
                  fetchWalletData(store.id);
                }
              }
            } catch (err) {
              const errorMsg = getErrorMessage(err, 'Google login failed');
              showToast(errorMsg, 'error');
            } finally {
              setIsGoogleAuthLoading(false);
            }
          }}
        />
      </div>
    </>
  );
};