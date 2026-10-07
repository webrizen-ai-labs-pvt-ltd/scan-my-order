import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Sheet, SheetContent, SheetTitle } from '@smo/ui';
import { Download01Icon, Loading03Icon, CheckmarkCircle02Icon } from 'hugeicons-react';
import api from '../lib/api';
import { getSessionId } from '../lib/session';

// The same upi://pay request, opened in a particular app (needed on iPhones, which have no app picker)
const APPS = [
  { name: 'GPay', scheme: 'tez://upi/pay?' },
  { name: 'PhonePe', scheme: 'phonepe://pay?' },
  { name: 'Paytm', scheme: 'paytmmp://pay?' },
];
const withScheme = (payload, scheme) => payload.replace(/^upi:\/\/pay\?/, scheme);

/** Saves the QR as a PNG, so the guest can scan it from their gallery in a UPI app */
async function saveQr(svgEl, fileName) {
  if (!svgEl) return;
  const xml = new XMLSerializer().serializeToString(svgEl);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 720, 720);
  ctx.drawImage(img, 60, 60, 600, 600);
  const a = document.createElement('a');
  a.download = fileName;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

/**
 * "Pay by UPI" for a guest order: pay the store's own UPI ID from any UPI app, then tap "I've paid".
 * A cashier confirms the money arrived before the order counts as paid.
 *
 * @param {object} props
 * @param {{ orderId: string, amount: number, qrPayload: string|null, code: string, payeeName?: string, vpa?: string, claimedAt?: string }} props.payment
 * @param {boolean} [props.cooking] the store starts cooking before confirming
 */
export const UpiPaySheet = ({ storeId, payment, cooking, onClose, onClaimed }) => {
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [claimed, setClaimed] = useState(Boolean(payment?.claimedAt));
  const qrRef = useRef(null);

  const claim = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post(`/public/stores/${storeId}/orders/${payment.orderId}/upi-paid`, {
        sessionId: getSessionId(),
        reference: reference.replace(/\s/g, '') || undefined,
      });
      setClaimed(true);
      onClaimed?.();
    } catch (err) {
      setError(err?.response?.data?.error?.message || "Couldn't reach the store. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={Boolean(payment)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="mx-auto max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border-zinc-200 bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-md dark:border-zinc-800 dark:bg-zinc-900">
        {payment && (claimed ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15">
              <Loading03Icon size={26} className="animate-spin" />
            </div>
            <SheetTitle className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50">Waiting for the store to confirm</SheetTitle>
            <p className="max-w-xs text-sm text-zinc-500">
              The cashier is checking that ₹{payment.amount} reached them. {cooking ? 'Your order is already being prepared.' : 'Your order goes to the kitchen as soon as they confirm.'}
            </p>
            <p className="text-xs text-zinc-400">Order code <span className="font-mono font-bold text-zinc-600 dark:text-zinc-300">{payment.code}</span></p>
            <button type="button" onClick={onClose} className="mt-2 rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-zinc-900">
              Done
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <SheetTitle className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50">Pay ₹{payment.amount} by UPI</SheetTitle>
              {payment.payeeName && <p className="text-sm text-zinc-500">to {payment.payeeName}{payment.vpa ? ` · ${payment.vpa}` : ''}</p>}
              <p className="mt-1 text-xs text-zinc-400">Order code <span className="font-mono font-bold text-zinc-600 dark:text-zinc-300">{payment.code}</span> (it's in the payment note)</p>
            </div>

            {payment.qrPayload ? (
              <>
                <a
                  href={payment.qrPayload}
                  className="flex h-12 items-center justify-center rounded-xl bg-emerald-600 text-base font-extrabold text-white active:scale-[0.98]"
                >
                  Pay with UPI app
                </a>
                <div className="grid grid-cols-3 gap-2">
                  {APPS.map(app => (
                    <a
                      key={app.name}
                      href={withScheme(payment.qrPayload, app.scheme)}
                      className="flex h-10 items-center justify-center rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
                    >
                      {app.name}
                    </a>
                  ))}
                </div>

                <details className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                  <summary className="cursor-pointer text-sm font-semibold text-zinc-700 dark:text-zinc-200">Paying from another phone? Show the QR</summary>
                  <div className="mt-3 flex flex-col items-center gap-2">
                    <div className="rounded-xl bg-white p-3">
                      <QRCodeSVG ref={qrRef} value={payment.qrPayload} size={200} level="M" />
                    </div>
                    <button
                      type="button"
                      onClick={() => saveQr(qrRef.current, `${payment.code}.png`)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 underline dark:text-zinc-300"
                    >
                      <Download01Icon size={14} /> Save QR (scan it from your gallery in a UPI app)
                    </button>
                  </div>
                </details>
              </>
            ) : (
              <p className="rounded-xl bg-zinc-100 p-3 text-center text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">This payment is closed. Please pay at the counter.</p>
            )}

            <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Paid? Let the store know</p>
              <label className="mt-2 block">
                <span className="text-xs text-zinc-500">UPI reference number (optional, 12 digits, from your payment app)</span>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value.replace(/[^\d\s]/g, '').slice(0, 15))}
                  inputMode="numeric"
                  placeholder="e.g. 401234567890"
                  className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 font-mono text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              {error && <p role="alert" className="mt-2 text-xs font-medium text-rose-600">{error}</p>}
              <button
                type="button"
                onClick={claim}
                disabled={busy}
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 text-base font-extrabold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
              >
                {busy ? <Loading03Icon size={18} className="animate-spin" /> : <CheckmarkCircle02Icon size={18} />} I've paid
              </button>
              <p className="mt-2 text-center text-[11px] text-zinc-400">
                {cooking ? 'Your order is being prepared. The cashier will confirm the payment.' : 'Your order goes to the kitchen once the cashier confirms the payment.'}
              </p>
            </div>
          </div>
        ))}
      </SheetContent>
    </Sheet>
  );
};
