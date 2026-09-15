import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@smo/ui';
import {
  Search01Icon,
  PackageProcess01Icon,
  Chair01Icon,
  CashierIcon,
  Cancel01Icon,
  Delete02Icon,
  MinusSignIcon,
  PlusSignIcon,
  NoteEditIcon,
  Discount01Icon,
  CheckmarkCircle02Icon,
  ArrowRight01Icon,
  Loading03Icon,
} from 'hugeicons-react';
import { QRCodeSVG } from 'qrcode.react';
import { Receipt } from './receipt';
import { PaymentBifurcationModal } from './payment-bifurcation-modal';

/* Stable, collision-free line ids */
let lineCounter = 0;
const createLineId = () => `ln_${Date.now().toString(36)}_${(lineCounter++).toString(36)}`;

/* ─────────────────────────────────────────────────────────────────
   Enterprise SWR Cache
   - In-memory Map (fast path)
   - sessionStorage persistence (survives tab reloads, not new sessions)
   - TTL for "fresh" (skip network) vs "stale" (revalidate in background)
   - Hard max-age (drop dead data)
   - Request deduplication per store bundle
   ───────────────────────────────────────────────────────────────── */
const CACHE_TTL_MS = 60_000;              // <60s old → skip refetch entirely
const CACHE_MAX_AGE_MS = 30 * 60_000;     // >30min old → treat as missing
const STORAGE_PREFIX = 'pos_cache_v2:';

const _memory = new Map();                // "storeId:resource" -> { data, ts }
const _inflightStores = new Map();        // storeId -> Promise (bundle dedup)

const _storage = (() => {
  try {
    const t = '__pos_probe__';
    window.sessionStorage.setItem(t, '1');
    window.sessionStorage.removeItem(t);
    return window.sessionStorage;
  } catch {
    return null;
  }
})();

const cacheKey = (storeId, resource) => `${storeId}:${resource}`;

function readCache(storeId, resource) {
  if (!storeId) return null;
  const k = cacheKey(storeId, resource);
  let entry = _memory.get(k);

  if (!entry && _storage) {
    try {
      const raw = _storage.getItem(STORAGE_PREFIX + k);
      if (raw) entry = JSON.parse(raw);
    } catch {
      entry = null;
    }
  }

  if (!entry) return null;

  if (Date.now() - entry.ts > CACHE_MAX_AGE_MS) {
    _memory.delete(k);
    try { _storage?.removeItem(STORAGE_PREFIX + k); } catch { /* noop */ }
    return null;
  }

  _memory.set(k, entry);
  return entry;
}

function writeCache(storeId, resource, data) {
  if (!storeId) return;
  const k = cacheKey(storeId, resource);
  const entry = { data, ts: Date.now() };
  _memory.set(k, entry);
  if (_storage) {
    try {
      _storage.setItem(STORAGE_PREFIX + k, JSON.stringify(entry));
    } catch { /* quota / private mode — silently skip persistence */ }
  }
}

const isFresh = (entry) => Boolean(entry) && (Date.now() - entry.ts) < CACHE_TTL_MS;

function readStoreSnapshot(storeId) {
  if (!storeId) {
    return { menu: null, tables: null, store: null, promos: null, hasAny: false };
  }
  const menu = readCache(storeId, 'menu');
  const tables = readCache(storeId, 'tables');
  const store = readCache(storeId, 'store');
  const promos = readCache(storeId, 'promos');
  return {
    menu,
    tables,
    store,
    promos,
    hasAny: Boolean(menu || tables || store || promos),
  };
}

/* Bundle fetch with per-store dedup so parallel effects don't double-hit the API */
function fetchStoreBundle(storeId) {
  if (_inflightStores.has(storeId)) return _inflightStores.get(storeId);

  const promise = (async () => {
    const [menuRes, tablesRes, storeRes, promosRes] = await Promise.all([
      api.get(`/stores/${storeId}/menu`),
      api.get(`/stores/${storeId}/tables`),
      api.get(`/stores/${storeId}`),
      api.get(`/stores/${storeId}/promos`),
    ]);
    return { menuRes, tablesRes, storeRes, promosRes };
  })();

  _inflightStores.set(storeId, promise);
  promise.finally(() => _inflightStores.delete(storeId));
  return promise;
}

