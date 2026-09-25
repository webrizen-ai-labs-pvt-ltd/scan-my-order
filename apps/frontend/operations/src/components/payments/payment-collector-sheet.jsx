import React from 'react';
import { Button } from '@smo/ui';
import { ArrowLeft01Icon } from 'hugeicons-react';
import { PaymentCollector } from './payment-collector';

/**
 * Full-screen payment panel for the phone-sized waiter screens.
 * Renders inside the nearest positioned container.
 */
export const PaymentCollectorSheet = ({ open, title, subtitle, storeId, orderId, tableSessionId, subscribe, onClose, onSettled }) => {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 bg-zinc-50 dark:bg-zinc-950 flex flex-col animate-in slide-in-from-bottom-full duration-200" role="dialog" aria-modal="true" aria-label={title}>
      <div className="shrink-0 p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 bg-white dark:bg-zinc-900">
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close payment">
          <ArrowLeft01Icon size={18} />
        </Button>
        <div className="min-w-0">
          <h2 className="text-base font-bold truncate">{title}</h2>
          {subtitle && <p className="text-[11px] text-zinc-500 truncate">{subtitle}</p>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <PaymentCollector
          storeId={storeId}
          orderId={orderId}
          tableSessionId={tableSessionId}
          subscribe={subscribe}
          onSettled={onSettled}
        />
      </div>
    </div>
  );
};
