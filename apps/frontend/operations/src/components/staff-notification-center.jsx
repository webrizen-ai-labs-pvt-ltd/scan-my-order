import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Notification03Icon, 
  VolumeHighIcon, 
  VolumeOffIcon, 
  PlayIcon, 
  CheckmarkBadge01Icon, 
  Pot02Icon, 
  Dish01Icon, 
  CreditCardIcon, 
  UserGroupIcon, 
  Cancel01Icon,
  Tick02Icon
} from 'hugeicons-react';
import { useStaffNotifications } from '../hooks/use-staff-notifications';

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getNotificationIcon(type) {
  switch (type) {
    case 'ORDER_PROCESSING':
    case 'KITCHEN_ALERT':
      return <Pot02Icon size={18} className="text-amber-500" />;
    case 'ORDER_READY':
    case 'ORDER_SERVED':
      return <Dish01Icon size={18} className="text-emerald-500" />;
    case 'PAYMENT_WEBHOOK':
      return <CreditCardIcon size={18} className="text-blue-500" />;
    case 'WAITER_CALL':
    case 'WAITER_CALL_ESCALATED':
    case 'WAITER_CALL_ESCALATED_MANAGER':
      return <UserGroupIcon size={18} className="text-rose-500" />;
    case 'TABLE_SESSION_SETTLED':
      return <CheckmarkBadge01Icon size={18} className="text-purple-500" />;
    default:
      return <Notification03Icon size={18} className="text-zinc-500" />;
  }
}

export function StaffNotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const {
    notifications,
    unreadCount,
    loading,
    isMuted,
    toggleMute,
    testAudio,
    markAsRead,
    markAllAsRead,
    isPushSupported,
    isPushSubscribed,
    pushPermission,
    subscribePush
  } = useStaffNotifications();

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleItemClick = (item) => {
    if (!item.isRead) {
      markAsRead(item.id);
    }
    const url = item.data?.url;
    if (url) {
      navigate(url);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white p-2 text-zinc-600 shadow-xs hover:bg-zinc-50 hover:text-zinc-900 transition dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        title="Notifications & Sound Alerts"
      >
        <Notification03Icon size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white shadow-xs animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-zinc-200 bg-white p-0 shadow-2xl z-50 overflow-hidden dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 p-4 dark:border-zinc-800/80">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition"
                  title="Mark all as read"
                >
                  <Tick02Icon size={14} />
                  Mark read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <Cancel01Icon size={16} />
              </button>
            </div>
          </div>

          {/* Quick Audio & Push Bar */}
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/80 px-4 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-800/40">
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleMute}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium transition ${
                  isMuted 
                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' 
                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                }`}
                title={isMuted ? "Unmute Audio" : "Mute Audio"}
              >
                {isMuted ? <VolumeOffIcon size={14} /> : <VolumeHighIcon size={14} />}
                <span>{isMuted ? 'Muted' : 'Sound On'}</span>
              </button>
              
              <button
                onClick={testAudio}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-700/60 transition"
                title="Test Audio Chime"
              >
                <PlayIcon size={14} />
                <span>Test</span>
              </button>
            </div>

            {isPushSupported && !isPushSubscribed && (
              <button
                onClick={subscribePush}
                className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-xs hover:bg-amber-600 transition"
              >
                Enable Push
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-400 dark:text-zinc-500">
                <Notification03Icon size={32} className="mb-2 opacity-50" />
                <p className="text-xs font-medium">All caught up!</p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-600">New orders and calls will chime here</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`flex items-start gap-3 p-3.5 transition cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                    !item.isRead ? 'bg-amber-500/[0.03] dark:bg-amber-500/[0.04]' : ''
                  }`}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                    {getNotificationIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs font-semibold truncate ${
                        !item.isRead ? 'text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-700 dark:text-zinc-300'
                      }`}>
                        {item.title}
                      </p>
                      <span className="shrink-0 text-[10px] text-zinc-400">
                        {formatTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      {item.body}
                    </p>
                  </div>
                  {!item.isRead && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
