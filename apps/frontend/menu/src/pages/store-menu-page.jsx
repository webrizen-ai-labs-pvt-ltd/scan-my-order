import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { getSessionId } from '../lib/session';
import { useCartStore } from '../store/cart-store';
import { useAuthStore } from '../store/authStore';
import { GoogleLogin } from '@react-oauth/google';
import { Skeleton, Button, Input, AnimatedThemeToggler } from '@smo/ui';
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
} from 'hugeicons-react';
import { CallWaiterModal } from '../components/call-waiter-modal';

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
const MenuItemCard = ({ item, cartItem, onAdd, onUpdateQuantity, brandColor }) => {
  const hasImage = !!item.image;

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
          <div className="h-[104px] w-[104px] overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50 shadow-sm dark:border-zinc-800 dark:bg-zinc-800 sm:h-[118px] sm:w-[118px]">
            <img
              src={item.image}
              alt={item.name}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
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
  const tableNumber = searchParams.get('table');

  const [store, setStore] = useState(null);
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
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [paymentModel, setPaymentModel] = useState('POSTPAID');
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Table Session / PIN State
  const [tableSessionInfo, setTableSessionInfo] = useState(null);
  const [activeTablePin, setActiveTablePin] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [sessionPinBanner, setSessionPinBanner] = useState('');

  // Call Waiter Modal State
  const [showCallWaiter, setShowCallWaiter] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);

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

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchMenuData = async () => {
    setLoading(true);
    setError('');
    try {
      const storeRes = await api.get(`/public/resolve/${brandSlug}/${storeSlug}`);
      const resolvedStore = storeRes.data.data;

      if (tableNumber) {
        const tableNumInt = parseInt(tableNumber, 10);
        const isValidTable = resolvedStore.tables?.some(t => t.tableNumber === tableNumInt);
        if (!isValidTable) {
          showToast(`Table ${tableNumber} is invalid or inactive. Removing from session.`, 'error');
          searchParams.delete('table');
          setSearchParams(searchParams);
        } else {
          try {
            const sessRes = await api.get(`/public/stores/${resolvedStore.id}/tables/${tableNumInt}/session`);
            if (sessRes.data.success) {
              setTableSessionInfo(sessRes.data.data);
              const savedPin = localStorage.getItem(`smo_table_pin_${resolvedStore.id}_${tableNumInt}`);
              if (savedPin) {
                setActiveTablePin(savedPin);
              }
            }
          } catch (e) {}
        }
      }

      setStore(resolvedStore);
      setStoreId(resolvedStore.id);

      const menuRes = await api.get(`/public/stores/${resolvedStore.id}/menu`);
      const menuCategories = menuRes.data.data || [];
      setCategories(menuCategories);
      if (menuCategories.length > 0) {
        setActiveCategory(menuCategories[0].id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load menu. Please check your connection.');
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

  const submitOrder = async (overridePin) => {
    setIsPlacingOrder(true);
    const pinToUse = overridePin || activeTablePin || undefined;
    try {
      const payload = {
        tableNumber: parseInt(tableNumber, 10),
        paymentModel,
        type: 'DINE_IN',
        promoCode: appliedPromo?.code || undefined,
        items: items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          kitchenNotes: '',
        })),
        sessionId: getSessionId(),
        pin: pinToUse
      };

      const res = await api.post(`/public/stores/${store.id}/orders`, payload);
      const { paymentIntent, tableSessionId, sessionPin } = res.data.data;

      if (sessionPin) {
        setActiveTablePin(sessionPin);
        localStorage.setItem(`smo_table_pin_${store.id}_${tableNumber}`, sessionPin);
        if (tableSessionId) {
          localStorage.setItem(`smo_table_session_${store.id}_${tableNumber}`, tableSessionId);
        }
        setSessionPinBanner(sessionPin);
        setTableSessionInfo(prev => ({ ...prev, hasActiveSession: true, tableSessionId }));
      }

      if (paymentModel === 'PREPAID' && res.data.data.order?.id) {
        const pKey = `smo_prepaid_orders_${store.id}_${tableNumber}`;
        const existingPaid = JSON.parse(localStorage.getItem(pKey) || '[]');
        localStorage.setItem(pKey, JSON.stringify([...existingPaid, res.data.data.order.id]));
      }

      if (paymentModel === 'PREPAID' && paymentIntent) {
        const options = {
          key: store.razorpayKeyId,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          name: store.tenant?.name,
          description: `Order at ${store.name}`,
          image: store.tenant?.logo,
          order_id: paymentIntent.id,
          handler: async () => {
            try {
              await api.post(`/public/stores/${store.id}/orders/${paymentIntent.receipt}/verify-payment`);
              showToast('Payment successful! Order sent to kitchen.', 'success');
            } catch (err) {
              showToast('Payment verified, but there was a slight delay.', 'success');
            }
            clearCart();
            setIsCheckoutOpen(false);
          },
          prefill: { name: `Table ${tableNumber}` },
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
      }
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.message?.includes('Table PIN')) {
        setPinError(err.response?.data?.message || 'Invalid Table PIN');
        setShowPinModal(true);
      } else {
        showToast(err.response?.data?.message || 'Order failed. Please call a waiter.', 'error');
      }
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
    if (!tableNumber) {
      showToast('Scan a valid table QR code to place an order.', 'error');
      return;
    }

    if (paymentModel === 'PREPAID' && !token) {
      setShowAuthModal(true);
      return;
    }

    if (tableSessionInfo?.hasActiveSession && !activeTablePin) {
      setShowPinModal(true);
      return;
    }

    await submitOrder();
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const res = await api.post('/auth/google', {
        idToken: credentialResponse.credential,
        tenantSlug: store.tenant.slug
      });
      if (res.data.success) {
        const { token: newToken, user } = res.data.data;
        setAuth(newToken, user);
        setShowAuthModal(false);
        showToast('Authenticated successfully!', 'success');
        await submitOrder();
      }
    } catch (err) {
      showToast('Authentication failed. Please try again.', 'error');
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
      showToast(err.response?.data?.message || 'Invalid promo code', 'error');
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
  let discountAmount = 0;
  if (appliedPromo) {
    if (appliedPromo.discountType === 'PERCENTAGE') {
      discountAmount = Math.round(subTotal * (appliedPromo.discountValue / 100));
      if (appliedPromo.maxDiscount && discountAmount > appliedPromo.maxDiscount) {
        discountAmount = appliedPromo.maxDiscount;
      }
    } else {
      discountAmount = appliedPromo.discountValue;
    }
    if (discountAmount > subTotal) discountAmount = subTotal;
  }

  const taxAmount = store?.taxRules?.reduce((acc, tax) => {
    return acc + Math.round(subTotal * (tax.rate / 100));
  }, 0) || 0;

  const finalTotal = subTotal - discountAmount + taxAmount;

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
          className={`sticky top-0 z-30 flex items-center justify-between border-b bg-white/95 px-4 py-2.5 backdrop-blur-xl transition-shadow duration-300 dark:bg-zinc-950/95 ${
            isScrolled ? 'border-zinc-200/80 shadow-sm dark:border-zinc-800' : 'border-transparent'
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
              <div className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 pl-2 pr-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                T{tableNumber}
                {activeTablePin && (
                  <span className="ml-1 text-emerald-500/70 dark:text-emerald-600">• PIN {activeTablePin}</span>
                )}
              </div>
            ) : (
              <div className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                Browse
              </div>
            )}

            {/* Call Waiter (inline icon) */}
            {tableNumber && (
              <button
                type="button"
                onClick={() => setShowCallWaiter(true)}
                className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                  isCallActive
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
            <UserProfile />
          </div>
        </header>

        {/* ── Hero Banner (shorter, scrolls away) ────────────────────────── */}
        <div className="relative w-full overflow-hidden">
          <img
            src={store.banner || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80'}
            alt={store.tenant?.name || 'Store banner'}
            className="h-36 w-full object-cover sm:h-44"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent dark:from-zinc-950 dark:via-zinc-950/20" />

          {/* Session PIN Banner overlaid on bottom of hero */}
          {sessionPinBanner && (
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl border border-indigo-300/50 bg-indigo-50/95 px-3 py-2 text-xs text-indigo-900 shadow-lg backdrop-blur-md dark:border-indigo-800/50 dark:bg-indigo-950/90 dark:text-indigo-200">
              <div>
                <p className="font-bold">Table {tableNumber} PIN: {sessionPinBanner}</p>
                <p className="text-[10px] opacity-75">Share with companions to add dishes</p>
              </div>
              <button onClick={() => setSessionPinBanner('')} className="p-0.5 text-indigo-400 hover:text-indigo-600">
                <Cancel01Icon size={14} />
              </button>
            </div>
          )}
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
            className={` rounded-none rounded-r-full ${
              vegOnly
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                : ''
            }`}
            title={vegOnly ? 'Showing veg only' : 'Show all items'}
          >
            <span className={`h-2.5 w-2.5 rounded-full border-[1.5px] ${
              vegOnly
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
                className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold tracking-wide transition-all duration-200 active:scale-95 ${
                  isActive
                    ? 'text-white shadow-sm'
                    : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-400 dark:hover:bg-zinc-700/70'
                }`}
                style={{ backgroundColor: isActive ? brandColorHex : undefined }}
              >
                {cat.name}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                    isActive
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
              className={`flex items-center gap-3 rounded-2xl border p-3.5 shadow-2xl backdrop-blur-xl ${
                toast.type === 'error'
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
                  {store?.taxRules?.map((tax, idx) => (
                    <div key={idx} className="flex justify-between text-zinc-500 dark:text-zinc-400">
                      <span>{tax.name} ({tax.rate}%)</span>
                      <span>₹{Math.round(subTotal * (tax.rate / 100))}</span>
                    </div>
                  ))}
                  <div className="mt-1.5 flex justify-between border-t border-zinc-100 pt-2 text-base font-extrabold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
                    <span>Total</span>
                    <span>₹{finalTotal}</span>
                  </div>
                </div>

                {/* Payment Mode Toggle */}
                <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
                  <button
                    type="button"
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition-all ${
                      paymentModel === 'POSTPAID'
                        ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                        : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                    onClick={() => setPaymentModel('POSTPAID')}
                  >
                    <UserGroupIcon size={14} /> Pay at Table
                  </button>
                  <button
                    type="button"
                    disabled={!store.razorpayConfigured}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition-all ${
                      !store.razorpayConfigured
                        ? 'cursor-not-allowed text-zinc-300 dark:text-zinc-600'
                        : paymentModel === 'PREPAID'
                          ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                          : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                    onClick={() => store.razorpayConfigured && setPaymentModel('PREPAID')}
                  >
                    <CreditCardIcon size={14} /> Pay Online
                  </button>
                </div>

                {/* Place Order CTA */}
                <button
                  className="h-[52px] w-full rounded-xl text-base font-extrabold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{ backgroundColor: brandColorHex }}
                  onClick={handlePlaceOrder}
                  disabled={isPlacingOrder || items.length === 0 || !tableNumber}
                >
                  {isPlacingOrder
                    ? 'Placing your order...'
                    : !tableNumber
                      ? 'Scan Table QR to Order'
                      : paymentModel === 'PREPAID'
                        ? `Pay ₹${finalTotal} Now`
                        : 'Place Order'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Auth Modal ─────────────────────────────────────────────── */}
        {showAuthModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                <CreditCardIcon size={26} />
              </div>
              <h3 className="mb-1.5 text-xl font-extrabold text-zinc-900 dark:text-zinc-50">Quick Checkout</h3>
              <p className="mb-6 text-sm text-zinc-400 dark:text-zinc-500">
                Verify your identity to secure your pre-paid order.
              </p>

              <div className="flex justify-center mb-4">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => showToast('Google login failed', 'error')}
                  theme="outline"
                  shape="rectangular"
                  text="continue_with"
                />
              </div>

              <button
                onClick={() => setShowAuthModal(false)}
                className="mt-2 text-sm font-medium text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── PIN Entry Modal ────────────────────────────────────────── */}
        {showPinModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                <UserGroupIcon size={26} />
              </div>
              <h3 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50">Table {tableNumber} PIN</h3>
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                An active session exists. Enter the 4-digit PIN to add your dishes.
              </p>

              <div className="my-5">
                <input
                  type="text"
                  maxLength={4}
                  autoFocus
                  placeholder="• • • •"
                  value={pinInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setPinInput(val);
                    setPinError('');
                  }}
                  className="w-32 text-center text-2xl font-extrabold tracking-[0.5em] py-3 rounded-xl border border-zinc-200 bg-zinc-50 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                />
                {pinError && (
                  <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">{pinError}</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setPinError('');
                  }}
                  className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={pinInput.length !== 4 || isPlacingOrder}
                  onClick={async () => {
                    setActiveTablePin(pinInput);
                    localStorage.setItem(`smo_table_pin_${store.id}_${tableNumber}`, pinInput);
                    setShowPinModal(false);
                    await submitOrder(pinInput);
                  }}
                  className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-sm font-bold text-white shadow-md transition disabled:opacity-40 dark:bg-white dark:text-zinc-900"
                >
                  {isPlacingOrder ? 'Checking...' : 'Submit'}
                </button>
              </div>
              <p className="mt-4 text-[10px] text-zinc-400">
                Ask companions at the table or call a waiter for the PIN.
              </p>
            </div>
          </div>
        )}

        {/* ── Call Waiter Modal ───────────────────────────────────────── */}
        {tableNumber && (
          <CallWaiterModal
            open={showCallWaiter}
            onClose={() => setShowCallWaiter(false)}
            storeId={store.id}
            tableNumber={tableNumber}
            tableId={resolvedTable?.id}
            onCallActiveChange={setIsCallActive}
          />
        )}

        {/* ── Live Orders ────────────────────────────────────────────── */}
        <LiveOrders
          storeId={store.id}
          tableNumber={tableNumber}
          activeSessionId={tableSessionInfo?.tableSessionId || localStorage.getItem(`smo_table_session_${store.id}_${tableNumber}`)}
        />
      </div>
    </>
  );
};