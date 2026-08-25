import React from 'react';
import { Button } from '@smo/ui';
import { QrCodeIcon } from 'hugeicons-react';

export const HomePage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 max-w-md w-full space-y-6">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl mx-auto flex items-center justify-center">
          <QrCodeIcon size={32} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Scan My Order</h1>
          <p className="text-zinc-500 mt-2">Scan a QR code at your table to view the menu and order instantly.</p>
        </div>
      </div>
    </div>
  );
};