/* SVG Item Placeholder for items without photos */
const ItemPlaceholder = ({ dietary, name }) => {
  const isDrink = /coffee|tea|latte|brew|shake|drink|juice|beverage|mocha|espresso|cappuccino/i.test(name || '');
  const isDessert = /cake|waffle|cookie|brownie|dessert|pastry|pie|sweet/i.test(name || '');

  return (
    <div className="w-full h-full flex items-center justify-center relative overflow-hidden rounded-xl bg-gradient-to-br from-stone-100 to-stone-200/60 dark:from-zinc-800/80 dark:to-zinc-900/60 text-stone-400 dark:text-zinc-600">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#b45309_1px,transparent_1px)] [background-size:8px_8px]" />
      {isDrink ? (
        <svg className="size-12 drop-shadow-sm text-teal-700/60 dark:text-teal-400/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
          <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
          <line x1="6" y1="2" x2="6" y2="4" />
          <line x1="10" y1="2" x2="10" y2="4" />
          <line x1="14" y1="2" x2="14" y2="4" />
        </svg>
      ) : isDessert ? (
        <svg className="size-12 drop-shadow-sm text-amber-700/60 dark:text-amber-400/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
          <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" />
          <path d="M2 21h20" />
          <path d="M7 8v3" />
          <path d="M12 5v6" />
          <path d="M17 8v3" />
        </svg>
      ) : (
        <svg className="size-12 drop-shadow-sm text-amber-700/60 dark:text-amber-400/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" strokeDasharray="3 3" />
          <path d="M12 3v2" />
          <path d="M12 19v2" />
        </svg>
      )}
    </div>
  );
};

