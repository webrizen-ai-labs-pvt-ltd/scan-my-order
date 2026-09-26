import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@smo/ui';
import { ArrowLeft01Icon, PrinterIcon, Loading03Icon, Cancel01Icon, CheckmarkCircle02Icon, Building02Icon, Invoice03Icon, NoteEditIcon } from 'hugeicons-react';
import api from '../../lib/api';
import { usePos } from './pos-layout';
import { PaymentCollector } from '../../components/payments/payment-collector';
import { Receipt } from '../../components/receipt';
import { printReceipt } from '../../lib/print-receipt';
import { apiErrorMessage } from '../../components/pos/pos-toasts';
import { sessionBillToReceipt } from '../../lib/session-receipt';
import { CancelOrderDialog } from '../../components/pos/cancel-order-dialog';
import { useAuthStore } from '../../store/authStore';

const BillLines = ({ items }) => (
  <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
    {items.map((item, idx) => item.status === 'REJECTED' ? (
      <div key={item.id || idx} className="py-2 flex justify-between gap-3 text-sm text-zinc-400">
        <div className="min-w-0">
          <span className="line-through"><span className="font-semibold mr-2">{item.quantity}×</span>{item.displayName || item.customName || item.menuItem?.name}</span>
          <div className="text-[11px] font-semibold text-rose-600 pl-7">Not made — {item.rejectReason}</div>
        </div>
        <span className="line-through tabular-nums shrink-0">₹{item.priceAtOrder * item.quantity}</span>
      </div>
    ) : (
      <div key={item.id || idx} className="py-2 flex justify-between gap-3 text-sm">
        <div className="min-w-0">
          <span className="font-semibold text-zinc-500 tabular-nums mr-2">{item.quantity}×</span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.displayName || item.customName || item.menuItem?.name || item.name}</span>
          {item.modifiers?.length > 0 && (
            <div className="text-[11px] text-zinc-500 pl-7">
              {item.modifiers.map(m => m.modifierOption?.name || m).filter(Boolean).join(', ')}
            </div>
          )}
          {item.kitchenNotes && <div className="text-[11px] italic text-amber-700 dark:text-amber-400 pl-7">“{item.kitchenNotes}”</div>}
        </div>
        <span className="font-semibold tabular-nums shrink-0">₹{(item.priceAtOrder ?? item.price) * item.quantity}</span>
      </div>
    ))}
  </div>
);

/**
 * How the bill will be invoiced: a regular GST bill, or a corporate invoice issued on payment.
 */
