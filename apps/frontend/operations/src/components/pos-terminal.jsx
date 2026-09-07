import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../lib/api';
import { Card, CardContent, Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Skeleton } from '@smo/ui';
import { 
  Add01Icon, 
  Remove01Icon, 
  ShoppingCart01Icon, 
  Tick02Icon, 
  Cancel01Icon, 
  QrCodeIcon, 
  Tag01Icon, 
  PrinterIcon, 
  Loading02Icon,
  Search01Icon,
  Delete02Icon,
  ChefHatIcon,
  Coins01Icon
} from 'hugeicons-react';
import { QRCodeSVG } from 'qrcode.react';
import { Receipt } from './receipt';

export const POSTerminal = ({ selectedStoreId, token }) => {
  const [menu, setMenu] = useState([]);
  const [tables, setTables] = useState([]);
  const [storeData, setStoreData] = useState(null);
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // UI State
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dietaryFilter, setDietaryFilter] = useState('ALL');

  // Cart State
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState('DINE_IN');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);

  // Modifier Modal State
  const [modifierItem, setModifierItem] = useState(null);
  const [selectedModifiers, setSelectedModifiers] = useState({});

  // Checkout State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [qrModal, setQrModal] = useState({ isOpen: false, url: '', orderId: '' });
  const [receiptOrder, setReceiptOrder] = useState(null);
  const receiptRef = useRef();
  
  const qrModalRef = useRef(qrModal);
  useEffect(() => {
    qrModalRef.current = qrModal;
  }, [qrModal]);

  useEffect(() => {
    if (!selectedStoreId) return;

    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [menuRes, tablesRes, storeRes, promosRes] = await Promise.all([
          api.get(`/stores/${selectedStoreId}/menu`),
          api.get(`/stores/${selectedStoreId}/tables`),
          api.get(`/stores/${selectedStoreId}`),
          api.get(`/stores/${selectedStoreId}/promos`)
        ]);

        if (menuRes.data.success) {
          setMenu(menuRes.data.data);
          if (menuRes.data.data.length > 0) {
            setSelectedCategoryId(menuRes.data.data[0].id);
          }
        }
        if (tablesRes.data.success) {
          setTables(tablesRes.data.data.filter(t => t.isActive));
        }
        if (storeRes.data.success) setStoreData(storeRes.data.data);
        if (promosRes.data.success) setPromos(promosRes.data.data);
      } catch (err) {
        setError('Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedStoreId]);

  useEffect(() => {
    if (!selectedStoreId || !token) return;
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    const eventSource = new EventSource(`${baseUrl}/stores/${selectedStoreId}/orders/stream?token=${token}`);
    
    eventSource.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        const currentModal = qrModalRef.current;
        if ((message.type === 'ORDER_PROCESSING' || message.type === 'ORDER_SETTLED') && currentModal.isOpen && message.data?.id === currentModal.orderId) {
          setQrModal({ isOpen: false, url: '', orderId: '' });
          resetOrderForm();
          
          const orderRes = await api.get(`/stores/${selectedStoreId}/orders/${currentModal.orderId}`);
          if (orderRes.data.success) {
            setReceiptOrder(orderRes.data.data);
          }
        }
      } catch(e) {}
    };
    return () => eventSource.close();
  }, [selectedStoreId, token]);

  const resetOrderForm = () => {
    setCart([]);
    setSelectedTableId('');
    setAppliedPromo(null);
    setPromoCodeInput('');
  };

  const applyPromo = () => {
    if (!promoCodeInput.trim()) return;
    const promo = promos.find(p => p.code === promoCodeInput.trim().toUpperCase() && p.isActive);
    if (!promo) {
      alert("Invalid or inactive promo code.");
      setAppliedPromo(null);
      return;
    }
    const tempSubTotal = cart.reduce((acc, c) => acc + ((c.menuItem.price + c.modifiers.reduce((sum, m) => sum + m.price, 0)) * c.quantity), 0);
    if (tempSubTotal < promo.minOrderValue) {
      alert(`Minimum order value for this promo is ₹${promo.minOrderValue}`);
      setAppliedPromo(null);
      return;
    }
    setAppliedPromo(promo);
  };

  const filteredItems = useMemo(() => {
    const category = menu.find(c => c.id === selectedCategoryId);
    let items = category ? category.items : [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(item => item.name.toLowerCase().includes(q));
    }

    if (dietaryFilter !== 'ALL') {
      items = items.filter(item => item.dietary === dietaryFilter);
    }

    return items;
  }, [menu, selectedCategoryId, searchQuery, dietaryFilter]);

  const initiateAddToCart = (item) => {
    if (item.isManuallyDisabled || item.isSystemDisabled) return;

    if (item.modifierGroups && item.modifierGroups.length > 0) {
      setModifierItem(item);
      setSelectedModifiers({});
    } else {
      finalizeAddToCart(item, []);
    }
  };

  const finalizeAddToCart = (item, modifiers) => {
    setCart(prev => {
      if (modifiers.length > 0) {
        return [...prev, { menuItem: item, quantity: 1, modifiers }];
      }

      const existing = prev.find(c => c.menuItem.id === item.id && c.modifiers.length === 0);
      if (existing) {
        return prev.map(c => (c === existing) ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { menuItem: item, quantity: 1, modifiers: [] }];
    });
    setModifierItem(null);
    setSelectedModifiers({});
  };

  const handleModifierToggle = (groupId, optionId, maxSelections) => {
    setSelectedModifiers(prev => {
      const current = prev[groupId] || [];
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter(id => id !== optionId) };
      }
      if (current.length >= maxSelections) {
        return prev;
      }
      return { ...prev, [groupId]: [...current, optionId] };
    });
  };

  const submitModifiers = () => {
    if (!modifierItem) return;

    for (const group of modifierItem.modifierGroups) {
      const selectedCount = (selectedModifiers[group.id] || []).length;
      if (group.isRequired && selectedCount < group.minSelections) {
        alert(`Please select at least ${group.minSelections} for ${group.name}`);
        return;
      }
    }

    const mods = [];
    modifierItem.modifierGroups.forEach(g => {
      const selected = selectedModifiers[g.id] || [];
      g.options.forEach(opt => {
        if (selected.includes(opt.id)) {
          mods.push(opt);
        }
      });
    });

    finalizeAddToCart(modifierItem, mods);
  };

  const updateQuantity = (cartIndex, delta) => {
    setCart(prev => prev.map((c, i) => {
      if (i === cartIndex) {
        const newQ = c.quantity + delta;
        return newQ > 0 ? { ...c, quantity: newQ } : null;
      }
      return c;
    }).filter(Boolean));
  };

  const removeCartLine = (cartIndex) => {
    setCart(prev => prev.filter((_, i) => i !== cartIndex));
  };

  const subTotal = cart.reduce((acc, c) => {
    const itemTotal = c.menuItem.price + c.modifiers.reduce((sum, m) => sum + m.price, 0);
    return acc + (itemTotal * c.quantity);
  }, 0);

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
  const subTotalAfterDiscount = subTotal - discountAmount;

  let taxAmount = 0;
  if (storeData?.taxRules && Array.isArray(storeData.taxRules)) {
    storeData.taxRules.forEach(tax => {
      taxAmount += Math.round(subTotal * (tax.rate / 100));
    });
  }
  const totalAmount = subTotalAfterDiscount + taxAmount;

  const handleCheckout = async (paymentModel, useQR = false) => {
    if (orderType === 'DINE_IN' && !selectedTableId) {
      alert("Please select a table for Dine-In orders.");
      return;
    }
    if (cart.length === 0) return;

    setIsSubmitting(true);
    try {
      const payload = {
        type: orderType,
        paymentModel,
        origin: 'POS',
        tableId: orderType === 'DINE_IN' ? selectedTableId : undefined,
        promoCode: appliedPromo ? appliedPromo.code : undefined,
        items: cart.map(c => ({
          menuItemId: c.menuItem.id,
          quantity: c.quantity,
          modifiers: c.modifiers.map(m => m.id)
        }))
      };

      const res = await api.post(`/stores/${selectedStoreId}/orders`, payload);
      const orderId = res.data.data.order.id;

      if (useQR) {
        const linkRes = await api.post(`/stores/${selectedStoreId}/orders/${orderId}/payment-link`);
        setQrModal({ isOpen: true, url: linkRes.data.data.short_url, orderId });
        return;
      }

      if (paymentModel === 'PREPAID') {
        await api.patch(`/stores/${selectedStoreId}/orders/${orderId}/status`, { status: 'SETTLED' });
      }

      resetOrderForm();
      setReceiptOrder(res.data.data.order);

    } catch (err) {
      console.error(err);
      alert("Failed to place order: " + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyOrder = async () => {
    setIsVerifying(true);
    try {
      const res = await api.get(`/stores/${selectedStoreId}/orders/${qrModal.orderId}/payment-status`);
      if (res.data.success && res.data.data.status === 'success') {
        setQrModal({ isOpen: false, url: '', orderId: '' });
        resetOrderForm();
        
        const orderRes = await api.get(`/stores/${selectedStoreId}/orders/${qrModal.orderId}`);
        if (orderRes.data.success) {
          setReceiptOrder(orderRes.data.data);
        }
      } else {
        alert(res.data.data?.message || `Payment not received yet.`);
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || "Failed to verify order.";
      alert("Error: " + msg);
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    let intervalId;
    let attempts = 0;
    
    if (qrModal.isOpen && qrModal.orderId) {
      intervalId = setInterval(async () => {
        attempts++;
        if (attempts > 100) {
          clearInterval(intervalId);
          alert('Payment QR Expired (timeout). Please generate again.');
          setQrModal({ isOpen: false, url: '', orderId: '' });
          return;
        }

        try {
          const res = await api.get(`/stores/${selectedStoreId}/orders/${qrModal.orderId}/payment-status`);
          if (res.data.success && res.data.data.status === 'success') {
            clearInterval(intervalId);
            setQrModal({ isOpen: false, url: '', orderId: '' });
            resetOrderForm();
            
            const orderRes = await api.get(`/stores/${selectedStoreId}/orders/${qrModal.orderId}`);
            if (orderRes.data.success) {
              setReceiptOrder(orderRes.data.data);
            }
          }
        } catch (err) {}
      }, 3000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [qrModal.isOpen, qrModal.orderId, selectedStoreId]);

  if (loading) {
    return (
      <div className="flex h-screen gap-2 p-2 bg-zinc-100 dark:bg-zinc-950">
        <Skeleton className="w-48 h-full rounded-lg" />
        <Skeleton className="flex-1 h-full rounded-lg" />
        <Skeleton className="w-80 h-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 p-4 font-medium text-sm">{error}</div>;
  }

  return (
    <div className="h-screen w-full grid grid-cols-[190px_1fr_320px] gap-2 p-2 bg-zinc-100 dark:bg-zinc-950 overflow-hidden text-xs select-none">
      
      {/* 1. Categories Sidebar */}
      <aside className="h-full flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-xs">
        <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs">Categories</span>
          <span className="text-[10px] text-zinc-400 font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
            {menu.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
          {menu.map(cat => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`w-full text-left px-2.5 py-2 rounded-md font-medium transition-colors flex items-center justify-between group ${
                  isSelected
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  {cat.icon && <span className="text-xs shrink-0">{cat.icon}</span>}
                  <span className="truncate">{cat.name}</span>
                </span>
                {cat.itemCount !== undefined && (
                  <span className={`text-[10px] tabular-nums px-1 rounded ${
                    isSelected ? 'bg-amber-600 text-white' : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'
                  }`}>
                    {cat.itemCount}
                  </span>
                )}
              </button>
            );
          })}
          {menu.length === 0 && (
            <p className="text-center text-zinc-400 py-6 text-xs">No categories</p>
          )}
        </div>
      </aside>

      {/* 2. Items Catalog Grid */}
      <main className="h-full flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-xs">
        
        {/* Compact Search & Filter Toolbar */}
        <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2 bg-zinc-50/50 dark:bg-zinc-900">
          <div className="relative flex-1">
            <Search01Icon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search items..."
              className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
            />
          </div>

          <div className="flex bg-zinc-200 dark:bg-zinc-800 p-0.5 rounded-md shrink-0">
            {['ALL', 'VEG', 'NON_VEG'].map(type => (
              <button
                key={type}
                onClick={() => setDietaryFilter(type)}
                className={`px-2 py-1 text-[10px] font-semibold rounded ${
                  dietaryFilter === type
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                {type === 'ALL' ? 'All' : type === 'VEG' ? 'Veg' : 'Non-Veg'}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Compact Grid */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 auto-rows-max">
            {filteredItems.map(item => {
              const isDisabled = item.isManuallyDisabled || item.isSystemDisabled;
              return (
                <Card
                  key={item.id}
                  onClick={() => initiateAddToCart(item)}
                  className={`relative border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 cursor-pointer transition-all hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-xs ${
                    isDisabled ? 'opacity-40 grayscale cursor-not-allowed' : 'active:scale-[0.98]'
                  }`}
                >
                  <CardContent className="p-0 flex flex-col justify-between h-20">
                    <div>
                      <div className="flex items-start justify-between gap-1.5">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight">
                          {item.name}
                        </span>
                        <span
                          title={item.dietary}
                          className={`size-2 shrink-0 rounded-full mt-0.5 border ${
                            item.dietary === 'VEG'
                              ? 'bg-green-500 border-green-600'
                              : item.dietary === 'NON_VEG'
                              ? 'bg-red-500 border-red-600'
                              : 'bg-zinc-400 border-zinc-500'
                          }`}
                        />
                      </div>
                      {isDisabled && (
                        <span className="text-[10px] text-red-500 font-medium block">Sold Out</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
                      <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                        ₹{item.price}
                      </span>
                      {item.modifierGroups?.length > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded font-medium">
                          Custom
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredItems.length === 0 && (
            <div className="h-40 flex items-center justify-center text-zinc-400 text-xs">
              No menu items match your search.
            </div>
          )}
        </div>
      </main>

      {/* 3. Compact Cart & Order Controller */}
      <aside className="h-full flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-xs">
        
        {/* Cart Header */}
        <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900">
          <span className="font-bold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100 text-xs">
            <ShoppingCart01Icon size={15} /> Order #{cart.length}
          </span>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              title="Clear Cart"
              className="p-1 text-zinc-400 hover:text-red-500 rounded transition-colors"
            >
              <Delete02Icon size={14} />
            </button>
          )}
        </div>

        {/* Dense Controls: Type + Table Picker */}
        <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-1.5">
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-md flex-1">
            <button
              className={`flex-1 py-1 text-[11px] font-semibold rounded ${
                orderType === 'DINE_IN'
                  ? 'bg-white dark:bg-zinc-900 shadow-xs text-zinc-900 dark:text-zinc-100'
                  : 'text-zinc-500'
              }`}
              onClick={() => setOrderType('DINE_IN')}
            >
              Dine-In
            </button>
            <button
              className={`flex-1 py-1 text-[11px] font-semibold rounded ${
                orderType === 'TAKEAWAY'
                  ? 'bg-white dark:bg-zinc-900 shadow-xs text-zinc-900 dark:text-zinc-100'
                  : 'text-zinc-500'
              }`}
              onClick={() => { setOrderType('TAKEAWAY'); setSelectedTableId(''); }}
            >
              Takeaway
            </button>
          </div>

          {orderType === 'DINE_IN' && (
            <div className="w-28">
              <Select value={selectedTableId} onValueChange={setSelectedTableId}>
                <SelectTrigger className="h-7 text-xs px-2 bg-white dark:bg-zinc-900">
                  <SelectValue placeholder="Table" />
                </SelectTrigger>
                <SelectContent>
                  {tables.map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      T-{t.tableNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Cart Item Rows */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400">
              <ShoppingCart01Icon size={32} className="mb-1 opacity-30" />
              <p className="text-xs">No items in order</p>
            </div>
          ) : (
            cart.map((c, idx) => (
              <div
                key={idx}
                className="p-1.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-md border border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between gap-1.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-xs truncate text-zinc-900 dark:text-zinc-100">
                      {c.menuItem.name}
                    </p>
                    <span className="font-semibold text-xs tabular-nums ml-1">
                      ₹{(c.menuItem.price + c.modifiers.reduce((sum, m) => sum + m.price, 0)) * c.quantity}
                    </span>
                  </div>
                  {c.modifiers.length > 0 && (
                    <p className="text-[10px] text-zinc-400 truncate">
                      {c.modifiers.map(m => m.name).join(', ')}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded shrink-0 p-0.5">
                  <button
                    onClick={() => updateQuantity(idx, -1)}
                    className="p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300"
                  >
                    <Remove01Icon size={12} />
                  </button>
                  <span className="w-4 text-center font-bold text-[11px]">{c.quantity}</span>
                  <button
                    onClick={() => updateQuantity(idx, 1)}
                    className="p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300"
                  >
                    <Add01Icon size={12} />
                  </button>
                </div>

                <button
                  onClick={() => removeCartLine(idx)}
                  className="p-1 text-zinc-400 hover:text-red-500 rounded"
                  title="Remove"
                >
                  <Cancel01Icon size={12} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Promo Code Compact Bar */}
        <div className="px-2 py-1.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Coupon"
            className="flex-1 px-2 py-1 text-xs border rounded bg-white dark:bg-zinc-950 dark:border-zinc-800 uppercase focus:outline-none"
            value={promoCodeInput}
            onChange={e => setPromoCodeInput(e.target.value)}
            disabled={!!appliedPromo}
          />
          {appliedPromo ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setAppliedPromo(null); setPromoCodeInput(''); }}
              className="h-7 px-2 text-[10px] text-red-500 border-red-200 hover:bg-red-50"
            >
              Clear
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={applyPromo}
              className="h-7 px-2 text-[10px]"
            >
              Apply
            </Button>
          )}
        </div>

        {/* Calculation Details Strip */}
        <div className="px-3 py-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-1">
          <div className="flex justify-between text-zinc-500 text-[11px]">
            <span>Subtotal</span>
            <span>₹{subTotal}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-green-600 text-[11px]">
              <span className="flex items-center gap-1"><Tag01Icon size={11} /> Discount</span>
              <span>-₹{discountAmount}</span>
            </div>
          )}
          {taxAmount > 0 && (
            <div className="flex justify-between text-zinc-500 text-[11px]">
              <span>Taxes</span>
              <span>₹{taxAmount}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm text-zinc-900 dark:text-zinc-100 pt-1 border-t border-dashed border-zinc-200 dark:border-zinc-800">
            <span>Payable</span>
            <span>₹{totalAmount}</span>
          </div>

          {/* Icon-Driven Action Dock */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <Button
              disabled={cart.length === 0 || isSubmitting}
              onClick={() => handleCheckout('POSTPAID')}
              variant="outline"
              title="Kitchen Order Ticket (KOT)"
              className="h-8 p-0 flex flex-col items-center justify-center gap-0.5 text-[10px]"
            >
              {isSubmitting ? <Loading02Icon size={14} className="animate-spin" /> : <ChefHatIcon size={14} />}
              <span>KOT</span>
            </Button>

            <Button
              disabled={cart.length === 0 || isSubmitting}
              onClick={() => handleCheckout('PREPAID')}
              title="Pay Cash (Direct Settlement)"
              className="h-8 p-0 flex flex-col items-center justify-center gap-0.5 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {isSubmitting ? <Loading02Icon size={14} className="animate-spin" /> : <Coins01Icon size={14} />}
              <span>Cash</span>
            </Button>

            <Button
              disabled={cart.length === 0 || isSubmitting}
              onClick={() => handleCheckout('PREPAID', true)}
              title="Generate Dynamic UPI/Card QR"
              className="h-8 p-0 flex flex-col items-center justify-center gap-0.5 text-[10px] bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isSubmitting ? <Loading02Icon size={14} className="animate-spin" /> : <QrCodeIcon size={14} />}
              <span>QR Pay</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Modifier Modal Overlay */}
      {modifierItem && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-3 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100">{modifierItem.name}</h4>
                <p className="text-[10px] text-zinc-500">Configure add-ons</p>
              </div>
              <button onClick={() => setModifierItem(null)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                <Cancel01Icon size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {modifierItem.modifierGroups.map(group => {
                const selected = selectedModifiers[group.id] || [];
                return (
                  <div key={group.id} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-[11px]">{group.name}</span>
                      <span className="text-[9px] font-medium px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500">
                        {group.isRequired ? `Req (Min ${group.minSelections})` : 'Opt'} · Max {group.maxSelections}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-1">
                      {group.options.map(opt => {
                        const isSelected = selected.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            onClick={() => handleModifierToggle(group.id, opt.id, group.maxSelections)}
                            className={`flex justify-between items-center px-2.5 py-1.5 border rounded-md transition-colors text-xs ${
                              isSelected
                                ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20 text-amber-950 dark:text-amber-100'
                                : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`size-3.5 border rounded flex items-center justify-center ${
                                isSelected ? 'bg-amber-500 border-amber-500 text-white' : 'border-zinc-300 dark:border-zinc-600'
                              }`}>
                                {isSelected && <Tick02Icon size={10} />}
                              </div>
                              <span>{opt.name}</span>
                            </div>
                            {opt.price > 0 && <span className="font-semibold text-[11px]">+₹{opt.price}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
              <Button onClick={submitModifiers} className="w-full h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white">
                Add to Cart
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* QR Payment Modal Overlay */}
      {qrModal.isOpen && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-3 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-5 max-w-xs w-full flex flex-col items-center text-center">
            <h4 className="font-bold text-sm mb-0.5">Scan to Pay</h4>
            <p className="text-[11px] text-zinc-500 mb-3">Customer UPI or QR payment</p>
            
            <div className="bg-white p-2.5 rounded-lg shadow-inner border border-zinc-200 inline-block mb-3">
              <QRCodeSVG value={qrModal.url} size={150} level="M" includeMargin={false} />
            </div>
            
            <div className="font-bold text-xl text-zinc-900 dark:text-zinc-100 mb-2">
              ₹{totalAmount}
            </div>

            <div className="flex items-center justify-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium text-[11px] mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              Waiting for settlement...
            </div>
            
            <div className="w-full grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                className="h-8 text-xs"
                disabled={isVerifying}
                onClick={() => setQrModal({ isOpen: false, url: '', orderId: '' })}
              >
                Cancel
              </Button>
              <Button 
                className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                disabled={isVerifying}
                onClick={verifyOrder}
              >
                {isVerifying ? 'Checking...' : 'Verify'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal Overlay */}
      {receiptOrder && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-3 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl flex flex-col w-full max-w-xs max-h-[85vh] overflow-hidden">
            <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400">
              <span className="font-bold flex items-center gap-1 text-xs">
                <Tick02Icon size={16}/> Settled Successfully
              </span>
              <button onClick={() => setReceiptOrder(null)} className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded">
                <Cancel01Icon size={14} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 bg-zinc-50 dark:bg-black">
              <Receipt ref={receiptRef} order={receiptOrder} storeData={storeData} />
            </div>

            <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1 h-8 text-xs"
                onClick={() => setReceiptOrder(null)}
              >
                Close
              </Button>
              <Button 
                className="flex-1 h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center gap-1.5"
                onClick={() => {
                  const printWindow = window.open('', '', 'width=400,height=600');
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>Receipt</title>
                        <style>
                          body { font-family: monospace; font-size: 12px; margin: 0; padding: 12px; }
                          .flex { display: flex; }
                          .justify-between { justify-content: space-between; }
                          .text-center { text-align: center; }
                          .font-bold { font-weight: bold; }
                          .mb-2 { margin-bottom: 0.5rem; }
                          .border-b { border-bottom: 1px dashed black; }
                        </style>
                      </head>
                      <body>${receiptRef.current.innerHTML}</body>
                    </html>
                  `);
                  printWindow.document.close();
                  printWindow.focus();
                  setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
                }}
              >
                <PrinterIcon size={14} /> Print
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};