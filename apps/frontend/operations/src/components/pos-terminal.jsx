import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../lib/api';
import { Card, CardContent, Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Skeleton } from '@smo/ui';
import { Add01Icon, Remove01Icon, ShoppingCart01Icon, Tick02Icon, Cancel01Icon, QrCodeIcon, Tag01Icon, PrinterIcon, Loading02Icon } from 'hugeicons-react';
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

  // Cart State
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState('DINE_IN');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);

  // Modifier Modal State
  const [modifierItem, setModifierItem] = useState(null);
  const [selectedModifiers, setSelectedModifiers] = useState({}); // { groupId: [optionId, ...] }

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
           setCart([]);
           setSelectedTableId('');
           setAppliedPromo(null);
           
           const orderRes = await api.get(`/stores/${selectedStoreId}/orders/${currentModal.orderId}`);
           if (orderRes.data.success) {
             setReceiptOrder(orderRes.data.data);
           }
        }
      } catch(e) {}
    };
    return () => eventSource.close();
  }, [selectedStoreId, token]);

  const applyPromo = () => {
    const promo = promos.find(p => p.code === promoCodeInput.toUpperCase() && p.isActive);
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

  const selectedCategoryItems = useMemo(() => {
    const category = menu.find(c => c.id === selectedCategoryId);
    return category ? category.items : [];
  }, [menu, selectedCategoryId]);

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
      // For items with modifiers, we treat each unique modifier combination as a separate cart line item
      // For V1, to keep it simple, we just append a new line item if there are modifiers, 
      // or stack if it's exactly the same (simplification: just append for now if modifiers exist)
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
        return prev; // max reached
      }
      return { ...prev, [groupId]: [...current, optionId] };
    });
  };

  const submitModifiers = () => {
    if (!modifierItem) return;

    // Validate required groups
    for (const group of modifierItem.modifierGroups) {
      const selectedCount = (selectedModifiers[group.id] || []).length;
      if (group.isRequired && selectedCount < group.minSelections) {
        alert(`Please select at least ${group.minSelections} for ${group.name}`);
        return;
      }
    }

    // Flatten selected modifiers
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
        return; // Wait for SSE
      }

      if (paymentModel === 'PREPAID') {
        await api.patch(`/stores/${selectedStoreId}/orders/${orderId}/status`, { status: 'SETTLED' });
      }

      setCart([]);
      setSelectedTableId('');
      setAppliedPromo(null);
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
      const res = await api.post(`/stores/${selectedStoreId}/orders/${qrModal.orderId}/verify-payment`);
      if (res.data.success && res.data.data.success) {
         setQrModal({ isOpen: false, url: '', orderId: '' });
         setCart([]);
         setSelectedTableId('');
         setAppliedPromo(null);
         
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
    let interval;
    if (qrModal.isOpen && qrModal.orderId) {
      interval = setInterval(async () => {
        try {
          const res = await api.post(`/stores/${selectedStoreId}/orders/${qrModal.orderId}/verify-payment`);
          if (res.data.success && res.data.data.success) {
             setQrModal({ isOpen: false, url: '', orderId: '' });
             setCart([]);
             setSelectedTableId('');
             setAppliedPromo(null);
             
             const orderRes = await api.get(`/stores/${selectedStoreId}/orders/${qrModal.orderId}`);
             if (orderRes.data.success) {
               setReceiptOrder(orderRes.data.data);
             }
          }
        } catch (err) {
          // Silent failure for polling
        }
      }, 5000); // Poll every 5 seconds
    }
    return () => clearInterval(interval);
  }, [qrModal.isOpen, qrModal.orderId, selectedStoreId]);

  if (loading) {
    return (
      <div className="flex h-full gap-4">
        <Skeleton className="w-64 h-full rounded-xl" />
        <Skeleton className="flex-1 h-full rounded-xl" />
        <Skeleton className="w-96 h-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  return (
    <div className="h-full grid grid-cols-[250px_1fr_380px] gap-4 overflow-hidden relative">

      {/* 1. Categories Sidebar */}
      <div className="w-full h-full flex flex-col gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg tracking-tight">Categories</h3>
          <span className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {menu.length} items
          </span>
        </div>

        {menu.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategoryId(cat.id)}
            className={`group relative text-left px-3 py-2.5 rounded-md font-medium transition-all duration-200 ${selectedCategoryId === cat.id
              ? 'text-zinc-900 dark:text-white'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
          >
            <span className="flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                {cat.icon && <span className="text-base opacity-70">{cat.icon}</span>}
                <span className="text-sm">{cat.name}</span>
              </span>

              {cat.itemCount !== undefined && (
                <span className="text-xs tabular-nums opacity-60">
                  {cat.itemCount}
                </span>
              )}
            </span>

            {/* Animated underline indicator */}
            <span className={`absolute bottom-0 left-0 h-[2px] transition-all duration-300 ${selectedCategoryId === cat.id
              ? 'w-full bg-gradient-to-r from-amber-500 to-yellow-500'
              : 'w-0 group-hover:w-1/2 bg-zinc-300 dark:bg-zinc-600'
              }`} />

            {/* Selected background glow */}
            {selectedCategoryId === cat.id && (
              <span className="absolute inset-0 bg-yellow-50 dark:bg-yellow-500/10 rounded-md -z-10" />
            )}
          </button>
        ))}

        {menu.length === 0 && (
          <p className="text-center text-sm text-zinc-400 dark:text-zinc-500 py-8">
            No categories available
          </p>
        )}
      </div>

      {/* 2. Products Grid */}
      <div className="w-full h-full flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 overflow-y-auto">
        <h3 className="font-semibold text-lg mb-4">
          {menu.find(c => c.id === selectedCategoryId)?.name || 'Items'}
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max">
          {selectedCategoryItems.map(item => {
            const isDisabled = item.isManuallyDisabled || item.isSystemDisabled;
            return (
              <Card
                key={item.id}
                className={`cursor-pointer transition-shadow hover:shadow-md ${isDisabled ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                onClick={() => initiateAddToCart(item)}
              >
                <CardContent className="p-4 flex flex-col h-full relative">
                  <span
                    className={`absolute bottom-1 right-1 size-2 rounded-full border ${item.dietary === 'VEG'
                      ? 'bg-green-500 border-green-600'
                      : item.dietary === 'NON_VEG'
                        ? 'bg-red-500 border-red-600'
                        : item.dietary === 'VEGAN'
                          ? 'bg-cyan-400 border-cyan-500'
                          : item.dietary === 'EGG'
                            ? 'bg-amber-400 border-amber-500'
                            : 'bg-zinc-300 border-zinc-400 dark:bg-zinc-600 dark:border-zinc-500'
                      }`}
                  />
                  <div className="flex-1 mb-2">
                    <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</h4>
                    {isDisabled && <span className="text-xs text-red-500 font-medium mt-1 inline-block">Out of Stock</span>}
                  </div>
                  <div className="font-bold text-lg text-zinc-900 dark:text-zinc-100 mt-auto flex justify-between items-center">
                    ₹{item.price}
                    {item.modifierGroups?.length > 0 && <span className="text-xs font-normal text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-full">Customizable</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 3. Cart Sidebar */}
      <div className="w-full h-full overflow-y-auto flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl z-10">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <ShoppingCart01Icon size={20} /> Current Order
          </h3>
        </div>

        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col gap-3 bg-zinc-50 dark:bg-zinc-950/50">
          <div className="flex bg-zinc-200 dark:bg-zinc-800 p-1 rounded-lg">
            <button
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${orderType === 'DINE_IN' ? 'bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              onClick={() => setOrderType('DINE_IN')}
            >
              Dine-In
            </button>
            <button
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${orderType === 'TAKEAWAY' ? 'bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              onClick={() => { setOrderType('TAKEAWAY'); setSelectedTableId(''); }}
            >
              Takeaway
            </button>
          </div>

          {orderType === 'DINE_IN' && (
            <Select value={selectedTableId} onValueChange={setSelectedTableId}>
              <SelectTrigger className="w-full bg-white dark:bg-zinc-900">
                <SelectValue placeholder="Select Table" />
              </SelectTrigger>
              <SelectContent>
                {tables.map(t => (
                  <SelectItem key={t.id} value={t.id}>Table {t.tableNumber}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400">
              <ShoppingCart01Icon size={48} className="mb-2 opacity-50" />
              <p>Cart is empty</p>
            </div>
          ) : (
            cart.map((c, idx) => (
              <div key={idx} className="flex flex-col gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-sm">{c.menuItem.name}</span>
                  <span className="font-semibold text-sm">₹{(c.menuItem.price + c.modifiers.reduce((sum, m) => sum + m.price, 0)) * c.quantity}</span>
                </div>
                {c.modifiers.length > 0 && (
                  <div className="text-xs text-zinc-500 flex flex-col">
                    {c.modifiers.map(m => <span key={m.id}>+ {m.name}</span>)}
                  </div>
                )}
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md">
                    <button onClick={() => updateQuantity(idx, -1)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-l-md"><Remove01Icon size={16} /></button>
                    <span className="text-sm font-medium w-4 text-center">{c.quantity}</span>
                    <button onClick={() => updateQuantity(idx, 1)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-r-md"><Add01Icon size={16} /></button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Promo Input */}
        <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Promo Code" 
              className="flex-1 px-3 py-2 text-sm border rounded-md dark:bg-zinc-900 dark:border-zinc-800 focus:outline-none"
              value={promoCodeInput}
              onChange={e => setPromoCodeInput(e.target.value)}
              disabled={!!appliedPromo}
            />
            {appliedPromo ? (
              <Button variant="outline" size="sm" onClick={() => { setAppliedPromo(null); setPromoCodeInput(''); }}>
                Remove
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={applyPromo}>
                Apply
              </Button>
            )}
          </div>
          {appliedPromo && (
            <div className="text-xs text-green-600 mt-2 flex items-center gap-1">
              <Tag01Icon size={12} /> Promo {appliedPromo.code} applied!
            </div>
          )}
        </div>

        {/* Totals & Actions */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex flex-col gap-3">
          <div className="flex justify-between text-sm text-zinc-500">
            <span>Subtotal</span>
            <span>₹{subTotal}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm text-green-600 font-medium">
              <span>Discount</span>
              <span>-₹{discountAmount}</span>
            </div>
          )}
          {taxAmount > 0 && (
            <div className="flex justify-between text-sm text-zinc-500">
              <span>Taxes</span>
              <span>₹{taxAmount}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-xl text-zinc-900 dark:text-zinc-100 border-t border-dashed border-zinc-300 dark:border-zinc-700 pt-2 mt-1">
            <span>Total</span>
            <span>₹{totalAmount}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <Button
              disabled={cart.length === 0 || isSubmitting}
              onClick={() => handleCheckout('POSTPAID')}
              variant="outline"
              className="w-full h-11"
            >
              {isSubmitting ? <Loading02Icon size={18} /> : 'Kitchen Only'}
            </Button>
            <Button
              disabled={cart.length === 0 || isSubmitting}
              onClick={() => handleCheckout('PREPAID')}
              className="w-full h-11 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loading02Icon size={18} /> : 'Pay Cash'}
            </Button>
          </div>
          <Button
            disabled={cart.length === 0 || isSubmitting}
            onClick={() => handleCheckout('PREPAID', true)}
            className="w-full h-11 bg-yellow-600 hover:bg-yellow-700 text-white flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loading02Icon size={18} /> : <QrCodeIcon size={18} />} Generate Payment QR
          </Button>
        </div>

      </div>

      {/* Modifier Modal Overlay */}
      {modifierItem && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-full">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">{modifierItem.name}</h3>
                <p className="text-sm text-zinc-500">Customize your item</p>
              </div>
              <button onClick={() => setModifierItem(null)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full">
                <Cancel01Icon size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
              {modifierItem.modifierGroups.map(group => {
                const selected = selectedModifiers[group.id] || [];
                return (
                  <div key={group.id} className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <h4 className="font-semibold">{group.name}</h4>
                      <span className="text-xs font-medium px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md text-zinc-500">
                        {group.isRequired ? `Required (Min ${group.minSelections})` : 'Optional'}
                        {` • Max ${group.maxSelections}`}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {group.options.map(opt => {
                        const isSelected = selected.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            onClick={() => handleModifierToggle(group.id, opt.id, group.maxSelections)}
                            className={`flex justify-between items-center p-3 border rounded-lg transition-colors ${isSelected
                              ? 'border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800/50'
                              : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 border rounded flex items-center justify-center ${isSelected ? 'bg-zinc-900 border-zinc-900 dark:bg-zinc-100 dark:border-zinc-100 text-white dark:text-zinc-900' : 'border-zinc-300 dark:border-zinc-600'}`}>
                                {isSelected && <Tick02Icon size={14} />}
                              </div>
                              <span className="font-medium">{opt.name}</span>
                            </div>
                            {opt.price > 0 && <span className="text-sm font-semibold">+₹{opt.price}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
              <Button onClick={submitModifiers} className="w-full h-12">
                Add to Cart
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* QR Payment Modal Overlay */}
      {qrModal.isOpen && (
        <div className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center text-center">
            <div className="bg-yellow-50 dark:bg-yellow-500/10 p-4 rounded-full mb-4">
              <QrCodeIcon size={32} className="text-yellow-600 dark:text-yellow-400" />
            </div>
            <h3 className="font-bold text-xl mb-1">Scan to Pay</h3>
            <p className="text-sm text-zinc-500 mb-4">Please scan this QR code to pay.</p>
            
            <div className="bg-white p-4 rounded-xl shadow-inner border border-zinc-100 inline-block mb-4">
              <QRCodeSVG value={qrModal.url} size={200} level="M" includeMargin={false} />
            </div>
            
            <div className="font-bold text-2xl text-zinc-900 dark:text-zinc-100 mb-2">
              ₹{totalAmount}
            </div>

            <div className="flex items-center justify-center gap-2 text-yellow-600 dark:text-yellow-400 font-medium mb-6">
               <span className="relative flex h-3 w-3">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
               </span>
               Waiting for payment...
            </div>
            
            <div className="w-full flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                disabled={isVerifying}
                onClick={() => setQrModal({ isOpen: false, url: '', orderId: '' })}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                disabled={isVerifying}
                onClick={verifyOrder}
              >
                {isVerifying ? 'Verifying...' : 'Verify Payment'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Receipt Modal Overlay */}
      {receiptOrder && (
        <div className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl flex flex-col w-full max-w-md max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
              <h3 className="font-bold flex items-center gap-2"><Tick02Icon size={20}/> Order Successful</h3>
              <button onClick={() => setReceiptOrder(null)} className="p-1 hover:bg-green-100 dark:hover:bg-green-800 rounded-full">
                <Cancel01Icon size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-zinc-100 dark:bg-black">
              <Receipt ref={receiptRef} order={receiptOrder} storeData={storeData} />
            </div>

            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setReceiptOrder(null)}
              >
                Close
              </Button>
              <Button 
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white flex items-center justify-center gap-2"
                onClick={() => {
                  const printWindow = window.open('', '', 'width=400,height=600');
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>Receipt</title>
                        <style>
                          body { font-family: monospace; font-size: 14px; margin: 0; padding: 20px; }
                          .flex { display: flex; }
                          .justify-between { justify-content: space-between; }
                          .text-center { text-align: center; }
                          .text-right { text-align: right; }
                          .font-bold { font-weight: bold; }
                          .text-xl { font-size: 1.25rem; }
                          .text-lg { font-size: 1.125rem; }
                          .mb-4 { margin-bottom: 1rem; }
                          .mb-2 { margin-bottom: 0.5rem; }
                          .mb-1 { margin-bottom: 0.25rem; }
                          .pb-2 { padding-bottom: 0.5rem; }
                          .pl-2 { padding-left: 0.5rem; }
                          .uppercase { text-transform: uppercase; }
                          .border-b { border-bottom: 1px dashed black; }
                          .flex-1 { flex: 1; }
                          .w-10 { width: 2.5rem; }
                          .w-16 { width: 4rem; }
                          .text-xs { font-size: 0.75rem; }
                          .pr-2 { padding-right: 0.5rem; }
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
                <PrinterIcon size={18} /> Print Receipt
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
