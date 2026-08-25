import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { useCartStore } from '../store/cart-store';
import { Skeleton, Button } from '@smo/ui';
import { 
  ShoppingCart01Icon, 
  PlusSignIcon, 
  MinusSignIcon, 
  Store01Icon, 
  Cancel01Icon, 
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  CreditCardIcon,
  UserGroupIcon
} from 'hugeicons-react';

// Accessible FSSAI-style dietary badge
const DietaryBadge = ({ type }) => {
  const isVeg = type === 'VEG' || type === 'VEGAN';
  const isEgg = type === 'EGG';
  
  const borderColor = isVeg ? 'border-emerald-600' : isEgg ? 'border-amber-600' : 'border-rose-600';
  const dotColor = isVeg ? 'bg-emerald-600' : isEgg ? 'bg-amber-600' : 'bg-rose-600';

  return (
    <span 
      className={`w-4 h-4 border-2 ${borderColor} rounded flex items-center justify-center p-0.5 shrink-0`}
      title={type}
      aria-label={type}
    >
      <span className={`w-2 h-2 ${dotColor} ${isEgg ? 'rounded-xs' : 'rounded-full'}`} />
    </span>
  );
};

export const StoreMenuPage = () => {
  const { brandSlug, storeSlug } = useParams();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get('table');

  const [store, setStore] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [activeCategory, setActiveCategory] = useState('');
  const [toast, setToast] = useState(null);

  // Promo Code State
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [validatingPromo, setValidatingPromo] = useState(false);

  // Cart Store
  const { items, setStoreId, addItem, updateQuantity, getTotalPrice, getTotalItems, clearCart } = useCartStore();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [paymentModel, setPaymentModel] = useState('POSTPAID');

  const categoryRefs = useRef({});

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

  const scrollToCategory = (id) => {
    setActiveCategory(id);
    const target = categoryRefs.current[id];
    if (target) {
      const yOffset = -130; // Accounts for sticky nav and header offset
      const y = target.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    return categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [categories, searchQuery]);

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
    if (!tableNumber) {
      showToast('Scan a valid table QR code to place an order.', 'error');
      return;
    }

    setIsPlacingOrder(true);
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
      };

      const res = await api.post(`/public/stores/${store.id}/orders`, payload);
      const { paymentIntent } = res.data.data;

      if (paymentModel === 'PREPAID' && paymentIntent) {
        const options = {
          key: store.razorpayKeyId,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          name: store.tenant?.name,
          description: `Order at ${store.name}`,
          image: store.tenant?.logo,
          order_id: paymentIntent.id,
          handler: () => {
            showToast('Payment successful! Order sent to kitchen.', 'success');
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
      showToast(err.response?.data?.message || 'Order failed. Please call a waiter.', 'error');
    } finally {
      setIsPlacingOrder(false);
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

  // Math for Bill
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

  // Loading Skeleton State
  if (loading) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 space-y-4">
        <Skeleton className="h-44 w-full rounded-3xl" />
        <div className="flex gap-2 overflow-hidden py-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full shrink-0" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/4 rounded" />
                <Skeleton className="h-3 w-full rounded" />
              </div>
              <Skeleton className="h-24 w-24 rounded-xl shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error State
  if (error || !store) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center mb-4">
          <AlertCircleIcon size={32} />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Menu Unavailable</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">{error}</p>
        <button
          onClick={fetchMenuData}
          className="px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold rounded-xl text-sm transition-transform active:scale-95 shadow-md"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 relative pb-28 antialiased selection:bg-zinc-200">
      {/* Dynamic Toast Notification */}
      {toast && (
        <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`p-4 rounded-2xl shadow-xl border flex items-center gap-3 backdrop-blur-md ${
              toast.type === 'error'
                ? 'bg-rose-500/90 text-white border-rose-600'
                : toast.type === 'success'
                ? 'bg-emerald-600/90 text-white border-emerald-700'
                : 'bg-zinc-900/90 text-white border-zinc-800'
            }`}
          >
            {toast.type === 'success' ? <CheckmarkCircle02Icon size={20} /> : <AlertCircleIcon size={20} />}
            <p className="text-xs sm:text-sm font-medium flex-1">{toast.message}</p>
            <button onClick={() => setToast(null)} className="p-1 rounded-full hover:bg-white/20">
              <Cancel01Icon size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Hero Header */}
      <header className="relative bg-zinc-900 text-white overflow-hidden rounded-b-3xl shadow-md">
        <div
          className="h-44 bg-cover bg-center transition-transform duration-500"
          style={{ backgroundImage: `url(${store.banner || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80'})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
        </div>

        <div className="p-4 pt-0 -mt-12 relative flex items-end justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {store.tenant?.logo ? (
              <img
                src={store.tenant.logo}
                alt={store.tenant.name}
                className="w-16 h-16 rounded-2xl border-2 border-white/20 bg-white object-contain shadow-lg shrink-0 p-1"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl border-2 border-white/20 bg-zinc-800 flex items-center justify-center text-zinc-400 shadow-lg shrink-0">
                <Store01Icon size={28} />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate leading-tight tracking-tight">{store.tenant?.name}</h1>
              <p className="text-xs text-zinc-300 truncate">{store.name}</p>
            </div>
          </div>

          {tableNumber ? (
            <div className="bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 text-emerald-300 text-xs px-3 py-1.5 rounded-full font-medium shrink-0 flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Table {tableNumber}
            </div>
          ) : (
            <div className="bg-amber-500/20 backdrop-blur-md border border-amber-400/30 text-amber-300 text-[11px] px-2.5 py-1.5 rounded-full font-medium shrink-0">
              Browsing Menu
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search dishes, drinks, ingredients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-4 pr-10 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-sm text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
              >
                <Cancel01Icon size={16} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Categories Navigation (Sticky) */}
      <nav className="sticky top-0 z-20 bg-zinc-50/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 py-2.5 px-4 flex gap-2 overflow-x-auto no-scrollbar shadow-xs">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => scrollToCategory(cat.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all duration-150 active:scale-95 ${
                isActive
                  ? 'text-white shadow-sm'
                  : 'bg-zinc-200/70 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
              }`}
              style={{ backgroundColor: isActive ? brandColorHex : undefined }}
            >
              {cat.name}
            </button>
          );
        })}
      </nav>

      {/* Menu Categories */}
      <main className="p-4 space-y-8 mt-2">
        {filteredCategories.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 space-y-2">
            <p className="text-base font-medium">No dishes match "{searchQuery}"</p>
            <p className="text-xs">Try searching for a different keyword or category.</p>
          </div>
        ) : (
          filteredCategories.map((cat) => (
            <section
              key={cat.id}
              ref={(el) => (categoryRefs.current[cat.id] = el)}
              data-category-id={cat.id}
              className="scroll-mt-28"
            >
              <h2 className="text-lg font-bold mb-3 text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                {cat.name}
                <span className="text-xs font-normal text-zinc-400">({cat.items.length})</span>
              </h2>

              <div className="space-y-3">
                {cat.items.map((item) => {
                  const cartItem = items.find((i) => i.menuItemId === item.id);
                  return (
                    <article
                      key={item.id}
                      className="p-3.5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex gap-3.5 items-start justify-between transition hover:border-zinc-300 dark:hover:border-zinc-700"
                    >
                      <div className="flex-1 min-w-0 pr-1 flex flex-col justify-between self-stretch">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <DietaryBadge type={item.dietary || 'VEG'} />
                            <h3 className="font-semibold text-sm sm:text-base leading-snug text-zinc-900 dark:text-zinc-100 truncate">
                              {item.name}
                            </h3>
                          </div>
                          <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mb-1.5">
                            ₹{item.price}
                          </p>
                          {item.description && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                        </div>

                        {/* Quantity Controls / Add Button */}
                        <div className="mt-3">
                          {cartItem ? (
                            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 w-fit border border-zinc-200/60 dark:border-zinc-700/60">
                              <button
                                onClick={() => updateQuantity(item.id, -1)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 shadow-xs active:scale-90 transition"
                                aria-label="Decrease quantity"
                              >
                                <MinusSignIcon size={14} />
                              </button>
                              <span className="font-semibold text-xs w-5 text-center">
                                {cartItem.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.id, 1)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 shadow-xs active:scale-90 transition"
                                aria-label="Increase quantity"
                              >
                                <PlusSignIcon size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addItem(item)}
                              className="px-4 py-1.5 rounded-xl text-xs font-semibold tracking-wider uppercase border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 active:scale-95 transition shadow-xs"
                            >
                              Add
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Product Thumbnail */}
                      {item.image && (
                        <div className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800 relative">
                          <img
                            src={item.image}
                            alt={item.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>

      {/* Floating Bottom Cart Bar */}
      {getTotalItems() > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-40 animate-in slide-in-from-bottom-5 duration-200">
          <button
            onClick={() => setIsCheckoutOpen(true)}
            style={{ backgroundColor: brandColorHex }}
            className="w-full flex items-center justify-between p-3.5 px-4 rounded-2xl shadow-xl text-white active:scale-[0.98] transition-transform duration-150"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-bold text-sm">
                {getTotalItems()}
              </div>
              <div className="text-left">
                <p className="text-[11px] uppercase tracking-wider text-white/80 font-medium">Total Bill</p>
                <p className="text-base font-bold leading-none">₹{finalTotal}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 font-semibold text-sm bg-white/20 px-3.5 py-2 rounded-xl">
              View Cart <ShoppingCart01Icon size={18} />
            </div>
          </button>
        </div>
      )}

      {/* Checkout Drawer / Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl border-t border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-bottom-full duration-250">
            {/* Grab Bar Header */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center relative">
              <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full absolute top-2 left-1/2 -translate-x-1/2" />
              <div className="mt-1">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Review Your Order</h2>
                {tableNumber && <p className="text-xs text-zinc-500">Delivering to Table {tableNumber}</p>}
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-800 transition"
              >
                <Cancel01Icon size={18} />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {items.map((item) => (
                <div key={item.menuItemId} className="py-3 flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <DietaryBadge type={item.dietary || 'VEG'} />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate text-zinc-900 dark:text-zinc-100">{item.name}</p>
                      <p className="text-xs text-zinc-500">₹{item.price} each</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 border border-zinc-200/50 dark:border-zinc-700/50">
                      <button
                        onClick={() => updateQuantity(item.menuItemId, -1)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-white dark:bg-zinc-700 shadow-2xs active:scale-90"
                      >
                        <MinusSignIcon size={12} />
                      </button>
                      <span className="text-xs font-semibold w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.menuItemId, 1)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-white dark:bg-zinc-700 shadow-2xs active:scale-90"
                      >
                        <PlusSignIcon size={12} />
                      </button>
                    </div>
                    <span className="font-bold text-sm w-14 text-right">
                      ₹{item.price * item.quantity}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              
              {/* Promo Code Input */}
              <div>
                {!appliedPromo ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Got a Promo Code?"
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                      className="flex-1 h-10 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 uppercase placeholder:normal-case"
                    />
                    <button
                      onClick={handleApplyPromo}
                      disabled={validatingPromo || !promoCodeInput}
                      className="h-10 px-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-sm font-semibold disabled:opacity-50"
                    >
                      {validatingPromo ? 'Checking...' : 'Apply'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl px-3 py-2 text-sm">
                    <div>
                      <p className="font-bold text-emerald-700 dark:text-emerald-400">{appliedPromo.code}</p>
                      <p className="text-xs text-emerald-600/80 dark:text-emerald-500/80">Code applied successfully</p>
                    </div>
                    <button onClick={handleRemovePromo} className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 p-1">
                      <Cancel01Icon size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Bill Breakdown */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 space-y-2 text-sm">
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Subtotal</span>
                  <span>₹{subTotal}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Discount ({appliedPromo?.code})</span>
                    <span>-₹{discountAmount}</span>
                  </div>
                )}
                {store?.taxRules?.map((tax, idx) => (
                  <div key={idx} className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>{tax.name} ({tax.rate}%)</span>
                    <span>₹{Math.round(subTotal * (tax.rate / 100))}</span>
                  </div>
                ))}
                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2 mt-2 flex justify-between font-bold text-base text-zinc-900 dark:text-zinc-100">
                  <span>Total Amount</span>
                  <span>₹{finalTotal}</span>
                </div>
              </div>

              {/* Payment Type Selection */}
              <div className="grid grid-cols-2 gap-2 bg-zinc-200/60 dark:bg-zinc-800/60 rounded-xl p-1">
                <button
                  type="button"
                  className={`py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    paymentModel === 'POSTPAID'
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                  onClick={() => setPaymentModel('POSTPAID')}
                >
                  <UserGroupIcon size={16} /> Pay at Table
                </button>
                <button
                  type="button"
                  disabled={!store.razorpayConfigured}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    !store.razorpayConfigured
                      ? 'opacity-40 cursor-not-allowed text-zinc-400'
                      : paymentModel === 'PREPAID'
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                  onClick={() => store.razorpayConfigured && setPaymentModel('PREPAID')}
                >
                  <CreditCardIcon size={16} /> Pay Online
                </button>
              </div>

              {/* Submit CTA */}
              <Button
                className="w-full h-12 text-base font-bold rounded-xl text-white shadow-lg transition-transform active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: brandColorHex, border: 'none' }}
                onClick={handlePlaceOrder}
                disabled={isPlacingOrder || items.length === 0 || !tableNumber}
              >
                {isPlacingOrder
                  ? 'Placing your order...'
                  : !tableNumber
                  ? 'Scan Table QR to Order'
                  : paymentModel === 'PREPAID'
                  ? `Pay ₹${finalTotal} Now`
                  : 'Confirm & Place Order'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};