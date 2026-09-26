import React, { useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loading03Icon } from 'hugeicons-react';
import { InvoiceDialog } from '../../components/invoices/invoice-dialog';
import { RefundDialog } from '../../components/pos/refund-dialog';
import { CancelOrderDialog } from '../../components/pos/cancel-order-dialog';
import { useOrderPage } from './use-order-page';

const Frame = ({ children }) => <div className="flex justify-center pb-12">{children}</div>;

/** /dashboard/orders/:orderId/invoice[?corporate=1] */
export const OrderInvoicePage = () => {
  const [params] = useSearchParams();
  const { orderId, storeId, detailPath, goBack } = useOrderPage();
  return (
    <Frame>
      <InvoiceDialog
        asPage
        storeId={storeId}
        orderId={orderId}
        startWithCorporate={params.get('corporate') === '1'}
        onClose={() => goBack(detailPath)}
      />
    </Frame>
  );
};

/** /dashboard/orders/:orderId/refund */
export const OrderRefundPage = () => {
  const { orderId, storeId, detailPath, goBack } = useOrderPage();
  return (
    <Frame>
      <RefundDialog asPage storeId={storeId} orderId={orderId} onClose={() => goBack(detailPath)} />
    </Frame>
  );
};

/** /dashboard/orders/:orderId/cancel */
export const OrderCancelPage = () => {
  const { order, error, detailPath, goBack, storeId } = useOrderPage();
  const cancelled = useRef(false);
  if (error && !order) {
    return <Frame><div role="alert" className="w-full max-w-md rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div></Frame>;
  }
  if (!order) return <Frame><Loading03Icon size={24} className="animate-spin text-zinc-400 mt-16" /></Frame>;
  return (
    <Frame>
      <CancelOrderDialog
        asPage
        storeId={storeId}
        order={order}
        // The dialog also calls onClose after a successful cancel; the order page is already shown then
        onClose={() => { if (!cancelled.current) goBack(detailPath); }}
        onCancelled={() => {
          cancelled.current = true;
          // Go back to the order page (Back from there shouldn't reopen a finished form)
          goBack(detailPath);
        }}
      />
    </Frame>
  );
};
