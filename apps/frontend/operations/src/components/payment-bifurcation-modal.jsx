import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@smo/ui';
import {
  Money01Icon,
  QrCodeIcon,
  Cancel01Icon,
  Tick02Icon,
  CheckmarkCircle02Icon,
  CashierIcon,
  RefreshIcon
} from 'hugeicons-react';
import { QRCodeSVG } from 'qrcode.react';

/**
 * PaymentBifurcationModal
 * 
 * Supports:
 * - 100% Cash with change calculator
 * - 100% Online with Razorpay dynamic QR
 * - Split Payment (Cash + Online QR) with dynamic split calculations
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

  // Initialize or reset when modal opens or totalAmount changes
  useEffect(() => {
    if (isOpen) {
      const half = Math.floor(totalAmount / 2);
      setCashPart(half);
      setOnlinePart(totalAmount - half);
      setCashTendered('');
      setQrState({
        isOpen: false,
        url: externalQrUrl || '',
        amount: 0,
        isGenerated: Boolean(externalQrUrl),
        isVerified: false
      });
      setMethod('CASH');
    }
  }, [isOpen, totalAmount, externalQrUrl]);

  // Keep external QR in sync if passed
  useEffect(() => {
    if (externalQrUrl) {
      setQrState(prev => ({
        ...prev,
        url: externalQrUrl,
        isGenerated: true
      }));
    }
  }, [externalQrUrl]);

  // Handle cash input change in Split mode
  const handleCashChange = (val) => {
    const parsed = Math.max(0, Math.min(totalAmount, parseInt(val, 10) || 0));
    setCashPart(parsed);
    setOnlinePart(totalAmount - parsed);
    // Reset generated QR if online amount changes
    if (qrState.isGenerated) {
      setQrState(prev => ({ ...prev, isGenerated: false, url: '' }));
    }
  };

  // Handle online input change in Split mode
  const handleOnlineChange = (val) => {
    const parsed = Math.max(0, Math.min(totalAmount, parseInt(val, 10) || 0));
    setOnlinePart(parsed);
    setCashPart(totalAmount - parsed);
    if (qrState.isGenerated) {
      setQrState(prev => ({ ...prev, isGenerated: false, url: '' }));
    }
  };

  // Preset split helpers
  const handleHalfSplit = () => {
    const half = Math.floor(totalAmount / 2);
    setCashPart(half);
    setOnlinePart(totalAmount - half);
    setQrState(prev => ({ ...prev, isGenerated: false, url: '' }));
  };

  const handleRoundCash50 = () => {
    const rounded = Math.min(totalAmount, Math.ceil(cashPart / 50) * 50);
    setCashPart(rounded);
    setOnlinePart(totalAmount - rounded);
    setQrState(prev => ({ ...prev, isGenerated: false, url: '' }));
  };

  const handleRoundCash100 = () => {
    const rounded = Math.min(totalAmount, Math.ceil(cashPart / 100) * 100);
    setCashPart(rounded);
    setOnlinePart(totalAmount - rounded);
    setQrState(prev => ({ ...prev, isGenerated: false, url: '' }));
  };

  // Change calculator
  const activeCashDue = method === 'CASH' ? totalAmount : cashPart;
  const parsedTendered = parseInt(cashTendered, 10) || 0;
  const changeDue = Math.max(0, parsedTendered - activeCashDue);

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95">
        
        {/* ─── Header ─── */}
        <div className="shrink-0 p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/80 dark:bg-zinc-950/50">
          <div>
            <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <CashierIcon size={20} className="text-primary" />
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-zinc-400">Total Due</div>
              <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
                ₹{totalAmount.toLocaleString('en-IN')}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              <Cancel01Icon size={18} />
            </button>
          </div>
        </div>

        {/* ─── Tender Tabs ─── */}
        <div className="shrink-0 p-3 bg-zinc-100 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800">
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-200/70 dark:bg-zinc-900 rounded-xl">
            <button
              type="button"
              onClick={() => setMethod('CASH')}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                method === 'CASH'
                  ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-500/30'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              <Money01Icon size={15} />
              <span>100% Cash</span>
            </button>

            <button
              type="button"
              onClick={() => setMethod('ONLINE')}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                method === 'ONLINE'
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-blue-500/30'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              <QrCodeIcon size={15} />
              <span>100% Online</span>
            </button>

            <button
              type="button"
              onClick={() => setMethod('SPLIT')}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                method === 'SPLIT'
                  ? 'bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-sm ring-1 ring-amber-500/30'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              <CashierIcon size={15} />
              <span>Split Tender</span>
            </button>
          </div>
        </div>

        {/* ─── Tab Content Body ─── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* 1. 100% CASH TAB */}
          {method === 'CASH' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Cash Amount to Collect</span>
                  <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                    ₹{totalAmount.toLocaleString('en-IN')}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-500">Collect physical currency from guest at counter</p>
              </div>

              {/* Cash Tendered & Change Due Calculator */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Cash Tendered (Received):</label>
                  <div className="relative w-36">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      min={0}
                      placeholder={String(totalAmount)}
                      value={cashTendered}
                      onChange={e => setCashTendered(e.target.value)}
                      className="w-full h-8 pl-6 pr-2 text-right text-sm font-bold bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setCashTendered(String(totalAmount))}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md hover:border-zinc-400"
                  >
                    Exact (₹{totalAmount})
                  </button>
                  {[100, 200, 500, 1000, 2000].map(den => (
                    den >= totalAmount && (
                      <button
                        key={den}
                        type="button"
                        onClick={() => setCashTendered(String(den))}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md hover:border-zinc-400"
                      >
                        ₹{den}
                      </button>
                    )
                  ))}
                </div>

                {/* Change Due Display */}
                {parsedTendered > totalAmount && (
                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-700 text-xs">
                    <span className="font-semibold text-zinc-600 dark:text-zinc-400">Change to Return:</span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 text-base tabular-nums">
                      ₹{changeDue.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. 100% ONLINE TAB */}
          {method === 'ONLINE' && (
            <div className="space-y-4 text-center">
              <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">Online Amount Due</span>
                  <span className="text-2xl font-black text-blue-700 dark:text-blue-400 tabular-nums">
                    ₹{totalAmount.toLocaleString('en-IN')}
                  </span>
                </div>
                <p className="text-[11px] text-blue-600 dark:text-blue-500">Customer scans Razorpay UPI dynamic QR code to pay</p>
              </div>

              {/* QR Box */}
              {qrState.url ? (
                <div className="flex flex-col items-center p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <div className="bg-white p-3 rounded-xl shadow-inner border border-zinc-100 inline-block mb-3">
                    <QRCodeSVG value={qrState.url} size={180} level="M" includeMargin={false} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-bold mb-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                    </span>
                    Waiting for customer UPI payment…
                  </div>
                  {onVerifyPayment && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isVerifying}
                      onClick={onVerifyPayment}
                      className="text-xs flex items-center gap-1"
                    >
                      <RefreshIcon size={12} className={isVerifying ? "animate-spin" : ""} />
                      {isVerifying ? "Checking…" : "Verify Payment Now"}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col items-center justify-center gap-3">
                  <QrCodeIcon size={36} className="text-zinc-400" />
                  <div className="text-xs text-zinc-500">Generate a dynamic UPI QR code for ₹{totalAmount}</div>
                  <Button
                    type="button"
                    disabled={generatingQr}
                    onClick={handleTriggerGenerateQR}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                  >
                    {generatingQr ? "Generating QR…" : "Generate Razorpay QR"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* 3. SPLIT PAYMENT TAB (BIFURCATION) */}
          {method === 'SPLIT' && (
            <div className="space-y-4">
              {/* Balance Bar */}
              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/40">
                <div className="flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <CashierIcon size={15} /> Split Tender Breakdown
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Balanced: ₹{cashPart + onlinePart} / ₹{totalAmount}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2 bg-white dark:bg-zinc-900 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                    <div className="text-[10px] text-zinc-400 font-bold uppercase">Cash Portion</div>
                    <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                      ₹{cashPart.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="p-2 bg-white dark:bg-zinc-900 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                    <div className="text-[10px] text-zinc-400 font-bold uppercase">Online Portion</div>
                    <div className="text-lg font-black text-blue-600 dark:text-blue-400 tabular-nums">
                      ₹{onlinePart.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dual Linked Inputs */}
              <div className="space-y-3">
                {/* Cash Input */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <Money01Icon size={14} className="text-emerald-600" />
                      1. Cash Portion Amount:
                    </label>
                    <div className="relative w-36">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">₹</span>
                      <input
                        type="number"
                        min={0}
                        max={totalAmount}
                        value={cashPart}
                        onChange={e => handleCashChange(e.target.value)}
                        className="w-full h-8 pl-6 pr-2 text-right text-sm font-bold bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                  </div>

                  {/* Cash Presets */}
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={handleHalfSplit}
                      className="px-2 py-0.5 text-[10px] font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded hover:border-zinc-400"
                    >
                      50% (₹{Math.floor(totalAmount / 2)})
                    </button>
                    <button
                      type="button"
                      onClick={handleRoundCash50}
                      className="px-2 py-0.5 text-[10px] font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded hover:border-zinc-400"
                    >
                      Round to ₹50
                    </button>
                    <button
                      type="button"
                      onClick={handleRoundCash100}
                      className="px-2 py-0.5 text-[10px] font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded hover:border-zinc-400"
                    >
                      Round to ₹100
                    </button>
                  </div>
                </div>

                {/* Online Input & QR Trigger */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <QrCodeIcon size={14} className="text-blue-600" />
                      2. Online (UPI) Portion:
                    </label>
                    <div className="relative w-36">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">₹</span>
                      <input
                        type="number"
                        min={0}
                        max={totalAmount}
                        value={onlinePart}
                        onChange={e => handleOnlineChange(e.target.value)}
                        className="w-full h-8 pl-6 pr-2 text-right text-sm font-bold bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                  </div>

                  {/* Online QR Section for Split */}
                  {onlinePart > 0 && (
                    <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
                      {qrState.url ? (
                        <div className="flex flex-col items-center p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700">
                          <div className="bg-white p-2 rounded shadow-inner border border-zinc-100 inline-block mb-2">
                            <QRCodeSVG value={qrState.url} size={140} level="M" includeMargin={false} />
                          </div>
                          <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                            Customer scans to pay ₹{onlinePart}
                          </div>
                          {onVerifyPayment && (
                            <button
                              type="button"
                              disabled={isVerifying}
                              onClick={onVerifyPayment}
                              className="mt-2 text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                            >
                              <RefreshIcon size={11} className={isVerifying ? "animate-spin" : ""} />
                              {isVerifying ? "Verifying…" : "Check Online Status"}
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
                          className="w-full text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <QrCodeIcon size={14} />
                          {generatingQr ? "Generating QR…" : `Generate QR for ₹${onlinePart}`}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ─── Footer Action Buttons ─── */}
        <div className="shrink-0 p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>

          <Button
            type="button"
            disabled={isSubmitting || (method === 'SPLIT' && (cashPart + onlinePart !== totalAmount))}
            onClick={handleConfirmSettle}
            className={`flex-1 font-bold text-white shadow-md flex items-center justify-center gap-1.5 ${
              method === 'CASH'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : method === 'ONLINE'
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            <CheckmarkCircle02Icon size={16} />
            {isSubmitting ? (
              <span className="animate-pulse">Settling…</span>
            ) : method === 'CASH' ? (
              <span>Confirm Cash & Settle</span>
            ) : method === 'ONLINE' ? (
              <span>Settle Online</span>
            ) : (
              <span>Confirm Split & Settle</span>
            )}
          </Button>
        </div>

      </div>
    </div>
  );
};