const InvoiceChoice = ({ request, onCorporate, onRemove, busy, error }) => (
  <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-2">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Invoice</div>
        {request ? (
          <div className="text-sm">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">Corporate</span> · {request.billTo.name}
            {request.billTo.gstin && <span className="block font-mono text-xs text-zinc-500">GSTIN {request.billTo.gstin}</span>}
            {request.sendEmail && request.billTo.email && <span className="block text-xs text-zinc-500">Emailed to {request.billTo.email}</span>}
          </div>
        ) : (
          <div className="text-sm text-zinc-700 dark:text-zinc-300">Regular GST bill</div>
        )}
      </div>
      <div className="flex gap-1.5 shrink-0">
        {request && (
          <Button variant="outline" size="sm" disabled={busy} onClick={onRemove}>Remove</Button>
        )}
        <Button variant="outline" size="sm" disabled={busy} onClick={onCorporate}>
          <Building02Icon size={14} className="mr-1.5" /> {request ? 'Edit' : 'Corporate invoice'}
        </Button>
      </div>
    </div>
    <p className="text-[11px] text-zinc-500">
      {request ? 'The corporate invoice is issued automatically once the bill is paid.' : 'Need a company invoice? Add the details now and it is issued the moment payment completes.'}
    </p>
    {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
  </div>
);

/**
 * /dashboard/pos/checkout/order/:id  — pay a single order
 * /dashboard/pos/checkout/table/:id  — pay a whole table session bill
 */
export const PosCheckoutPage = () => {
  const { kind, id } = useParams();
  const { storeId, store, subscribe, toast, data } = usePos();
  const navigate = useNavigate();
  const location = useLocation();
  const isTable = kind === 'table';
  const childPath = (page) => `/dashboard/pos/checkout/${kind}/${id}/${page}${location.search}`;

  const [bill, setBill] = useState(null);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [paySummary, setPaySummary] = useState(null);
  const canPutOnDues = ['CASHIER', 'STORE_MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'].includes(useAuthStore(state => state.user?.role));
  // Bills that were already paid when opened (e.g. back from the invoice page) shouldn't toast again
  const paidOnOpen = useRef(null);
  const receiptRef = useRef(null);
  const latestSummary = useRef(null);

  const loadBill = useCallback(async () => {
    try {
      const res = isTable
        ? await api.get(`/stores/${storeId}/orders/sessions/${id}`)
        : await api.get(`/stores/${storeId}/orders/${id}`);
      const data = res.data.data;
      if (paidOnOpen.current === null) paidOnOpen.current = isTable ? data.session?.status === 'SETTLED' : Boolean(data.paidAt);
      setBill(data);
      setError('');
      return data;
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load this bill'));
      return null;
    }
  }, [storeId, id, isTable]);

  useEffect(() => { setReceipt(null); paidOnOpen.current = null; loadBill(); }, [loadBill]);

  const removeCorporate = async () => {
    setRequestBusy(true);
    setRequestError('');
    try {
      await api.put(`/stores/${storeId}/invoices/request`, { ...(isTable ? { tableSessionId: id } : { orderId: id }), billTo: null });
      await loadBill();
    } catch (err) {
      setRequestError(apiErrorMessage(err, 'Could not remove the company details'));
    } finally {
      setRequestBusy(false);
    }
  };

  const handleSettled = useCallback(async (summary) => {
    latestSummary.current = summary;
    const fresh = await loadBill();
    if (!fresh) return;
    setReceipt(isTable ? sessionBillToReceipt(fresh, summary.payments) : fresh);
    data.refreshTables();
    if (!paidOnOpen.current) {
      const inv = fresh.invoice;
      toast(`${isTable ? `Table ${fresh.session.tableNumber} bill paid` : 'Payment complete'}${inv ? ` · ${inv.kind === 'CORPORATE' ? 'Corporate invoice' : 'Invoice'} ${inv.number}` : ''}`, 'success');
    }
  }, [loadBill, isTable, toast, data]);

  const title = isTable
    ? `Table ${bill?.session?.tableNumber ?? ''} · Bill`
    : `Order #${id.slice(-6).toUpperCase()}${bill?.table ? ` · Table ${bill.table.tableNumber}` : bill ? ' · Takeaway' : ''}`;

  const items = isTable ? bill?.aggregatedItems : bill?.items;
  // Paid or cancelled bills are invoiced from the invoice page instead
  const billOpen = isTable ? bill?.session?.status === 'ACTIVE' : Boolean(bill) && !bill.paidAt && !['SETTLED', 'CANCELLED'].includes(bill.status);
  // Unpaid orders can be cancelled from checkout (with a reason); paid ones need a refund first
  const canCancelOrder = !isTable && bill && !bill.paidAt && ['PENDING_PAYMENT', 'DRAFT', 'PROCESSING', 'READY'].includes(bill.status);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} aria-label="Back">
              <ArrowLeft01Icon size={16} />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg font-black text-zinc-900 dark:text-zinc-50 truncate">{title}</h1>
              <p className="text-xs text-zinc-500">
                {isTable ? 'Everything ordered on this table, paid together.' : 'Collect payment for this order.'}
              </p>
            </div>
          </div>
          {canCancelOrder && (
            <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)} className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50">
              <Cancel01Icon size={14} className="mr-1.5" /> Cancel order
            </Button>
          )}
        </div>

        {error && !bill && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 p-4 text-sm text-rose-700">{error}</div>
        )}

        {!bill && !error && (
          <div className="h-64 flex items-center justify-center text-zinc-400"><Loading03Icon size={26} className="animate-spin" /></div>
        )}

        {bill && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-4 items-start">
            <section aria-label="Bill" className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              {receipt ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                    <CheckmarkCircle02Icon size={18} /> Paid — receipt ready
                  </div>
                  <div className="bg-stone-100 dark:bg-black rounded-xl p-3 max-h-[60vh] overflow-y-auto">
                    <Receipt ref={receiptRef} order={receipt} storeData={store} />
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => printReceipt(receiptRef.current)}>
                      <PrinterIcon size={16} className="mr-2" /> Print receipt
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => navigate('/dashboard/pos')}>New order</Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => navigate(childPath('invoice'))}>
                      <Invoice03Icon size={15} className="mr-1.5" /> {receipt.invoice ? `Invoice ${receipt.invoice.number}` : 'GST invoice'}
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => navigate(`${childPath('invoice')}${location.search ? '&' : '?'}corporate=1`)}>
                      <Building02Icon size={15} className="mr-1.5" /> {receipt.invoice?.kind === 'CORPORATE' ? 'Change company' : 'Corporate invoice'}
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => navigate('/dashboard/pos/orders')}>Active orders</Button>
                  </div>
                </div>
              ) : (
                <>
                  <BillLines items={items || []} />
                  <div className="mt-3 pt-3 border-t border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col gap-1 text-sm">
                    <div className="flex justify-between text-zinc-500"><span>Subtotal</span><span className="tabular-nums">₹{bill.subTotal}</span></div>
                    {bill.discountAmount > 0 && (
                      <div className="flex justify-between text-amber-700 dark:text-amber-400"><span>Discount</span><span className="tabular-nums">−₹{bill.discountAmount}</span></div>
                    )}
                    {bill.walletDiscount > 0 && (
                      <div className="flex justify-between text-amber-700 dark:text-amber-400"><span>Store credits</span><span className="tabular-nums">−₹{bill.walletDiscount}</span></div>
                    )}
                    {bill.taxAmount > 0 && (
                      <div className="flex justify-between text-zinc-500"><span>Tax</span><span className="tabular-nums">₹{bill.taxAmount}</span></div>
                    )}
                    <div className="flex justify-between font-black text-lg pt-1"><span>Total</span><span className="tabular-nums">₹{bill.totalAmount}</span></div>
                    {isTable && bill.orders?.some(o => o.paidAt) && (
                      <p className="text-[11px] text-zinc-500">Some orders on this table were already paid separately; only the unpaid ones are due.</p>
                    )}
                  </div>
                </>
              )}
            </section>

            <section aria-label="Payment" className="flex flex-col gap-3">
              {!receipt && billOpen && (
                <InvoiceChoice
                  request={bill.invoiceRequest}
                  busy={requestBusy}
                  error={requestError}
                  onCorporate={() => navigate(childPath('corporate'))}
                  onRemove={removeCorporate}
                />
              )}
              <PaymentCollector
                storeId={storeId}
                orderId={isTable ? undefined : id}
                tableSessionId={isTable ? id : undefined}
                subscribe={subscribe}
                onSettled={handleSettled}
                onChange={setPaySummary}
              />
              {/* On credit: the rest of the bill is owed by a dues account (e.g. the owner) */}
              {!receipt && billOpen && canPutOnDues && paySummary && !paySummary.isSettled && paySummary.dueAmount > 0 && (
                <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Guest not paying now?</div>
                    <div className="text-xs text-zinc-500">
                      Put {paySummary.paidAmount > 0 ? 'the rest' : 'the bill'} ({'₹'}{paySummary.dueAmount.toLocaleString('en-IN')}) on dues. It counts as a sale and is collected later.
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(childPath('dues'))}
                    className="shrink-0"
                  >
                    <NoteEditIcon size={15} className="mr-1.5" /> Put on dues
                  </Button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <CancelOrderDialog
        storeId={storeId}
        order={cancelOpen && bill ? bill : null}
        onClose={() => setCancelOpen(false)}
        onCancelled={() => {
          toast('Order cancelled', 'info');
          data.refreshTables();
          navigate('/dashboard/pos/orders');
        }}
      />
    </div>
  );
};
