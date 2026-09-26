import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@smo/ui';
import { ArrowLeft01Icon, Loading03Icon } from 'hugeicons-react';
import api from '../../lib/api';
import { usePos } from './pos-layout';
import { apiErrorMessage } from '../../components/pos/pos-toasts';
import { CorporateForm, InvoiceDialog } from '../../components/invoices/invoice-dialog';

/** Loads the order or table bill behind /dashboard/pos/checkout/:kind/:id/... */
export function useCheckoutBill() {
  const { kind, id } = useParams();
  const { storeId } = usePos();
  const location = useLocation();
  const navigate = useNavigate();
  const isTable = kind === 'table';
  const [bill, setBill] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!storeId) return;
    const url = isTable ? `/stores/${storeId}/orders/sessions/${id}` : `/stores/${storeId}/orders/${id}`;
    api.get(url)
      .then(res => { setBill(res.data.data); setError(''); })
      .catch(err => setError(apiErrorMessage(err, 'Could not load this bill')));
  }, [storeId, id, isTable]);

  const store = new URLSearchParams(location.search).get('store');
  const checkoutPath = `/dashboard/pos/checkout/${kind}/${id}${store ? `?store=${store}` : ''}`;
  const back = () => (location.key !== 'default' ? navigate(-1) : navigate(checkoutPath));
  return { kind, id, isTable, storeId, bill, error, back, navigate, checkoutPath };
}

const PageHeader = ({ title, subtitle, onBack }) => (
  <div className="flex items-center gap-3">
    <Button variant="outline" size="sm" onClick={onBack} aria-label="Back to checkout"><ArrowLeft01Icon size={16} /></Button>
    <div className="min-w-0">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 truncate">{title}</h1>
      {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
    </div>
  </div>
);

/**
 * /dashboard/pos/checkout/:kind/:id/corporate — company details taken before payment.
 * The corporate invoice is issued with them the moment the bill is paid.
 */
export const PosCorporateDetailsPage = () => {
  const { isTable, id, storeId, bill, error, back } = useCheckoutBill();
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const save = async ({ billTo, saveClient, sendEmail }) => {
    setBusy(true);
    setFormError('');
    try {
      await api.put(`/stores/${storeId}/invoices/request`, {
        ...(isTable ? { tableSessionId: id } : { orderId: id }),
        billTo,
        saveClient,
        sendEmail,
      });
      back();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not save the company details'));
      setBusy(false);
    }
  };

  const label = isTable ? `Table ${bill?.session?.tableNumber ?? ''}` : `Order #${id.slice(-6).toUpperCase()}`;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto p-4 flex flex-col gap-4">
        <PageHeader title="Corporate invoice" subtitle={`${label}${bill ? ` · ₹${bill.totalAmount}` : ''}`} onBack={back} />
        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        {!bill && !error && <div className="h-40 flex items-center justify-center text-zinc-400"><Loading03Icon size={22} className="animate-spin" /></div>}
        {bill && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <CorporateForm
              storeId={storeId}
              busy={busy}
              error={formError}
              initial={bill.invoiceRequest}
              intro="The bill is invoiced to this company as soon as it is paid. Amounts don't change."
              submitLabel={bill.invoiceRequest ? 'Save details' : 'Use for this bill'}
              onSubmit={save}
              onBack={back}
            />
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * /dashboard/pos/checkout/:kind/:id/invoice[?corporate=1] — view, print, email or convert the paid bill's invoice.
 */
export const PosInvoicePage = () => {
  const [params] = useSearchParams();
  const { isTable, id, storeId, bill, error, back } = useCheckoutBill();
  // A table's invoice is found through any of its orders
  const orderId = isTable ? bill?.orders?.[0]?.id : id;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 flex flex-col items-center gap-4">
        {error && <div role="alert" className="w-full max-w-3xl rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        {!orderId && !error && <div className="h-40 flex items-center justify-center text-zinc-400"><Loading03Icon size={22} className="animate-spin" /></div>}
        {orderId && (
          <InvoiceDialog
            asPage
            storeId={storeId}
            orderId={orderId}
            startWithCorporate={params.get('corporate') === '1'}
            onClose={back}
          />
        )}
      </div>
    </div>
  );
};
