import React, { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Button,
  Input,
  Badge
} from '@smo/ui';
import {
  Cancel01Icon,
  Tick02Icon,
  Clock01Icon,
  AlertCircleIcon,
  Loading03Icon,
  UserGroupIcon,
  DropletIcon,
  Invoice01Icon,
  SpoonAndForkIcon,
  CleaningBucketIcon,
  CustomerService01Icon,
  Notification01Icon
} from 'hugeicons-react';

const CALL_TYPES = [
  {
    id: 'WATER',
    label: 'Water Refill',
    icon: DropletIcon,
    desc: 'Regular or warm drinking water',
  },
  {
    id: 'BILL',
    label: 'Request Bill',
    icon: Invoice01Icon,
    desc: 'Ready to settle bill at table',
  },
  {
    id: 'CUTLERY',
    label: 'Cutlery & Napkins',
    icon: SpoonAndForkIcon,
    desc: 'Extra spoons, forks, or tissues',
  },
  {
    id: 'CLEAN_TABLE',
    label: 'Clean Table',
    icon: CleaningBucketIcon,
    desc: 'Clear empty plates or wipe table',
  },
  {
    id: 'CALL_WAITER',
    label: 'General Assistance',
    icon: CustomerService01Icon,
    desc: 'Assistance with menu or ordering',
  }
];