export const POSTerminal = ({ selectedStoreId, token }) => {
  const [searchParams] = useSearchParams();

  /* ─── Synchronous hydration (no loading flash if cache exists) ──── */
  const initialSnap = useMemo(() => readStoreSnapshot(selectedStoreId), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [menu, setMenu] = useState(() => initialSnap.menu?.data || []);
  const [tables, setTables] = useState(() => initialSnap.tables?.data || []);
  const [storeData, setStoreData] = useState(() => initialSnap.store?.data || null);
  const [promos, setPromos] = useState(() => initialSnap.promos?.data || []);
  const [isInitialLoading, setIsInitialLoading] = useState(() => !initialSnap.hasAny);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [error, setError] = useState('');

  // UI State
  const [selectedCategoryId, setSelectedCategoryId] = useState(() => {
    const m = initialSnap.menu?.data;
    return m && m.length > 0 ? m[0].id : null;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const isSearching = searchQuery.trim().length > 0;
  const searchInputRef = useRef(null);

  // Cart & Order State
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState('DINE_IN');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [customerName, setCustomerName] = useState('Guest');
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [cartNotes, setCartNotes] = useState({});
  const [activeNoteId, setActiveNoteId] = useState(null);

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

  // Reference number for active receipt ticket
  const orderRefNumber = useMemo(() => {
    return (Math.floor(10000 + Math.random() * 90000)).toString();
  }, []);

  const qrModalRef = useRef(qrModal);
  useEffect(() => { qrModalRef.current = qrModal; }, [qrModal]);

  const paymentModalOpenRef = useRef(paymentModalOpen);
  useEffect(() => { paymentModalOpenRef.current = paymentModalOpen; }, [paymentModalOpen]);

  const activePaymentOrderIdRef = useRef(activePaymentOrderId);
  useEffect(() => { activePaymentOrderIdRef.current = activePaymentOrderId; }, [activePaymentOrderId]);

  /* ─── Toasts ──────────────────────────────────────────────────────── */
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

  /* ─── Fetch Tables with Live Status (writes through cache) ──────── */
  const fetchTables = useCallback(async () => {
    if (!selectedStoreId) return;
    try {
      const res = await api.get(`/stores/${selectedStoreId}/tables`);
      if (res.data.success) {
        const activeTables = (res.data.data || []).filter(t => t.isActive);
        setTables(activeTables);
        writeCache(selectedStoreId, 'tables', activeTables);
      }
    } catch (err) {
      console.error('Failed to fetch tables with live status:', err);
    }
  }, [selectedStoreId]);

  /* ─── SWR Data Hydration + Background Revalidation ───────────────── */
  useEffect(() => {
    if (!selectedStoreId) return;
    let cancelled = false;

    const snap = readStoreSnapshot(selectedStoreId);

    // 1) Hydrate synchronously from cache → no loading flash for cached stores
    if (snap.menu) setMenu(snap.menu.data || []);
    if (snap.tables) setTables(snap.tables.data || []);
    if (snap.store) setStoreData(snap.store.data || null);
    if (snap.promos) setPromos(snap.promos.data || []);

    setError('');
    setIsInitialLoading(!snap.hasAny);

    // 2) Fast path: everything fresh → skip network entirely
    const allFresh =
      isFresh(snap.menu) &&
      isFresh(snap.tables) &&
      isFresh(snap.store) &&
      isFresh(snap.promos);

    if (allFresh) {
      setIsRevalidating(false);
      return () => { cancelled = true; };
    }

    // 3) Otherwise revalidate in the background — UI already has (stale) data
    setIsRevalidating(snap.hasAny);

    (async () => {
      try {
        const { menuRes, tablesRes, storeRes, promosRes } =
          await fetchStoreBundle(selectedStoreId);
        if (cancelled) return;

        if (menuRes?.data?.success) {
          const freshMenu = menuRes.data.data || [];
          setMenu(freshMenu);
          writeCache(selectedStoreId, 'menu', freshMenu);
        }
        if (tablesRes?.data?.success) {
          const freshTables = (tablesRes.data.data || []).filter(t => t.isActive);
          setTables(freshTables);
          writeCache(selectedStoreId, 'tables', freshTables);
        }
        if (storeRes?.data?.success) {
          setStoreData(storeRes.data.data);
          writeCache(selectedStoreId, 'store', storeRes.data.data);
        }
        if (promosRes?.data?.success) {
          const freshPromos = promosRes.data.data || [];
          setPromos(freshPromos);
          writeCache(selectedStoreId, 'promos', freshPromos);
        }
      } catch (err) {
        if (!cancelled && !snap.hasAny) setError('Failed to fetch data');
        console.error('POS revalidation failed:', err);
      } finally {
        if (!cancelled) {
          setIsInitialLoading(false);
          setIsRevalidating(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [selectedStoreId]);

  /* Keep selectedCategoryId valid whenever the menu set changes */
  useEffect(() => {
    if (!menu.length) return;
    setSelectedCategoryId(prev => {
      if (prev && menu.some(c => c.id === prev)) return prev;
      return menu[0].id;
    });
  }, [menu]);

  /* Preselect table from URL query param (?table=...) */
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

  /* Reset state when store switches */
  useEffect(() => {
    setCart([]);
    setCartNotes({});
    setActiveNoteId(null);
    setAppliedPromo(null);
    setPromoCodeInput('');
    setSelectedTableId('');
    setCustomerName('');
    setOrderType('DINE_IN');
    setSearchQuery('');
    setReceiptOrder(null);
    setQrModal({ isOpen: false, url: '', orderId: '' });
    setPaymentModalOpen(false);
    setActivePaymentOrderId(null);
  }, [selectedStoreId]);

  /* ─── SSE Live Updates ───────────────────────────────────────────── */
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
      } catch (e) { /* ignore */ }
    };
    return () => eventSource.close();
  }, [selectedStoreId, token, fetchTables]);

  /* ─── Keyboard Shortcuts ─────────────────────────────────────────── */
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName))) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === 'Escape') {
        if (modifierItem) { setModifierItem(null); return; }
        if (receiptOrder) { setReceiptOrder(null); return; }
        if (qrModal.isOpen && !isVerifying) { setQrModal({ isOpen: false, url: '', orderId: '' }); return; }
        if (paymentModalOpen && !isVerifying && !isSubmitting) { setPaymentModalOpen(false); return; }
        if (activeNoteId) { setActiveNoteId(null); return; }
        if (searchQuery) { setSearchQuery(''); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modifierItem, receiptOrder, qrModal.isOpen, paymentModalOpen, isVerifying, isSubmitting, activeNoteId, searchQuery]);

  /* ─── Cart Helpers ───────────────────────────────────────────────── */
  const resetCartState = () => {
    setCart([]);
    setSelectedTableId('');
    setCustomerName('');
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

  /* ─── Menu Filtering ─────────────────────────────────────────────── */
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
      if (maxSelections === 1) return { ...prev, [groupId]: [optionId] };
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
    const snapshot = { cart, cartNotes, appliedPromo, promoCodeInput, customerName };
    resetCartState();
    pushToast('Order cleared', 'info', {
      label: 'Undo',
      onClick: () => {
        setCart(snapshot.cart);
        setCartNotes(snapshot.cartNotes);
        setAppliedPromo(snapshot.appliedPromo);
        setPromoCodeInput(snapshot.promoCodeInput);
        setCustomerName(snapshot.customerName);
      },
    });
  };

  /* ─── Financial Totals ───────────────────────────────────────────── */
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

  /* ─── Validation & Checkout ──────────────────────────────────────── */
  const selectedTable = useMemo(() => tables.find(t => t.id === selectedTableId), [tables, selectedTableId]);
  const isSelectedTableUnavailable = orderType === 'DINE_IN' && selectedTable && (selectedTable.status !== 'AVAILABLE' && selectedTable.isAvailable === false);
  const needsTable = orderType === 'DINE_IN' && !selectedTableId;
  const checkoutDisabled = cart.length === 0 || isSubmitting || needsTable || isSelectedTableUnavailable;

  const handleCheckout = async (paymentModel) => {
    if (needsTable) { pushToast('Please select a table for Dine-In orders.', 'error'); return; }
    if (isSelectedTableUnavailable) { pushToast(`Table ${selectedTable?.tableNumber} is currently unavailable.`, 'error'); return; }
    if (cart.length === 0) return;
    setIsSubmitting(true);
    try {
      const payload = {
        type: orderType,
        paymentModel,
        origin: 'POS',
        customerName: customerName.trim() || undefined,
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

      if (paymentModel === 'PREPAID') {
        await api.patch(`/stores/${selectedStoreId}/orders/${orderId}/status`, { status: 'SETTLED' });
      }
      resetCartState();
      setReceiptOrder(res.data.data.order);
      pushToast('Order placed successfully!', 'success');
    } catch (err) {
      console.error(err);
      pushToast('Failed to place order: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── Payment Bifurcation Modal Integration ─────────────────────── */
  const handleOpenPaymentModal = () => {
    if (needsTable) { pushToast('Please select a table for Dine-In orders.', 'error'); return; }
    if (isSelectedTableUnavailable) { pushToast(`Table ${selectedTable?.tableNumber} is currently unavailable.`, 'error'); return; }
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
        customerName: customerName.trim() || undefined,
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
          customerName: customerName.trim() || undefined,
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
      let isSuccess = false;
      try {
        const verifyRes = await api.post(`/stores/${selectedStoreId}/orders/${activePaymentOrderId}/verify-payment`, { manual: true });
        if (verifyRes.data.success && (verifyRes.data.data.status === 'PROCESSING' || verifyRes.data.data.status === 'SETTLED' || verifyRes.data.data.success)) {
          isSuccess = true;
        }
      } catch (e) { }

      if (!isSuccess) {
        const res = await api.get(`/stores/${selectedStoreId}/orders/${activePaymentOrderId}/payment-status`);
        if (res.data.success && res.data.data.status === 'success') {
          isSuccess = true;
        } else {
          pushToast(res.data.data?.message || 'Payment not received yet.', 'info');
          return { success: false, message: res.data.data?.message || 'Payment pending' };
        }
      }

      if (isSuccess) {
        const orderRes = await api.get(`/stores/${selectedStoreId}/orders/${activePaymentOrderId}`);
        const order = orderRes.data.data;
        setPaymentModalOpen(false);
        setActivePaymentOrderId(null);
        resetCartState();
        setReceiptOrder(order);
        pushToast('Payment verified and order settled!', 'success');
        return { success: true };
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to verify payment.';
      pushToast('Error: ' + msg, 'error');
      return { success: false, message: msg };
    } finally {
      setIsVerifying(false);
    }
  };

  /* ─── Receipt Printing ───────────────────────────────────────────── */
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

  /* ─── Loading / Error Views ──────────────────────────────────────── */
  if (isInitialLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 bg-stone-100/60 dark:bg-zinc-950">
        <Loading03Icon size={30} className="animate-spin text-amber-500" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
          Loading POS…
        </span>
      </div>
    );
  }

  if (error && menu.length === 0) return <div className="text-rose-500 p-6 font-bold">{error}</div>;

  return (
    <div className="h-full grid grid-cols-[1fr_360px] 2xl:grid-cols-[1fr_390px] gap-3 p-3 overflow-hidden relative bg-stone-100/60 dark:bg-zinc-950">

      {/* ─── TOASTS ─── */}
      <div aria-live="polite" className="pointer-events-none absolute top-3 right-3 z-[100] flex flex-col items-end gap-2 max-w-[340px]">
        {toasts.map(t => {
          const tone =
            t.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/90 dark:text-rose-200 dark:border-rose-900'
              : t.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/90 dark:text-emerald-200 dark:border-emerald-900'
                : 'bg-white text-stone-800 border-stone-200 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700';
          return (
            <div key={t.id} role="status" className={`pointer-events-auto flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold shadow-lg ${tone}`}>
              <span className="min-w-0 flex-1">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  onClick={() => { t.action.onClick(); dismissToast(t.id); }}
                  className="shrink-0 rounded px-2 py-0.5 text-[11px] font-bold underline hover:opacity-80"
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
                <Cancel01Icon size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* ─── LEFT: MENU & CATALOG AREA ─── */}
      <div className="flex flex-col h-full min-h-0 overflow-hidden gap-3">

        {/* 1. Top Bar: Search + Customer Name + Table (moved from cart) */}
        <div className="shrink-0 grid grid-cols-2 lg:grid-cols-[minmax(0,1fr)_170px_190px] gap-2">

          {/* Search */}
          <div className="relative col-span-2 lg:col-span-1">
            <div className="h-10 rounded-l-full bg-white dark:bg-zinc-900 border border-stone-200/90 dark:border-zinc-800 shadow-xs flex items-center pl-4 pr-1.5 gap-3 transition-all">
              <Search01Icon size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                aria-label="Search menu"
                placeholder="Search dishes, drinks, or items… (Press '/' or 'Ctrl+K' to focus)"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-zinc-500 outline-none font-medium py-3"
              />
              {isSearching ? (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                  aria-label="Clear search"
                  className="shrink-0 size-7 flex items-center justify-center text-stone-500 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Cancel01Icon size={15} />
                </button>
              ) : (
                <div className="shrink-0 h-7 px-3.5 bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 flex items-center gap-1 text-[11px] font-bold text-stone-500 dark:text-zinc-400">
                  <span>⌘</span>
                  <span>K</span>
                </div>
              )}
            </div>
          </div>

          {/* Customer Name */}
          <input
            type="text"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            placeholder="Customer name"
            aria-label="Customer name"
            className="h-10 w-full bg-white dark:bg-zinc-900 border border-stone-200/90 dark:border-zinc-800 shadow-xs px-5 text-xs font-medium text-stone-900 dark:text-zinc-100 placeholder-stone-400 dark:placeholder-zinc-500 outline-none"
          />

          {/* Table Selector (swaps to Takeaway label when order type is Takeaway) */}
          {orderType === 'DINE_IN' ? (
            <Select value={selectedTableId} onValueChange={setSelectedTableId}>
              <SelectTrigger
                className={`h-10 w-full rounded-r-full bg-white dark:bg-zinc-900 border-stone-200/90 dark:border-zinc-800 px-4 text-xs font-medium ${needsTable ? 'border-amber-400' : ''
                  }`}
              >
                <SelectValue placeholder="Select Table" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {tables.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-stone-400">No tables configured</div>
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
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="font-bold">Table {t.tableNumber}</span>
                          <span className="text-[10px] text-stone-400 font-normal">({t.capacity || 4}p)</span>
                          {isOccupied ? (
                            <span className="ml-auto px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              Occupied
                            </span>
                          ) : isReserved ? (
                            <span className="ml-auto px-1.5 py-0.2 rounded text-[9px] font-bold bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                              Reserved
                            </span>
                          ) : (
                            <span className="ml-auto px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
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
          ) : (
            <div className="h-10 w-full rounded-r-full border border-dashed border-stone-200 dark:border-zinc-700 bg-stone-100/50 dark:bg-zinc-800/40 text-[11px] font-medium text-stone-400 dark:text-zinc-500 flex items-center justify-center gap-2 px-5">
              <span>N/A</span>
            </div>
          )}
        </div>

        {/* 2. Category Cards Showcase */}
        <div className="shrink-0 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none select-none">
          {menu.map(cat => {
            const active = selectedCategoryId === cat.id && !isSearching;
            const count = cat.items?.length || 0;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => { setSelectedCategoryId(cat.id); setSearchQuery(''); }}
                className={`shrink-0 inline-flex items-center gap-2 rounded-full pl-4 pr-1.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-all duration-200 shadow-xs ${active
                    ? 'bg-amber-400 dark:bg-amber-400 text-amber-950 shadow-md'
                    : 'bg-white dark:bg-zinc-900 border border-stone-200/90 dark:border-zinc-800 text-stone-700 dark:text-zinc-300 hover:border-amber-400/60 dark:hover:border-amber-400/40 hover:bg-stone-50/70 dark:hover:bg-zinc-800/50'
                  }`}
              >
                <span className="truncate max-w-[9rem]">{cat.name}</span>

                <span
                  className={`inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full text-[11px] font-bold tabular-nums ${active
                      ? 'bg-amber-950/15 text-amber-950'
                      : 'bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-zinc-400'
                    }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 3. Product Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-3 auto-rows-max">
  {selectedCategoryItems.map(item => {
    const isDisabled = item.isManuallyDisabled || item.isSystemDisabled;
    const line = getCartLineForItem(item);
    const inCart = Boolean(line);

    return (
      <div
        key={item.id}
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        onClick={() => !isDisabled && initiateAddToCart(item)}
        onKeyDown={(e) => {
          if (isDisabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            initiateAddToCart(item);
          }
        }}
        className={`group relative h-48 rounded-2xl overflow-hidden border cursor-pointer select-none transition-all duration-200
          ${isDisabled
            ? 'opacity-60 grayscale cursor-not-allowed border-stone-200/80 dark:border-zinc-800/80'
            : inCart
              ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-lg shadow-amber-500/10'
              : 'border-stone-200/80 dark:border-zinc-800/80 hover:border-amber-400/70 dark:hover:border-amber-400/50 hover:shadow-xl hover:shadow-stone-900/10 dark:hover:shadow-black/30'
          }`}
      >
        {/* ── Image layer (full bleed) ───────────────────────────── */}
        <div className="absolute inset-0 bg-gradient-to-br from-stone-100 via-stone-50 to-stone-200 dark:from-zinc-800 dark:via-zinc-850 dark:to-zinc-900">
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`${item.image ? 'hidden' : ''} w-full h-full`}>
            <ItemPlaceholder dietary={item.dietary} name={item.name} />
          </div>
        </div>

        {/* ── Bottom scrim: transparent → dark ───────────────────── */}
        <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/85 via-black/45 to-transparent pointer-events-none" />

        {/* ── Top badges ─────────────────────────────────────────── */}
        <span
          title={item.dietary}
          className={`absolute top-2.5 left-2.5 size-3 rounded-full border-2 border-white/90 shadow-sm z-10 ${
            item.dietary === 'VEG'
              ? 'bg-emerald-500'
              : item.dietary === 'NON_VEG'
                ? 'bg-rose-500'
                : item.dietary === 'VEGAN'
                  ? 'bg-teal-400'
                  : item.dietary === 'EGG'
                    ? 'bg-amber-400'
                    : 'bg-stone-300'
          }`}
        />

        {inCart && !isDisabled && (
          <span className="absolute top-2.5 right-2.5 z-10 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-950 bg-amber-400 px-2 py-0.5 rounded-full shadow-sm">
            In cart
          </span>
        )}

        {/* ── Bottom content over scrim ──────────────────────────── */}
        <div className="absolute inset-x-0 bottom-0 p-3 flex flex-col gap-2">
          {item.modifierGroups?.length > 0 && !isDisabled && (
            <span className="self-start text-[9px] font-black tracking-wider uppercase text-amber-200 bg-amber-500/25 border border-amber-300/30 backdrop-blur-sm px-1.5 py-0.5 rounded-md">
              Options
            </span>
          )}

          <h4 className="font-bold text-[13px] leading-snug text-white truncate drop-shadow-sm">
            {item.name}
          </h4>

          <div className="flex items-center justify-between gap-2">
            <span className="font-black text-[15px] text-white tabular-nums tracking-tight drop-shadow-sm">
              <span className="text-[11px] font-bold text-white/70 mr-0.5">₹</span>
              {item.price}
            </span>

            {!isDisabled && (
              inCart && !item.modifierGroups?.length ? (
                <div
                  onClick={e => e.stopPropagation()}
                  className="flex items-center gap-0.5 bg-amber-400 text-amber-950 rounded-full p-0.5 shadow-md ring-1 ring-white/20"
                >
                  <button
                    type="button"
                    onClick={e => quickRemove(item, e)}
                    className="size-6 rounded-full flex items-center justify-center hover:bg-amber-950/15 active:scale-90 transition-all"
                  >
                    <MinusSignIcon size={12} />
                  </button>
                  <span className="text-xs font-black px-1.5 tabular-nums min-w-5 text-center">
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={e => quickAdd(item, e)}
                    className="size-6 rounded-full flex items-center justify-center hover:bg-amber-950/15 active:scale-90 transition-all"
                  >
                    <PlusSignIcon size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); initiateAddToCart(item); }}
                  aria-label={`Add ${item.name}`}
                  className="h-7 px-3 rounded-full bg-white/95 hover:bg-amber-400 text-stone-900 hover:text-amber-950 text-[11px] font-bold flex items-center gap-1 backdrop-blur-sm shadow-md active:scale-95 transition-all duration-200"
                >
                  <PlusSignIcon size={13} />
                  Add
                </button>
              )
            )}
          </div>
        </div>

        {/* ── Sold out overlay ───────────────────────────────────── */}
        {isDisabled && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-20">
            <span className="text-[10px] font-black tracking-widest text-white uppercase bg-rose-600 px-2.5 py-1 rounded-md shadow-sm">
              Sold Out
            </span>
          </div>
        )}
      </div>
    );
  })}
</div>
      </div>

      {/* ─── RIGHT: CART SIDEBAR ─── */}
      <div className="flex flex-col h-full min-h-0 overflow-hidden rounded-2xl border border-stone-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">

        {/* 1. Receipt Top Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-stone-200/80 px-4 py-3 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shadow-xs">
              <CashierIcon size={14} />
            </div>
            <div>
              <h3 className="text-xs font-black text-stone-900 dark:text-zinc-100 tracking-tight">
                Purchase Receipt <span className="text-stone-400 dark:text-zinc-500 font-normal">#{orderRefNumber}</span>
              </h3>
            </div>
          </div>

          {cart.length > 0 && (
            <button
              type="button"
              title="Clear cart"
              onClick={clearCart}
              className="size-7 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center justify-center"
            >
              <Delete02Icon size={15} />
            </button>
          )}
        </div>

        {/* 2. Segmented Pill Order Type (customer name & table now in top bar) */}
        <div className="shrink-0 p-3 border-b border-stone-200/80 dark:border-zinc-800">
          <div className="flex items-stretch rounded-full overflow-hidden border border-stone-300 dark:border-zinc-700 divide-x divide-stone-300 dark:divide-zinc-700 shadow-sm">
            <button
              type="button"
              onClick={() => setOrderType('DINE_IN')}
              className={`flex-1 flex items-center justify-center gap-1.5 h-10 text-xs font-bold transition-colors ${orderType === 'DINE_IN'
                ? 'bg-amber-400 text-amber-950'
                : 'bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100'
                }`}
            >
              <Chair01Icon size={14} />
              <span>Dine In</span>
            </button>
            <button
              type="button"
              onClick={() => { setOrderType('TAKEAWAY'); setSelectedTableId(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 h-10 text-xs font-bold transition-colors ${orderType === 'TAKEAWAY'
                ? 'bg-amber-400 text-amber-950'
                : 'bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100'
                }`}
            >
              <PackageProcess01Icon size={14} />
              <span>Take Away</span>
            </button>
          </div>
        </div>

        {/* 3. Order List */}
        <div className="shrink-0 px-4 pt-2.5 pb-1 flex items-center justify-between">
          <span className="text-xs font-black text-stone-900 dark:text-zinc-100 uppercase tracking-wider">
            Order List
          </span>
          {cart.length > 0 && (
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full tabular-nums">
              {totalItemCount} items
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-1 flex flex-col gap-2">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-stone-400 dark:text-zinc-500 py-8">
              <p className="text-xs font-bold text-stone-600 dark:text-zinc-400">Your cart is empty</p>
              <p className="text-[11px] text-stone-400 dark:text-zinc-500 mt-0.5">Click any menu item to begin order</p>
            </div>
          ) : (
            cart.map(c => {
              const lineTotal = (c.menuItem.price + c.modifiers.reduce((s, m) => s + m.price, 0)) * c.quantity;
              const isNoteOpen = activeNoteId === c.lineId;

              return (
                <div
                  key={c.lineId}
                  className="rounded-xl border border-stone-200/80 bg-stone-50/50 dark:border-zinc-800/80 dark:bg-zinc-800/30 p-2.5 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <div className="size-9 rounded-lg overflow-hidden shrink-0 bg-stone-200/60 dark:bg-zinc-700/50 flex items-center justify-center text-xs">
                      {c.menuItem.image ? (
                        <img src={c.menuItem.image} alt="" className="size-full object-cover" />
                      ) : (
                        <span>🍽️</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-stone-900 dark:text-zinc-100 truncate">
                        {c.menuItem.name}
                      </h4>
                      <div className="text-[10px] text-stone-500 dark:text-zinc-400 truncate flex items-center gap-1">
                        <span>₹{c.menuItem.price}</span>
                        {c.modifiers.length > 0 && (
                          <span className="text-amber-700 dark:text-amber-400 font-medium">
                            • {c.modifiers.map(m => m.name).join(', ')}
                          </span>
                        )}
                      </div>
                      {cartNotes[c.lineId] && (
                        <p className="text-[10px] italic text-amber-700 dark:text-amber-400 truncate mt-0.5">
                          “{cartNotes[c.lineId]}”
                        </p>
                      )}
                    </div>

                    <span className="shrink-0 text-xs font-black text-stone-900 dark:text-zinc-100 tabular-nums">
                      ₹{lineTotal}
                    </span>

                    <div className="flex shrink-0 items-center rounded-lg border border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 shadow-2xs">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() => updateQuantity(c.lineId, -1)}
                        className="p-1 text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-l-lg transition-colors"
                      >
                        <MinusSignIcon size={12} />
                      </button>
                      <span className="w-5 text-center text-[11px] font-black tabular-nums text-stone-900 dark:text-zinc-100">
                        {c.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() => updateQuantity(c.lineId, 1)}
                        className="p-1 text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-r-lg transition-colors"
                      >
                        <PlusSignIcon size={12} />
                      </button>
                    </div>

                    <button
                      type="button"
                      title="Add special instructions"
                      onClick={() => setActiveNoteId(isNoteOpen ? null : c.lineId)}
                      className={`shrink-0 size-6 rounded-md flex items-center justify-center transition-colors ${isNoteOpen || cartNotes[c.lineId]
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                        : 'text-stone-400 hover:bg-stone-100 dark:hover:bg-zinc-800'
                        }`}
                    >
                      <NoteEditIcon size={13} />
                    </button>

                    <button
                      type="button"
                      title="Remove item"
                      onClick={() => removeLine(c.lineId)}
                      className="shrink-0 size-6 rounded-md flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      <Cancel01Icon size={13} />
                    </button>
                  </div>

                  {isNoteOpen && (
                    <div className="mt-2 pt-2 border-t border-stone-200/60 dark:border-zinc-700/60 flex items-center gap-1.5">
                      <input
                        autoFocus
                        value={cartNotes[c.lineId] || ''}
                        onChange={e => updateCartNote(c.lineId, e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') setActiveNoteId(null); }}
                        placeholder="e.g., Less spicy, no onions, extra ice…"
                        className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 dark:border-zinc-700 dark:bg-zinc-900 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setActiveNoteId(null)}
                        className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 shrink-0"
                      >
                        Done
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 4. Financial Summary & Checkout Footer */}
        <div className="shrink-0 border-t border-stone-200/90 bg-stone-50/80 dark:border-zinc-800 dark:bg-zinc-950/70 p-3 flex flex-col gap-3">

          {/* Promo Code Input — pill-shaped */}
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-full pl-3.5 pr-1.5 py-1.5">
            {appliedPromo ? (
              <div className="flex items-center justify-between flex-1">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <CheckmarkCircle02Icon size={13} /> {appliedPromo.code} applied
                </span>
                <button
                  type="button"
                  onClick={removePromo}
                  className="size-7 rounded-full flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                >
                  <Cancel01Icon size={13} />
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={promoCodeInput}
                  onChange={e => setPromoCodeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyPromo()}
                  placeholder="Promo code"
                  disabled={cart.length === 0}
                  className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-xs uppercase tracking-wide outline-none placeholder-stone-400 font-medium"
                />
                <button
                  type="button"
                  onClick={applyPromo}
                  disabled={cart.length === 0 || !promoCodeInput.trim()}
                  className="shrink-0 h-8 px-3.5 rounded-full bg-amber-400 text-amber-950 text-[11px] font-bold hover:bg-amber-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </>
            )}
          </div>

          {/* Price Breakdown */}
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between text-stone-500 dark:text-zinc-400">
              <span>Subtotal</span>
              <span className="font-bold text-stone-800 dark:text-zinc-200 tabular-nums">₹{subTotal}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-amber-700 dark:text-amber-400 font-semibold">
                <span>Discount</span>
                <span className="tabular-nums">−₹{discountAmount}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between text-stone-500 dark:text-zinc-400">
                <span>Tax</span>
                <span className="font-bold text-stone-800 dark:text-zinc-200 tabular-nums">₹{taxAmount}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-1.5 border-t border-dashed border-stone-200 dark:border-zinc-800">
              <span className="font-black text-sm text-stone-900 dark:text-zinc-100 uppercase tracking-tight">Total</span>
              <span className="font-black text-xl text-stone-900 dark:text-zinc-100 tabular-nums">₹{totalAmount}</span>
            </div>
          </div>

          {needsTable && cart.length > 0 && (
            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 text-center animate-pulse">
              * Please select a dining table above to proceed.
            </p>
          )}

          {/* Primary Checkout — full pill */}
          <Button
            size="lg"
            disabled={checkoutDisabled}
            onClick={handleOpenPaymentModal}
          >
            {isSubmitting ? 'Processing…' : `Place Order  •  ₹${totalAmount}`}
          </Button>

          {/* Quick Actions — one-sided pill segmented control */}
          <div className="flex overflow-hidden w-full justify-between gap-x-4">
            <Button
              disabled={checkoutDisabled}
              onClick={() => handleCheckout('POSTPAID')}
              title="Send order ticket to Kitchen (Pay bill later at table/counter)"
              size="lg"
              className="w-full"
            >
              Postpaid (KOT)
            </Button>
            <Button
              disabled={checkoutDisabled}
              onClick={() => handleCheckout('PREPAID')}
              title="Direct Cash Settle"
              size="lg"
              className="w-full"
            >
              Quick Cash
            </Button>
          </div>
        </div>
      </div>

      {/* ─── MODIFIER CUSTOMIZATION MODAL ─── */}
      {modifierItem && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Customize ${modifierItem.name}`}
        >
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] border border-stone-200 dark:border-zinc-800">
            <div className="shrink-0 p-4 border-b border-stone-200 dark:border-zinc-800 flex justify-between items-center bg-stone-50 dark:bg-zinc-800/50">
              <div className="min-w-0">
                <h3 className="font-bold text-base truncate text-stone-900 dark:text-zinc-100">{modifierItem.name}</h3>
                <p className="text-xs text-stone-500 dark:text-zinc-400">Select your preferred options</p>
              </div>
              <button
                type="button"
                onClick={() => setModifierItem(null)}
                className="p-1.5 hover:bg-stone-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
              >
                <Cancel01Icon size={16} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
              {modifierItem.modifierGroups.map(group => {
                const selected = selectedModifiers[group.id] || [];
                return (
                  <div key={group.id} className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-xs text-stone-900 dark:text-zinc-100">{group.name}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${group.isRequired && selected.length < group.minSelections
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                        : 'bg-stone-100 text-stone-500 dark:bg-zinc-800 dark:text-zinc-400'
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
                            onClick={() => handleModifierToggle(group.id, opt.id, group.maxSelections)}
                            className={`flex justify-between items-center p-2.5 border rounded-xl transition-all ${isSelected
                              ? 'border-amber-400 bg-amber-500/10'
                              : 'border-stone-200 hover:border-stone-300 dark:border-zinc-700 dark:hover:border-zinc-600'
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`size-4 rounded-full border flex items-center justify-center shrink-0 ${isSelected
                                ? 'bg-amber-400 border-amber-400 text-amber-950'
                                : 'border-stone-300 dark:border-zinc-600'
                                }`}>
                                {isSelected && <CheckmarkCircle02Icon size={12} />}
                              </div>
                              <span className="font-medium text-xs text-left text-stone-900 dark:text-zinc-100">{opt.name}</span>
                            </div>
                            {opt.price > 0 && (
                              <span className="text-xs font-bold text-stone-800 dark:text-zinc-200 tabular-nums">+₹{opt.price}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="shrink-0 p-3 border-t border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950">
              <button
                type="button"
                onClick={submitModifiers}
                className="w-full h-11 rounded-full bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
              >
                <span>Add to Cart</span>
                <span className="tabular-nums">• ₹{modifierTotalPrice}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── THERMAL RECEIPT MODAL ─── */}
      {receiptOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Order receipt"
        >
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl flex flex-col w-full max-w-md max-h-[90vh] overflow-hidden border border-stone-200 dark:border-zinc-800">
            <div className="shrink-0 p-3.5 border-b border-stone-200 dark:border-zinc-800 flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <CheckmarkCircle02Icon size={18} /> Order Placed Successfully
              </h3>
              <button
                type="button"
                onClick={() => setReceiptOrder(null)}
                className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-full"
              >
                <Cancel01Icon size={16} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-stone-100 dark:bg-black">
              <Receipt ref={receiptRef} order={receiptOrder} storeData={storeData} />
            </div>

            <div className="shrink-0 p-3 border-t border-stone-200 dark:border-zinc-800 flex gap-2.5 bg-stone-50 dark:bg-zinc-900">
              <Button type="button" variant="outline" className="flex-1 rounded-full" onClick={() => setReceiptOrder(null)}>
                Close
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-full bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold"
                onClick={printReceipt}
              >
                Print Receipt
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PAYMENT BIFURCATION MODAL ─── */}
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