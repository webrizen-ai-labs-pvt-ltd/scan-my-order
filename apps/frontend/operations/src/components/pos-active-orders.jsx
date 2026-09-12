import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../lib/api';
import { Card, CardContent, Button, Skeleton } from '@smo/ui';
import { Money01Icon, QrCodeIcon, Search01Icon, Cancel01Icon, Tick02Icon, PrinterIcon, UserGroupIcon } from 'hugeicons-react';
import { QRCodeSVG } from 'qrcode.react';
import { Receipt } from './receipt';
import { PaymentBifurcationModal } from './payment-bifurcation-modal';

export const POSActiveOrders = ({ selectedStoreId, token }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [qrModal, setQrModal] = useState({ isOpen: false, url: '', orderId: '', sessionId: null, totalAmount: 0, tableNumber: null });
  const [activePaymentGroup, setActivePaymentGroup] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const [storeData, setStoreData] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const receiptRef = useRef();

  const qrModalRef = useRef(qrModal);
  useEffect(() => {
    qrModalRef.current = qrModal;
  }, [qrModal]);

  const activePaymentGroupRef = useRef(activePaymentGroup);
  useEffect(() => {
    activePaymentGroupRef.current = activePaymentGroup;
  }, [activePaymentGroup]);

  const paymentModalOpenRef = useRef(paymentModalOpen);
  useEffect(() => {
    paymentModalOpenRef.current = paymentModalOpen;
  }, [paymentModalOpen]);

  const fetchOrders = async (storeIdToFetch) => {
    if (!storeIdToFetch) return;
    try {
      const res = await api.get(`/stores/${storeIdToFetch}/orders`);
      if (res.data.success) {
        setOrders(res.data.data);
      }
    } catch (err) {
      setError('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStoreId) {
      setLoading(true);
      fetchOrders(selectedStoreId);
      
      api.get(`/stores/${selectedStoreId}`).then(res => {
        if (res.data.success) setStoreData(res.data.data);
      }).catch(err => console.error("Failed to fetch store data", err));
      
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const eventSource = new EventSource(`${baseUrl}/stores/${selectedStoreId}/orders/stream?token=${token}`);
      
      eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          fetchOrders(selectedStoreId);
          
          const currentModal = qrModalRef.current;
          const activeGroup = activePaymentGroupRef.current;
          if (
            (message.type === 'ORDER_PROCESSING' || message.type === 'ORDER_SETTLED' || message.type === 'TABLE_SESSION_SETTLED') &&
            ((currentModal.isOpen && (message.data?.id === currentModal.orderId || message.data?.tableSessionId === currentModal.sessionId)) ||
             (paymentModalOpenRef.current && activeGroup && (
               (activeGroup.tableSessionId && message.data?.tableSessionId === activeGroup.tableSessionId) ||
               (activeGroup.orders?.some(o => o.id === message.data?.id))
             )))
          ) {
            setQrModal({ isOpen: false, url: '', orderId: '', sessionId: null, totalAmount: 0, tableNumber: null });
            setPaymentModalOpen(false);
            setActivePaymentGroup(null);
          }
        } catch(e) {}
      };

      return () => eventSource.close();
    }
  }, [selectedStoreId, token]);

  /* ─── Payment Bifurcation Modal Handlers ────────────────────────── */
  const handleOpenPaymentModal = (group) => {
    setActivePaymentGroup(group);
    setPaymentModalOpen(true);
  };

  const handleGenerateModalQR = async (onlineAmount) => {
    if (!activePaymentGroup) return;
    if (activePaymentGroup.tableSessionId) {
      const linkRes = await api.post(`/stores/${selectedStoreId}/orders/sessions/${activePaymentGroup.tableSessionId}/payment-link`, {
        onlineAmount
      });
      return { url: linkRes.data.data.short_url };
    } else {
      const order = activePaymentGroup.orders[0];
      const linkRes = await api.post(`/stores/${selectedStoreId}/orders/${order.id}/payment-link`, {
        onlineAmount
      });
      return { url: linkRes.data.data.short_url };
    }
  };

  const handleModalSettle = async (tenderDetails) => {
    if (!activePaymentGroup) return;
    setIsSubmittingPayment(true);
    try {
      if (activePaymentGroup.tableSessionId) {
        const sessId = activePaymentGroup.tableSessionId;
        await api.post(`/stores/${selectedStoreId}/orders/sessions/${sessId}/settle`, {
          paymentMethod: tenderDetails.paymentMethod,
          cashAmount: tenderDetails.cashAmount,
          onlineAmount: tenderDetails.onlineAmount,
        });
        const billRes = await api.get(`/stores/${selectedStoreId}/orders/sessions/${sessId}`);
        if (billRes.data.success) {
          const b = billRes.data.data;
          setReceiptOrder({
            id: `TAB-${b.session.pin}`,
            createdAt: b.session.createdAt,
            type: 'DINE_IN',
            paymentModel: 'POSTPAID',
            paymentMethod: tenderDetails.paymentMethod,
            cashAmount: tenderDetails.cashAmount,
            onlineAmount: tenderDetails.onlineAmount,
            table: { tableNumber: b.session.tableNumber },
            subTotal: b.subTotal,
            discountAmount: b.discountAmount,
            taxAmount: b.taxAmount,
            totalAmount: b.totalAmount,
            items: b.aggregatedItems.map(i => ({
              quantity: i.quantity,
              priceAtOrder: i.price,
              menuItem: { name: i.name },
              modifiers: (i.modifiers || []).map(m => ({ modifierOption: { name: m } }))
            }))
          });
        }
      } else {
        const order = activePaymentGroup.orders[0];
        await api.patch(`/stores/${selectedStoreId}/orders/${order.id}/status`, {
          status: 'SETTLED',
          paymentMethod: tenderDetails.paymentMethod,
          cashAmount: tenderDetails.cashAmount,
          onlineAmount: tenderDetails.onlineAmount,
        });
        const orderRes = await api.get(`/stores/${selectedStoreId}/orders/${order.id}`);
        if (orderRes.data.success) {
          setReceiptOrder(orderRes.data.data);
        }
      }

      setPaymentModalOpen(false);
      setActivePaymentGroup(null);
      fetchOrders(selectedStoreId);
    } catch (err) {
      console.error(err);
      setError('Failed to settle bill: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleModalVerifyPayment = async () => {
    if (!activePaymentGroup) return { success: false, message: 'No active table selected' };
    setIsVerifying(true);
    try {
      if (activePaymentGroup.tableSessionId) {
        const sessId = activePaymentGroup.tableSessionId;
        const res = await api.post(`/stores/${selectedStoreId}/orders/sessions/${sessId}/verify-payment`);
        if (res.data.success && res.data.data.status === 'SETTLED') {
          const billRes = await api.get(`/stores/${selectedStoreId}/orders/sessions/${sessId}`);
          if (billRes.data.success) {
            const b = billRes.data.data;
            setReceiptOrder({
              id: `TAB-${b.session.pin}`,
              createdAt: b.session.createdAt,
              type: 'DINE_IN',
              paymentModel: 'POSTPAID',
              paymentMethod: b.session.paymentMethod || 'ONLINE',
              cashAmount: b.session.cashAmount || 0,
              onlineAmount: b.session.onlineAmount || b.totalAmount,
              table: { tableNumber: b.session.tableNumber },
              subTotal: b.subTotal,
              discountAmount: b.discountAmount,
              taxAmount: b.taxAmount,
              totalAmount: b.totalAmount,
              items: b.aggregatedItems.map(i => ({
                quantity: i.quantity,
                priceAtOrder: i.price,
                menuItem: { name: i.name },
                modifiers: (i.modifiers || []).map(m => ({ modifierOption: { name: m } }))
              }))
            });
          }
          setPaymentModalOpen(false);
          setActivePaymentGroup(null);
          fetchOrders(selectedStoreId);
          return { success: true };
        } else {
          return { success: false, message: res.data.data?.message || 'Payment not yet confirmed.' };
        }
      } else {
        const order = activePaymentGroup.orders[0];
        const res = await api.get(`/stores/${selectedStoreId}/orders/${order.id}/payment-status`);
        if (res.data.success && res.data.data.status === 'success') {
          const orderRes = await api.get(`/stores/${selectedStoreId}/orders/${order.id}`);
          if (orderRes.data.success) {
            setReceiptOrder(orderRes.data.data);
          }
          setPaymentModalOpen(false);
          setActivePaymentGroup(null);
          fetchOrders(selectedStoreId);
          return { success: true };
        } else {
          return { success: false, message: res.data.data?.message || 'Payment not received yet.' };
        }
      }
    } catch (err) {
      console.error(err);
      return { success: false, message: 'Verification error' };
    } finally {
      setIsVerifying(false);
    }
  };

  const settleSession = async (tableSessionId, fallbackOrder) => {
    try {
      if (tableSessionId) {
        await api.post(`/stores/${selectedStoreId}/orders/sessions/${tableSessionId}/settle`);
        const billRes = await api.get(`/stores/${selectedStoreId}/orders/sessions/${tableSessionId}`);
        if (billRes.data.success) {
          const b = billRes.data.data;
          setReceiptOrder({
            id: `TAB-${b.session.pin}`,
            createdAt: b.session.createdAt,
            type: 'DINE_IN',
            paymentModel: 'POSTPAID',
            table: { tableNumber: b.session.tableNumber },
            subTotal: b.subTotal,
            discountAmount: b.discountAmount,
            taxAmount: b.taxAmount,
            totalAmount: b.totalAmount,
            items: b.aggregatedItems.map(i => ({
              quantity: i.quantity,
              priceAtOrder: i.price,
              menuItem: { name: i.name },
              modifiers: (i.modifiers || []).map(m => ({ modifierOption: { name: m } }))
            }))
          });
        }
        fetchOrders(selectedStoreId);
      } else if (fallbackOrder) {
        await settleSingleOrder(fallbackOrder.id);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to settle table');
    }
  };

  const settleSingleOrder = async (orderId) => {
    try {
      await api.patch(`/stores/${selectedStoreId}/orders/${orderId}/status`, { status: 'SETTLED' });
      setOrders(prev => prev.filter(o => o.id !== orderId));
      
      const orderRes = await api.get(`/stores/${selectedStoreId}/orders/${orderId}`);
      if (orderRes.data.success) {
        setReceiptOrder(orderRes.data.data);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to settle order');
    }
  };

  const approveOrder = async (orderId) => {
    try {
      await api.patch(`/stores/${selectedStoreId}/orders/${orderId}/verify`);
      fetchOrders(selectedStoreId);
    } catch (err) {
      console.error(err);
      setError('Failed to approve order');
    }
  };

  const handleGenerateQR = async (group) => {
    try {
      if (group.tableSessionId) {
        const linkRes = await api.post(`/stores/${selectedStoreId}/orders/sessions/${group.tableSessionId}/payment-link`);
        setQrModal({
          isOpen: true,
          url: linkRes.data.data.short_url,
          sessionId: group.tableSessionId,
          orderId: group.orders[0]?.id,
          totalAmount: linkRes.data.data.totalAmount,
          tableNumber: group.table?.tableNumber
        });
      } else {
        const order = group.orders[0];
        const linkRes = await api.post(`/stores/${selectedStoreId}/orders/${order.id}/payment-link`);
        setQrModal({
          isOpen: true,
          url: linkRes.data.data.short_url,
          sessionId: null,
          orderId: order.id,
          totalAmount: order.totalAmount,
          tableNumber: order.table?.tableNumber
        });
      }
    } catch (err) {
      console.error(err);
      alert("Failed to generate QR code");
    }
  };

  const verifyPayment = async () => {
    setIsVerifying(true);
    try {
      if (qrModal.sessionId) {
        const res = await api.post(`/stores/${selectedStoreId}/orders/sessions/${qrModal.sessionId}/verify-payment`);
        if (res.data.success && res.data.data.status === 'SETTLED') {
          const sessId = qrModal.sessionId;
          setQrModal({ isOpen: false, url: '', orderId: '', sessionId: null, totalAmount: 0, tableNumber: null });
          fetchOrders(selectedStoreId);
          
          const billRes = await api.get(`/stores/${selectedStoreId}/orders/sessions/${sessId}`);
          if (billRes.data.success) {
            const b = billRes.data.data;
            setReceiptOrder({
              id: `TAB-${b.session.pin}`,
              createdAt: b.session.createdAt,
              type: 'DINE_IN',
              paymentModel: 'POSTPAID',
              table: { tableNumber: b.session.tableNumber },
              subTotal: b.subTotal,
              discountAmount: b.discountAmount,
              taxAmount: b.taxAmount,
              totalAmount: b.totalAmount,
              items: b.aggregatedItems.map(i => ({
                quantity: i.quantity,
                priceAtOrder: i.price,
                menuItem: { name: i.name },
                modifiers: (i.modifiers || []).map(m => ({ modifierOption: { name: m } }))
              }))
            });
          }
        } else {
          alert(res.data.data?.message || 'Payment not yet confirmed.');
        }
      } else if (qrModal.orderId) {
        const res = await api.get(`/stores/${selectedStoreId}/orders/${qrModal.orderId}/payment-status`);
        if (res.data.success && res.data.data.status === 'success') {
          const orderId = qrModal.orderId;
          setQrModal({ isOpen: false, url: '', orderId: '', sessionId: null, totalAmount: 0, tableNumber: null });
          fetchOrders(selectedStoreId);
          
          const orderRes = await api.get(`/stores/${selectedStoreId}/orders/${orderId}`);
          if (orderRes.data.success) {
            setReceiptOrder(orderRes.data.data);
          }
        } else {
          alert(res.data.data?.message || `Payment not received yet.`);
        }
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || "Failed to verify payment.";
      alert("Error: " + msg);
    } finally {
      setIsVerifying(false);
    }
  };

  // Payment Polling logic
  useEffect(() => {
    let intervalId;
    let attempts = 0;
    
    if (qrModal.isOpen && (qrModal.sessionId || qrModal.orderId)) {
      intervalId = setInterval(async () => {
        attempts++;
        if (attempts > 100) {
          clearInterval(intervalId);
          alert('Payment QR Expired (timeout). Please generate again.');
          setQrModal({ isOpen: false, url: '', orderId: '', sessionId: null, totalAmount: 0, tableNumber: null });
          return;
        }

        try {
          if (qrModal.sessionId) {
            const res = await api.post(`/stores/${selectedStoreId}/orders/sessions/${qrModal.sessionId}/verify-payment`);
            if (res.data.success && res.data.data.status === 'SETTLED') {
              clearInterval(intervalId);
              const sessId = qrModal.sessionId;
              setQrModal({ isOpen: false, url: '', orderId: '', sessionId: null, totalAmount: 0, tableNumber: null });
              fetchOrders(selectedStoreId);
              
              const billRes = await api.get(`/stores/${selectedStoreId}/orders/sessions/${sessId}`);
              if (billRes.data.success) {
                const b = billRes.data.data;
                setReceiptOrder({
                  id: `TAB-${b.session.pin}`,
                  createdAt: b.session.createdAt,
                  type: 'DINE_IN',
                  paymentModel: 'POSTPAID',
                  table: { tableNumber: b.session.tableNumber },
                  subTotal: b.subTotal,
                  discountAmount: b.discountAmount,
                  taxAmount: b.taxAmount,
                  totalAmount: b.totalAmount,
                  items: b.aggregatedItems.map(i => ({
                    quantity: i.quantity,
                    priceAtOrder: i.price,
                    menuItem: { name: i.name },
                    modifiers: (i.modifiers || []).map(m => ({ modifierOption: { name: m } }))
                  }))
                });
              }
            }
          } else if (qrModal.orderId) {
            const res = await api.get(`/stores/${selectedStoreId}/orders/${qrModal.orderId}/payment-status`);
            if (res.data.success && res.data.data.status === 'success') {
              clearInterval(intervalId);
              const orderId = qrModal.orderId;
              setQrModal({ isOpen: false, url: '', orderId: '', sessionId: null, totalAmount: 0, tableNumber: null });
              fetchOrders(selectedStoreId);
              
              const orderRes = await api.get(`/stores/${selectedStoreId}/orders/${orderId}`);
              if (orderRes.data.success) {
                setReceiptOrder(orderRes.data.data);
              }
            }
          }
        } catch (err) {
          // Silent polling failure
        }
      }, 3000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [qrModal.isOpen, qrModal.sessionId, qrModal.orderId, selectedStoreId]);

  const getStatusDisplay = (status) => {
    switch(status) {
      case 'PENDING_VERIFICATION': return { label: 'Awaiting Approval', color: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800' };
      case 'PENDING_PAYMENT': return { label: 'Awaiting Payment', color: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' };
      case 'PROCESSING': return { label: 'In Kitchen', color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' };
      case 'READY': return { label: 'Ready', color: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800' };
      case 'SERVED': return { label: 'Served', color: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' };
      default: return { label: status, color: 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700' };
    }
  };

  const filteredOrders = orders.filter(o => {
    if (!searchQuery) return true;
    const term = searchQuery.toLowerCase();
    if (o.table && String(o.table.tableNumber).toLowerCase().includes(term)) return true;
    if (o.tableSession?.pin && String(o.tableSession.pin).includes(term)) return true;
    if (o.id.toLowerCase().includes(term)) return true;
    return false;
  });

  // Group active orders by table session or table
  const groupedOrders = useMemo(() => {
    const groups = [];
    const sessionMap = new Map();

    for (const order of filteredOrders) {
      const key = order.tableSessionId || (order.table ? `tbl_${order.table.id}` : `ord_${order.id}`);
      if (sessionMap.has(key)) {
        sessionMap.get(key).orders.push(order);
      } else {
        const group = {
          key,
          tableSessionId: order.tableSessionId,
          tableSession: order.tableSession,
          table: order.table,
          origin: order.origin,
          paymentModel: order.paymentModel,
          orders: [order]
        };
        sessionMap.set(key, group);
        groups.push(group);
      }
    }

    return groups;
  }, [filteredOrders]);

  if (error) {
    return (
      <div className="mb-4 flex items-center gap-2 p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md">
        {error}
      </div>
    );
  }

  if (loading && orders.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden pb-4">
      {/* Search Bar */}
      <div className="mb-4 shrink-0">
        <div className="relative w-full">
          <Search01Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by table number, Table PIN, or Order ID..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {groupedOrders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 min-h-[400px]">
          <Money01Icon size={48} className="text-zinc-300 mb-4" />
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">
            {searchQuery ? 'No matching orders' : 'No Active Orders'}
          </h3>
          <p className="text-zinc-500">
            {searchQuery ? 'Try a different table number.' : 'All tables are clear.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-max flex-1 overflow-y-auto pr-2 pb-20">
          {groupedOrders.map(group => {
            const groupTotal = group.orders.reduce((sum, o) => sum + o.totalAmount, 0);
            const hasPendingVerification = group.orders.some(o => o.status === 'PENDING_VERIFICATION');
            const allPrepaid = group.orders.every(o => o.paymentModel === 'PREPAID');
            const primaryOrder = group.orders[0];
            const statusInfo = getStatusDisplay(primaryOrder.status);

            return (
              <Card key={group.key} className="border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full bg-white dark:bg-zinc-900">
                <CardContent className="p-0 flex flex-col h-full">
                  
                  {/* Header */}
                  <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/50 flex justify-between items-start bg-zinc-50/50 dark:bg-zinc-900/50 rounded-t-xl">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-xl text-zinc-900 dark:text-zinc-100">
                          {group.table ? `Table ${group.table.tableNumber}` : 'Takeaway'}
                        </span>

                        {group.tableSession?.pin && (
                          <span className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs px-2 py-0.5 rounded-md font-bold dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-300">
                            PIN: {group.tableSession.pin}
                          </span>
                        )}

                        {group.orders.length > 1 && (
                          <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] px-2 py-0.5 rounded-md font-bold">
                            {group.orders.length} Batches
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 uppercase font-semibold tracking-wider flex gap-2">
                        <span>{group.origin}</span>
                        <span>•</span>
                        <span>{allPrepaid ? 'PREPAID' : 'POSTPAID'}</span>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end">
                      <div className="font-bold text-2xl text-zinc-900 dark:text-zinc-100">₹{groupTotal}</div>
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md border font-semibold mt-1 ${statusInfo.color}`}>
                        {hasPendingVerification ? 'Awaiting Approval' : statusInfo.label}
                      </span>
                    </div>
                  </div>
                  
                  {/* Items List across all grouped orders */}
                  <div className="p-4 flex-1 overflow-y-auto max-h-[220px] space-y-3">
                    {group.orders.map((order, ordIdx) => (
                      <div key={order.id} className={group.orders.length > 1 ? "border-b pb-2 last:border-b-0 border-zinc-100 dark:border-zinc-800" : ""}>
                        {group.orders.length > 1 && (
                          <div className="text-[10px] uppercase font-bold text-zinc-400 mb-1 flex justify-between">
                            <span>Batch #{ordIdx + 1}</span>
                            <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        )}
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex flex-col text-sm mb-1.5 last:mb-0">
                            <div className="flex justify-between items-start">
                              <span className="text-zinc-800 dark:text-zinc-200 leading-tight">
                                <span className="font-semibold text-zinc-500 w-6 inline-block">{item.quantity}x</span> 
                                <span className="font-medium">{item.menuItem?.name}</span>
                              </span>
                              <span className="text-zinc-500 font-medium">₹{item.priceAtOrder * item.quantity}</span>
                            </div>
                            {item.modifiers && item.modifiers.length > 0 && (
                              <div className="text-xs text-zinc-500 pl-6 mt-0.5 flex flex-wrap gap-1">
                                {item.modifiers.map(m => (
                                  <span key={m.id} className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded text-[11px]">
                                    +{m.modifierOption?.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Actions Footer */}
                  <div className="p-4 border-t border-zinc-100 dark:border-zinc-800/50 bg-zinc-50 dark:bg-zinc-950/50 rounded-b-xl mt-auto">
                    {hasPendingVerification ? (
                      <div className="space-y-2">
                        {group.orders.filter(o => o.status === 'PENDING_VERIFICATION').map(pendingOrder => (
                          <Button 
                            key={pendingOrder.id}
                            className="w-full h-11 font-semibold bg-amber-500 hover:bg-amber-600 text-white"
                            onClick={() => approveOrder(pendingOrder.id)}
                          >
                            <Tick02Icon size={18} className="mr-2" />
                            Approve Batch (#{pendingOrder.id.slice(-4).toUpperCase()})
                          </Button>
                        ))}
                      </div>
                    ) : allPrepaid ? (
                      <Button 
                        className="w-full h-11 font-semibold bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white"
                        onClick={() => settleSession(group.tableSessionId, primaryOrder)}
                      >
                        <Tick02Icon size={18} className="mr-2" />
                        Close Table (Prepaid Settled)
                      </Button>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <Button 
                          className="w-full h-11 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-sm flex items-center justify-center gap-2"
                          onClick={() => handleOpenPaymentModal(group)}
                        >
                          <Money01Icon size={18} />
                          <span>Collect Payment / Settle Tab (₹{groupTotal})</span>
                        </Button>
                      </div>
                    )}
                  </div>

                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dynamic QR Payment Modal */}
      {qrModal.isOpen && (
        <div className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center text-center">
            <div className="bg-indigo-50 dark:bg-indigo-500/10 p-4 rounded-full mb-4">
              <QrCodeIcon size={32} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="font-bold text-xl mb-1">Scan to Pay</h3>
            <p className="text-sm text-zinc-500 mb-4">
              {qrModal.tableNumber ? `Table ${qrModal.tableNumber} Total Due` : 'Scan QR to pay total bill'}
            </p>
            
            <div className="bg-white p-4 rounded-xl shadow-inner border border-zinc-100 inline-block mb-4">
              <QRCodeSVG value={qrModal.url} size={200} level="M" includeMargin={false} />
            </div>

            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
              ₹{qrModal.totalAmount}
            </div>

            <div className="flex gap-3 w-full">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setQrModal({ isOpen: false, url: '', orderId: '', sessionId: null, totalAmount: 0, tableNumber: null })}
              >
                <Cancel01Icon size={16} className="mr-2" />
                Close
              </Button>
              <Button 
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={verifyPayment}
                disabled={isVerifying}
              >
                {isVerifying ? (
                  <div className="flex items-center">
                    <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Verifying...
                  </div>
                ) : (
                  <>
                    <Tick02Icon size={16} className="mr-2" />
                    Verify
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {receiptOrder && (
        <div className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl flex flex-col w-full max-w-md max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
              <h3 className="font-bold flex items-center gap-2"><Tick02Icon size={20}/> Payment Confirmed & Settled</h3>
              <button onClick={() => setReceiptOrder(null)} className="p-1 hover:bg-green-100 dark:hover:bg-green-800 rounded-full">
                <Cancel01Icon size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-zinc-100 dark:bg-black">
              {receiptOrder && storeData && (
                <Receipt ref={receiptRef} order={receiptOrder} storeData={storeData} />
              )}
            </div>

            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-2 bg-white dark:bg-zinc-900">
              <Button 
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white" 
                onClick={() => {
                  window.print();
                }}
              >
                <PrinterIcon size={18} className="mr-2" /> Print Bill
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setReceiptOrder(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PAYMENT BIFURCATION MODAL (CASH, ONLINE QR, SPLIT) ─── */}
      <PaymentBifurcationModal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setActivePaymentGroup(null);
        }}
        totalAmount={activePaymentGroup ? activePaymentGroup.orders.reduce((sum, o) => sum + o.totalAmount, 0) : 0}
        title="Collect Payment & Settle"
        subtitle={activePaymentGroup?.table ? `Table ${activePaymentGroup.table.tableNumber}${activePaymentGroup.tableSession?.pin ? ` • PIN: ${activePaymentGroup.tableSession.pin}` : ''}` : 'Takeaway Order'}
        onSettle={handleModalSettle}
        onGenerateQR={handleGenerateModalQR}
        isSubmitting={isSubmittingPayment}
        isVerifying={isVerifying}
        onVerifyPayment={handleModalVerifyPayment}
      />
    </div>
  );
};
