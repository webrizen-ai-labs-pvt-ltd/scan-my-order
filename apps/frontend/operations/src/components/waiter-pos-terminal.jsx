import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../lib/api';
import { Card, CardContent, Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Skeleton } from '@smo/ui';
import { Add01Icon, Remove01Icon, ShoppingCart01Icon, Tick02Icon, Cancel01Icon, QrCodeIcon, Tag01Icon, PrinterIcon, Loading02Icon, ArrowLeft01Icon } from 'hugeicons-react';
import { QRCodeSVG } from 'qrcode.react';
import { Receipt } from './receipt';

export const WaiterPOSTerminal = ({ selectedStoreId, token }) => {
  const [menu, setMenu] = useState([]);
  const [tables, setTables] = useState([]);
  const [storeData, setStoreData] = useState(null);
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // UI State
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

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
           setIsCartOpen(false);
           
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
        origin: 'WAITER',
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
      setIsCartOpen(false);
      setReceiptOrder(res.data.data.order);

    } catch (err) {
      console.error(err);
      alert("Failed to place order: " + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    if (!receiptRef.current) return;
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
             setIsCartOpen(false);
             
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
      <div className="flex flex-col h-full gap-4 p-4">
        <Skeleton className="w-full h-12 rounded-xl shrink-0" />
        <Skeleton className="w-full h-full rounded-xl flex-1" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex flex-col h-full relative overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      
      {/* 1. Horizontal Categories Bar */}
      <div className="shrink-0 flex overflow-x-auto p-3 gap-2 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 no-scrollbar">
        {menu.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategoryId(cat.id)}
            className={`whitespace-nowrap px-4 py-2 rounded-full font-medium text-sm transition-all duration-200 shadow-sm border flex items-center ${
              selectedCategoryId === cat.id
                ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 dark:hover:bg-zinc-700'
            }`}
          >
            {cat.icon && <span className="mr-2 opacity-70">{cat.icon}</span>}
            {cat.name}
            {cat.itemCount !== undefined && <span className="ml-2 opacity-60 text-xs">({cat.itemCount})</span>}
          </button>
        ))}
      </div>

      {/* 2. Menu Items List (1 item per row for mobile optimization) */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <h3 className="font-semibold text-lg mb-4 text-zinc-900 dark:text-zinc-100">
          {menu.find(c => c.id === selectedCategoryId)?.name || 'Items'}
        </h3>
        
        <div className="flex flex-col gap-3">
          {selectedCategoryItems.map(item => {
            const isDisabled = item.isManuallyDisabled || item.isSystemDisabled;
            // Check if item is already in cart to show a quick "+" button or quantity
            const cartItemCount = cart.filter(c => c.menuItem.id === item.id).reduce((sum, c) => sum + c.quantity, 0);

            return (
              <div
                key={item.id}
                className={`flex justify-between items-center bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-shadow ${isDisabled ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:shadow-md cursor-pointer'}`}
                onClick={() => !isDisabled && initiateAddToCart(item)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`size-2.5 rounded-full border ${item.dietary === 'VEG'
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
                    <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">{item.name}</h4>
                  </div>
                  <div className="text-zinc-700 dark:text-zinc-300 font-bold">₹{item.price}</div>
                  {isDisabled && <div className="text-xs text-red-500 font-medium mt-1">Out of Stock</div>}
                  {!isDisabled && item.modifierGroups?.length > 0 && <div className="text-xs text-zinc-500 mt-1">Customizable</div>}
                </div>
                
                {!isDisabled && (
                  <div className="shrink-0 ml-4">
                    {cartItemCount > 0 ? (
                      <div className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 text-sm">
                        {cartItemCount} added
                      </div>
                    ) : (
                      <button className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium px-4 py-2 rounded-lg text-sm transition-colors border border-zinc-200 dark:border-zinc-700">
                        ADD
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Sticky Bottom Bar for Cart */}
      {totalCartItems > 0 && !isCartOpen && (
        <div className="absolute bottom-4 left-4 right-4 z-10 animate-in slide-in-from-bottom-5">
          <Button 
            className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl flex justify-between items-center px-6 rounded-xl text-lg font-bold"
            onClick={() => setIsCartOpen(true)}
          >
            <div className="flex items-center gap-2 bg-indigo-700 px-3 py-1 rounded-lg">
              <ShoppingCart01Icon size={20} />
              <span>{totalCartItems} items</span>
            </div>
            <span>View Cart →</span>
          </Button>
        </div>
      )}

      {/* 4. Fullscreen Cart Slide-up Modal */}
      {isCartOpen && (
        <div className="absolute inset-0 z-40 bg-white dark:bg-zinc-950 flex flex-col animate-in slide-in-from-bottom-full duration-300">
          <div className="shrink-0 p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsCartOpen(false)}
                className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              >
                <ArrowLeft01Icon size={24} className="text-zinc-700 dark:text-zinc-300" />
              </button>
              <h2 className="text-xl font-bold">Current Order</h2>
            </div>
            <div className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-400 font-bold px-3 py-1 rounded-full text-sm">
              {totalCartItems} items
            </div>
          </div>

          {/* Cart Settings */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col gap-3 bg-zinc-50 dark:bg-zinc-900/50">
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
                <SelectTrigger className="w-full bg-white dark:bg-zinc-950 h-12 text-base rounded-xl">
                  <SelectValue placeholder="Select Table" />
                </SelectTrigger>
                <SelectContent>
                  {tables.map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-base py-3">Table {t.tableNumber}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                <ShoppingCart01Icon size={48} className="mb-4 opacity-50" />
                <p className="text-lg font-medium">Cart is empty</p>
                <Button variant="outline" className="mt-4" onClick={() => setIsCartOpen(false)}>Back to Menu</Button>
              </div>
            ) : (
              cart.map((c, idx) => (
                <div key={idx} className="flex flex-col gap-2 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-base text-zinc-900 dark:text-zinc-100">{c.menuItem.name}</span>
                    <span className="font-bold text-base text-zinc-900 dark:text-zinc-100">₹{(c.menuItem.price + c.modifiers.reduce((sum, m) => sum + m.price, 0)) * c.quantity}</span>
                  </div>
                  {c.modifiers.length > 0 && (
                    <div className="text-sm text-zinc-500 flex flex-col mb-1">
                      {c.modifiers.map(m => <span key={m.id}>+ {m.name}</span>)}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700/50">
                    <div className="text-sm font-medium text-zinc-500">₹{c.menuItem.price + c.modifiers.reduce((sum, m) => sum + m.price, 0)} each</div>
                    <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1">
                      <button onClick={() => updateQuantity(idx, -1)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"><Remove01Icon size={20} /></button>
                      <span className="text-base font-bold w-6 text-center">{c.quantity}</span>
                      <button onClick={() => updateQuantity(idx, 1)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"><Add01Icon size={20} /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Promo Input */}
          <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Promo Code" 
                className="flex-1 px-4 py-3 text-base border border-zinc-300 rounded-xl dark:bg-zinc-950 dark:border-zinc-700 focus:outline-none"
                value={promoCodeInput}
                onChange={e => setPromoCodeInput(e.target.value)}
                disabled={!!appliedPromo}
              />
              {appliedPromo ? (
                <Button variant="outline" className="h-[50px] px-6 rounded-xl border-zinc-300" onClick={() => { setAppliedPromo(null); setPromoCodeInput(''); }}>
                  Remove
                </Button>
              ) : (
                <Button variant="outline" className="h-[50px] px-6 rounded-xl border-zinc-300" onClick={applyPromo}>
                  Apply
                </Button>
              )}
            </div>
            {appliedPromo && (
              <div className="text-sm text-green-600 mt-2 flex items-center gap-1 font-medium">
                <Tag01Icon size={16} /> Promo {appliedPromo.code} applied!
              </div>
            )}
          </div>

          {/* Totals & Actions */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col gap-3 shrink-0 pb-6">
            <div className="flex justify-between text-base text-zinc-500">
              <span>Subtotal</span>
              <span>₹{subTotal}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-base text-green-600 font-medium">
                <span>Discount</span>
                <span>-₹{discountAmount}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between text-base text-zinc-500">
                <span>Taxes</span>
                <span>₹{taxAmount}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-2xl text-zinc-900 dark:text-zinc-100 border-t border-dashed border-zinc-300 dark:border-zinc-700 pt-3 mt-1">
              <span>Total</span>
              <span>₹{totalAmount}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <Button
                disabled={cart.length === 0 || isSubmitting}
                onClick={() => handleCheckout('POSTPAID')}
                variant="outline"
                className="w-full h-14 text-base font-bold rounded-xl border-zinc-300 dark:border-zinc-700"
              >
                {isSubmitting ? <Loading02Icon size={20} className="animate-spin" /> : 'Send to Kitchen'}
              </Button>
              <Button
                disabled={cart.length === 0 || isSubmitting}
                onClick={() => handleCheckout('PREPAID')}
                className="w-full h-14 text-base font-bold rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center gap-2 shadow-lg"
              >
                {isSubmitting ? <Loading02Icon size={20} className="animate-spin" /> : 'Pay Cash'}
              </Button>
            </div>
            <Button
              disabled={cart.length === 0 || isSubmitting}
              onClick={() => handleCheckout('PREPAID', true)}
              className="w-full h-14 text-base font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2 shadow-lg mt-1"
            >
              {isSubmitting ? <Loading02Icon size={20} className="animate-spin" /> : <QrCodeIcon size={20} />} Generate QR Pay
            </Button>
          </div>
        </div>
      )}

      {/* Modifier Modal Overlay */}
      {modifierItem && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-end justify-center backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl w-full max-h-[90%] overflow-hidden flex flex-col animate-in slide-in-from-bottom-full">
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950">
              <div>
                <h3 className="font-bold text-xl">{modifierItem.name}</h3>
                <p className="text-sm text-zinc-500">Customize your item</p>
              </div>
              <button onClick={() => setModifierItem(null)} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors bg-zinc-100 dark:bg-zinc-800">
                <Cancel01Icon size={24} className="text-zinc-600 dark:text-zinc-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
              {modifierItem.modifierGroups?.map(group => {
                const selectedCount = (selectedModifiers[group.id] || []).length;
                return (
                  <div key={group.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-zinc-100 dark:bg-zinc-800/50 p-3 px-4 flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800">
                      <div>
                        <div className="font-bold text-zinc-900 dark:text-zinc-100">{group.name}</div>
                        <div className="text-xs text-zinc-500">
                          {group.isRequired ? `Required (Min ${group.minSelections})` : 'Optional'} 
                          {group.maxSelections > 1 ? ` • Up to ${group.maxSelections}` : ''}
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        group.isRequired && selectedCount < group.minSelections 
                          ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' 
                          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {selectedCount}/{group.maxSelections}
                      </span>
                    </div>
                    <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                      {group.options.map(opt => {
                        const isSelected = (selectedModifiers[group.id] || []).includes(opt.id);
                        return (
                          <label key={opt.id} className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}>
                            <div className="flex items-center gap-3">
                              <div className={`size-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'}`}>
                                {isSelected && <Tick02Icon size={14} />}
                              </div>
                              <span className={`font-medium ${isSelected ? 'text-indigo-900 dark:text-indigo-300' : 'text-zinc-700 dark:text-zinc-300'}`}>{opt.name}</span>
                            </div>
                            <span className="text-zinc-500 font-medium">+{opt.price}</span>
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={isSelected}
                              onChange={() => handleModifierToggle(group.id, opt.id, group.maxSelections)}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-5 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 pb-8">
              <Button onClick={submitModifiers} className="w-full h-14 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg">
                Add to Cart
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal / SSE Waiting Overlay */}
      {qrModal.isOpen && (
        <div className="absolute inset-0 z-50 bg-white dark:bg-zinc-950 flex flex-col items-center justify-center p-6 animate-in zoom-in-95">
           <h2 className="text-2xl font-bold mb-2 text-center text-zinc-900 dark:text-white">Collect Payment</h2>
           <p className="text-sm text-zinc-500 mb-8 text-center max-w-xs">Ask the customer to scan this QR code to complete payment for Order #{qrModal.orderId.slice(-6).toUpperCase()}</p>
           
           <div className="bg-white p-6 rounded-3xl shadow-2xl border border-zinc-100 mb-8">
              <QRCodeSVG value={qrModal.url} size={240} />
           </div>
           
           <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 font-medium animate-pulse mb-8 bg-indigo-50 dark:bg-indigo-900/30 px-6 py-3 rounded-full">
             <Loading02Icon size={20} className="animate-spin" />
             <span>Waiting for payment confirmation...</span>
           </div>
           
           <Button variant="outline" className="w-full h-14 text-base font-bold rounded-xl max-w-xs" onClick={() => setQrModal({ isOpen: false, url: '', orderId: '' })}>
             Cancel Payment
           </Button>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptOrder && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col items-center p-8 text-center">
             <div className="size-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                <Tick02Icon size={32} />
             </div>
             <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Order Successful!</h2>
             <p className="text-zinc-500 mb-8">Order #{receiptOrder.id.slice(-6).toUpperCase()} has been sent to the kitchen.</p>
             
             {/* Hidden Printable Receipt */}
             <div style={{ display: 'none' }}>
               <div ref={receiptRef}>
                 <Receipt order={receiptOrder} store={storeData} />
               </div>
             </div>

             <div className="w-full flex flex-col gap-3">
                <Button onClick={handlePrint} className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white text-base font-bold rounded-xl shadow-lg flex items-center justify-center gap-2">
                  <PrinterIcon size={20} /> Print Receipt
                </Button>
                <Button variant="outline" className="w-full h-14 text-base font-bold rounded-xl border-zinc-300 dark:border-zinc-700" onClick={() => setReceiptOrder(null)}>
                  Done
                </Button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