export const CallWaiterModal = ({
  open,
  onClose,
  storeId,
  tableNumber,
  tableId,
  onCallActiveChange
}) => {
  const [selectedType, setSelectedType] = useState('WATER');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  
  // Active call status
  const [activeCall, setActiveCall] = useState(null);
  const [countdown, setCountdown] = useState(60);

  const pollTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);

  // Storage key for keeping state on refresh
  const storageKey = `smo_call_${storeId}_${tableNumber}`;

  // Check active call status from backend
  const checkCallStatus = async () => {
    if (!storeId || !tableNumber) return;
    try {
      const res = await api.get(`/public/stores/${storeId}/tables/${tableNumber}/calls/status`);
      if (res.data?.success && res.data.data?.hasActiveCall) {
        const callData = res.data.data;
        setActiveCall(callData);
        localStorage.setItem(storageKey, JSON.stringify(callData));
        if (onCallActiveChange) onCallActiveChange(true);
      } else {
        setActiveCall(null);
        localStorage.removeItem(storageKey);
        if (onCallActiveChange) onCallActiveChange(false);
      }
    } catch (err) {
      console.error('Failed to check table call status:', err);
    }
  };

  // Poll status when open or active call exists
  useEffect(() => {
    if (open || activeCall) {
      checkCallStatus();
      pollTimerRef.current = setInterval(checkCallStatus, 3500);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [open, storeId, tableNumber, !!activeCall]);

  // Load saved active call from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setActiveCall(parsed);
        if (onCallActiveChange) onCallActiveChange(true);
      } catch (e) {
        localStorage.removeItem(storageKey);
      }
    }
  }, [storageKey]);

  // 60s countdown visual helper for customer
  useEffect(() => {
    if (activeCall && activeCall.status === 'PENDING') {
      const created = new Date(activeCall.createdAt || Date.now()).getTime();
      const elapsed = Math.floor((Date.now() - created) / 1000);
      setCountdown(Math.max(0, 60 - (elapsed % 60)));

      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => (prev > 1 ? prev - 1 : 60));
      }, 1000);
    } else {
      setCountdown(60);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    }
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [activeCall?.status, activeCall?.createdAt]);

  const handleSendCall = async () => {
    if (!storeId || !tableNumber) return;
    setLoading(true);
    setError('');

    try {
      const payload = {
        tableId,
        tableNumber: parseInt(tableNumber, 10),
        type: selectedType,
        note: note.trim()
      };

      const res = await api.post(`/public/stores/${storeId}/calls`, payload);
      if (res.data?.success) {
        await checkCallStatus();
        setNote('');
      } else {
        setError(res.data?.message || 'Failed to call waiter');
      }
    } catch (err) {
      console.error('Call waiter error:', err);
      setError(err.response?.data?.message || 'Unable to place call right now. Please notify staff directly.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelCall = async () => {
    if (!activeCall?.callId) return;
    setCancelling(true);
    try {
      await api.post(`/public/stores/${storeId}/calls/${activeCall.callId}/cancel`);
      setActiveCall(null);
      localStorage.removeItem(storageKey);
      if (onCallActiveChange) onCallActiveChange(false);
    } catch (err) {
      console.error('Cancel call error:', err);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="bottom" className="w-full sm:max-w-md mx-auto p-6 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-t-3xl shadow-2xl">
        <SheetHeader className="pb-6 pt-2 pr-6 text-left">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-bold flex items-center gap-2.5 text-zinc-900 dark:text-zinc-50">
              <span className="p-2 rounded-xl bg-yellow-500/15 text-yellow-600 dark:text-yellow-400">
                <Notification01Icon size={20} />
              </span>
              Call a Waiter
            </SheetTitle>
            <Badge variant="outline" className="px-2.5 py-1 text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
              Table {tableNumber}
            </Badge>
          </div>
        </SheetHeader>

        {/* If an active call is currently in progress */}
        {activeCall ? (
          <div className="space-y-5 pt-3">
            <div className="p-5 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 dark:bg-yellow-500/10 text-center space-y-3 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-28 h-28 bg-yellow-500/10 rounded-full blur-xl pointer-events-none" />

              {/* Status Indicator */}
              <div className="flex flex-col items-center justify-center">
                {activeCall.status === 'ACKNOWLEDGED' ? (
                  <div className="h-14 w-14 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center animate-bounce">
                    <Tick02Icon size={32} />
                  </div>
                ) : (
                  <div className="relative flex items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-yellow-400 opacity-30" />
                    <div className="h-14 w-14 rounded-full bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 flex items-center justify-center font-bold text-lg">
                      {countdown}s
                    </div>
                  </div>
                )}

                <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-3">
                  {activeCall.status === 'ACKNOWLEDGED'
                    ? 'Waiter is on the way!'
                    : activeCall.assignedWaiterName
                    ? `Paging ${activeCall.assignedWaiterName}...`
                    : 'Dispatching Next Available Server...'}
                </h4>

                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mt-1">
                  {activeCall.status === 'ACKNOWLEDGED' ? (
                    <span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{activeCall.assignedWaiterName || 'A waiter'}</span> has acknowledged your request and is heading to Table {tableNumber}.
                    </span>
                  ) : activeCall.escalationLevel >= 2 ? (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      All servers are currently assisting other tables. Your request is #1 in queue and floor supervisor has been alerted.
                    </span>
                  ) : (
                    <span>
                      Assigned to server {activeCall.assignedWaiterName ? `(${activeCall.assignedWaiterName})` : ''}. If unacknowledged within 60s, will auto-escalate to the next available staff.
                    </span>
                  )}
                </p>
              </div>

              {/* Call Details Pill */}
              <div className="flex items-center justify-center gap-2 pt-2 text-xs text-zinc-600 dark:text-zinc-300">
                <span className="px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-medium">
                  Request: {CALL_TYPES.find(c => c.id === activeCall.type)?.label || activeCall.type}
                </span>
                {activeCall.note && (
                  <span className="px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 truncate max-w-[150px]" title={activeCall.note}>
                    "{activeCall.note}"
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCancelCall}
                disabled={cancelling}
                className="w-full text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 dark:border-rose-900"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Request'}
              </Button>
              <Button
                onClick={onClose}
                className="w-full text-xs bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
              >
                Keep Waiting
              </Button>
            </div>
          </div>
        ) : (
          /* Create New Call View */
          <div className="space-y-2 pt-2 pb-6 px-1">

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircleIcon size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Category Options */}
            <div className="flex flex-col gap-1">
              {CALL_TYPES.map((type) => {
                const isSelected = selectedType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setSelectedType(type.id)}
                    className={`px-2 py-3.5 rounded-2xl flex items-center justify-between transition-all w-full cursor-pointer border border-transparent ${
                      isSelected
                        ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 font-bold'
                        : 'bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <type.icon size={22} variant={isSelected ? 'solid' : 'stroke'} className={isSelected ? 'text-yellow-500' : 'text-zinc-400 dark:text-zinc-500'} />
                      <span className="text-[15px]">{type.label}</span>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center transition-all ${isSelected ? 'border-yellow-500 bg-yellow-500' : 'border-zinc-300 dark:border-zinc-700'}`}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Optional Custom Note */}
            <div className="pt-2">
              <Input
                type="text"
                placeholder="Any special instructions? (Optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={100}
                className="h-10 text-sm bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 rounded-xl"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              <Button
                onClick={handleSendCall}
                disabled={loading}
                className="w-full h-12 text-sm font-bold bg-yellow-500 hover:bg-yellow-400 text-zinc-950 shadow-sm gap-2 rounded-xl"
              >
                {loading ? (
                  <>
                    <Loading03Icon size={18} className="animate-spin" />
                    Paging Server...
                  </>
                ) : (
                  <>
                    <Notification01Icon size={18} /> Call Server Now
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CallWaiterModal;
