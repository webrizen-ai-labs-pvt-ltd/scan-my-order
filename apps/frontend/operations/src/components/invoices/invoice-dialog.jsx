import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@smo/ui';
import { Cancel01Icon, PrinterIcon, Mail01Icon, Building02Icon, Loading03Icon, CheckmarkCircle02Icon, Alert01Icon, ArrowLeft01Icon } from 'hugeicons-react';
import { validateGstin } from '@smo/shared/gst';
import api from '../../lib/api';
import { InvoiceDocument } from './invoice-document';
import { printReceipt } from '../../lib/print-receipt';

const errorText = (err, fallback) => err?.response?.data?.error?.message || err?.message || fallback;

const EMPTY_FORM = { name: '', gstin: '', address: '', email: '', employeeName: '', employeeId: '', costCenter: '', poNumber: '', guests: '', purpose: '' };

const Field = ({ label, hint, error, children }) => (
  <label className="flex flex-col gap-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
    <span>{label}</span>
    {children}
    {error ? <span className="text-[11px] font-semibold text-rose-600">{error}</span> : hint ? <span className="text-[11px] font-normal text-zinc-500">{hint}</span> : null}
  </label>
);
const inputClass = 'h-9 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-zinc-400/40';

/**
 * Corporate details form. Saved companies can be picked from the search.
 */
