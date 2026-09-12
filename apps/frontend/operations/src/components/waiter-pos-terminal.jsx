import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../lib/api';
import { Card, CardContent, Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Skeleton } from '@smo/ui';
import { Add01Icon, Remove01Icon, ShoppingCart01Icon, Tick02Icon, Cancel01Icon, QrCodeIcon, Tag01Icon, PrinterIcon, Loading02Icon, ArrowLeft01Icon, DiningTableIcon } from 'hugeicons-react';
import { QRCodeSVG } from 'qrcode.react';
import { Receipt } from './receipt';
import { PaymentBifurcationModal } from './payment-bifurcation-modal';

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
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [activePaymentOrderId, setActivePaymentOrderId] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const receiptRef = useRef();
  
  const qrModalRef = useRef(qrModal);
  useEffect(() => {
    qrModalRef.current = qrModal;
  }, [qrModal]);

  const activePaymentOrderIdRef = useRef(activePaymentOrderId);
  useEffect(() => {
    activePaymentOrderIdRef.current = activePaymentOrderId;
  }, [activePaymentOrderId]);

  const paymentModalOpenRef = useRef(paymentModalOpen);
  useEffect(() => {
    paymentModalOpenRef.current = paymentModalOpen;
  }, [paymentModalOpen]);

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

  const fetchTables = async () => {
    if (!selectedStoreId) return;
    try {
      const res = await api.get(`/stores/${selectedStoreId}/tables`);
      if (res.data.success) {
        setTables(res.data.data.filter(t => t.isActive));
      }
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    }
  };

  useEffect(() => {
    if (!selectedStoreId || !token) return;
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    const eventSource = new EventSource(`${baseUrl}/stores/${selectedStoreId}/orders/stream?token=${token}`);
    
    eventSource.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        const currentModal = qrModalRef.current;
        const targetOrderId = message.data?.id;
        if (
          (message.type === 'ORDER_PROCESSING' || message.type === 'ORDER_SETTLED') &&
          ((currentModal.isOpen && targetOrderId === currentModal.orderId) ||
           (paymentModalOpenRef.current && targetOrderId === activePaymentOrderIdRef.current))
        ) {
           setQrModal({ isOpen: false, url: '', orderId: '' });
           setPaymentModalOpen(false);
           setActivePaymentOrderId(null);
           setCart([]);
           setSelectedTableId('');
           setAppliedPromo(null);
           setIsCartOpen(false);
           
           const orderRes = await api.get(`/stores/${selectedStoreId}/orders/${targetOrderId}`);
           if (orderRes.data.success) {
             setReceiptOrder(orderRes.data.data);
           }
        }

        // Live table status refresh on order and table events
        const tableEvents = [
          'ORDER_PENDING_VERIFICATION',
          'ORDER_PROCESSING',
          'ORDER_READY',
          'ORDER_SERVED',
          'ORDER_SETTLED',
          'ORDER_CANCELLED',
          'TABLE_UPDATED',
          'RESERVATION_CREATED',
          'RESERVATION_UPDATED',
          'RESERVATION_DELETED'
        ];
        if (tableEvents.includes(message.type)) {
          fetchTables();
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
    if (orderType === 'DINE_IN') {
      if (!selectedTableId) {
        alert("Please select a table for Dine-In orders.");
        return;
      }
      const selectedTable = tables.find(t => t.id === selectedTableId);
      if (selectedTable && selectedTable.status !== 'AVAILABLE' && selectedTable.isAvailable === false) {
        alert(`Table ${selectedTable.tableNumber} is currently unavailable (${selectedTable.status === 'OCCUPIED' ? 'Occupied' : 'Reserved'}). Please pick an available table.`);
        return;
      }
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

  /* ─── Payment Bifurcation Modal Handlers ────────────────────────── */
  const handleOpenPaymentModal = () => {
    if (orderType === 'DINE_IN') {
      if (!selectedTableId) {
        alert("Please select a table for Dine-In orders.");
        return;
      }
      const selectedTable = tables.find(t => t.id === selectedTableId);
      if (selectedTable && selectedTable.status !== 'AVAILABLE' && selectedTable.isAvailable === false) {
        alert(`Table ${selectedTable.tableNumber} is currently unavailable (${selectedTable.status === 'OCCUPIED' ? 'Occupied' : 'Reserved'}). Please pick an available table.`);
        return;
      }
    }
    if (cart.length === 0) return;
    setPaymentModalOpen(true);
  };

  const handleGenerateModalQR = async (onlineAmount) => {
    let orderId = activePaymentOrderId;
    if (!orderId) {
      const payload = {
        type: orderType,
        paymentModel: 'PREPAID',
        paymentMethod: onlineAmount === totalAmount ? 'ONLINE' : 'SPLIT',
        cashAmount: totalAmount - onlineAmount,
        onlineAmount: onlineAmount,
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
      orderId = res.data.data.order.id;
      setActivePaymentOrderId(orderId);
    }
    const linkRes = await api.post(`/stores/${selectedStoreId}/orders/${orderId}/payment-link`, {
      onlineAmount
    });
    return { url: linkRes.data.data.short_url };
  };

  const handleModalSettle = async (tenderDetails) => {
    setIsSubmitting(true);
    try {
      let settledOrder = null;
      let orderId = activePaymentOrderId;

      if (!orderId) {
        const payload = {
          type: orderType,
          paymentModel: 'PREPAID',
          paymentMethod: tenderDetails.paymentMethod,
          cashAmount: tenderDetails.cashAmount,
          onlineAmount: tenderDetails.onlineAmount,
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
        settledOrder = res.data.data.order;

        if (tenderDetails.paymentMethod !== 'CASH') {
          const updateRes = await api.patch(`/stores/${selectedStoreId}/orders/${settledOrder.id}/status`, {
            status: 'SETTLED',
            paymentMethod: tenderDetails.paymentMethod,
            cashAmount: tenderDetails.cashAmount,
            onlineAmount: tenderDetails.onlineAmount,
          });
          if (updateRes.data.success) settledOrder = updateRes.data.data;
        }
      } else {
        const updateRes = await api.patch(`/stores/${selectedStoreId}/orders/${orderId}/status`, {
          status: 'SETTLED',
          paymentMethod: tenderDetails.paymentMethod,
          cashAmount: tenderDetails.cashAmount,
          onlineAmount: tenderDetails.onlineAmount,
        });
        settledOrder = updateRes.data.data;
      }

      setPaymentModalOpen(false);
      setActivePaymentOrderId(null);
      setCart([]);
      setSelectedTableId('');
      setAppliedPromo(null);
      setIsCartOpen(false);
      setReceiptOrder(settledOrder);
    } catch (err) {
      console.error(err);
      alert('Failed to settle order: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalVerifyPayment = async () => {
    if (!activePaymentOrderId) return { success: false, message: 'No active order' };
    setIsVerifying(true);
    try {
      const res = await api.get(`/stores/${selectedStoreId}/orders/${activePaymentOrderId}/payment-status`);
      if (res.data.success && res.data.data.status === 'success') {
        const orderRes = await api.get(`/stores/${selectedStoreId}/orders/${activePaymentOrderId}`);
        const order = orderRes.data.data;
        setPaymentModalOpen(false);
        setActivePaymentOrderId(null);
        setCart([]);
        setSelectedTableId('');
        setAppliedPromo(null);
        setIsCartOpen(false);
        setReceiptOrder(order);
        return { success: true };
      } else {
        alert(res.data.data?.message || 'Payment not received yet.');
        return { success: false, message: res.data.data?.message || 'Payment pending' };
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to verify payment.';
      alert('Error: ' + msg);
      return { success: false, message: msg };
    } finally {
      setIsVerifying(false);
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
      <div className="shrink-0 flex overflow-x-auto p-2 gap-2 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 no-scrollbar">
        {menu.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategoryId(cat.id)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full font-medium text-xs transition-all duration-200 shadow-sm border flex items-center ${
              selectedCategoryId === cat.id
                ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 dark:hover:bg-zinc-700'
            }`}
          >
            {cat.icon && <span className="mr-1.5 opacity-70 scale-75">{cat.icon}</span>}
            {cat.name}
            {cat.itemCount !== undefined && <span className="ml-1.5 opacity-60 text-[10px]">({cat.itemCount})</span>}
          </button>
        ))}
      </div>

      {/* 2. Menu Items List (1 item per row for mobile optimization) */}
      <div className="flex-1 overflow-y-auto p-3 pb-20">
        <h3 className="font-semibold text-base mb-3 text-zinc-900 dark:text-zinc-100">
          {menu.find(c => c.id === selectedCategoryId)?.name || 'Items'}
        </h3>
        
        <div className="flex flex-col gap-2">
          {selectedCategoryItems.map(item => {
            const isDisabled = item.isManuallyDisabled || item.isSystemDisabled;
            // Check if item is already in cart to show a quick "+" button or quantity
            const cartItemCount = cart.filter(c => c.menuItem.id === item.id).reduce((sum, c) => sum + c.quantity, 0);

            return (
              <div
                key={item.id}
                className={`flex justify-between items-center bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm transition-shadow ${isDisabled ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:shadow-md cursor-pointer'}`}
                onClick={() => !isDisabled && initiateAddToCart(item)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className={`size-2 rounded-full border ${item.dietary === 'VEG'
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
                    <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm leading-tight">{item.name}</h4>
                  </div>
                  <div className="text-zinc-700 dark:text-zinc-300 font-bold text-sm">₹{item.price}</div>
                  {isDisabled && <div className="text-[10px] text-red-500 font-medium mt-0.5">Out of Stock</div>}
                  {!isDisabled && item.modifierGroups?.length > 0 && <div className="text-[10px] text-zinc-500 mt-0.5">Customizable</div>}
                </div>
                
                {!isDisabled && (
                  <div className="shrink-0 ml-3">
                    {cartItemCount > 0 ? (
                      <div className="bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-bold px-2 py-1 rounded text-xs border border-yellow-200 dark:border-yellow-800">
                        {cartItemCount} added
                      </div>
                    ) : (
                      <button className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium px-3 py-1.5 rounded text-xs transition-colors border border-zinc-200 dark:border-zinc-700">
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
        <div className="absolute bottom-3 left-3 right-3 z-10 animate-in slide-in-from-bottom-5">
          <Button 
            className="w-full h-12 bg-yellow-600 hover:bg-yellow-700 text-white shadow-xl flex justify-between items-center px-4 text-sm font-bold"
            onClick={() => setIsCartOpen(true)}
          >
            <div className="flex items-center gap-1.5 bg-yellow-700 px-2 py-1 rounded-full">
              <ShoppingCart01Icon size={16} />
              <span className="text-xs">{totalCartItems} items</span>
            </div>
            <span>View Cart →</span>
          </Button>
        </div>
      )}

      {/* 4. Fullscreen Cart Slide-up Modal */}
      {isCartOpen && (
        <div className="absolute inset-0 z-40 bg-white dark:bg-zinc-950 flex flex-col animate-in slide-in-from-bottom-full duration-300">
          <div className="shrink-0 p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsCartOpen(false)}
                className="p-1 -ml-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              >
                <ArrowLeft01Icon size={20} className="text-zinc-700 dark:text-zinc-300" />
              </button>
              <h2 className="text-base font-bold">Current Order</h2>
            </div>
            <div className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400 font-bold px-2 py-0.5 rounded-full text-xs">
              {totalCartItems} items
            </div>
          </div>

          {/* Cart Settings */}
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-col gap-2 bg-zinc-50 dark:bg-zinc-900/50">
            <div className="flex bg-zinc-200 dark:bg-zinc-800 p-1 rounded-lg">
              <button
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${orderType === 'DINE_IN' ? 'bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                onClick={() => setOrderType('DINE_IN')}
              >
                Dine-In
              </button>
              <button
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${orderType === 'TAKEAWAY' ? 'bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                onClick={() => { setOrderType('TAKEAWAY'); setSelectedTableId(''); }}
              >
                Takeaway
              </button>
            </div>

            {orderType === 'DINE_IN' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  <span className="flex items-center gap-1.5">
                    <DiningTableIcon size={14} className="text-zinc-400" />
                    Select Table:
                  </span>
                  <div className="flex items-center gap-1.5 text-[9px] font-medium text-zinc-500">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Free
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      Occupied
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                      Reserved
                    </span>
                  </div>
                </div>

                {/* Mobile-Friendly Table Selection Grid */}
                <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1 bg-zinc-100/60 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800 scrollbar-thin">
                  {tables.length === 0 ? (
                    <div className="col-span-3 text-center py-2 text-xs text-zinc-400">No tables configured</div>
                  ) : (
                    tables.map(t => {
                      const isReserved = t.status === 'RESERVED' || Boolean(t.activeReservation);
                      const isOccupied = ['OCCUPIED', 'PROCESSING', 'READY', 'SERVED', 'BILL_REQUESTED', 'ATTENTION'].includes(t.status) || Boolean(t.currentOrder);
                      const isAvailable = !isReserved && !isOccupied;
                      const isSelected = selectedTableId === t.id;
                      const isDisabled = !isAvailable;

                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => setSelectedTableId(t.id)}
                          className={`p-2 rounded-lg border text-xs flex flex-col items-center justify-center gap-1 transition-all ${
                            isDisabled
                              ? 'opacity-40 cursor-not-allowed bg-zinc-200/50 dark:bg-zinc-800/40 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400'
                              : isSelected
                              ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm ring-2 ring-primary ring-offset-1 dark:ring-offset-zinc-900'
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:border-zinc-300'
                          }`}
                        >
                          <span className="font-bold text-xs">Table {t.tableNumber}</span>
                          <span className="text-[9px] text-zinc-400">({t.capacity || 4}p)</span>
                          {isOccupied ? (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              Occupied
                            </span>
                          ) : isReserved ? (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                              Reserved
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              Free
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                <ShoppingCart01Icon size={32} className="mb-2 opacity-50" />
                <p className="text-sm font-medium">Cart is empty</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setIsCartOpen(false)}>Back to Menu</Button>
              </div>
            ) : (
              cart.map((c, idx) => (
                <div key={idx} className="flex flex-col gap-1 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{c.menuItem.name}</span>
                    <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">₹{(c.menuItem.price + c.modifiers.reduce((sum, m) => sum + m.price, 0)) * c.quantity}</span>
                  </div>
                  {c.modifiers.length > 0 && (
                    <div className="text-xs text-zinc-500 flex flex-col mb-0.5">
                      {c.modifiers.map(m => <span key={m.id}>+ {m.name}</span>)}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-1 pt-1 border-t border-zinc-200 dark:border-zinc-700/50">
                    <div className="text-[10px] font-medium text-zinc-500">₹{c.menuItem.price + c.modifiers.reduce((sum, m) => sum + m.price, 0)} each</div>
                    <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md p-1">
                      <button onClick={() => updateQuantity(idx, -1)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"><Remove01Icon size={16} /></button>
                      <span className="text-sm font-bold w-4 text-center">{c.quantity}</span>
                      <button onClick={() => updateQuantity(idx, 1)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"><Add01Icon size={16} /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Promo Input */}
          <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Promo Code" 
                className="flex-1 px-3 py-2 text-sm border border-zinc-300 rounded-lg dark:bg-zinc-950 dark:border-zinc-700 focus:outline-none"
                value={promoCodeInput}
                onChange={e => setPromoCodeInput(e.target.value)}
                disabled={!!appliedPromo}
              />
              {appliedPromo ? (
                <Button variant="outline" className="h-[38px] px-4 rounded-lg border-zinc-300 text-sm" onClick={() => { setAppliedPromo(null); setPromoCodeInput(''); }}>
                  Remove
                </Button>
              ) : (
                <Button variant="outline" className="h-[38px] px-4 rounded-lg border-zinc-300 text-sm" onClick={applyPromo}>
                  Apply
                </Button>
              )}
            </div>
            {appliedPromo && (
              <div className="text-xs text-green-600 mt-1 flex items-center gap-1 font-medium">
                <Tag01Icon size={14} /> Promo {appliedPromo.code} applied!
              </div>
            )}
          </div>

          {/* Totals & Actions */}
          <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col gap-2 shrink-0 pb-4">
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
            <div className="flex justify-between font-bold text-lg text-zinc-900 dark:text-zinc-100 border-t border-dashed border-zinc-300 dark:border-zinc-700 pt-2 mt-1">
              <span>Total</span>
              <span>₹{totalAmount}</span>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <Button
                disabled={cart.length === 0 || isSubmitting}
                onClick={handleOpenPaymentModal}
                className="w-full h-12 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 shadow"
              >
                {isSubmitting ? <Loading02Icon size={16} className="animate-spin" /> : `Pay & Settle (₹${totalAmount})`}
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  disabled={cart.length === 0 || isSubmitting}
                  onClick={() => handleCheckout('POSTPAID')}
                  variant="outline"
                  className="w-full h-11 text-sm font-bold border-zinc-300 dark:border-zinc-700"
                >
                  {isSubmitting ? <Loading02Icon size={16} className="animate-spin" /> : 'Send to Kitchen'}
                </Button>
                <Button
                  disabled={cart.length === 0 || isSubmitting}
                  onClick={() => handleCheckout('PREPAID')}
                  className="w-full h-11 text-sm font-bold bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 flex items-center justify-center gap-1.5 shadow"
                >
                  {isSubmitting ? <Loading02Icon size={16} className="animate-spin" /> : 'Quick Cash'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modifier Modal Overlay */}
      {modifierItem && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-end justify-center backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-t-2xl shadow-2xl w-full max-h-[90%] overflow-hidden flex flex-col animate-in slide-in-from-bottom-full">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950">
              <div>
                <h3 className="font-bold text-lg">{modifierItem.name}</h3>
                <p className="text-xs text-zinc-500">Customize your item</p>
              </div>
              <button onClick={() => setModifierItem(null)} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors bg-zinc-100 dark:bg-zinc-800">
                <Cancel01Icon size={20} className="text-zinc-600 dark:text-zinc-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {modifierItem.modifierGroups?.map(group => {
                const selectedCount = (selectedModifiers[group.id] || []).length;
                return (
                  <div key={group.id} className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-zinc-100 dark:bg-zinc-800/50 p-2.5 px-3 flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800">
                      <div>
                        <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{group.name}</div>
                        <div className="text-[10px] text-zinc-500">
                          {group.isRequired ? `Required (Min ${group.minSelections})` : 'Optional'} 
                          {group.maxSelections > 1 ? ` • Up to ${group.maxSelections}` : ''}
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
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
                          <label key={opt.id} className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${isSelected ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}>
                            <div className="flex items-center gap-2.5">
                              <div className={`size-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-yellow-600 border-yellow-600 text-white' : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'}`}>
                                {isSelected && <Tick02Icon size={12} />}
                              </div>
                              <span className={`font-medium text-sm ${isSelected ? 'text-yellow-900 dark:text-yellow-300' : 'text-zinc-700 dark:text-zinc-300'}`}>{opt.name}</span>
                            </div>
                            <span className="text-zinc-500 font-medium text-sm">+{opt.price}</span>
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
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 pb-6">
              <Button onClick={submitModifiers} className="w-full h-11 text-base font-bold bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg shadow-lg">
                Add to Cart
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal / SSE Waiting Overlay */}
      {qrModal.isOpen && (
        <div className="absolute inset-0 z-50 bg-white dark:bg-zinc-950 flex flex-col items-center justify-center p-4 animate-in zoom-in-95">
           <h2 className="text-xl font-bold mb-1 text-center text-zinc-900 dark:text-white">Collect Payment</h2>
           <p className="text-xs text-zinc-500 mb-6 text-center max-w-xs">Scan to complete payment for #{qrModal.orderId.slice(-6).toUpperCase()}</p>
           
           <div className="bg-white p-4 rounded-2xl shadow-xl border border-zinc-100 mb-6">
              <QRCodeSVG value={qrModal.url} size={200} />
           </div>
           
           <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 font-medium animate-pulse mb-6 bg-yellow-50 dark:bg-yellow-900/30 px-4 py-2 rounded-full text-sm">
             <Loading02Icon size={16} className="animate-spin" />
             <span>Waiting for payment...</span>
           </div>
           
           <Button variant="outline" className="w-full h-11 text-sm font-bold rounded-lg max-w-xs" onClick={() => setQrModal({ isOpen: false, url: '', orderId: '' })}>
             Cancel Payment
           </Button>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptOrder && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col items-center p-6 text-center">
             <div className="size-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3">
                <Tick02Icon size={24} />
             </div>
             <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">Order Successful!</h2>
             <p className="text-sm text-zinc-500 mb-6">Order #{receiptOrder.id.slice(-6).toUpperCase()} sent to kitchen.</p>
             
             {/* Hidden Printable Receipt */}
             <div style={{ display: 'none' }}>
               <div ref={receiptRef}>
                 {receiptOrder && storeData && (
                   <Receipt order={receiptOrder} storeData={storeData} />
                 )}
               </div>
             </div>

             <div className="w-full flex flex-col gap-2">
                <Button onClick={handlePrint} className="w-full h-11 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-bold rounded-lg shadow flex items-center justify-center gap-1.5">
                  <PrinterIcon size={16} /> Print Receipt
                </Button>
                 <Button variant="outline" className="w-full h-11 text-sm font-bold rounded-lg border-zinc-300 dark:border-zinc-700" onClick={() => setReceiptOrder(null)}>
                   Done
                 </Button>
              </div>
           </div>
         </div>
       )}

      {/* ─── PAYMENT BIFURCATION MODAL (CASH, ONLINE QR, SPLIT) ─── */}
      <PaymentBifurcationModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        totalAmount={totalAmount}
        title="Collect Payment"
        subtitle={orderType === 'DINE_IN' && selectedTableId ? `Table ${tables.find(t => t.id === selectedTableId)?.tableNumber || ''}` : 'Takeaway Order'}
        onSettle={handleModalSettle}
        onGenerateQR={handleGenerateModalQR}
        isSubmitting={isSubmitting}
        isVerifying={isVerifying}
        onVerifyPayment={handleModalVerifyPayment}
      />
    </div>
  );
};
