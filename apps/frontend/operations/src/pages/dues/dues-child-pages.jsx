import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@smo/ui';
import { ArrowLeft01Icon, Loading03Icon, CheckmarkCircle02Icon } from 'hugeicons-react';
import api from '../../lib/api';
import { Notice, Panel, Row } from '../../components/settings-layout';
import { useDuesScope, rupees, ageOf, METHOD_LABEL } from './use-dues-scope';

const errorText = (err, fallback) => err?.response?.data?.error?.message || fallback;
const inputCls = 'h-10 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-400/40';
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const phoneLike = (v) => !v.trim() || /^\+?\d{10,15}$/.test(v.replace(/[\s()-]/g, ''));
const emailLike = (v) => !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function useBackToDues(storeQuery) {
  const navigate = useNavigate();
  const location = useLocation();
  const listPath = `/dashboard/dues${storeQuery ? `?${storeQuery}` : ''}`;
  const back = () => (location.key !== 'default' ? navigate(-1) : navigate(listPath));
  return { navigate, back, listPath };
}

const Header = ({ title, subtitle, onBack }) => (
  <div className="flex items-center gap-3">
    <Button type="button" variant="outline" size="sm" onClick={onBack} aria-label="Back to dues"><ArrowLeft01Icon size={16} /></Button>
    <div className="min-w-0">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{title}</h1>
      {subtitle && <p className="text-sm text-zinc-500">{subtitle}</p>}
    </div>
  </div>
);

const ManagersOnly = ({ onBack }) => (
  <div className="flex flex-col gap-4">
    <Header title="Dues" onBack={onBack} />
    <Notice msg={{ text: 'Only managers and owners can do this.', error: true }} />
  </div>
);

/**
 * /dashboard/dues/record-payment?account=&store= — money received against an account's dues,
 * cleared oldest bill first.
 */
