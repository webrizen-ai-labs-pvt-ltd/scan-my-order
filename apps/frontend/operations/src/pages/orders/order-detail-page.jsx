import React, { useRef, useState } from 'react';
import { Button, Badge } from '@smo/ui';
import {
  ArrowLeft01Icon, PrinterIcon, Edit02Icon, Shield01Icon, Loading03Icon, Invoice03Icon,
  Building02Icon, Cancel01Icon, MoneyReceive01Icon, AlertCircleIcon, CheckmarkCircle02Icon, GiftIcon,
} from 'hugeicons-react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { ComplimentaryDialog } from '../../components/pos/complimentary-dialog';
import { canGiveComplimentary } from '../../lib/complimentary';
import { Receipt } from '../../components/receipt';
import { printReceipt } from '../../lib/print-receipt';
import { OrderActivity } from '../../components/audit/order-activity';
import { useOrderPage } from './use-order-page';
import { ORDER_STATUSES, statusTone } from './order-status';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const PAY_LABEL = { CASH: 'Cash', CARD: 'Card', UPI_OFFLINE: 'UPI', RAZORPAY: 'Online (UPI/Card)', DUES: 'Dues' };

const Section = ({ title, children, className = '' }) => (
  <section className={`rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 ${className}`}>
    {title && <h2 className="px-4 pt-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</h2>}
    <div className="p-4">{children}</div>
  </section>
);

/**
 * /dashboard/orders/:orderId — one order: items, money, invoice, refunds, status and history.
 */
export const OrderDetailPage = () => {
  const { user } = useAuthStore();
  const isManager = ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER'].includes(user?.role);
  const { orderId, storeId, store, order, setOrder, error, query, detailPath, listPath, goBack, navigate } = useOrderPage();
  const [updating, setUpdating] = useState(false);
  const [comping, setComping] = useState(false);
  const [feedback, setFeedback] = useState({ text: '', error: false });
  const receiptRef = useRef(null);

  const changeStatus = async (next) => {
    if (!order || order.status === next) return;
    if (next === 'CANCELLED') {
      navigate(`/dashboard/orders/${orderId}/cancel${query}`);
      return;
    }
    setUpdating(true);
    setFeedback({ text: '', error: false });
    try {
      const res = await api.patch(`/stores/${storeId}/orders/${orderId}/status`, { status: next });
      setOrder(prev => ({ ...prev, ...res.data.data, status: next }));
      setFeedback({ text: `Status changed to ${next.replace('_', ' ').toLowerCase()}.`, error: false });
    } catch (err) {
      setFeedback({ text: err?.response?.data?.error?.message || 'Could not change the status', error: true });
    } finally {
      setUpdating(false);
    }
  };

  const paid = Boolean(order?.paidAt) || order?.status === 'SETTLED';
  const items = order?.items || [];
  const canEdit = isManager && order && !order.complimentaryOfId && !['CANCELLED', 'SETTLED'].includes(order.status);

  return (
    <div className="flex flex-col gap-4 pb-12">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="outline" size="sm" onClick={() => goBack(listPath)} aria-label="Back to order history">
            <ArrowLeft01Icon size={16} />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 truncate">
              Order #{orderId.slice(-6).toUpperCase()}
              {order && <span className="font-normal text-zinc-500"> · {order.table ? `Table ${order.table.tableNumber}` : order.origin}</span>}
            </h1>
            {order && <p className="text-xs text-zinc-500">{new Date(order.createdAt).toLocaleString()} · {order.paymentModel}</p>}
          </div>
        </div>
        {order && <Badge className={`border-none shrink-0 ${statusTone(order.status)}`}>{order.status.replace('_', ' ')}</Badge>}
      </div>

      {error && !order && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 p-4 text-sm text-rose-700">{error}</div>
      )}
      {!order && !error && <div className="h-64 flex items-center justify-center text-zinc-400"><Loading03Icon size={24} className="animate-spin" /></div>}

      {feedback.text && (
        <div className={`rounded-xl border px-3 py-2 text-xs font-semibold flex items-center gap-2 ${feedback.error
          ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/40'
          : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/40'}`}>
          {feedback.error ? <AlertCircleIcon size={15} /> : <CheckmarkCircle02Icon size={15} />} {feedback.text}
        </div>
      )}

      {order && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
          <div className="flex flex-col gap-4 min-w-0">
            {order.status === 'CANCELLED' && order.cancelReason && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-800 dark:text-rose-300">
                <span className="font-semibold">Cancelled:</span> {order.cancelReason}
                {(order.cancelledBy?.name || order.cancelledAt) && (
                  <span className="block text-xs opacity-80">
                    {order.cancelledBy?.name ? `by ${order.cancelledBy.name}` : ''}
                    {order.cancelledAt ? ` · ${new Date(order.cancelledAt).toLocaleString()}` : ''}
                  </span>
                )}
              </div>
            )}

            {order.complimentaryOfId && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
                <span className="font-semibold">Complimentary:</span> free food worth {money(order.complimentaryValue)}, in place of order{' '}
                <button type="button" className="font-mono underline" onClick={() => navigate(`/dashboard/orders/${order.complimentaryOfId}${query}`)}>
                  #{order.complimentaryOfId.slice(-6).toUpperCase()}
                </button>
                {order.complimentaryReason && <span className="block text-xs opacity-80">Reason: {order.complimentaryReason}</span>}
              </div>
            )}

            {order.refundDue > 0 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-800 dark:text-rose-300 flex items-center justify-between gap-3">
                <span><span className="font-semibold">Refund due:</span> {money(order.refundDue)} — the kitchen couldn’t make paid items</span>
                <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white shrink-0" onClick={() => navigate(`/dashboard/orders/${orderId}/refund${query}`)}>Refund</Button>
              </div>
            )}

            <Section title="Items">
              <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                {items.map((item, idx) => {
                  const rejected = item.status === 'REJECTED';
                  return (
                    <div key={item.id || idx} className={`py-2 flex justify-between gap-3 text-sm ${rejected ? 'text-zinc-400' : ''}`}>
                      <div className="min-w-0">
                        <div className={`font-medium flex items-center gap-1.5 flex-wrap ${rejected ? 'line-through' : ''}`}>
                          <span className="tabular-nums text-zinc-500">{item.quantity}×</span>
                          <span>{item.displayName || item.customName || item.menuItem?.name}</span>
                          {item.isCustom && <span className="px-1.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300">Custom</span>}
                        </div>
                        {rejected && <div className="text-xs font-medium text-rose-600">Not made — {item.rejectReason}</div>}
                        {item.modifiers?.length > 0 && (
                          <div className="text-xs text-zinc-500 pl-6">{item.modifiers.map(m => m.modifierOption?.name || m.name).join(', ')}</div>
                        )}
                        {item.customIngredients?.length > 0 && (
                          <div className="text-xs text-zinc-500 pl-6">
                            {item.customIngredients.map(ing => `+${ing.name} (${ing.quantity}${ing.unit})`).join(', ')}
                          </div>
                        )}
                        {item.kitchenNotes && <p className="text-xs italic text-amber-700 dark:text-amber-400 pl-6">“{item.kitchenNotes}”</p>}
                      </div>
                      <div className={`font-medium tabular-nums shrink-0 ${rejected ? 'line-through' : ''}`}>{money(item.priceAtOrder * item.quantity)}</div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-1 text-sm">
                <div className="flex justify-between text-zinc-500"><span>Subtotal</span><span className="tabular-nums">{money(order.subTotal)}</span></div>
                {order.discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span className="tabular-nums">−{money(order.discountAmount)}</span></div>}
                {order.walletDiscount > 0 && <div className="flex justify-between text-green-600"><span>Store credits</span><span className="tabular-nums">−{money(order.walletDiscount)}</span></div>}
                {order.invoice?.taxes?.length > 0 ? order.invoice.taxes.map(t => (
                  <div key={t.name} className="flex justify-between text-zinc-500"><span>{t.name} @ {t.rate}%</span><span className="tabular-nums">₹{Number(t.amount).toFixed(2)}</span></div>
                )) : (
                  <div className="flex justify-between text-zinc-500"><span>Taxes</span><span className="tabular-nums">{money(order.taxAmount)}</span></div>
                )}
                <div className="flex justify-between font-semibold text-base pt-2 mt-1 border-t border-zinc-200 dark:border-zinc-800"><span>Total</span><span className="tabular-nums">{money(order.totalAmount)}</span></div>
              </div>
            </Section>

            {(order.payments?.length > 0 || order.refunds?.length > 0) && (
              <Section title="Money">
                <div className="flex flex-col gap-1.5 text-sm">
                  {order.payments?.map(p => (
                    <div key={p.id} className="flex justify-between">
                      <span>
                        {PAY_LABEL[p.channel] || p.channel}
                        {p.channel === 'DUES' && p.duesAccount && <> · owed by {p.duesAccount.name}</>}
                        <span className="text-xs text-zinc-400"> · {p.paidAt ? new Date(p.paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        {p.channel === 'DUES' && (
                          <span className="block text-xs text-zinc-500">
                            {p.duesGuest?.name ? `Guest ${p.duesGuest.name} · ` : ''}
                            {p.amount - (p.duesSettled || 0) - (p.duesReduced || 0) > 0
                              ? `${money(p.amount - (p.duesSettled || 0) - (p.duesReduced || 0))} still owed`
                              : 'Paid back'}
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums">{money(p.amount)}</span>
                    </div>
                  ))}
                  {order.refunds?.map(r => (
                    <div key={r.id} className="flex justify-between text-rose-600">
                      <span>Refund · {PAY_LABEL[r.method] || r.method}{r.status === 'PENDING' ? ' (on its way)' : ''}</span>
                      <span className="tabular-nums">−{money(r.amount)}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {isManager && (
              <Section title="Activity & change history">
                <OrderActivity storeId={storeId} orderId={orderId} />
              </Section>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <Section title="Actions">
              <div className="flex flex-col gap-2">
                <Button onClick={() => printReceipt(receiptRef.current)}>
                  <PrinterIcon size={16} className="mr-2" /> Print receipt
                </Button>
                {paid && (
                  <>
                    <Button variant="outline" onClick={() => navigate(`/dashboard/orders/${orderId}/invoice${query}`)}>
                      <Invoice03Icon size={16} className="mr-2" />
                      {order.invoice ? `Invoice ${order.invoice.number}` : 'GST invoice'}
                    </Button>
                    <Button variant="outline" onClick={() => navigate(`/dashboard/orders/${orderId}/invoice${query}${query ? '&' : '?'}corporate=1`)}>
                      <Building02Icon size={16} className="mr-2" />
                      {order.invoice?.kind === 'CORPORATE' ? 'Change company details' : 'Corporate invoice'}
                    </Button>
                  </>
                )}
                {order.refundDue > 0 && (
                  <Button variant="outline" onClick={() => navigate(`/dashboard/orders/${orderId}/refund${query}`)}>
                    <MoneyReceive01Icon size={16} className="mr-2" /> Refund {money(order.refundDue)}
                  </Button>
                )}
                {canEdit && (
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/dashboard/pos/orders/${orderId}/edit?store=${storeId}&returnTo=${encodeURIComponent(detailPath)}`)}
                  >
                    <Edit02Icon size={16} className="mr-2" /> Edit items
                  </Button>
                )}
                {canGiveComplimentary(user, order) && (
                  <Button variant="outline" title="Send free food in place of something that went wrong" onClick={() => setComping(true)}>
                    <GiftIcon size={16} className="mr-2" /> Complimentary
                  </Button>
                )}
                {isManager && !['CANCELLED', 'SETTLED'].includes(order.status) && !order.paidAt && (
                  <Button variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50" onClick={() => navigate(`/dashboard/orders/${orderId}/cancel${query}`)}>
                    <Cancel01Icon size={16} className="mr-2" /> Cancel order
                  </Button>
                )}
              </div>
            </Section>

            {isManager && (
              <Section title="Status override">
                <p className="text-xs text-zinc-500 mb-3">Changes the order state directly. Inventory is reconciled automatically.</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {ORDER_STATUSES.map(st => (
                    <button
                      key={st}
                      type="button"
                      disabled={order.status === st || updating}
                      onClick={() => changeStatus(st)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-semibold border ${order.status === st
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white'
                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 disabled:opacity-50'}`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-zinc-400 flex items-center gap-1"><Shield01Icon size={12} /> {user?.role.replace('_', ' ').toLowerCase()}</p>
              </Section>
            )}
          </div>
        </div>
      )}

      <ComplimentaryDialog
        storeId={storeId}
        storeName={store?.name}
        order={comping ? order : null}
        onClose={() => setComping(false)}
        onSent={(created) => setFeedback({ text: `Complimentary order #${created.id.slice(-6).toUpperCase()} sent to the kitchen.`, error: false })}
      />

      {/* Printed through print-receipt; never shown */}
      <div style={{ display: 'none' }}>
        {order && <Receipt ref={receiptRef} order={order} storeData={store || { name: 'Scan My Order' }} />}
      </div>
    </div>
  );
};
