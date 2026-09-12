import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { Card, CardContent, Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Skeleton } from '@smo/ui';
import { Search01Icon, DiningTableIcon, PackageProcess01Icon, Chair01Icon, CashierIcon, Cancel01Icon, Delete02Icon, MinusSignIcon, PlusSignIcon, NoteEditIcon, Discount01Icon, CheckmarkCircle02Icon } from 'hugeicons-react';
import { QRCodeSVG } from 'qrcode.react';
import { Receipt } from './receipt';
import { PaymentBifurcationModal } from './payment-bifurcation-modal';

/* Stable, collision-free line ids so notes never get re-attached to the wrong row. */
let lineCounter = 0;
const createLineId = () => `ln_${Date.now().toString(36)}_${(lineCounter++).toString(36)}`;

export const POSTerminal = ({ selectedStoreId, token }) => {
  const [searchParams] = useSearchParams();
  const [menu, setMenu] = useState([]);
  const [tables, setTables] = useState([]);
  const [storeData, setStoreData] = useState(null);
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // UI State
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const isSearching = searchQuery.trim().length > 0;
  const searchInputRef = useRef(null);

  // Cart State
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState('DINE_IN');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [cartNotes, setCartNotes] = useState({});       // keyed by lineId
  const [activeNoteId, setActiveNoteId] = useState(null); // lineId

  // Modifier Modal State
  const [modifierItem, setModifierItem] = useState(null);
  const [selectedModifiers, setSelectedModifiers] = useState({});

  // Checkout State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [qrModal, setQrModal] = useState({ isOpen: false, url: '', orderId: '' });
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [activePaymentOrderId, setActivePaymentOrderId] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const receiptRef = useRef();

  const qrModalRef = useRef(qrModal);
  useEffect(() => { qrModalRef.current = qrModal; }, [qrModal]);

  const paymentModalOpenRef = useRef(paymentModalOpen);
  useEffect(() => { paymentModalOpenRef.current = paymentModalOpen; }, [paymentModalOpen]);

  const activePaymentOrderIdRef = useRef(activePaymentOrderId);
  useEffect(() => { activePaymentOrderIdRef.current = activePaymentOrderId; }, [activePaymentOrderId]);

  /* ─── Toasts (replaces window.alert) ─────────────────────────────── */
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const toastTimers = useRef(new Map());

  const dismissToast = useCallback((id) => {
    const timer = toastTimers.current.get(id);
    if (timer) { clearTimeout(timer); toastTimers.current.delete(id); }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const pushToast = useCallback((message, type = 'info', action = null) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev.slice(-2), { id, message, type, action }]);
    const timer = setTimeout(() => dismissToast(id), action ? 7000 : 3500);
    toastTimers.current.set(id, timer);
  }, [dismissToast]);

  useEffect(() => () => { toastTimers.current.forEach(clearTimeout); }, []);

  /* ─── Fetch Tables with Live Status ──────────────────────────────── */
  const fetchTables = useCallback(async () => {
    if (!selectedStoreId) return;
    try {
      const res = await api.get(`/stores/${selectedStoreId}/tables`);
      if (res.data.success) {
        setTables(res.data.data.filter(t => t.isActive));
      }
    } catch (err) {
      console.error('Failed to fetch tables with live status:', err);
    }
  }, [selectedStoreId]);

  /* ─── Data fetching ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!selectedStoreId) return;
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [menuRes, tablesRes, storeRes, promosRes] = await Promise.all([
          api.get(`/stores/${selectedStoreId}/menu`),
          api.get(`/stores/${selectedStoreId}/tables`),
          api.get(`/stores/${selectedStoreId}`),
          api.get(`/stores/${selectedStoreId}/promos`),
        ]);
        if (cancelled) return;
        if (menuRes.data.success) {
          setMenu(menuRes.data.data);
          if (menuRes.data.data.length > 0) setSelectedCategoryId(menuRes.data.data[0].id);
        }
        if (tablesRes.data.success) setTables(tablesRes.data.data.filter(t => t.isActive));
        if (storeRes.data.success) setStoreData(storeRes.data.data);
        if (promosRes.data.success) setPromos(promosRes.data.data);
      } catch (err) {
        if (!cancelled) setError('Failed to fetch data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [selectedStoreId]);

  /* Preselect table from URL query param (?table=...) if provided and available */
  useEffect(() => {
    const tableParam = searchParams.get('table');
    if (tableParam && tables.length > 0) {
      const found = tables.find(t => String(t.tableNumber) === String(tableParam) || t.id === tableParam);
      if (found && (found.status === 'AVAILABLE' || found.isAvailable)) {
        setSelectedTableId(found.id);
        setOrderType('DINE_IN');
      }
    }
  }, [searchParams, tables]);

  /* Reset everything when switching stores */
  useEffect(() => {
    setCart([]);
    setCartNotes({});
    setActiveNoteId(null);
    setAppliedPromo(null);
    setPromoCodeInput('');
    setSelectedTableId('');
    setOrderType('DINE_IN');
    setSearchQuery('');
    setReceiptOrder(null);
    setQrModal({ isOpen: false, url: '', orderId: '' });
    setPaymentModalOpen(false);
    setActivePaymentOrderId(null);
  }, [selectedStoreId]);

  /* ─── SSE stream with Real-time Table Status Sync ────────────────── */
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
          resetCartState();
          const orderRes = await api.get(`/stores/${selectedStoreId}/orders/${targetOrderId}`);
          if (orderRes.data.success) setReceiptOrder(orderRes.data.data);
        }

        // Live table availability refresh on order or reservation events
        const tableStatusEvents = [
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
        if (tableStatusEvents.includes(message.type)) {
          fetchTables();
        }
      } catch (e) { /* ignore malformed frames */ }
    };
    return () => eventSource.close();
  }, [selectedStoreId, token, fetchTables]);

  /* ─── QR polling ─────────────────────────────────────────────────── */
  useEffect(() => {
    let intervalId;
    let attempts = 0;
    if (qrModal.isOpen && qrModal.orderId) {
      intervalId = setInterval(async () => {
        attempts++;
        if (attempts > 100) {
          clearInterval(intervalId);
          pushToast('Payment QR expired. Please generate a new one.', 'error');
          setQrModal({ isOpen: false, url: '', orderId: '' });
          return;
        }
        try {
          const res = await api.get(`/stores/${selectedStoreId}/orders/${qrModal.orderId}/payment-status`);
          if (res.data.success && res.data.data.status === 'success') {
            clearInterval(intervalId);
            setQrModal({ isOpen: false, url: '', orderId: '' });
            resetCartState();
            const orderRes = await api.get(`/stores/${selectedStoreId}/orders/${qrModal.orderId}`);
            if (orderRes.data.success) setReceiptOrder(orderRes.data.data);
          }
        } catch (err) { /* keep polling */ }
      }, 3000);
    }
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [qrModal.isOpen, qrModal.orderId, selectedStoreId, pushToast]);

  /* ─── Global Escape-to-close ─────────────────────────────────────── */
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (modifierItem) { setModifierItem(null); return; }
      if (receiptOrder) { setReceiptOrder(null); return; }
      if (qrModal.isOpen && !isVerifying) { setQrModal({ isOpen: false, url: '', orderId: '' }); return; }
      if (paymentModalOpen && !isVerifying && !isSubmitting) { setPaymentModalOpen(false); return; }
      if (activeNoteId) { setActiveNoteId(null); return; }
      if (searchQuery) { setSearchQuery(''); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modifierItem, receiptOrder, qrModal.isOpen, paymentModalOpen, isVerifying, isSubmitting, activeNoteId, searchQuery]);

  /* ─── Cart helpers ───────────────────────────────────────────────── */
  const resetCartState = () => {
    setCart([]);
    setSelectedTableId('');
    setAppliedPromo(null);
    setPromoCodeInput('');
    setCartNotes({});
    setActiveNoteId(null);
  };

  const applyPromo = () => {
    const code = promoCodeInput.trim().toUpperCase();
    if (!code) return;
    const promo = promos.find(p => p.code === code && p.isActive);
    if (!promo) {
      pushToast('Invalid or inactive promo code.', 'error');
      setAppliedPromo(null);
      return;
    }
    const tempSubTotal = cart.reduce(
      (acc, c) => acc + ((c.menuItem.price + c.modifiers.reduce((s, m) => s + m.price, 0)) * c.quantity), 0
    );
    if (tempSubTotal < promo.minOrderValue) {
      pushToast(`Minimum order value for this promo is ₹${promo.minOrderValue}`, 'error');
      setAppliedPromo(null);
      return;
    }
    setAppliedPromo(promo);
    setPromoCodeInput('');
    pushToast(`Promo ${promo.code} applied`, 'success');
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoCodeInput('');
  };

  /* ─── Menu / item actions ────────────────────────────────────────── */
  const selectedCategoryItems = useMemo(() => {
    if (isSearching) {
      const q = searchQuery.trim().toLowerCase();
      return menu.flatMap(c => c.items).filter(item => item.name.toLowerCase().includes(q));
    }
    return menu.find(c => c.id === selectedCategoryId)?.items || [];
  }, [menu, selectedCategoryId, isSearching, searchQuery]);

  const initiateAddToCart = useCallback((item) => {
    if (item.isManuallyDisabled || item.isSystemDisabled) return;
    if (item.modifierGroups?.length > 0) {
      setModifierItem(item);
      setSelectedModifiers({});
    } else {
      finalizeAddToCart(item, []);
    }
  }, []);

  const finalizeAddToCart = (item, modifiers) => {
    setCart(prev => {
      if (modifiers.length > 0) {
        return [...prev, { lineId: createLineId(), menuItem: item, quantity: 1, modifiers }];
      }
      const existing = prev.find(c => c.menuItem.id === item.id && c.modifiers.length === 0);
      if (existing) {
        return prev.map(c => (c.lineId === existing.lineId ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { lineId: createLineId(), menuItem: item, quantity: 1, modifiers: [] }];
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
      if (maxSelections === 1) return { ...prev, [groupId]: [optionId] }; // radio behaviour
      if (current.length >= maxSelections) return prev;
      return { ...prev, [groupId]: [...current, optionId] };
    });
  };

  const modifierTotalPrice = useMemo(() => {
    if (!modifierItem) return 0;
    let total = modifierItem.price;
    modifierItem.modifierGroups.forEach(g => {
      const sel = selectedModifiers[g.id] || [];
      g.options.forEach(opt => { if (sel.includes(opt.id)) total += opt.price; });
    });
    return total;
  }, [modifierItem, selectedModifiers]);

  const submitModifiers = () => {
    if (!modifierItem) return;
    for (const group of modifierItem.modifierGroups) {
      const selectedCount = (selectedModifiers[group.id] || []).length;
      if (group.isRequired && selectedCount < group.minSelections) {
        pushToast(`Please select at least ${group.minSelections} for ${group.name}`, 'error');
        return;
      }
    }
    const mods = [];
    modifierItem.modifierGroups.forEach(g => {
      const selected = selectedModifiers[g.id] || [];
      g.options.forEach(opt => { if (selected.includes(opt.id)) mods.push(opt); });
    });
    finalizeAddToCart(modifierItem, mods);
  };

  const updateQuantity = (lineId, delta) => {
    const line = cart.find(c => c.lineId === lineId);
    if (!line) return;
    if (line.quantity + delta <= 0) {
      setCart(prev => prev.filter(c => c.lineId !== lineId));
      setCartNotes(prev => {
        if (!(lineId in prev)) return prev;
        const next = { ...prev };
        delete next[lineId];
        return next;
      });
      setActiveNoteId(id => (id === lineId ? null : id));
    } else {
      setCart(prev => prev.map(c => (c.lineId === lineId ? { ...c, quantity: c.quantity + delta } : c)));
    }
  };

  const removeLine = (lineId) => {
    setCart(prev => prev.filter(c => c.lineId !== lineId));
    setCartNotes(prev => {
      if (!(lineId in prev)) return prev;
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
    setActiveNoteId(id => (id === lineId ? null : id));
  };

  const getCartLineForItem = (item) => cart.find(c => c.menuItem.id === item.id && c.modifiers.length === 0);

  const quickAdd = (item, e) => { e.stopPropagation(); initiateAddToCart(item); };
  const quickRemove = (item, e) => {
    e.stopPropagation();
    const line = getCartLineForItem(item);
    if (line) updateQuantity(line.lineId, -1);
  };

  const updateCartNote = (lineId, note) =>
    setCartNotes(prev => ({ ...prev, [lineId]: note }));

  const clearCart = () => {
    const snapshot = { cart, cartNotes, appliedPromo, promoCodeInput };
    resetCartState();
    pushToast('Order cleared', 'info', {
      label: 'Undo',
      onClick: () => {
        setCart(snapshot.cart);
        setCartNotes(snapshot.cartNotes);
        setAppliedPromo(snapshot.appliedPromo);
        setPromoCodeInput(snapshot.promoCodeInput);
      },
    });
  };

  /* ─── Totals ─────────────────────────────────────────────────────── */
  const subTotal = useMemo(() =>
    cart.reduce((acc, c) => {
      const itemTotal = c.menuItem.price + c.modifiers.reduce((s, m) => s + m.price, 0);
      return acc + itemTotal * c.quantity;
    }, 0), [cart]);

  const discountAmount = useMemo(() => {
    if (!appliedPromo) return 0;
    let amount = 0;
    if (appliedPromo.discountType === 'PERCENTAGE') {
      amount = Math.round(subTotal * (appliedPromo.discountValue / 100));
      if (appliedPromo.maxDiscount && amount > appliedPromo.maxDiscount) amount = appliedPromo.maxDiscount;
    } else {
      amount = appliedPromo.discountValue;
    }
    return Math.min(amount, subTotal);
  }, [appliedPromo, subTotal]);

  const subTotalAfterDiscount = subTotal - discountAmount;

  const taxAmount = useMemo(() => {
    if (!Array.isArray(storeData?.taxRules)) return 0;
    return storeData.taxRules.reduce((sum, tax) => sum + Math.round(subTotal * (tax.rate / 100)), 0);
  }, [storeData, subTotal]);

  const totalAmount = subTotalAfterDiscount + taxAmount;
  const totalItemCount = useMemo(() => cart.reduce((a, c) => a + c.quantity, 0), [cart]);

  /* ─── Checkout ───────────────────────────────────────────────────── */
  const selectedTable = useMemo(() => tables.find(t => t.id === selectedTableId), [tables, selectedTableId]);
  const isSelectedTableUnavailable = orderType === 'DINE_IN' && selectedTable && (selectedTable.status !== 'AVAILABLE' && selectedTable.isAvailable === false);
  const needsTable = orderType === 'DINE_IN' && !selectedTableId;
  const checkoutDisabled = cart.length === 0 || isSubmitting || needsTable || isSelectedTableUnavailable;

  const handleCheckout = async (paymentModel, useQR = false) => {
    if (needsTable) { pushToast('Please select a table for Dine-In orders.', 'error'); return; }
    if (isSelectedTableUnavailable) { pushToast(`Table ${selectedTable?.tableNumber} is currently unavailable (occupied or reserved). Please pick an available table.`, 'error'); return; }
    if (cart.length === 0) return;
    setIsSubmitting(true);
    try {
      const payload = {
        type: orderType,
        paymentModel,
        origin: 'POS',
        tableId: orderType === 'DINE_IN' ? selectedTableId : undefined,
        promoCode: appliedPromo ? appliedPromo.code : undefined,
        items: cart.map((c) => ({
          menuItemId: c.menuItem.id,
          quantity: c.quantity,
          modifiers: c.modifiers.map(m => m.id),
          notes: cartNotes[c.lineId] || undefined,
        })),
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
      resetCartState();
      setReceiptOrder(res.data.data.order);
    } catch (err) {
      console.error(err);
      pushToast('Failed to place order: ' + (err.response?.data?.message || err.message), 'error');
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
        resetCartState();
        const orderRes = await api.get(`/stores/${selectedStoreId}/orders/${qrModal.orderId}`);
        if (orderRes.data.success) setReceiptOrder(orderRes.data.data);
      } else {
        pushToast(res.data.data?.message || 'Payment not received yet.', 'info');
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to verify order.';
      pushToast('Error: ' + msg, 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  /* ─── Payment Bifurcation Modal Handlers ────────────────────────── */
  const handleOpenPaymentModal = () => {
    if (needsTable) { pushToast('Please select a table for Dine-In orders.', 'error'); return; }
    if (isSelectedTableUnavailable) { pushToast(`Table ${selectedTable?.tableNumber} is currently unavailable (occupied or reserved). Please pick an available table.`, 'error'); return; }
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
        origin: 'POS',
        tableId: orderType === 'DINE_IN' ? selectedTableId : undefined,
        promoCode: appliedPromo ? appliedPromo.code : undefined,
        items: cart.map((c) => ({
          menuItemId: c.menuItem.id,
          quantity: c.quantity,
          modifiers: c.modifiers.map(m => m.id),
          notes: cartNotes[c.lineId] || undefined,
        })),
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
          origin: 'POS',
          tableId: orderType === 'DINE_IN' ? selectedTableId : undefined,
          promoCode: appliedPromo ? appliedPromo.code : undefined,
          items: cart.map((c) => ({
            menuItemId: c.menuItem.id,
            quantity: c.quantity,
            modifiers: c.modifiers.map(m => m.id),
            notes: cartNotes[c.lineId] || undefined,
          })),
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
      resetCartState();
      setReceiptOrder(settledOrder);
      pushToast('Payment settled successfully!', 'success');
    } catch (err) {
      console.error(err);
      pushToast('Failed to settle order: ' + (err.response?.data?.message || err.message), 'error');
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
        resetCartState();
        setReceiptOrder(order);
        pushToast('Payment verified and order settled!', 'success');
        return { success: true };
      } else {
        pushToast(res.data.data?.message || 'Payment not received yet.', 'info');
        return { success: false, message: res.data.data?.message || 'Payment pending' };
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to verify payment.';
      pushToast('Error: ' + msg, 'error');
      return { success: false, message: msg };
    } finally {
      setIsVerifying(false);
    }
  };

  /* ─── Receipt printing via hidden iframe (avoids popup blockers) ─── */
  const printReceipt = useCallback(() => {
    if (!receiptRef.current) return;
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!doctype html>
      <html>
        <head>
          <title>Receipt</title>
          <style>
            body { font-family: monospace; font-size: 14px; margin: 0; padding: 20px; }
            .flex { display: flex; } .justify-between { justify-content: space-between; }
            .text-center { text-align: center; } .text-right { text-align: right; }
            .font-bold { font-weight: bold; } .text-xl { font-size: 1.25rem; }
            .text-lg { font-size: 1.125rem; } .mb-4 { margin-bottom: 1rem; }
            .mb-2 { margin-bottom: 0.5rem; } .mb-1 { margin-bottom: 0.25rem; }
            .pb-2 { padding-bottom: 0.5rem; } .pl-2 { padding-left: 0.5rem; }
            .uppercase { text-transform: uppercase; } .border-b { border-bottom: 1px dashed black; }
            .flex-1 { flex: 1; } .w-10 { width: 2.5rem; } .w-16 { width: 4rem; }
            .text-xs { font-size: 0.75rem; } .pr-2 { padding-right: 0.5rem; }
          </style>
        </head>
        <body>${receiptRef.current.innerHTML}</body>
      </html>
    `);
    doc.close();

    const win = iframe.contentWindow;
    setTimeout(() => {
      try { win.focus(); win.print(); } finally {
        setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 300);
      }
    }, 250);
  }, []);

  /* ─── Render ─────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex h-full gap-2 p-2">
        <Skeleton className="flex-1 h-full rounded-xl" />
        <Skeleton className="w-80 h-full rounded-xl" />
      </div>
    );
  }
  if (error) return <div className="text-red-500 p-4">{error}</div>;

  return (
    <div className="h-full grid grid-cols-[1fr_320px] gap-2 overflow-hidden relative bg-zinc-100 dark:bg-zinc-950 p-2">

      {/* ─── TOASTS ─── */}
      <div
        aria-live="polite"
        className="pointer-events-none absolute top-3 right-3 z-[100] flex flex-col items-end gap-2 max-w-[320px]"
      >
        {toasts.map(t => {
          const tone =
            t.type === 'error'
              ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/80 dark:text-red-300 dark:border-red-900'
              : t.type === 'success'
                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/80 dark:text-green-300 dark:border-green-900'
                : 'bg-white text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700';
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium shadow-lg ${tone}`}
            >
              <span className="min-w-0 flex-1">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  onClick={() => { t.action.onClick(); dismissToast(t.id); }}
                  className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold underline underline-offset-2 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  {t.action.label}
                </button>
              )}
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismissToast(t.id)}
                className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
              >
                <Cancel01Icon size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {/* ─── LEFT: MENU AREA ─── */}
      <div className="flex flex-col h-full min-h-0 overflow-hidden bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">

        {/* Top Bar */}
        <div className="shrink-0 flex gap-2 items-center border-b border-zinc-200 dark:border-zinc-800 px-3 py-2">
          <div className="flex-1 relative min-w-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
              <Search01Icon size={16} />
            </span>
            <input
              ref={searchInputRef}
              type="text"
              aria-label="Search menu"
              placeholder="Search menu…"
              className="w-full h-8 pl-9 pr-8 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none rounded-md focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {isSearching && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700"
              >
                <Cancel01Icon size={13} />
              </button>
            )}
          </div>

          <div className="shrink-0 flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-md">
            <button
              type="button"
              aria-pressed={orderType === 'DINE_IN'}
              className={`flex items-center gap-1 px-2.5 h-7 text-[11px] font-bold rounded transition-colors ${orderType === 'DINE_IN' ? 'bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              onClick={() => setOrderType('DINE_IN')}
            >
              <Chair01Icon size={12} />
              Dine-In
            </button>
            <button
              type="button"
              aria-pressed={orderType === 'TAKEAWAY'}
              className={`flex items-center gap-1 px-2.5 h-7 text-[11px] font-bold rounded transition-colors ${orderType === 'TAKEAWAY' ? 'bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              onClick={() => { setOrderType('TAKEAWAY'); setSelectedTableId(''); }}
            >
              <PackageProcess01Icon size={12} /> Takeaway
            </button>
          </div>

          {orderType === 'DINE_IN' && (
            <div className="relative shrink-0">
              <DiningTableIcon
                size={13}
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 z-10"
              />
              <Select value={selectedTableId} onValueChange={setSelectedTableId}>
                <SelectTrigger
                  aria-label="Select table"
                  className={`w-36 h-8 bg-white dark:bg-zinc-900 text-xs pl-7 ${needsTable ? 'border-amber-400 dark:border-amber-500' : ''}`}
                >
                  <SelectValue placeholder="Select Table" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {tables.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-zinc-500">No tables configured</div>
                  ) : (
                    tables.map(t => {
                      const isReserved = t.status === 'RESERVED' || Boolean(t.activeReservation);
                      const isOccupied = ['OCCUPIED', 'PROCESSING', 'READY', 'SERVED', 'BILL_REQUESTED', 'ATTENTION'].includes(t.status) || Boolean(t.currentOrder);
                      const isAvailable = !isReserved && !isOccupied;

                      return (
                        <SelectItem
                          key={t.id}
                          value={t.id}
                          disabled={!isAvailable}
                          className="text-xs py-1.5 cursor-pointer"
                        >
                          <div className="flex items-center justify-between w-full gap-3">
                            <span className="font-semibold">Table {t.tableNumber} <span className="text-[10px] text-zinc-400 font-normal">({t.capacity || 4}p)</span></span>
                            {isOccupied ? (
                              <span className="ml-2 px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                Occupied
                              </span>
                            ) : isReserved ? (
                              <span className="ml-2 px-1.5 py-0.2 rounded text-[9px] font-bold bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                                Reserved
                              </span>
                            ) : (
                              <span className="ml-2 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                Free
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Dine-In Table Selection Strip with Small Chips */}
        {orderType === 'DINE_IN' && (
          <div className="shrink-0 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-zinc-700 dark:text-zinc-300">
                <DiningTableIcon size={14} className="text-zinc-400" />
                <span>Select Table:</span>
                {selectedTableId && (
                  <span className="text-primary font-bold text-[11px] bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full ml-1">
                    Table {tables.find(t => t.id === selectedTableId)?.tableNumber} Selected
                  </span>
                )}
              </div>

              {/* Status Legend Chips */}
              <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-medium">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Free
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <span className="size-1.5 rounded-full bg-blue-500" /> Occupied
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                  <span className="size-1.5 rounded-full bg-pink-500" /> Reserved
                </span>
              </div>
            </div>

            {/* Table Buttons Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
              {tables.length === 0 ? (
                <div className="text-xs text-zinc-400 py-1 italic">No tables configured for this store</div>
              ) : (
                tables.map((t) => {
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
                      title={
                        isOccupied
                          ? `Table ${t.tableNumber} is Occupied with dining guests`
                          : isReserved
                          ? `Table ${t.tableNumber} is Reserved`
                          : `Select Table ${t.tableNumber} (${t.capacity || 4} seats)`
                      }
                      className={`h-8 px-2.5 rounded-lg border text-xs flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
                        isDisabled
                          ? 'opacity-40 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800/40 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 select-none'
                          : isSelected
                          ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm ring-2 ring-primary ring-offset-1 dark:ring-offset-zinc-900'
                          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <span className="font-bold">Table {t.tableNumber}</span>
                      <span className="text-[10px] text-zinc-400">({t.capacity || 4}p)</span>

                      {/* Small Status Chip */}
                      {isOccupied ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          Occupied
                        </span>
                      ) : isReserved ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                          Reserved
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
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

        {/* Category Tabs */}
        <div className="shrink-0 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 flex gap-1.5 overflow-x-auto">
          {menu.map(cat => {
            const active = selectedCategoryId === cat.id && !isSearching;
            return (
              <button
                type="button"
                key={cat.id}
                aria-pressed={active}
                onClick={() => { setSelectedCategoryId(cat.id); setSearchQuery(''); }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${active
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                  : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                  }`}
              >
                {cat.icon && <span>{cat.icon}</span>}
                {cat.name}
                {cat.itemCount !== undefined && (
                  <span className={`text-[9px] px-1 py-0.5 rounded-full tabular-nums ${active ? 'bg-white/20 dark:bg-black/20' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
                    {cat.itemCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Banner */}
        {isSearching && (
          <div className="shrink-0 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-[11px] font-medium flex items-center gap-2 border-b border-yellow-100 dark:border-yellow-500/20">
            <Search01Icon size={16} />
            <span className="truncate">
              {selectedCategoryItems.length} result{selectedCategoryItems.length === 1 ? '' : 's'} for “{searchQuery}”
            </span>
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery('')}
              className="ml-auto rounded p-0.5 hover:bg-yellow-100 dark:hover:bg-yellow-500/20"
            >
              <Cancel01Icon size={14} />
            </button>
          </div>
        )}

        {/* Products Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          {selectedCategoryItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center dark:text-zinc-400">
              <div className="text-4xl mb-2 opacity-50 size-20 p-6 rounded-xl border-2 border-zinc-100/10 flex justify-center items-center bg-primary/20">
                <Search01Icon size={64} />
              </div>
              <p className="text-sm">No items found</p>
              {isSearching && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-xs font-semibold text-yellow-600 hover:underline dark:text-yellow-400"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 auto-rows-max">
              {selectedCategoryItems.map(item => {
                const isDisabled = item.isManuallyDisabled || item.isSystemDisabled;
                const line = getCartLineForItem(item);
                const inCart = Boolean(line);
                return (
                  <Card
                    key={item.id}
                    role="button"
                    tabIndex={isDisabled ? -1 : 0}
                    aria-disabled={isDisabled}
                    aria-label={`Add ${item.name}, ₹${item.price}`}
                    className={`cursor-pointer transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 border-zinc-200 dark:border-zinc-800 relative ${isDisabled ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                    onClick={() => !isDisabled && initiateAddToCart(item)}
                    onKeyDown={(e) => {
                      if (isDisabled) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        initiateAddToCart(item);
                      }
                    }}
                  >
                    <CardContent className="p-2.5 flex flex-col h-full relative">
                      <span
                        aria-hidden="true"
                        className={`absolute top-1.5 right-1.5 size-2.5 rounded-full border ${item.dietary === 'VEG' ? 'bg-green-500 border-green-600' :
                          item.dietary === 'NON_VEG' ? 'bg-red-500 border-red-600' :
                            item.dietary === 'VEGAN' ? 'bg-cyan-400 border-cyan-500' :
                              item.dietary === 'EGG' ? 'bg-amber-400 border-amber-500' :
                                'bg-zinc-300 border-zinc-400'
                          }`}
                      />
                      <div className="flex-1 mb-1.5 pr-3">
                        <h4 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight">{item.name}</h4>
                        {isDisabled && (
                          <span className="text-[9px] text-red-500 font-bold mt-0.5 inline-block uppercase">Sold Out</span>
                        )}
                      </div>
                      <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mt-auto flex justify-between items-end">
                        ₹{item.price}
                        {item.modifierGroups?.length > 0 && (
                          <span className="text-[9px] font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">Options</span>
                        )}
                      </div>

                      {/* Quick overlay for non-modifier items */}
                      {!isDisabled && !item.modifierGroups?.length && inCart && (
                        <div
                          className="absolute inset-0 bg-black/40 dark:bg-black/60 rounded-lg flex items-center justify-center gap-2 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            aria-label={`Remove one ${item.name}`}
                            onClick={(e) => quickRemove(item, e)}
                            className="bg-white dark:bg-zinc-900 text-red-500 p-1.5 rounded-full shadow-lg hover:scale-110 transition-transform"
                          >
                            <MinusSignIcon size={14} />
                          </button>
                          <span className="text-white font-bold text-sm bg-black/50 px-2 py-0.5 rounded-full tabular-nums">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Add one more ${item.name}`}
                            onClick={(e) => quickAdd(item, e)}
                            className="bg-white dark:bg-zinc-900 text-green-500 p-1.5 rounded-full shadow-lg hover:scale-110 transition-transform"
                          >
                            <PlusSignIcon size={14} />
                          </button>
                        </div>
                      )}
                      {!isDisabled && inCart && (
                        <div className="absolute -top-1.5 -left-1.5 bg-yellow-500 text-white text-[10px] font-bold size-5 rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-zinc-900 tabular-nums">
                          {line.quantity}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── RIGHT: CART SIDEBAR ─── */}
      <div className="flex flex-col h-full min-h-0 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">

        {/* Cart Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-bold">
              <CashierIcon size={14} /> Current Order
              {cart.length > 0 && (
                <span className="rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400">
                  {totalItemCount}
                </span>
              )}
            </h3>
            {orderType === 'DINE_IN' ? (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                selectedTableId
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-amber-500/10 text-amber-600 border-amber-500/30 animate-pulse'
              }`}>
                {selectedTableId ? `Table ${tables.find(t => t.id === selectedTableId)?.tableNumber || ''}` : 'Select Table'}
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                Takeaway
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              title="Clear cart"
              aria-label="Clear cart"
              onClick={clearCart}
              className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
            >
              <Delete02Icon size={14} />
            </button>
          )}
        </div>

        {/* Cart Items — the ONLY scrolling region */}
        <div className="flex flex-1 min-h-0 flex-col gap-1.5 overflow-y-auto p-2">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-zinc-400">
              <div className="text-3xl mb-2 opacity-40">🛒</div>
              <p className="text-xs">Cart is empty</p>
              <p className="text-[10px] mt-1 opacity-70">Tap a menu item to add it</p>
            </div>
          ) : (
            cart.map((c) => {
              const lineTotal = (c.menuItem.price + c.modifiers.reduce((s, m) => s + m.price, 0)) * c.quantity;
              const isNoteOpen = activeNoteId === c.lineId;
              return (
                <div
                  key={c.lineId}
                  className="shrink-0 rounded-lg border border-zinc-100 bg-zinc-50 p-2 dark:border-zinc-800/60 dark:bg-zinc-800/30"
                >
                  <div className="flex items-center gap-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold">{c.menuItem.name}</p>
                      {c.modifiers.length > 0 && (
                        <p className="truncate text-[10px] text-zinc-500">+ {c.modifiers.map(m => m.name).join(', ')}</p>
                      )}
                      {cartNotes[c.lineId] && (
                        <p className="truncate text-[10px] italic text-yellow-600 dark:text-yellow-400">“{cartNotes[c.lineId]}”</p>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] font-bold tabular-nums">₹{lineTotal}</span>
                    <div className="flex shrink-0 items-center rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                      <button
                        type="button"
                        aria-label={`Decrease ${c.menuItem.name}`}
                        onClick={() => updateQuantity(c.lineId, -1)}
                        className="p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <MinusSignIcon size={14} />
                      </button>
                      <span className="w-4 text-center text-[11px] font-bold tabular-nums">{c.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Increase ${c.menuItem.name}`}
                        onClick={() => updateQuantity(c.lineId, 1)}
                        className="p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <PlusSignIcon size={14} />
                      </button>
                    </div>
                    <button
                      type="button"
                      title="Add note"
                      aria-label={`Add note to ${c.menuItem.name}`}
                      aria-expanded={isNoteOpen}
                      onClick={() => setActiveNoteId(isNoteOpen ? null : c.lineId)}
                      className={`shrink-0 rounded-md p-1 transition-colors ${isNoteOpen
                        ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400'
                        : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                    >
                      <NoteEditIcon size={14} />
                    </button>
                    <button
                      type="button"
                      title="Remove line"
                      aria-label={`Remove ${c.menuItem.name}`}
                      onClick={() => removeLine(c.lineId)}
                      className="shrink-0 rounded-md p-1 text-zinc-400 transition-colors hover:text-red-500"
                    >
                      <Cancel01Icon size={14} />
                    </button>
                  </div>
                  {isNoteOpen && (
                    <input
                      autoFocus
                      value={cartNotes[c.lineId] || ''}
                      onChange={e => updateCartNote(c.lineId, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') setActiveNoteId(null); }}
                      placeholder="Special instructions…"
                      aria-label="Special instructions"
                      className="mt-1.5 w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-yellow-500 dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── PINNED FOOTER ── */}
        <div className="shrink-0 border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/50">

          {/* Promo */}
          <div className="flex items-center gap-1.5 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <span className="shrink-0 text-zinc-500"><Discount01Icon size={14} /></span>
            {appliedPromo ? (
              <>
                <span className="flex min-w-0 flex-1 items-center gap-1 truncate text-[11px] font-semibold text-green-600 dark:text-green-400">
                  <CheckmarkCircle02Icon size={14} /> {appliedPromo.code} applied
                </span>
                <button
                  type="button"
                  title="Remove promo"
                  aria-label="Remove promo"
                  onClick={removePromo}
                  className="shrink-0 rounded-md p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Cancel01Icon size={14} />
                </button>
              </>
            ) : (
              <>
                <input
                  value={promoCodeInput}
                  onChange={e => setPromoCodeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyPromo()}
                  placeholder="Promo code"
                  aria-label="Promo code"
                  disabled={cart.length === 0}
                  className="h-7 min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-2 text-[11px] uppercase tracking-wide focus:outline-none focus:ring-1 focus:ring-yellow-500 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900"
                />
                <button
                  type="button"
                  title="Apply promo"
                  onClick={applyPromo}
                  disabled={cart.length === 0 || !promoCodeInput.trim()}
                  className="shrink-0 rounded-md bg-zinc-200 px-2 py-1 text-xs text-zinc-900 transition-colors hover:bg-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600"
                >
                  Apply
                </button>
              </>
            )}
          </div>

          {/* Totals */}
          <div className="flex flex-col gap-0.5 px-3 py-2 text-[11px]">
            <div className="flex justify-between text-zinc-500">
              <span>Subtotal</span><span className="tabular-nums">₹{subTotal}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between font-medium text-green-600 dark:text-green-400">
                <span>Discount</span><span className="tabular-nums">−₹{discountAmount}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between text-zinc-500">
                <span>Taxes</span><span className="tabular-nums">₹{taxAmount}</span>
              </div>
            )}
            <div className="mt-0.5 flex justify-between border-t border-dashed border-zinc-300 pt-1.5 text-sm font-bold text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
              <span>Total</span><span className="tabular-nums">₹{totalAmount}</span>
            </div>
          </div>

          {/* Checkout Buttons */}
          <div className="space-y-2 px-3 pb-3">
            {needsTable && cart.length > 0 && (
              <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                Please select a table to continue
              </p>
            )}
            {isSelectedTableUnavailable && cart.length > 0 && (
              <p className="text-[10px] font-medium text-red-600 dark:text-red-400">
                Table {selectedTable?.tableNumber} is not available (occupied or reserved). Please pick an available table.
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                disabled={checkoutDisabled}
                onClick={handleOpenPaymentModal}
                title="Collect payment (Cash, UPI QR, or Split Payment)"
                className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 shadow-md"
              >
                <CashierIcon size={20} />
                <span>{isSubmitting ? 'Processing…' : `Pay & Settle (₹${totalAmount})`}</span>
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={checkoutDisabled}
                  onClick={() => handleCheckout('POSTPAID')}
                  title="Send to kitchen, pay later"
                  className="w-full"
                >
                  {isSubmitting ? <span className="animate-pulse">Processing…</span> : 'Postpaid'}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={checkoutDisabled}
                  onClick={() => handleCheckout('PREPAID')}
                  title="Fast direct cash settle"
                  className="w-full"
                >
                  {isSubmitting ? <span className="animate-pulse">Processing…</span> : 'Quick Cash'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODIFIER MODAL ─── */}
      {modifierItem && (
        <div
          className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Customize ${modifierItem.name}`}
        >
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-full">
            <div className="shrink-0 p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <div className="min-w-0">
                <h3 className="font-bold text-lg truncate">{modifierItem.name}</h3>
                <p className="text-sm text-zinc-500">Customize your item</p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setModifierItem(null)}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"
              >
                <Cancel01Icon size={16} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-5">
              {modifierItem.modifierGroups.map(group => {
                const selected = selectedModifiers[group.id] || [];
                return (
                  <div key={group.id} className="flex flex-col gap-2.5">
                    <div className="flex justify-between items-center">
                      <h4 className="font-semibold text-sm">{group.name}</h4>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${group.isRequired && selected.length < group.minSelections
                        ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'
                        }`}>
                        {group.isRequired ? `Required (Min ${group.minSelections})` : 'Optional'} • Max {group.maxSelections}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {group.options.map(opt => {
                        const isSelected = selected.includes(opt.id);
                        return (
                          <button
                            type="button"
                            key={opt.id}
                            aria-pressed={isSelected}
                            onClick={() => handleModifierToggle(group.id, opt.id, group.maxSelections)}
                            className={`flex justify-between items-center p-2.5 border rounded-lg transition-colors ${isSelected
                              ? 'border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800/50'
                              : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
                              }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`w-4 h-4 border rounded flex items-center justify-center shrink-0 ${isSelected
                                ? 'bg-zinc-900 border-zinc-900 dark:bg-zinc-100 dark:border-zinc-100 text-white dark:text-zinc-900'
                                : 'border-zinc-300 dark:border-zinc-600'
                                }`}>
                                {isSelected && <CheckmarkCircle02Icon size={12} />}
                              </div>
                              <span className="font-medium text-sm text-left">{opt.name}</span>
                            </div>
                            {opt.price > 0 && <span className="text-xs font-semibold tabular-nums">+₹{opt.price}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="shrink-0 p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
              <Button type="button" onClick={submitModifiers} className="w-full h-11 flex items-center justify-center gap-2">
                <span>Add to Cart</span>
                <span className="tabular-nums">• ₹{modifierTotalPrice}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── QR PAYMENT MODAL ─── */}
      {qrModal.isOpen && (
        <div
          className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-6 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Scan to pay"
        >
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center text-center">
            <div className="bg-yellow-50 dark:bg-yellow-500/10 p-3 rounded-full mb-4 text-3xl">📱</div>
            <h3 className="font-bold text-xl mb-1">Scan to Pay</h3>
            <p className="text-sm text-zinc-500 mb-4">Please scan this QR code to pay.</p>
            <div className="bg-white p-4 rounded-xl shadow-inner border border-zinc-100 inline-block mb-4">
              <QRCodeSVG value={qrModal.url} size={200} level="M" includeMargin={false} />
            </div>
            <div className="font-bold text-2xl text-zinc-900 dark:text-zinc-100 mb-2 tabular-nums">₹{totalAmount}</div>
            <div className="flex items-center justify-center gap-2 text-yellow-600 dark:text-yellow-400 font-medium mb-6">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
              </span>
              Waiting for payment…
            </div>
            <div className="w-full flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={isVerifying}
                onClick={() => setQrModal({ isOpen: false, url: '', orderId: '' })}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                disabled={isVerifying}
                onClick={verifyOrder}
              >
                {isVerifying ? 'Verifying…' : 'Verify Payment'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── RECEIPT MODAL ─── */}
      {receiptOrder && (
        <div
          className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-6 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Order receipt"
        >
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl flex flex-col w-full max-w-md max-h-[90vh] overflow-hidden">
            <div className="shrink-0 p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
              <h3 className="font-bold flex items-center gap-2">
                <CheckmarkCircle02Icon size={18} /> Order Successful
              </h3>
              <button
                type="button"
                aria-label="Close receipt"
                onClick={() => setReceiptOrder(null)}
                className="p-1 hover:bg-green-100 dark:hover:bg-green-800 rounded-full"
              >
                <Cancel01Icon size={16} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-zinc-100 dark:bg-black">
              <Receipt ref={receiptRef} order={receiptOrder} storeData={storeData} />
            </div>
            <div className="shrink-0 p-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setReceiptOrder(null)}>
                Close
              </Button>
              <Button
                type="button"
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white"
                onClick={printReceipt}
              >
                Print Receipt
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
        subtitle={orderType === 'DINE_IN' && selectedTable ? `Table ${selectedTable.tableNumber}` : 'Takeaway Order'}
        onSettle={handleModalSettle}
        onGenerateQR={handleGenerateModalQR}
        isSubmitting={isSubmitting}
        isVerifying={isVerifying}
        onVerifyPayment={handleModalVerifyPayment}
      />
    </div>
  );
};