export const DuesPaymentPage = () => {
  const [params] = useSearchParams();
  const scope = useDuesScope();
  const { navigate, back } = useBackToDues(scope.storeQuery);
  const [accounts, setAccounts] = useState(null);
  const [accountId, setAccountId] = useState(params.get('account') || '');
  const [bills, setBills] = useState(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [date, setDate] = useState(todayStr);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const storeId = scope.apiParams.storeId;
  useEffect(() => {
    if (!scope.ready) return;
    api.get('/dues/accounts', { params: storeId ? { storeId } : {} })
      .then(res => {
        const owing = (res.data.data || []).filter(a => a.outstanding > 0);
        setAccounts(owing);
        setAccountId(prev => (owing.some(a => a.id === prev) ? prev : owing[0]?.id || ''));
      })
      .catch(err => { setAccounts([]); setError(errorText(err, 'Could not load accounts')); });
  }, [storeId, scope.ready]);

  // Open bills of the chosen account, oldest first, to preview where the money goes
  useEffect(() => {
    if (!accountId) { setBills([]); return; }
    setBills(null);
    api.get('/dues/bills', { params: { ...(storeId ? { storeId } : {}), accountId, status: 'open', limit: 100 } })
      .then(res => setBills([...(res.data.data.bills || [])].reverse()))
      .catch(() => setBills([]));
  }, [accountId, storeId]);

  const account = accounts?.find(a => a.id === accountId);
  const owed = account?.outstanding || 0;
  const amountNum = parseInt(amount, 10) || 0;

  const preview = useMemo(() => {
    let left = amountNum;
    return (bills || []).map(b => {
      const part = Math.max(0, Math.min(left, b.outstanding));
      left -= part;
      return { ...b, part, clears: part > 0 && part === b.outstanding };
    });
  }, [bills, amountNum]);

  const valid = account && amountNum > 0 && amountNum <= owed && date && date <= todayStr();

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError('');
    try {
      // Midday local time, so the date doesn't shift across time zones
      const receivedAt = date === todayStr() ? undefined : new Date(`${date}T12:00:00`).toISOString();
      const res = await api.post('/dues/repayments', {
        ...(storeId ? { storeId } : {}),
        accountId,
        amount: amountNum,
        method,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
        receivedAt,
      });
      const r = res.data.data;
      const notice = `${rupees(r.amount)} from ${account.name} recorded · ${r.billsCleared} bill${r.billsCleared === 1 ? '' : 's'} cleared`;
      navigate(`/dashboard/dues?${new URLSearchParams({ ...(scope.storeQuery ? { store: storeId } : {}), tab: 'payments', notice })}`, { replace: true });
    } catch (err) {
      setError(errorText(err, 'Could not record the payment'));
      setSaving(false);
    }
  };

  if (!scope.canManage) return <ManagersOnly onBack={back} />;

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 pb-12 max-w-4xl">
      <Header title="Record payment" subtitle="Money received against dues. It clears the oldest bills first; part-payments are fine." onBack={back} />
      {error && <Notice msg={{ text: error, error: true }} />}

      {!accounts ? (
        <div className="h-40 flex items-center justify-center text-zinc-400"><Loading03Icon size={22} className="animate-spin" /></div>
      ) : accounts.length === 0 ? (
        <Notice msg={{ text: 'Nobody owes anything right now.', error: false }} />
      ) : (
        <Panel
          title="Payment"
          footer={(
            <>
              <span className="text-xs text-zinc-500 mr-auto">{account ? `${account.name} owes ${rupees(owed)}` : ''}</span>
              <Button type="button" variant="outline" size="sm" onClick={back} disabled={saving}>Cancel</Button>
              <Button type="submit" size="sm" disabled={!valid || saving}>
                {saving ? <Loading03Icon size={14} className="animate-spin" /> : `Record ${amountNum > 0 ? rupees(amountNum) : 'payment'}`}
              </Button>
            </>
          )}
        >
          <Row label="From" hint="The account paying.">
            <select value={accountId} onChange={e => setAccountId(e.target.value)} aria-label="Account" className={`${inputCls} max-w-md`}>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} · owes {rupees(a.outstanding)}</option>)}
            </select>
          </Row>

          <Row label="Amount" hint={`Up to ${rupees(owed)}.`}>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-44">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">₹</span>
                <input
                  inputMode="numeric"
                  value={amount}
                  onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ''))}
                  aria-label="Amount received"
                  className={`${inputCls} pl-7 text-right font-semibold tabular-nums`}
                />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setAmount(String(owed))} disabled={!owed}>Full {rupees(owed)}</Button>
            </div>
            {amountNum > owed && <p className="mt-1 text-xs text-rose-600">That's more than {account?.name} owes.</p>}
          </Row>

          <Row label="Received as">
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Payment method">
              {Object.entries(METHOD_LABEL).map(([id, label]) => (
                <button key={id} type="button" role="radio" aria-checked={method === id} onClick={() => setMethod(id)}
                  className={`px-3 h-8 rounded-md text-sm border ${method === id
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'}`}>
                  {label}
                </button>
              ))}
            </div>
          </Row>

          <Row label="Details" hint="Date received, and a reference like the UPI/UTR or cheque number.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">Date</span>
                <input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} className={inputCls} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">Reference <span className="font-normal text-zinc-500">(optional)</span></span>
                <input value={reference} onChange={e => setReference(e.target.value)} maxLength={60} placeholder="e.g. UTR 4102…" className={inputCls} />
              </label>
              <label className="sm:col-span-2 flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">Note <span className="font-normal text-zinc-500">(optional)</span></span>
                <input value={note} onChange={e => setNote(e.target.value)} maxLength={200} placeholder="e.g. September settlement" className={inputCls} />
              </label>
            </div>
          </Row>

          <Row label="Clears" hint="Oldest bills are paid off first.">
            {!bills ? (
              <Loading03Icon size={16} className="animate-spin text-zinc-400" />
            ) : (
              <ul className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800 max-h-72 overflow-y-auto">
                {preview.map(b => (
                  <li key={b.id} className={`px-3 py-2 flex items-center justify-between gap-3 text-sm ${b.part > 0 ? '' : 'opacity-50'}`}>
                    <div className="min-w-0">
                      <div className="truncate text-zinc-900 dark:text-zinc-100">{b.label}{b.guest?.name ? ` · ${b.guest.name}` : ''}</div>
                      <div className="text-xs text-zinc-500">{new Date(b.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · {ageOf(b.createdAt)} · owes {rupees(b.outstanding)}</div>
                    </div>
                    <div className="text-right shrink-0">
                      {b.clears ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium"><CheckmarkCircle02Icon size={14} /> Cleared</span>
                      ) : b.part > 0 ? (
                        <span className="text-zinc-900 dark:text-zinc-100 tabular-nums">{rupees(b.part)} <span className="text-xs text-zinc-500">of {rupees(b.outstanding)}</span></span>
                      ) : (
                        <span className="text-xs text-zinc-500">stays owed</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Row>
        </Panel>
      )}
    </form>
  );
};

/**
 * /dashboard/dues/accounts/new and /dashboard/dues/accounts/:accountId — who can owe dues.
 */
export const DuesAccountPage = () => {
  const { accountId } = useParams();
  const scope = useDuesScope();
  const { navigate, back, listPath } = useBackToDues(scope.storeQuery);
  const isNew = !accountId;
  const [form, setForm] = useState({ name: '', phone: '', email: '', note: '', isActive: true });
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  useEffect(() => {
    if (isNew || !scope.ready) return;
    api.get('/dues/accounts', { params: { ...scope.apiParams, includeInactive: '1' } })
      .then(res => {
        const a = (res.data.data || []).find(x => x.id === accountId);
        if (!a) { setError('Account not found'); return; }
        setAccount(a);
        setForm({ name: a.name, phone: a.phone || '', email: a.email || '', note: a.note || '', isActive: a.isActive });
      })
      .catch(err => setError(errorText(err, 'Could not load the account')))
      .finally(() => setLoading(false));
  }, [accountId, isNew, scope.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const valid = form.name.trim().length >= 2 && phoneLike(form.phone) && emailLike(form.email);

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError('');
    const payload = { ...scope.apiParams, name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), note: form.note.trim() };
    try {
      if (isNew) await api.post('/dues/accounts', payload);
      else await api.patch(`/dues/accounts/${accountId}`, { ...payload, isActive: form.isActive });
      navigate(`${listPath}${listPath.includes('?') ? '&' : '?'}tab=accounts`, { replace: true });
    } catch (err) {
      setError(errorText(err, 'Could not save the account'));
      setSaving(false);
    }
  };

  if (!scope.canManage) return <ManagersOnly onBack={back} />;

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 pb-12 max-w-4xl">
      <Header title={isNew ? 'New dues account' : account?.name || 'Dues account'} subtitle="Someone who can owe the store for bills: a partner, a company, a regular…" onBack={back} />
      {error && <Notice msg={{ text: error, error: true }} />}
      {loading ? (
        <div className="h-40 flex items-center justify-center text-zinc-400"><Loading03Icon size={22} className="animate-spin" /></div>
      ) : (
        <Panel
          title="Account"
          footer={(
            <>
              <Button type="button" variant="outline" size="sm" onClick={back} disabled={saving}>Cancel</Button>
              <Button type="submit" size="sm" disabled={!valid || saving}>
                {saving ? <Loading03Icon size={14} className="animate-spin" /> : isNew ? 'Create account' : 'Save changes'}
              </Button>
            </>
          )}
        >
          <Row label="Name" hint="Shown to cashiers when they put a bill on dues.">
            <input value={form.name} onChange={set('name')} maxLength={80} autoFocus={isNew} placeholder="e.g. Mehta Traders" className={`${inputCls} max-w-md`} />
          </Row>
          <Row label="Contact" hint="Optional, for reminders.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">Phone</span>
                <input type="tel" value={form.phone} onChange={set('phone')} maxLength={20} className={inputCls} />
                {!phoneLike(form.phone) && <span className="text-xs text-rose-600">10–15 digits, + allowed</span>}
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">Email</span>
                <input type="email" value={form.email} onChange={set('email')} maxLength={120} className={inputCls} />
                {!emailLike(form.email) && <span className="text-xs text-rose-600">Check the email address</span>}
              </label>
            </div>
          </Row>
          <Row label="Note" hint="e.g. pays at month end.">
            <input value={form.note} onChange={set('note')} maxLength={200} className={`${inputCls} max-w-xl`} />
          </Row>
          {!isNew && !account?.isOwner && (
            <Row label="Taking new dues" hint="Closed accounts keep their history and can still pay back, but can't be picked for new bills.">
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(prev => ({ ...prev, isActive: e.target.checked }))} className="size-4" />
                Open for new dues
              </label>
              {account?.outstanding > 0 && <p className="mt-1 text-xs text-zinc-500">Still owes {rupees(account.outstanding)}.</p>}
            </Row>
          )}
        </Panel>
      )}
    </form>
  );
};
