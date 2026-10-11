import React, { useCallback, useEffect, useState } from 'react';
import { Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@smo/ui';
import { Loading03Icon, Store01Icon, Megaphone01Icon, Notification03Icon } from 'hugeicons-react';
import api from '../lib/api';
import { useStoreSelection } from '../hooks/use-store-selection';

const TITLE_MAX = 60;
const BODY_MAX = 160;
const NO_CODE = 'NONE';
const card = 'rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900';
const eyebrow = 'text-[11px] font-semibold uppercase tracking-wider text-zinc-500';
const field = 'w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 text-sm outline-none focus:border-amber-500';
const errorText = (err, fallback) => err?.response?.data?.error?.message || fallback;
const when = (iso) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * Campaigns: send an offer as a phone notification to guests who ordered from the QR menu
 * and agreed to get offers. One campaign per store per day.
 */
export const Campaigns = () => {
  const { storeId, setStoreId, stores, canSwitch } = useStoreSelection();
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState(null);
  const [promos, setPromos] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('ALL');
  const [promoCode, setPromoCode] = useState(NO_CODE);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { text, error }

  const load = useCallback(async () => {
    if (!storeId) return;
    try {
      const [a, c, p] = await Promise.all([
        api.get(`/stores/${storeId}/marketing/audience`),
        api.get(`/stores/${storeId}/marketing/campaigns`),
        api.get(`/stores/${storeId}/promos`).catch(() => ({ data: { data: [] } })),
      ]);
      setSummary(a.data.data);
      setHistory(c.data.data || []);
      setPromos((p.data.data || []).filter(x => x.isActive && (!x.validUntil || new Date(x.validUntil) > new Date())));
    } catch (err) {
      setNotice({ text: errorText(err, 'Could not load campaigns'), error: true });
    }
  }, [storeId]);

  useEffect(() => { setSummary(null); setHistory(null); setConfirming(false); load(); }, [load]);

  const chosen = summary?.audiences.find(a => a.id === audience);
  const reach = chosen?.devices || 0;
  const code = promoCode === NO_CODE ? null : promoCode;
  const preview = `${body.trim() || 'Your message appears here.'}${code ? ` Use code ${code}.` : ''}`;
  const valid = title.trim().length >= 3 && body.trim().length >= 5;
  const blocked = !summary?.canSendToday ? 'Today’s campaign has already been sent. You can send the next one tomorrow.'
    : reach === 0 ? 'Nobody in this audience has agreed to get offers yet.'
    : null;

  const send = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await api.post(`/stores/${storeId}/marketing/campaigns`, { title: title.trim(), body: body.trim(), audience, promoCode: code || undefined });
      const sent = res.data.data;
      setNotice({ text: `Sent to ${sent.delivered} of ${sent.targeted} ${sent.targeted === 1 ? 'device' : 'devices'}.`, error: false });
      setTitle('');
      setBody('');
      setPromoCode(NO_CODE);
      load();
    } catch (err) {
      setNotice({ text: errorText(err, 'Could not send the campaign'), error: true });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Campaigns</h1>
          <p className="text-sm text-zinc-500">Send an offer as a phone notification to guests who ordered from your QR menu and agreed to get offers.</p>
        </div>
        {canSwitch && (
          <Select value={storeId || undefined} onValueChange={setStoreId}>
            <SelectTrigger className="w-[200px] h-9 text-sm"><Store01Icon size={15} className="mr-1.5 text-zinc-400" /><SelectValue placeholder="Store" /></SelectTrigger>
            <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>

      {notice && (
        <p role={notice.error ? 'alert' : 'status'} className={`${card} px-4 py-3 text-sm ${notice.error ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'}`}>{notice.text}</p>
      )}

      {!summary ? (
        !notice && <div className="p-12 flex justify-center text-zinc-400"><Loading03Icon size={22} className="animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* Compose */}
          <section aria-label="New campaign" className={`${card} lg:col-span-2 p-5 flex flex-col gap-4`}>
            <p className={eyebrow}>New campaign</p>

            <fieldset>
              <legend className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5">Who gets it</legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Audience">
                {summary.audiences.map(a => (
                  <button key={a.id} type="button" role="radio" aria-checked={audience === a.id} onClick={() => setAudience(a.id)}
                    className={`rounded-lg border px-3 py-2.5 text-left ${audience === a.id ? 'border-zinc-900 dark:border-zinc-100' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'}`}>
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{a.label}</span>
                      <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{a.devices}</span>
                    </span>
                    <span className="block text-xs text-zinc-500">{a.hint}</span>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-zinc-500">
                The numbers are phones that agreed to offers. {summary.allowedNotifications} {summary.allowedNotifications === 1 ? 'phone has' : 'phones have'} allowed order alerts at this store in total.
              </p>
            </fieldset>

            <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <span className="flex items-baseline justify-between"><span>Title</span><span className="text-xs font-normal tabular-nums text-zinc-400">{title.length}/{TITLE_MAX}</span></span>
              <input value={title} maxLength={TITLE_MAX} onChange={e => setTitle(e.target.value)} placeholder="e.g. Weekend biryani offer" className={`${field} mt-1 h-10 font-normal`} />
            </label>

            <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <span className="flex items-baseline justify-between"><span>Message</span><span className="text-xs font-normal tabular-nums text-zinc-400">{body.length}/{BODY_MAX}</span></span>
              <textarea value={body} maxLength={BODY_MAX} rows={3} onChange={e => setBody(e.target.value)} placeholder="e.g. Flat 20% off on all biryanis this Saturday and Sunday." className={`${field} mt-1 py-2 font-normal resize-none`} />
            </label>

            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Promo code <span className="font-normal text-zinc-400">(optional)</span>
              <Select value={promoCode} onValueChange={setPromoCode}>
                <SelectTrigger className="mt-1 h-10 w-full sm:w-72 text-sm font-normal" aria-label="Promo code"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CODE}>No code</SelectItem>
                  {promos.map(p => <SelectItem key={p.id} value={p.code}>{p.code}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs font-normal text-zinc-500">{promos.length === 0 ? 'No active promo codes at this store.' : 'The code is added to the end of the message.'}</p>
            </div>

            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 flex flex-col gap-2">
              {blocked ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{blocked}</p>
              ) : confirming ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-zinc-900 dark:text-zinc-100 mr-auto">Send this to <strong className="tabular-nums">{reach}</strong> {reach === 1 ? 'phone' : 'phones'} now? It can’t be undone.</p>
                  <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Go back</Button>
                  <Button disabled={busy} onClick={send} className="bg-amber-400 hover:bg-amber-500 text-zinc-950">
                    {busy ? <Loading03Icon size={16} className="animate-spin" /> : 'Yes, send'}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <Button disabled={!valid} onClick={() => setConfirming(true)} className="bg-amber-400 hover:bg-amber-500 text-zinc-950">
                    <Megaphone01Icon size={16} className="mr-2" /> Send to {reach} {reach === 1 ? 'phone' : 'phones'}
                  </Button>
                  <span className="text-xs text-zinc-500">One campaign per day, so guests don’t switch offers off.</span>
                </div>
              )}
            </div>
          </section>

          {/* Preview */}
          <section aria-label="Preview" className={`${card} p-5`}>
            <p className={`${eyebrow} mb-3`}>How it looks on a phone</p>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 p-3 flex gap-3">
              <span className="size-9 shrink-0 rounded-lg bg-amber-400 text-zinc-950 flex items-center justify-center"><Notification03Icon size={18} /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 break-words">{title.trim() || 'Your title'}</span>
                <span className="block text-xs text-zinc-600 dark:text-zinc-400 break-words">{preview}</span>
              </span>
            </div>
            <p className="mt-3 text-xs text-zinc-500">Tapping it opens this store’s menu. Guests can switch offers off at any time, and they still get their order alerts.</p>
          </section>
        </div>
      )}

      {/* History */}
      {history && (
        <section aria-label="Sent campaigns" className={`${card} overflow-x-auto`}>
          <p className={`${eyebrow} px-5 py-3 border-b border-zinc-200 dark:border-zinc-800`}>Sent campaigns</p>
          {history.length === 0 ? (
            <p className="p-8 text-center text-sm text-zinc-500">Nothing sent yet. Your campaigns will be listed here.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-5 py-2 font-medium">Sent</th>
                  <th className="px-3 py-2 font-medium">Message</th>
                  <th className="px-3 py-2 font-medium">Audience</th>
                  <th className="px-3 py-2 font-medium text-right">Delivered</th>
                  <th className="px-5 py-2 font-medium">By</th>
                </tr>
              </thead>
              <tbody>
                {history.map(c => (
                  <tr key={c.id} className="border-b last:border-0 border-zinc-100 dark:border-zinc-800 align-top">
                    <td className="px-5 py-2.5 whitespace-nowrap tabular-nums text-zinc-500">{when(c.createdAt)}</td>
                    <td className="px-3 py-2.5 max-w-[420px]">
                      <span className="block font-semibold text-zinc-900 dark:text-zinc-100 break-words">{c.title}</span>
                      <span className="block text-xs text-zinc-500 break-words">{c.body}{c.promoCode ? ` Use code ${c.promoCode}.` : ''}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-zinc-600 dark:text-zinc-400">{summary?.audiences.find(a => a.id === c.audience)?.label || c.audience}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap text-zinc-900 dark:text-zinc-100">{c.delivered} of {c.targeted}</td>
                    <td className="px-5 py-2.5 whitespace-nowrap text-zinc-600 dark:text-zinc-400">{c.sentByName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
};
