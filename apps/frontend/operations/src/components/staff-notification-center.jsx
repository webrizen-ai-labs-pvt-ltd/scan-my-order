import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Notification03Icon,
  VolumeHighIcon,
  VolumeOffIcon,
  CheckmarkBadge01Icon,
  Pot02Icon,
  Dish01Icon,
  CreditCardIcon,
  UserGroupIcon,
  Cancel01Icon,
  Tick02Icon
} from 'hugeicons-react';
import { useStaffNotifications } from '../hooks/use-staff-notifications';

// --- Helpers & Caches ---

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function formatTime(isoString) {
  if (!isoString) return '';
  const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);

  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return rtf.format(-Math.floor(diffSec / 60), 'minute');
  if (diffSec < 86400) return rtf.format(-Math.floor(diffSec / 3600), 'hour');
  return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const ICON_MAP = {
  ORDER_PROCESSING: <Pot02Icon size={18} className="text-amber-500" />,
  KITCHEN_ALERT: <Pot02Icon size={18} className="text-amber-500" />,
  ORDER_READY: <Dish01Icon size={18} className="text-emerald-500" />,
  ORDER_SERVED: <Dish01Icon size={18} className="text-emerald-500" />,
  PAYMENT_WEBHOOK: <CreditCardIcon size={18} className="text-blue-500" />,
  WAITER_CALL: <UserGroupIcon size={18} className="text-rose-500" />,
  WAITER_CALL_ESCALATED: <UserGroupIcon size={18} className="text-rose-500" />,
  WAITER_CALL_ESCALATED_MANAGER: <UserGroupIcon size={18} className="text-rose-500" />,
  TABLE_SESSION_SETTLED: <CheckmarkBadge01Icon size={18} className="text-purple-500" />
};

function getNotificationIcon(type) {
  return ICON_MAP[type] || <Notification03Icon size={18} className="text-zinc-500" />;
}

// --- Subcomponents ---

const NotificationItem = memo(function NotificationItem({ item, onItemClick }) {
  return (
    <button
      type="button"
      onClick={() => onItemClick(item)}
      className={`group flex w-full items-start gap-3 p-3.5 text-left transition focus:outline-none focus-visible:bg-zinc-100/70 dark:focus-visible:bg-zinc-800/80 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 ${
        !item.isRead ? 'bg-amber-500/[0.04] dark:bg-amber-500/[0.06]' : ''
      }`}
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-100 transition group-hover:scale-105 dark:bg-zinc-800">
        {getNotificationIcon(item.type)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`truncate text-xs ${
              !item.isRead
                ? 'font-bold text-zinc-900 dark:text-zinc-100'
                : 'font-medium text-zinc-700 dark:text-zinc-300'
            }`}
          >
            {item.title}
          </p>
          <span className="shrink-0 text-[10px] text-zinc-400 tabular-nums">
            {formatTime(item.createdAt)}
          </span>
        </div>

        <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
          {item.body}
        </p>
      </div>

      {!item.isRead && (
        <span
          aria-label="Unread notification indicator"
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500 ring-2 ring-white dark:ring-zinc-900"
        />
      )}
    </button>
  );
});

// --- Main Component ---

export function StaffNotificationCenter({ storeId }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const navigate = useNavigate();

  const {
    notifications = [],
    unreadCount = 0,
    loading = false,
    isMuted,
    toggleMute,
    markAsRead,
    markAllAsRead,
    isPushSupported,
    isPushSubscribed,
    pushPermission,
    subscribePush
  } = useStaffNotifications(storeId);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Dismiss on external click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        handleClose();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClose]);

  const handleItemClick = useCallback(
    (item) => {
      if (!item.isRead) {
        markAsRead(item.id);
      }
      if (item.data?.url) {
        navigate(item.data.url);
        setIsOpen(false);
      }
    },
    [markAsRead, navigate]
  );

  // Show push prompt only if supported, not granted, not blocked, and not subscribed
  const showPushPrompt =
    isPushSupported &&
    !isPushSubscribed &&
    pushPermission !== 'granted' &&
    pushPermission !== 'denied';

  return (
    <div className="relative z-50 inline-block text-left" ref={containerRef}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`Staff notifications: ${unreadCount} unread`}
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200/80 bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <Notification03Icon size={20} />

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white shadow-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Staff Notifications"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-zinc-200/90 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden focus:outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800/80">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Staff Alerts
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition"
                  title="Mark all notifications as read"
                >
                  <Tick02Icon size={14} />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close notification panel"
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <Cancel01Icon size={16} />
              </button>
            </div>
          </div>

          {/* Quick Sound & Push Controls Bar */}
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/80 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-800/40">
            <button
              type="button"
              onClick={toggleMute}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition ${
                isMuted
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                  : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
              }`}
              title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {isMuted ? <VolumeOffIcon size={14} /> : <VolumeHighIcon size={14} />}
              <span>{isMuted ? 'Muted' : 'Sound On'}</span>
            </button>

            {showPushPrompt && (
              <button
                type="button"
                onClick={subscribePush}
                className="rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-xs hover:bg-amber-600 transition"
              >
                Enable Push
              </button>
            )}
          </div>

          {/* Feed Container */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60 overscroll-contain">
            {loading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex animate-pulse items-start gap-3">
                    <div className="h-8 w-8 rounded-xl bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
                      <div className="h-2.5 w-full rounded bg-zinc-100 dark:bg-zinc-800/60" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-400 dark:text-zinc-500">
                <Notification03Icon size={32} className="mb-2 opacity-40" />
                <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">All caught up!</p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  New orders and table alerts will appear here in real time
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <NotificationItem
                  key={item.id}
                  item={item}
                  onItemClick={handleItemClick}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}