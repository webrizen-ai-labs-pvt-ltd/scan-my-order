import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { Logout01Icon } from 'hugeicons-react';

export const UserProfile = () => {
  const { user, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className="relative z-50" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white/20 bg-zinc-100 shadow-sm transition active:scale-95 dark:bg-zinc-800"
      >
        {user.avatar ? (
          <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-bold uppercase text-zinc-600 dark:text-zinc-300">
            {user.name ? user.name.charAt(0) : 'U'}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-1 border-b border-zinc-100 px-3 pb-2 pt-1 dark:border-zinc-800/80">
            <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">{user.name}</p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{user.email}</p>
          </div>
          
          <button
            onClick={() => {
              logout();
              setIsOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-500/10"
          >
            <Logout01Icon size={16} /> Logout
          </button>
        </div>
      )}
    </div>
  );
};
