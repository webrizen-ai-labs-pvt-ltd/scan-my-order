import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  useIsMobile
} from '@smo/ui';
import {
  Money01Icon,
  QrCodeIcon,
  Cancel01Icon,
  Tick02Icon,
  CheckmarkCircle02Icon,
  CashierIcon,
  RefreshIcon,
  Copy01Icon,
  ArrowRight01Icon,
  AlertCircleIcon
} from 'hugeicons-react';
import { QRCodeSVG } from 'qrcode.react';

/**
 * PaymentBifurcationModal
 * 
 * High-performance payment settlement interface for Cashiers and Waiters.
 * - Automatically renders as a Bottom Sheet on Mobile (< 768px) and a Centered Dialog on Desktop (>= 768px).
 * - Full Cash with one-tap denomination calculators (+₹50, +₹100, +₹500, exact change).
 * - 100% Online UPI dynamic QR with live scan pulse, link copying, and instant verification.
 * - Split Payment with balanced ratio indicators, quick split presets (50/50, round to ₹50/₹100).
 * - Zero emojis, pure hugeicons-react icons, design system tokens, and dark mode elegance.
 */
export const PaymentBifurcationModal = ({
  isOpen,
  onClose,
  totalAmount = 0,
  title = "Collect Payment",
  subtitle = null,
  onSettle,
  onGenerateQR,
  isSubmitting = false,
  isVerifying = false,
  onVerifyPayment = null,
  externalQrUrl = null
}) => {
  const isMobile = useIsMobile();
  const [method, setMethod] = useState('CASH'); // 'CASH' | 'ONLINE' | 'SPLIT'

  // Split state
  const [cashPart, setCashPart] = useState(0);
  const [onlinePart, setOnlinePart] = useState(0);

  // Cash tendered & change calculation
  const [cashTendered, setCashTendered] = useState('');

  // Local QR state
  const [qrState, setQrState] = useState({
    isOpen: false,
    url: '',
    amount: 0,
    isGenerated: false,
    isVerified: false
  });
  const [generatingQr, setGeneratingQr] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Ref to track modal open state transitions
  const prevIsOpenRef = useRef(false);

  // Initialize or reset ONLY when modal transitions from closed -> open
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      const half = Math.floor(totalAmount / 2);
      setCashPart(half);
      setOnlinePart(totalAmount - half);
      setCashTendered('');
      setCopiedLink(false);
      setQrState({
        isOpen: Boolean(externalQrUrl),
        url: externalQrUrl || '',
        amount: totalAmount,
        isGenerated: Boolean(externalQrUrl),
        isVerified: false
      });
      // If external QR is already present on open, default to ONLINE tab, else CASH
      setMethod(externalQrUrl ? 'ONLINE' : 'CASH');
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, totalAmount, externalQrUrl]);

  // Safely sync external QR URL without resetting the user's selected tab or amounts
  useEffect(() => {
    if (externalQrUrl) {
      setQrState(prev => ({
        ...prev,
        url: externalQrUrl,
        isGenerated: true
      }));
    }
  }, [externalQrUrl]);

  // If totalAmount changes while already open, re-balance split parts without resetting tab
  useEffect(() => {
    if (isOpen && prevIsOpenRef.current) {
      setCashPart(prevCash => {
        const nextCash = Math.min(prevCash, totalAmount);
        setOnlinePart(totalAmount - nextCash);
        return nextCash;
      });
    }
  }, [totalAmount, isOpen]);

  // Handle cash input change in Split mode
  const handleCashChange = useCallback((val) => {
    const raw = parseInt(val, 10);
    const parsed = isNaN(raw) ? 0 : Math.max(0, Math.min(totalAmount, raw));
    setCashPart(parsed);
    setOnlinePart(totalAmount - parsed);
    if (qrState.isGenerated) {
      setQrState(prev => ({ ...prev, isGenerated: false, url: '' }));
    }
  }, [totalAmount, qrState.isGenerated]);

  // Handle online input change in Split mode
  const handleOnlineChange = useCallback((val) => {
    const raw = parseInt(val, 10);
    const parsed = isNaN(raw) ? 0 : Math.max(0, Math.min(totalAmount, raw));
    setOnlinePart(parsed);
    setCashPart(totalAmount - parsed);
    if (qrState.isGenerated) {
      setQrState(prev => ({ ...prev, isGenerated: false, url: '' }));
    }
  }, [totalAmount, qrState.isGenerated]);

  // Quick split presets
  const handleHalfSplit = () => {
    const half = Math.floor(totalAmount / 2);
    setCashPart(half);
    setOnlinePart(totalAmount - half);
    if (qrState.isGenerated) {
      setQrState(prev => ({ ...prev, isGenerated: false, url: '' }));
    }
  };

  const handleRoundCash50 = () => {
    const currentHalf = Math.floor(totalAmount / 2);
    const rounded = Math.min(totalAmount, Math.ceil(currentHalf / 50) * 50);
    setCashPart(rounded);
    setOnlinePart(totalAmount - rounded);
    if (qrState.isGenerated) {
      setQrState(prev => ({ ...prev, isGenerated: false, url: '' }));
    }
  };

  const handleRoundCash100 = () => {
    const currentHalf = Math.floor(totalAmount / 2);
    const rounded = Math.min(totalAmount, Math.ceil(currentHalf / 100) * 100);
    setCashPart(rounded);
    setOnlinePart(totalAmount - rounded);
    if (qrState.isGenerated) {
      setQrState(prev => ({ ...prev, isGenerated: false, url: '' }));
    }
  };

  // Change calculator derived values
  const activeCashDue = useMemo(() => {
    return method === 'CASH' ? totalAmount : cashPart;
  }, [method, totalAmount, cashPart]);

  const parsedTendered = useMemo(() => {
    return parseInt(cashTendered, 10) || 0;
  }, [cashTendered]);

  const changeDue = useMemo(() => {
    return Math.max(0, parsedTendered - activeCashDue);
  }, [parsedTendered, activeCashDue]);

  const isUnderTendered = useMemo(() => {
    return cashTendered !== '' && parsedTendered < activeCashDue;
  }, [cashTendered, parsedTendered, activeCashDue]);

  const remainingToTender = useMemo(() => {
    return Math.max(0, activeCashDue - parsedTendered);
  }, [activeCashDue, parsedTendered]);

  // Denomination addition helpers
  const handleAddDenomination = (amount) => {
    const current = parseInt(cashTendered, 10) || 0;
    setCashTendered(String(current + amount));
  };

  // Generate QR for the online portion
  const handleTriggerGenerateQR = async () => {
    const targetAmount = method === 'ONLINE' ? totalAmount : onlinePart;
    if (targetAmount <= 0) return;

    setGeneratingQr(true);
    try {
      if (onGenerateQR) {
        const res = await onGenerateQR(targetAmount);
        if (res && res.url) {
          setQrState({
            isOpen: true,
            url: res.url,
            amount: targetAmount,
            isGenerated: true,
            isVerified: false
          });
        }
      }
    } catch (err) {
      console.error('Failed to generate QR:', err);
    } finally {
      setGeneratingQr(false);
    }
  };

  const handleCopyLink = () => {
    if (qrState.url) {
      navigator.clipboard.writeText(qrState.url).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 3000);
      }).catch(() => {});
    }
  };

  // Settle execution
  const handleConfirmSettle = async () => {
    if (method === 'CASH') {
      await onSettle({
        paymentMethod: 'CASH',
        cashAmount: totalAmount,
        onlineAmount: 0,
        cashTendered: parsedTendered || totalAmount,
        changeDue
      });
    } else if (method === 'ONLINE') {
      await onSettle({
        paymentMethod: 'ONLINE',
        cashAmount: 0,
        onlineAmount: totalAmount,
        cashTendered: 0,
        changeDue: 0
      });
    } else if (method === 'SPLIT') {
      await onSettle({
        paymentMethod: 'SPLIT',
        cashAmount: cashPart,
        onlineAmount: onlinePart,
        cashTendered: parsedTendered || cashPart,
        changeDue
      });
    }
  };

  // Split calculation percentages
  const cashPercent = totalAmount > 0 ? Math.round((cashPart / totalAmount) * 100) : 50;
  const onlinePercent = 100 - cashPercent;

  if (!isOpen) return null;

  // ─────────────────────────────────────────────────────────────
  // Inner Modal Content (Shared between Desktop Dialog & Mobile Sheet)
  // ─────────────────────────────────────────────────────────────
  const modalContent = (
    <div className="flex flex-col h-full max-h-[85vh] md:max-h-[88vh]">
      {/* ─── Grab Bar (Mobile Visual) ─── */}
      <div className="md:hidden mx-auto -mt-2 mb-2 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700" />

      {/* ─── Header ─── */}
      <div className="shrink-0 pb-3 md:pb-4 md:pt-0 pt-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <CashierIcon size={18} />
            </div>
            <h3 className="font-extrabold text-base md:text-lg text-zinc-900 dark:text-zinc-100 tracking-tight">
              {title}
            </h3>
          </div>
          {subtitle && (
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1 pl-10">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 block">
              Total Due
            </span>
            <span className="text-xl md:text-2xl font-black text-zinc-900 dark:text-zinc-50 tabular-nums">
              ₹{totalAmount.toLocaleString('en-IN')}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 md:flex hidden"
            aria-label="Close"
          >
            <Cancel01Icon size={18} />
          </button>
        </div>
      </div>

      {/* ─── Tender Method Selector Tabs ─── */}
      <div className="shrink-0 py-3 border-b border-zinc-100 dark:border-zinc-800/80">
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-2xl">
          <button
            type="button"
            onClick={() => setMethod('CASH')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 ${
              method === 'CASH'
                ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-500/30'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Money01Icon size={16} />
            <span>100% Cash</span>
          </button>

          <button
            type="button"
            onClick={() => setMethod('ONLINE')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 ${
              method === 'ONLINE'
                ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-blue-500/30'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <QrCodeIcon size={16} />
            <span>100% Online</span>
          </button>

          <button
            type="button"
            onClick={() => setMethod('SPLIT')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 ${
              method === 'SPLIT'
                ? 'bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-sm ring-1 ring-amber-500/30'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <CashierIcon size={16} />
            <span>Split Tender</span>
          </button>
        </div>
      </div>

      {/* ─── Tab Content Scrollable Body ─── */}
      <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">

        {/* 1. 100% CASH TAB */}
        {method === 'CASH' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Amount Banner */}
            <div className="p-4 rounded-2xl bg-emerald-500/[0.08] dark:bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block">
                    Cash Amount to Collect
                  </span>
                  <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                    Hand-to-hand currency payment at counter
                  </span>
                </div>
                <span className="text-2xl md:text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  ₹{totalAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Cash Tendered & Change Due Section */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Cash Received from Guest:
                </label>
                <div className="relative w-40">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    min={0}
                    placeholder={String(totalAmount)}
                    value={cashTendered}
                    onChange={e => setCashTendered(e.target.value)}
                    className="w-full h-9 pl-7 pr-3 text-right text-sm font-bold bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition"
                  />
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Quick Fill Currency</span>
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setCashTendered(String(totalAmount))}
                    className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                  >
                    Exact (₹{totalAmount})
                  </button>
                  {[50, 100, 200, 500].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleAddDenomination(amt)}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:border-zinc-400 transition"
                    >
                      +{amt}
                    </button>
                  ))}
                  {[100, 200, 500, 1000, 2000].map(den => (
                    den >= totalAmount && (
                      <button
                        key={den}
                        type="button"
                        onClick={() => setCashTendered(String(den))}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl hover:bg-emerald-100 transition"
                      >
                        ₹{den} Note
                      </button>
                    )
                  ))}
                </div>
              </div>

              {/* Change Due or Remaining Display */}
              {parsedTendered > totalAmount ? (
                <div className="flex justify-between items-center pt-3 border-t border-dashed border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    <Tick02Icon size={16} />
                    <span>Change to Return to Guest:</span>
                  </div>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-lg tabular-nums">
                    ₹{changeDue.toLocaleString('en-IN')}
                  </span>
                </div>
              ) : isUnderTendered ? (
                <div className="flex justify-between items-center pt-3 border-t border-dashed border-zinc-200 dark:border-zinc-700 text-xs">
                  <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircleIcon size={14} /> Remaining to Tender:
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                    ₹{remainingToTender.toLocaleString('en-IN')}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* 2. 100% ONLINE TAB */}
        {method === 'ONLINE' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Amount Banner */}
            <div className="p-4 rounded-2xl bg-blue-500/[0.08] dark:bg-blue-500/10 border border-blue-500/20">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-blue-800 dark:text-blue-300 block">
                    Online Amount Due
                  </span>
                  <span className="text-[11px] text-blue-700/80 dark:text-blue-400/80">
                    UPI dynamic QR (GPay, PhonePe, Paytm, BHIM)
                  </span>
                </div>
                <span className="text-2xl md:text-3xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
                  ₹{totalAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* QR Box */}
            {qrState.url ? (
              <div className="flex flex-col items-center p-5 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-center">
                <div className="bg-white p-3.5 rounded-2xl shadow-md border border-zinc-200 inline-block mb-3">
                  <QRCodeSVG value={qrState.url} size={190} level="M" includeMargin={false} />
                </div>

                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-bold mb-3">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                  Awaiting UPI Payment Verification…
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-center w-full">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 transition"
                  >
                    <Copy01Icon size={14} />
                    <span>{copiedLink ? 'Copied Link!' : 'Copy Payment Link'}</span>
                  </button>

                  {onVerifyPayment && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isVerifying}
                      onClick={onVerifyPayment}
                      className="text-xs font-bold flex items-center gap-1.5 rounded-xl"
                    >
                      <RefreshIcon size={14} className={isVerifying ? "animate-spin text-blue-600" : ""} />
                      <span>{isVerifying ? "Checking…" : "Verify Payment"}</span>
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center gap-3 text-center bg-zinc-50/50 dark:bg-zinc-900/30">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <QrCodeIcon size={28} />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Dynamic Payment QR</p>
                  <p className="text-[11px] text-zinc-500">Generate a live Razorpay UPI QR code for ₹{totalAmount}</p>
                </div>
                <Button
                  type="button"
                  disabled={generatingQr}
                  onClick={handleTriggerGenerateQR}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl px-5 h-9 shadow-sm"
                >
                  {generatingQr ? (
                    <span className="flex items-center gap-1.5">
                      <RefreshIcon size={14} className="animate-spin" /> Generating QR…
                    </span>
                  ) : (
                    "Generate UPI QR"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* 3. SPLIT PAYMENT TAB */}
        {method === 'SPLIT' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Visual Ratio Progress Bar */}
            <div className="p-4 bg-amber-500/[0.08] dark:bg-amber-500/10 rounded-2xl border border-amber-500/20 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200">
                <span className="flex items-center gap-1.5">
                  <CashierIcon size={16} /> Split Ratio Breakdown
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Balanced: ₹{cashPart + onlinePart} / ₹{totalAmount}
                </span>
              </div>

              {/* Dual-color bar */}
              <div className="h-2.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden flex">
                <div
                  className="bg-emerald-500 transition-all duration-200"
                  style={{ width: `${cashPercent}%` }}
                  title={`Cash: ${cashPercent}%`}
                />
                <div
                  className="bg-blue-500 transition-all duration-200"
                  style={{ width: `${onlinePercent}%` }}
                  title={`Online: ${onlinePercent}%`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs pt-1">
                <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-emerald-500/20 shadow-xs">
                  <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Cash ({cashPercent}%)</div>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    ₹{cashPart.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-blue-500/20 shadow-xs">
                  <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Online ({onlinePercent}%)</div>
                  <div className="text-xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
                    ₹{onlinePart.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>

            {/* Split Presets */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleHalfSplit}
                className="flex-1 py-1.5 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl transition"
              >
                50 / 50 Split
              </button>
              <button
                type="button"
                onClick={handleRoundCash50}
                className="flex-1 py-1.5 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl transition"
              >
                Round to ₹50
              </button>
              <button
                type="button"
                onClick={handleRoundCash100}
                className="flex-1 py-1.5 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl transition"
              >
                Round to ₹100
              </button>
            </div>

            {/* Linked Inputs */}
            <div className="space-y-3">
              {/* Cash Component */}
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Money01Icon size={16} className="text-emerald-500" />
                    1. Cash Portion:
                  </label>
                  <div className="relative w-36">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      min={0}
                      max={totalAmount}
                      value={cashPart}
                      onChange={e => handleCashChange(e.target.value)}
                      className="w-full h-8 pl-7 pr-2 text-right text-sm font-bold bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Online Component & QR */}
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <QrCodeIcon size={16} className="text-blue-500" />
                    2. Online (UPI) Portion:
                  </label>
                  <div className="relative w-36">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      min={0}
                      max={totalAmount}
                      value={onlinePart}
                      onChange={e => handleOnlineChange(e.target.value)}
                      className="w-full h-8 pl-7 pr-2 text-right text-sm font-bold bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                {onlinePart > 0 && (
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700/60">
                    {qrState.url ? (
                      <div className="flex flex-col items-center p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 text-center">
                        <div className="bg-white p-2.5 rounded-xl shadow-xs border border-zinc-100 inline-block mb-2">
                          <QRCodeSVG value={qrState.url} size={150} level="M" includeMargin={false} />
                        </div>
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                          Scan to pay online share: ₹{onlinePart}
                        </span>
                        {onVerifyPayment && (
                          <button
                            type="button"
                            disabled={isVerifying}
                            onClick={onVerifyPayment}
                            className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <RefreshIcon size={13} className={isVerifying ? "animate-spin" : ""} />
                            <span>{isVerifying ? "Verifying…" : "Check Online Status"}</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={generatingQr}
                        onClick={handleTriggerGenerateQR}
                        className="w-full text-xs font-bold rounded-xl h-8 flex items-center justify-center gap-1.5"
                      >
                        <QrCodeIcon size={14} />
                        <span>{generatingQr ? "Generating QR…" : `Generate QR for ₹${onlinePart}`}</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ─── Footer Action Controls ─── */}
      <div className="shrink-0 pt-3 md:pt-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-2.5">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="rounded-none rounded-l-full w-full"
        >
          Cancel
        </Button>

        <Button
          type="button"
          disabled={isSubmitting || (method === 'SPLIT' && (cashPart + onlinePart !== totalAmount))}
          onClick={handleConfirmSettle}
          className={`flex items-center rounded-none rounded-r-full ${
            method === 'CASH'
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : method === 'ONLINE'
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-amber-600 hover:bg-amber-700'
          }`}
        >
          <CheckmarkCircle02Icon size={18} />
          {isSubmitting ? (
            <span className="flex items-center gap-1.5">
              <RefreshIcon size={14} className="animate-spin" /> Settling…
            </span>
          ) : method === 'CASH' ? (
            <span>Collect ₹{totalAmount.toLocaleString('en-IN')} & Settle</span>
          ) : method === 'ONLINE' ? (
            <span>Confirm Online Settlement</span>
          ) : (
            <span>Confirm Split & Settle</span>
          )}
        </Button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // Dual Responsive Shell: Bottom Sheet on Mobile, Dialog on Desktop
  // ─────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={open => !open && onClose()}>
        <SheetContent side="bottom" className="p-4 sm:p-6 rounded-t-3xl max-h-[92vh] border-t border-zinc-200 dark:border-zinc-800">
          <SheetHeader className="sr-only">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{subtitle || "Payment collection"}</SheetDescription>
          </SheetHeader>
          {modalContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-lg p-5 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {modalContent}
      </div>
    </div>
  );
};