export const CorporateForm = ({
  storeId, busy, error, onSubmit, onBack,
  initial = null,
  intro = "The current bill is cancelled with a credit note and re-issued with the company's details. Amounts don't change.",
  submitLabel = "Issue corporate invoice",
}) => {
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, ...(initial?.billTo || {}), guests: initial?.billTo?.guests ? String(initial.billTo.guests) : "" }));
  const [saveClient, setSaveClient] = useState(true);
  const [sendEmail, setSendEmail] = useState(initial ? Boolean(initial.sendEmail) : true);
  const [clients, setClients] = useState([]);
  const [showMore, setShowMore] = useState(() => ["employeeName", "employeeId", "costCenter", "poNumber", "guests", "purpose"].some(k => initial?.billTo?.[k]));
  const set = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  // Saved companies matching what's typed in the name field
  useEffect(() => {
    const q = form.name.trim();
    if (q.length < 2) { setClients([]); return undefined; }
    const timer = setTimeout(() => {
      api.get(`/stores/${storeId}/invoices/clients`, { params: { q } })
        .then(res => setClients(res.data.data || []))
        .catch(() => setClients([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [form.name, storeId]);

  const gst = form.gstin.trim() ? validateGstin(form.gstin) : null;
  const canSubmit = form.name.trim().length >= 2 && (!gst || gst.valid) && !busy;

  const pickClient = (c) => {
    setForm(prev => ({ ...prev, name: c.name, gstin: c.gstin || '', address: c.address || '', email: c.email || prev.email }));
    setClients([]);
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit({ billTo: { ...form, gstin: gst?.gstin || '' }, saveClient, sendEmail: sendEmail && Boolean(form.email.trim()) });
      }}
    >
      {intro && <p className="text-xs text-zinc-500">{intro}</p>}

      <div className="relative">
        <Field label="Company legal name *">
          <input className={inputClass} value={form.name} onChange={set('name')} autoFocus autoComplete="off" placeholder="e.g. Infosys Limited" />
        </Field>
        {clients.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden">
            {clients.map(c => (
              <button key={c.id} type="button" onClick={() => pickClient(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                <span className="font-semibold">{c.name}</span>
                {c.gstin && <span className="ml-2 font-mono text-xs text-zinc-500">{c.gstin}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <Field
        label="Company GSTIN"
        error={gst && !gst.valid ? gst.error : null}
        hint={gst?.valid ? `Valid · ${gst.stateName}` : 'Needed if the company wants to claim GST credit'}
      >
        <input className={`${inputClass} font-mono uppercase`} value={form.gstin} onChange={set('gstin')} maxLength={15} placeholder="27ABCDE1234F1Z5" autoComplete="off" />
      </Field>
      <Field label="Billing address">
        <textarea className={`${inputClass} h-auto py-2`} rows={2} value={form.address} onChange={set('address')} maxLength={300} />
      </Field>
      <Field label="Email the invoice to" hint="Optional">
        <input className={inputClass} type="email" value={form.email} onChange={set('email')} placeholder="accounts@company.com" />
      </Field>

      <button type="button" onClick={() => setShowMore(v => !v)} className="self-start text-xs font-semibold text-zinc-600 dark:text-zinc-400 underline">
        {showMore ? 'Hide' : 'Add'} employee, PO and cost centre details
      </button>
      {showMore && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Employee name"><input className={inputClass} value={form.employeeName} onChange={set('employeeName')} /></Field>
          <Field label="Employee ID"><input className={inputClass} value={form.employeeId} onChange={set('employeeId')} /></Field>
          <Field label="PO / reference no."><input className={inputClass} value={form.poNumber} onChange={set('poNumber')} /></Field>
          <Field label="Cost centre"><input className={inputClass} value={form.costCenter} onChange={set('costCenter')} /></Field>
          <Field label="Guests"><input className={inputClass} type="number" min={1} value={form.guests} onChange={set('guests')} /></Field>
          <Field label="Purpose"><input className={inputClass} value={form.purpose} onChange={set('purpose')} placeholder="e.g. Client meeting" /></Field>
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" checked={saveClient} onChange={e => setSaveClient(e.target.checked)} className="size-4" />
        Save this company for next time
      </label>
      {form.email.trim() && (
        <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} className="size-4" />
          Email the invoice to {form.email.trim()}
        </label>
      )}

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">{error}</div>}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onBack} disabled={busy}><ArrowLeft01Icon size={14} className="mr-1.5" /> Back</Button>
        <Button type="submit" disabled={!canSubmit}>{busy ? <Loading03Icon size={16} className="animate-spin" /> : submitLabel}</Button>
      </div>
    </form>
  );
};

/**
 * View, print, email and convert an invoice. Pass `orderId` (finds the order's or table's invoice)
 * or `invoiceId`.
 */
export const InvoiceDialog = ({ storeId, orderId, invoiceId, startWithCorporate = false, onClose, onChanged, asPage = false }) => {
  const open = Boolean(orderId || invoiceId);
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('view'); // 'view' | 'corporate'
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [notice, setNotice] = useState('');
  const docRef = useRef(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = orderId
        ? await api.get(`/stores/${storeId}/orders/${orderId}/invoice`)
        : await api.get(`/stores/${storeId}/invoices/${invoiceId}`);
      setInvoice(res.data.data);
      setEmailTo(res.data.data.billTo?.email || '');
    } catch (err) {
      setError(errorText(err, 'Could not load the invoice'));
    }
  }, [storeId, orderId, invoiceId]);

  useEffect(() => {
    if (!open) return;
    setInvoice(null);
    setNotice('');
    setFormError('');
    setMode(startWithCorporate ? 'corporate' : 'view');
    load();
  }, [open, load, startWithCorporate]);

  if (!open) return null;

  const issueCorporate = async (payload) => {
    setBusy(true);
    setFormError('');
    try {
      const res = await api.post(`/stores/${storeId}/invoices/${invoice.id}/corporate`, payload);
      setInvoice(res.data.data);
      setEmailTo(res.data.data.billTo?.email || '');
      setMode('view');
      setNotice(`Corporate invoice ${res.data.data.number} issued${payload.sendEmail ? ' and emailed' : ''}. The previous bill was cancelled with a credit note.`);
      onChanged?.(res.data.data);
    } catch (err) {
      setFormError(errorText(err, 'Could not issue the corporate invoice'));
    } finally {
      setBusy(false);
    }
  };

  const sendEmail = async () => {
    setBusy(true);
    setNotice('');
    try {
      await api.post(`/stores/${storeId}/invoices/${invoice.id}/email`, { email: emailTo });
      setNotice(`Emailed to ${emailTo}`);
    } catch (err) {
      setNotice(errorText(err, 'Email failed'));
    } finally {
      setBusy(false);
    }
  };

  const canConvert = invoice && invoice.status === 'ISSUED' && invoice.kind !== 'CREDIT_NOTE';

  return (
    <div className={asPage ? "w-full max-w-3xl" : "fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"} {...(asPage ? {} : { role: "dialog", "aria-modal": "true" })} aria-label="Invoice">
      <div className={`w-full flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden ${asPage ? "rounded-2xl" : "sm:max-w-3xl max-h-[94vh] rounded-t-3xl sm:rounded-2xl"}`}>
        <div className="px-5 py-3 flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">{mode === 'corporate' ? 'Corporate invoice' : invoice ? `${invoice.kind === 'CREDIT_NOTE' ? 'Credit note' : 'Invoice'} ${invoice.number}` : 'Invoice'}</h2>
            {invoice && mode === 'view' && (
              <p className="text-xs text-zinc-500">
                {invoice.kind === 'CORPORATE' ? `Billed to ${invoice.billTo?.name}` : invoice.kind === 'CREDIT_NOTE' ? 'Reverses an earlier invoice' : 'Regular bill'}
                {invoice.status === 'CANCELLED' ? ' · Cancelled' : ''}
              </p>
            )}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"><Cancel01Icon size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-900 dark:text-amber-200 flex gap-2">
              <Alert01Icon size={16} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}
          {!invoice && !error && <div className="h-40 flex items-center justify-center text-zinc-400"><Loading03Icon size={22} className="animate-spin" /></div>}

          {invoice && mode === 'corporate' && (
            <CorporateForm storeId={storeId} busy={busy} error={formError} onSubmit={issueCorporate} onBack={() => setMode('view')} />
          )}

          {invoice && mode === 'view' && (
            <div className="flex flex-col gap-3">
              {notice && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckmarkCircle02Icon size={15} /> {notice}
                </div>
              )}
              {invoice.snapshot?.supplier && !invoice.snapshot.supplier.gstinValid && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                  Your brand GSTIN is {invoice.snapshot.supplier.gstin ? 'not valid' : 'missing'}, so this prints as a plain bill. Fix it under Brand Setup.
                </div>
              )}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <InvoiceDocument ref={docRef} invoice={invoice} />
              </div>
            </div>
          )}
        </div>

        {invoice && mode === 'view' && (
          <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => printReceipt(docRef.current)}><PrinterIcon size={15} className="mr-1.5" /> Print / PDF</Button>
            <div className="flex items-center gap-1">
              <input
                type="email"
                value={emailTo}
                onChange={e => setEmailTo(e.target.value)}
                placeholder="Email address"
                aria-label="Email address"
                className="h-8 w-48 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 text-xs outline-none"
              />
              <Button variant="outline" size="sm" disabled={busy || !emailTo.trim()} onClick={sendEmail}><Mail01Icon size={15} className="mr-1.5" /> Email</Button>
            </div>
            {canConvert && (
              <Button size="sm" className="ml-auto" onClick={() => { setFormError(''); setMode('corporate'); }}>
                <Building02Icon size={15} className="mr-1.5" /> {invoice.kind === 'CORPORATE' ? 'Change company details' : 'Corporate invoice'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
