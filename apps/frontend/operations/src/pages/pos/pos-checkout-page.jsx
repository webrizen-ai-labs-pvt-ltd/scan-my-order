import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@smo/ui';
import { computeCartSubTotal, computeLineUnitPrice, computeOrderTotals } from '@smo/shared/pricing';
import { usePosCartStore, toOrderItems } from '../../store/pos-cart-store';
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
 * /dashboard/pos/checkout/draft/new  — pay for the cart being built; the order is
 *                                      created once a payment method is chosen
 */
export const PosCheckoutPage = () => {
  const { kind, id } = useParams();
  const { storeId, store, subscribe, toast, data } = usePos();
  const navigate = useNavigate();
  const location = useLocation();
  const isTable = kind === 'table';
  const isDraft = kind === 'draft';
  const childPath = (page) => `/dashboard/pos/checkout/${kind}/${id}/${page}${location.search}`;

  const cart = usePosCartStore();
  const [draftBusy, setDraftBusy] = useState(false);

  // The cart as a bill: same shape the order/table bills use, so it renders identically
  const draftBill = useMemo(() => {
    if (!isDraft) return null;
    const totals = computeOrderTotals({
      subTotal: computeCartSubTotal(cart.lines),
      promo: cart.promo,
      taxRules: store?.taxRules,
    });
    return {
      ...totals,
      invoiceRequest: cart.invoiceRequest,
      items: cart.lines.map(line => ({
        id: line.lineId,
        quantity: line.quantity,
        displayName: line.customName || line.menuItem?.name,
        modifiers: (line.modifiers || []).map(m => ({ modifierOption: { name: m.name } })),
        kitchenNotes: cart.notes[line.lineId] || '',
        priceAtOrder: computeLineUnitPrice(line),
      })),
    };
  }, [isDraft, cart.lines, cart.notes, cart.promo, cart.invoiceRequest, store?.taxRules]);

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
    if (isDraft) return null;
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
  }, [storeId, id, isTable, isDraft]);

  useEffect(() => { setReceipt(null); paidOnOpen.current = null; loadBill(); }, [loadBill]);

  /**
   * Draft checkout: the cashier settled on how the bill is being closed, so place the order
   * now and carry that choice over to the real checkout.
   *
   * @param {{ autoPay?: object, goToDues?: boolean }} next what to do once the order exists
   */
  const createDraftOrder = async ({ autoPay, goToDues } = {}) => {
    if (draftBusy) return;
    setDraftBusy(true);
    const invoiceRequest = cart.invoiceRequest; // read before the cart is cleared
    try {
      const res = await api.post(`/stores/${storeId}/orders`, {
        type: cart.orderType,
        paymentModel: 'PREPAID',
        customerName: cart.customerName.trim() || undefined,
        tableId: cart.orderType === 'DINE_IN' ? cart.tableId : undefined,
        promoCode: cart.promo?.code,
        items: toOrderItems(cart.lines, cart.notes),
      });
      const { order } = res.data.data;

      // Corporate details chosen on the draft belong to the order before it is paid,
      // so the corporate invoice is still issued the moment payment completes.
      if (invoiceRequest?.billTo) {
        try {
          await api.put(`/stores/${storeId}/invoices/request`, { orderId: order.id, ...invoiceRequest });
        } catch (err) {
          toast(`Order placed, but the company details could not be saved: ${apiErrorMessage(err)}`, 'error');
        }
      }

      cart.clear();
      data.refreshTables();
      const base = `/dashboard/pos/checkout/order/${order.id}`;
      navigate(goToDues ? `${base}/dues` : base, { replace: true, state: autoPay ? { autoPay } : undefined });
    } catch (err) {
      setDraftBusy(false);
      throw new Error(apiErrorMessage(err, 'Could not place the order'));
    }
  };

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

  const draftTable = isDraft ? data.tables.find(t => t.id === cart.tableId) : null;
  const title = isDraft
    ? `New order${draftTable ? ` · Table ${draftTable.tableNumber}` : cart.orderType === 'TAKEAWAY' ? ' · Takeaway' : ''}`
    : isTable
      ? `Table ${bill?.session?.tableNumber ?? ''} · Bill`
      : `Order #${id.slice(-6).toUpperCase()}${bill?.table ? ` · Table ${bill.table.tableNumber}` : bill ? ' · Takeaway' : ''}`;

  const shownBill = isDraft ? draftBill : bill;
  const items = isDraft ? draftBill?.items : isTable ? bill?.aggregatedItems : bill?.items;
  // Paid or cancelled bills are invoiced from the invoice page instead
  const billOpen = isDraft
    ? cart.lines.length > 0
    : isTable ? bill?.session?.status === 'ACTIVE' : Boolean(bill) && !bill.paidAt && !['SETTLED', 'CANCELLED'].includes(bill.status);
  // Unpaid orders can be cancelled from checkout (with a reason); paid ones need a refund first
  const canCancelOrder = !isTable && !isDraft && bill && !bill.paidAt && ['PENDING_PAYMENT', 'DRAFT', 'PROCESSING', 'READY'].includes(bill.status);
  // A draft with nothing in it (opened directly, or the cart was cleared in another tab)
  const draftEmpty = isDraft && cart.lines.length === 0;

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
                {isDraft
                  ? 'Choose how the guest is paying — the order is placed when you do.'
                  : isTable ? 'Everything ordered on this table, paid together.' : 'Collect payment for this order.'}
              </p>
            </div>
          </div>
          {canCancelOrder && (
            <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)} className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50">
              <Cancel01Icon size={14} className="mr-1.5" /> Cancel order
            </Button>
          )}
        </div>

        {error && !shownBill && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 p-4 text-sm text-rose-700">{error}</div>
        )}

        {draftEmpty && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-zinc-500">There is nothing to pay for — the order is empty.</p>
            <Button onClick={() => navigate('/dashboard/pos')}>Back to the terminal</Button>
          </div>
        )}

        {!shownBill && !error && !draftEmpty && (
          <div className="h-64 flex items-center justify-center text-zinc-400"><Loading03Icon size={26} className="animate-spin" /></div>
        )}

        {shownBill && !draftEmpty && (
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
                    <div className="flex justify-between text-zinc-500"><span>Subtotal</span><span className="tabular-nums">₹{shownBill.subTotal}</span></div>
                    {shownBill.discountAmount > 0 && (
                      <div className="flex justify-between text-amber-700 dark:text-amber-400"><span>Discount</span><span className="tabular-nums">−₹{shownBill.discountAmount}</span></div>
                    )}
                    {shownBill.walletDiscount > 0 && (
                      <div className="flex justify-between text-amber-700 dark:text-amber-400"><span>Store credits</span><span className="tabular-nums">−₹{shownBill.walletDiscount}</span></div>
                    )}
                    {shownBill.taxAmount > 0 && (
                      <div className="flex justify-between text-zinc-500"><span>Tax</span><span className="tabular-nums">₹{shownBill.taxAmount}</span></div>
                    )}
                    <div className="flex justify-between font-black text-lg pt-1"><span>Total</span><span className="tabular-nums">₹{shownBill.totalAmount}</span></div>
                    {isDraft && (
                      <p className="text-[11px] text-zinc-500 pt-1">Nothing is placed yet. Picking a payment method below sends this order to the kitchen and opens payment.</p>
                    )}
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
                  request={shownBill.invoiceRequest}
                  busy={requestBusy}
                  error={requestError}
                  onCorporate={() => navigate(childPath('corporate'))}
                  onRemove={isDraft ? () => cart.setInvoiceRequest(null) : removeCorporate}
                />
              )}
              <PaymentCollector
                storeId={storeId}
                orderId={isTable || isDraft ? undefined : id}
                tableSessionId={isTable ? id : undefined}
                draft={isDraft ? {
                  totalAmount: draftBill.totalAmount,
                  onCollect: (payment) => createDraftOrder({ autoPay: payment }),
                } : undefined}
                autoPay={location.state?.autoPay}
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
                    disabled={draftBusy}
                    onClick={() => (isDraft
                      ? createDraftOrder({ goToDues: true }).catch(err => toast(err.message, 'error'))
                      : navigate(childPath('dues')))}
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
