import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@smo/ui';
import { ArrowLeft01Icon, Loading03Icon, NoteEditIcon, AlertCircleIcon, PlusSignIcon, Tick02Icon } from 'hugeicons-react';
import api from '../../lib/api';
import { usePos } from './pos-layout';
import { apiErrorMessage } from '../../components/pos/pos-toasts';
import { useAuthStore } from '../../store/authStore';
import { useCheckoutBill } from './pos-invoice-pages';

const NOTES = ['Owner’s guest', 'Owner’s family', 'Staff meal', 'Regular — pays monthly', 'Company account'];
const MANAGE_ROLES = ['STORE_MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'];
const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const inputCls = 'h-10 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-zinc-400/40';
const phoneLike = (v) => !v.trim() || /^\+?\d{10,15}$/.test(v.replace(/[\s()-]/g, ''));
const emailLike = (v) => !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const Section = ({ title, hint, children }) => (
  <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-col gap-4">
    <div>
      <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</h2>
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
    {children}
  </section>
);

/**
 * /dashboard/pos/checkout/:kind/:id/dues — close what's left of a bill on credit.
 * The amount is owed by a dues account (the owner by default) and collected later on the Dues page.
 */
export const PosDuesPage = () => {
  const { isTable, id, storeId, bill, error, back, navigate, checkoutPath } = useCheckoutBill();
  const { toast, data } = usePos();
  const role = useAuthStore(state => state.user?.role);
  const canManage = MANAGE_ROLES.includes(role);

  const [summary, setSummary] = useState(null);
  const [accounts, setAccounts] = useState(null);
  const [accountId, setAccountId] = useState('');
  const [adding, setAdding] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: '', phone: '' });
  const [addingBusy, setAddingBusy] = useState(false);

  const [guest, setGuest] = useState({ name: '', phone: '', whatsapp: '', email: '' });
  const [sameWhatsapp, setSameWhatsapp] = useState(true);
  const [preset, setPreset] = useState('');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const detailsRef = useRef(null);
  const setField = (k) => (e) => setGuest(prev => ({ ...prev, [k]: e.target.value }));

  useEffect(() => {
    if (!storeId) return;
    api.get(`/stores/${storeId}/payments/summary`, { params: isTable ? { tableSessionId: id } : { orderId: id } })
      .then(res => setSummary(res.data.data))
      .catch(() => setSummary(null));
    api.get('/dues/accounts', { params: { storeId } })
      .then(res => {
        const list = res.data.data || [];
        setAccounts(list);
        setAccountId(prev => prev || list.find(a => a.isOwner)?.id || list[0]?.id || '');
      })
      .catch(err => { setAccounts([]); setSaveError(apiErrorMessage(err, 'Could not load dues accounts')); });
  }, [storeId, id, isTable]);

  const addAccount = async () => {
    setAddingBusy(true);
    setSaveError('');
    try {
      const res = await api.post('/dues/accounts', { storeId, name: newAccount.name.trim(), phone: newAccount.phone.trim() || undefined });
      setAccounts(prev => [...(prev || []), res.data.data]);
      setAccountId(res.data.data.id);
      setAdding(false);
      setNewAccount({ name: '', phone: '' });
    } catch (err) {
      setSaveError(apiErrorMessage(err, 'Could not add the account'));
    } finally {
      setAddingBusy(false);
    }
  };

  const whatsapp = sameWhatsapp ? guest.phone : guest.whatsapp;
  const hasContact = Boolean(guest.phone.trim() || whatsapp.trim() || guest.email.trim());
  const guestValid = guest.name.trim().length >= 2 && hasContact && phoneLike(guest.phone) && phoneLike(whatsapp) && emailLike(guest.email);
  const isOther = preset === 'Other';
  const note = isOther ? details.trim() : [preset, details.trim()].filter(Boolean).join(' — ');
  const amount = summary?.dueAmount ?? 0;
  const account = accounts?.find(a => a.id === accountId);
  const label = isTable ? `Table ${bill?.session?.tableNumber ?? ''} bill` : `Order #${id.slice(-6).toUpperCase()}${bill?.table ? ` · Table ${bill.table.tableNumber}` : ''}`;
  const ready = account && guestValid && note.length >= 3 && amount > 0 && !summary?.isSettled;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      await api.post(`/stores/${storeId}/payments/dues`, {
        ...(isTable ? { tableSessionId: id } : { orderId: id }),
        accountId,
        note,
        guest: {
          name: guest.name.trim(),
          phone: guest.phone.trim() || undefined,
          whatsapp: whatsapp.trim() || undefined,
          email: guest.email.trim() || undefined,
        },
      });
      toast(`${rupees(amount)} put on dues · owed by ${account.name}`, 'success');
      data.refreshTables();
      // Back to checkout, which now shows the settled bill and its receipt
      navigate(checkoutPath, { replace: true });
    } catch (err) {
      setSaveError(apiErrorMessage(err, 'Could not put the bill on dues'));
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <form onSubmit={submit} className="max-w-2xl mx-auto p-4 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={back} aria-label="Back to checkout"><ArrowLeft01Icon size={16} /></Button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Put on dues</h1>
            <p className="text-xs text-zinc-500">{label}</p>
          </div>
        </div>

        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        {(!bill || !summary || !accounts) && !error && <div className="h-40 flex items-center justify-center text-zinc-400"><Loading03Icon size={22} className="animate-spin" /></div>}

        {bill && summary && accounts && (
          <>
            {/* What goes on dues */}
            <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex items-center gap-4">
              <div className="size-11 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shrink-0">
                <NoteEditIcon size={20} className="text-amber-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-zinc-500">On dues{summary.paidAmount > 0 ? ` (${rupees(summary.paidAmount)} already paid)` : ''}</div>
                <div className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{rupees(amount)}</div>
              </div>
              <div className="text-right text-sm">
                <div className="text-zinc-500">Owed by</div>
                <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[180px]">{account?.name || '—'}</div>
              </div>
            </section>

            <Section title="Who owes this?" hint="The account that will pay for this bill later.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Dues account">
                {accounts.map(a => {
                  const on = a.id === accountId;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setAccountId(a.id)}
                      className={`rounded-xl border px-3 py-2.5 text-left flex items-start gap-2.5 ${on ? 'border-zinc-900 dark:border-zinc-100' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'}`}
                    >
                      <span className={`mt-0.5 size-4 shrink-0 rounded-full border flex items-center justify-center ${on ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900' : 'border-zinc-300 dark:border-zinc-600'}`}>
                        {on && <Tick02Icon size={10} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{a.name}</span>
                        <span className="block text-xs text-zinc-500">
                          {a.outstanding > 0 ? `${rupees(a.outstanding)} owed now` : 'Nothing owed'}{a.isOwner ? ' · owner' : ''}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {canManage && (adding ? (
                <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-3 flex flex-col sm:flex-row gap-2">
                  <input value={newAccount.name} onChange={e => setNewAccount(p => ({ ...p, name: e.target.value }))} placeholder="Account name, e.g. Mehta Traders" aria-label="New account name" maxLength={80} className={`${inputCls} flex-1`} />
                  <input value={newAccount.phone} onChange={e => setNewAccount(p => ({ ...p, phone: e.target.value }))} placeholder="Phone (optional)" aria-label="New account phone" type="tel" maxLength={20} className={`${inputCls} sm:w-40`} />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setAdding(false)} disabled={addingBusy}>Cancel</Button>
                    <Button type="button" onClick={addAccount} disabled={addingBusy || newAccount.name.trim().length < 2 || !phoneLike(newAccount.phone)}>
                      {addingBusy ? <Loading03Icon size={15} className="animate-spin" /> : 'Add'}
                    </Button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setAdding(true)} className="self-start text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 hover:underline">
                  <PlusSignIcon size={14} /> New account
                </button>
              ))}
            </Section>

            <Section title="Who ate?" hint="The guest’s name and at least one way to reach them: phone, WhatsApp or email.">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                <span>Guest name <span className="text-rose-600">*</span></span>
                <input value={guest.name} onChange={setField('name')} maxLength={80} autoComplete="off" placeholder="e.g. Rahul Mehta" className={inputCls} />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Phone
                  <input type="tel" inputMode="tel" value={guest.phone} onChange={setField('phone')} maxLength={20} autoComplete="off" placeholder="98765 43210" className={inputCls} />
                  {!phoneLike(guest.phone) && <span className="text-xs font-normal text-rose-600">10–15 digits, + allowed</span>}
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Email
                  <input type="email" value={guest.email} onChange={setField('email')} maxLength={120} autoComplete="off" placeholder="name@example.com" className={inputCls} />
                  {!emailLike(guest.email) && <span className="text-xs font-normal text-rose-600">Check the email address</span>}
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input type="checkbox" checked={sameWhatsapp} onChange={e => setSameWhatsapp(e.target.checked)} className="size-4" />
                WhatsApp is on the same number
              </label>
              {!sameWhatsapp && (
                <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 sm:max-w-[50%]">
                  WhatsApp number
                  <input type="tel" inputMode="tel" value={guest.whatsapp} onChange={setField('whatsapp')} maxLength={20} autoComplete="off" placeholder="98765 43210" className={inputCls} />
                  {!phoneLike(guest.whatsapp) && <span className="text-xs font-normal text-rose-600">10–15 digits, + allowed</span>}
                </label>
              )}
            </Section>

            <Section title="Note" hint="Why this bill is going on dues. It shows on the Dues page and in the order’s history.">
              <div className="flex flex-wrap gap-1.5">
                {[...NOTES, 'Other'].map(r => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={preset === r}
                    onClick={() => { setPreset(r); if (r === 'Other') setTimeout(() => detailsRef.current?.focus(), 0); }}
                    className={`px-3 h-8 rounded-full text-xs font-medium border ${preset === r
                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <textarea
                ref={detailsRef}
                rows={2}
                maxLength={150}
                value={details}
                onChange={e => setDetails(e.target.value)}
                aria-label="Note details"
                placeholder={isOther ? 'Why is this bill going on dues?' : 'Details (optional), e.g. approved by Rahul'}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400/40 resize-none"
              />
            </Section>

            <ul className="text-xs text-zinc-500 flex flex-col gap-1 list-disc pl-4">
              <li>The bill closes now and counts as a sale; its GST invoice is issued as usual.</li>
              <li>{rupees(amount)} is added to what {account?.name || 'the account'} owes, and is collected later on the Dues page.</li>
            </ul>

            {saveError && (
              <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
                <AlertCircleIcon size={16} /> {saveError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pb-6">
              <Button type="button" variant="outline" onClick={back} disabled={saving}>Back</Button>
              <Button type="submit" disabled={!ready || saving}>
                {saving ? <Loading03Icon size={16} className="animate-spin" /> : `Put ${rupees(amount)} on dues`}
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
};
