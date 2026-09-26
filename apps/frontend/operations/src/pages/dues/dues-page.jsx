import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Skeleton } from '@smo/ui';
import {
  NoteEditIcon, UserMultipleIcon, Money03Icon, Store01Icon, Search01Icon, PlusSignIcon, Call02Icon,
  Mail01Icon, Edit02Icon,
} from 'hugeicons-react';
import api from '../../lib/api';
import { Notice, SectionNav, SectionLayout } from '../../components/settings-layout';
import { useDuesScope, rupees, ageOf, METHOD_LABEL } from './use-dues-scope';

const errorText = (err, fallback) => err?.response?.data?.error?.message || fallback;
const dateOf = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const Empty = ({ children }) => <p className="px-6 py-14 text-center text-sm text-zinc-500">{children}</p>;

/* ---------- Bills ---------- */

const BillsTab = ({ apiParams, accounts, storeQuery, reloadKey }) => {
  const navigate = useNavigate();
  const [accountId, setAccountId] = useState('ALL');
  const [status, setStatus] = useState('open');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { setPage(1); }, [accountId, status, q, apiParams.storeId]);

  useEffect(() => {
    let stale = false;
    const t = setTimeout(() => {
      api.get('/dues/bills', { params: { ...apiParams, status, q: q.trim() || undefined, accountId: accountId === 'ALL' ? undefined : accountId, page } })
        .then(res => { if (!stale) { setData(res.data.data); setError(''); } })
        .catch(err => { if (!stale) setError(errorText(err, 'Could not load dues')); });
    }, 200);
    return () => { stale = true; clearTimeout(t); };
  }, [apiParams, status, q, accountId, page, reloadKey]);

  const owing = accounts.filter(a => a.outstanding > 0);

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5" role="tablist" aria-label="Status">
          {[['open', 'Unpaid'], ['paid', 'Paid back'], ['all', 'All']].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={status === id} onClick={() => setStatus(id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium ${status === id ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}>
              {label}
            </button>
          ))}
        </div>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="w-[220px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All accounts</SelectItem>
            {(status === 'open' ? owing : accounts).map(a => (
              <SelectItem key={a.id} value={a.id}>{a.name}{a.outstanding > 0 ? ` · ${rupees(a.outstanding)}` : ''}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative lg:ml-auto lg:w-72">
          <Search01Icon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Guest, phone, note or order no." aria-label="Search dues"
            className="h-8 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent pl-8 pr-2 text-sm outline-none" />
        </div>
      </div>

      {error && <div className="px-4 pt-3"><Notice msg={{ text: error, error: true }} /></div>}

      {!data ? (
        <div className="p-4 flex flex-col gap-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
      ) : data.bills.length === 0 ? (
        <Empty>{q.trim() ? `Nothing matches “${q.trim()}”.` : status === 'open' ? 'Nothing is owed right now.' : 'No dues bills yet.'}</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Bill</th>
                <th className="px-3 py-2 font-medium">Guest</th>
                <th className="px-3 py-2 font-medium">Owed by</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
                <th className="px-3 py-2 font-medium text-right">Paid back</th>
                <th className="px-4 py-2 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.bills.map(b => (
                <tr
                  key={b.id}
                  onClick={b.orderId ? () => navigate(`/dashboard/orders/${b.orderId}${storeQuery ? `?${storeQuery}` : b.storeId ? `?store=${b.storeId}` : ''}`) : undefined}
                  className={`border-b last:border-0 border-zinc-100 dark:border-zinc-800 align-top ${b.orderId ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900' : ''}`}
                >
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="tabular-nums text-zinc-900 dark:text-zinc-100">{dateOf(b.createdAt)}</div>
                    {b.outstanding > 0 && <div className="text-xs text-zinc-500">{ageOf(b.createdAt)}</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-zinc-900 dark:text-zinc-100">{b.label}</div>
                    <div className="text-xs text-zinc-500">
                      {b.invoiceNumber && <span className="font-mono">{b.invoiceNumber}</span>}
                      {b.storeName && !apiParams.storeId && <span>{b.invoiceNumber ? ' · ' : ''}{b.storeName}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-zinc-900 dark:text-zinc-100">{b.guest?.name || '—'}</div>
                    <div className="text-xs text-zinc-500 flex flex-wrap gap-x-2">
                      {b.guest?.phone && <a href={`tel:${b.guest.phone}`} onClick={e => e.stopPropagation()} className="hover:underline">{b.guest.phone}</a>}
                      {b.guest?.email && <a href={`mailto:${b.guest.email}`} onClick={e => e.stopPropagation()} className="hover:underline">{b.guest.email}</a>}
                    </div>
                    {b.note && <div className="text-xs italic text-zinc-500 max-w-[260px] truncate" title={b.note}>“{b.note}”</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-zinc-900 dark:text-zinc-100">{b.account?.name}</div>
                    {b.putBy && <div className="text-xs text-zinc-500">by {b.putBy.name}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{rupees(b.amount)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-500">
                    {b.settled > 0 ? rupees(b.settled) : '—'}
                    {b.reduced > 0 && <div className="text-xs">−{rupees(b.reduced)} not served</div>}
                  </td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${b.outstanding > 0 ? 'text-zinc-900 dark:text-zinc-100' : 'text-emerald-600'}`}>
                    {b.outstanding > 0 ? rupees(b.outstanding) : 'Paid'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.pagination?.pages > 1 && (
        <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
          <span>{data.pagination.total} bills</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= data.pagination.pages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </section>
  );
};

/* ---------- Accounts ---------- */

const AccountsTab = ({ accounts, canManage, storeQuery }) => {
  const navigate = useNavigate();
  const q = storeQuery ? `?${storeQuery}` : '';
  return (
    <div className="flex flex-col gap-3">
      {canManage && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/dues/accounts/new${q}`)}>
            <PlusSignIcon size={14} className="mr-1.5" /> New account
          </Button>
        </div>
      )}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 2xl:grid-cols-3">
        {accounts.map(a => (
          <div key={a.id} className={`rounded-xl border bg-white dark:bg-zinc-950 p-4 flex flex-col gap-3 ${a.isActive ? 'border-zinc-200 dark:border-zinc-800' : 'border-dashed border-zinc-300 dark:border-zinc-700 opacity-70'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{a.name}</span>
                  {a.isOwner && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">Owner</span>}
                  {!a.isActive && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500">Closed</span>}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500 flex flex-wrap gap-x-3">
                  {a.phone && <a href={`tel:${a.phone}`} className="flex items-center gap-1 hover:underline"><Call02Icon size={11} /> {a.phone}</a>}
                  {a.email && <a href={`mailto:${a.email}`} className="flex items-center gap-1 hover:underline"><Mail01Icon size={11} /> {a.email}</a>}
                </div>
              </div>
              {canManage && (
                <Button variant="ghost" size="icon" aria-label={`Edit ${a.name}`} onClick={() => navigate(`/dashboard/dues/accounts/${a.id}${q}`)}>
                  <Edit02Icon size={15} />
                </Button>
              )}
            </div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-xs text-zinc-500">Owes</div>
                <div className={`text-xl font-semibold tabular-nums ${a.outstanding > 0 ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-400'}`}>{rupees(a.outstanding)}</div>
                <div className="text-xs text-zinc-500">
                  {a.openBills > 0 ? `${a.openBills} bill${a.openBills === 1 ? '' : 's'} · oldest ${ageOf(a.oldestOpenAt)}` : 'All paid up'}
                </div>
              </div>
              {canManage && a.outstanding > 0 && (
                <Button size="sm" onClick={() => navigate(`/dashboard/dues/record-payment?account=${a.id}${storeQuery ? `&${storeQuery}` : ''}`)}>
                  Record payment
                </Button>
              )}
            </div>
            {a.note && <p className="text-xs text-zinc-500 italic">{a.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---------- Payments received ---------- */

const PaymentsTab = ({ apiParams, accounts, reloadKey }) => {
  const [accountId, setAccountId] = useState('ALL');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { setPage(1); }, [accountId, apiParams.storeId]);
  useEffect(() => {
    let stale = false;
    api.get('/dues/repayments', { params: { ...apiParams, accountId: accountId === 'ALL' ? undefined : accountId, page } })
      .then(res => { if (!stale) { setData(res.data.data); setError(''); } })
      .catch(err => { if (!stale) setError(errorText(err, 'Could not load payments')); });
    return () => { stale = true; };
  }, [apiParams, accountId, page, reloadKey]);

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="w-[220px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All accounts</SelectItem>
            {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {error && <div className="px-4 pt-3"><Notice msg={{ text: error, error: true }} /></div>}
      {!data ? (
        <div className="p-4 flex flex-col gap-2">{[1, 2].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
      ) : data.repayments.length === 0 ? (
        <Empty>No payments recorded yet.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-2 font-medium">Received</th>
                <th className="px-3 py-2 font-medium">From</th>
                <th className="px-3 py-2 font-medium">How</th>
                <th className="px-3 py-2 font-medium">Bills</th>
                <th className="px-3 py-2 font-medium">Recorded by</th>
                <th className="px-4 py-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.repayments.map(r => (
                <tr key={r.id} className="border-b last:border-0 border-zinc-100 dark:border-zinc-800 align-top">
                  <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{dateOf(r.receivedAt)}</td>
                  <td className="px-3 py-2.5">
                    <div className="text-zinc-900 dark:text-zinc-100">{r.account?.name}</div>
                    {r.storeName && <div className="text-xs text-zinc-500">{r.storeName} only</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    {METHOD_LABEL[r.method]}
                    {r.reference && <div className="text-xs font-mono text-zinc-500">{r.reference}</div>}
                    {r.note && <div className="text-xs italic text-zinc-500">“{r.note}”</div>}
                  </td>
                  <td className="px-3 py-2.5 text-zinc-500">{r.bills}</td>
                  <td className="px-3 py-2.5 text-zinc-500">{r.recordedBy?.name || '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-600">{rupees(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data?.pagination?.pages > 1 && (
        <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page >= data.pagination.pages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </section>
  );
};

/* ---------- Page ---------- */

/**
 * /dashboard/dues — bills closed on credit, who owes what, and money received against them.
 */
export const Dues = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const scope = useDuesScope();
  const { apiParams, storeQuery, canManage } = scope;
  const [summary, setSummary] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState('');
  const notice = params.get('notice');

  const stableParams = useMemo(() => apiParams, [apiParams.storeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(() => {
    if (!scope.ready) return;
    Promise.all([
      api.get('/dues/summary', { params: stableParams }),
      api.get('/dues/accounts', { params: { ...stableParams, includeInactive: '1' } }),
    ])
      .then(([s, a]) => { setSummary(s.data.data); setAccounts(a.data.data || []); setError(''); })
      .catch(err => setError(errorText(err, 'Could not load dues')));
  }, [stableParams, scope.ready]);

  useEffect(() => { load(); }, [load]);

  const tabs = [
    { id: 'bills', label: 'Bills', hint: 'Every bill put on dues', icon: NoteEditIcon },
    { id: 'accounts', label: 'Accounts', hint: 'Who owes what', icon: UserMultipleIcon },
    { id: 'payments', label: 'Payments received', hint: 'Money paid back', icon: Money03Icon },
  ];
  const active = tabs.some(t => t.id === params.get('tab')) ? params.get('tab') : 'bills';
  const setTab = (id) => setParams(prev => {
    const next = new URLSearchParams(prev);
    if (id === 'bills') next.delete('tab'); else next.set('tab', id);
    next.delete('notice');
    return next;
  }, { replace: true });

  const stats = summary ? [
    { label: 'Owed to you', value: rupees(summary.outstanding), detail: `${summary.openBills} unpaid bill${summary.openBills === 1 ? '' : 's'}` },
    { label: 'Accounts owing', value: summary.accountsOwing, detail: `of ${accounts.filter(a => a.isActive).length} accounts` },
    { label: 'Oldest unpaid', value: summary.oldestOpenAt ? ageOf(summary.oldestOpenAt) : '—', detail: summary.oldestOpenAt ? dateOf(summary.oldestOpenAt) : 'nothing owed' },
    { label: 'Received this month', value: rupees(summary.receivedThisMonth), detail: `${summary.paymentsThisMonth} payment${summary.paymentsThisMonth === 1 ? '' : 's'}` },
  ] : null;

  return (
    <div className="flex flex-col gap-5 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Dues</h1>
          <p className="text-sm text-zinc-500">Bills closed on credit, who owes them, and money paid back. Dues count as sales on the day of the bill.</p>
        </div>
        <div className="flex items-center gap-2">
          {scope.canPickStore && (
            <Select value={scope.storeId || 'ALL'} onValueChange={v => scope.setStoreId(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-[190px] h-9 text-sm"><Store01Icon size={15} className="mr-1.5 text-zinc-400" /><SelectValue /></SelectTrigger>
              <SelectContent>
                {scope.allowAllStores && <SelectItem value="ALL">All stores</SelectItem>}
                {scope.stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {canManage && (
            <Button onClick={() => navigate(`/dashboard/dues/record-payment${storeQuery ? `?${storeQuery}` : ''}`)} disabled={!summary?.outstanding}>
              <Money03Icon size={16} className="mr-1.5" /> Record payment
            </Button>
          )}
        </div>
      </div>

      {notice && <Notice msg={{ text: notice, error: false }} />}
      {error && <Notice msg={{ text: error, error: true }} />}

      {stats ? (
        <dl className="grid grid-cols-2 lg:grid-cols-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
          {stats.map((s, i) => (
            <div key={s.label} className={`px-5 py-4 border-zinc-200 dark:border-zinc-800 ${i % 2 === 1 ? 'border-l' : ''} ${i >= 2 ? 'border-t lg:border-t-0 lg:border-l' : ''}`}>
              <dt className="text-xs text-zinc-500">{s.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{s.value}</dd>
              <dd className="text-xs text-zinc-400">{s.detail}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <Skeleton className="h-24 w-full rounded-xl" />
      )}

      <SectionLayout nav={<SectionNav tabs={tabs} active={active} onChange={setTab} label="Dues sections" />}>
        {scope.ready && active === 'bills' && <BillsTab apiParams={stableParams} accounts={accounts} storeQuery={storeQuery} reloadKey={summary} />}
        {active === 'accounts' && <AccountsTab accounts={accounts} canManage={canManage} storeQuery={storeQuery} />}
        {scope.ready && active === 'payments' && <PaymentsTab apiParams={stableParams} accounts={accounts} reloadKey={summary} />}
      </SectionLayout>
    </div>
  );
};
