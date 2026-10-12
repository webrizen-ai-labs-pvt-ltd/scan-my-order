import React, { useCallback, useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@smo/ui';
import api from '../lib/api';
import { getSessionId } from '../lib/session';
import { ReviewForm, ReviewThanks, StarRow } from './review-form';

const laterKey = (storeId) => `smo_review_later_${storeId}`;
const visitKey = (orderIds) => [...orderIds].sort().join(',');

/**
 * Invites a guest to rate their visit once their food has been served: overall stars, stars for
 * each dish and an optional comment, then (for everyone) a link to review the restaurant on Google.
 * Shows as a slim strip in the page; the sheet opens by itself the first time and from the strip after "Not now".
 *
 * @param {{ storeId: string, storeName?: string }} props
 */
export const ReviewPrompt = ({ storeId, storeName }) => {
  const [pending, setPending] = useState(null); // { orderIds, dishes, tableNumber }
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(null); // { rating, googleReviewUrl }
  const place = storeName || 'this restaurant';

  const check = useCallback(async () => {
    try {
      const res = await api.get(`/public/stores/${storeId}/reviews/pending`, { params: { sessionId: getSessionId() } });
      const data = res.data.data;
      if (!data?.enabled || data.orderIds.length === 0) { setPending(null); return; }
      setPending(data);
      // Open by itself once per visit; after "Not now" the strip stays instead
      let later = null;
      try { later = localStorage.getItem(laterKey(storeId)); } catch { /* private mode */ }
      if (later !== visitKey(data.orderIds)) setOpen(true);
    } catch {
      /* rating is optional: never get in the way of ordering */
    }
  }, [storeId]);

  useEffect(() => {
    check();
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    window.addEventListener('smo:order-finished', check);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('smo:order-finished', check);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check]);

  const close = () => {
    if (pending && !done) {
      try { localStorage.setItem(laterKey(storeId), visitKey(pending.orderIds)); } catch { /* private mode */ }
    }
    setOpen(false);
    if (done) { setDone(null); setPending(null); }
  };

  if (!pending) return null;

  return (
    <>
      {!open && !done && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-2.5 text-left dark:border-amber-500/30 dark:bg-amber-500/10"
        >
          <span>
            <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-50">How was your order?</span>
            <span className="block text-xs text-zinc-600 dark:text-zinc-400">Rate it in a few seconds</span>
          </span>
          <StarRow />
        </button>
      )}

      <Sheet open={open} onOpenChange={(next) => { if (!next) close(); }}>
        <SheetContent side="bottom" className="w-full sm:max-w-md mx-auto max-h-[90vh] overflow-y-auto p-6 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-t-3xl">
          {done ? (
            <ReviewThanks Title={SheetTitle} rating={done.rating} googleReviewUrl={done.googleReviewUrl} place={place} onClose={close} />
          ) : (
            <ReviewForm
              Title={SheetTitle}
              subheading={pending.tableNumber ? `Table ${pending.tableNumber} at ${place}` : place}
              dishes={pending.dishes}
              send={async (payload) => (await api.post(`/public/stores/${storeId}/reviews`, { sessionId: getSessionId(), ...payload })).data.data}
              onDone={(result, rating) => setDone({ rating, googleReviewUrl: result?.googleReviewUrl || null })}
              onError={(err) => {
                // Rated from another tab or phone in the meantime: nothing left to do
                if (err?.response?.status !== 409) return false;
                setOpen(false);
                setPending(null);
                return true;
              }}
              onLater={close}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};
