import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Skeleton, AnimatedThemeToggler } from '@smo/ui';
import api from '../lib/api';
import { getSessionId } from '../lib/session';
import { ReviewForm, ReviewThanks } from '../components/review-form';

const Message = ({ title, children }) => (
  <div className="flex flex-col items-center text-center gap-2 py-6">
    <h1 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50">{title}</h1>
    <p className="text-sm text-zinc-500 max-w-xs">{children}</p>
  </div>
);

/**
 * /rate/:token — the page behind the small QR printed on a bill. Guests who ordered at the
 * counter or through a waiter rate here: the code on their bill is what identifies the order.
 */
export const RateBillPage = () => {
  const { token } = useParams();
  const [bill, setBill] = useState(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // { rating, googleReviewUrl }

  useEffect(() => {
    let cancelled = false;
    api.get(`/public/reviews/bill/${encodeURIComponent(token)}`)
      .then(res => { if (!cancelled) setBill(res.data.data); })
      .catch(err => { if (!cancelled) setError(err?.response?.data?.error?.message || err?.response?.data?.message || 'This rating link could not be opened. Please scan the code on your bill again.'); });
    return () => { cancelled = true; };
  }, [token]);

  const place = bill?.storeName || 'the restaurant';

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {bill?.logo && <img src={bill.logo} alt="" className="size-10 shrink-0 rounded-full border border-zinc-200 object-cover dark:border-zinc-800" />}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">{bill?.brandName || bill?.storeName || 'Scan My Order'}</p>
            {bill?.brandName && bill.brandName !== bill.storeName && <p className="truncate text-xs text-zinc-500">{bill.storeName}</p>}
          </div>
        </div>
        <AnimatedThemeToggler className="!size-8 shrink-0" />
      </header>

      <main className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        {error ? (
          <Message title="We couldn’t open this">{error}</Message>
        ) : !bill ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : done ? (
          <ReviewThanks rating={done.rating} googleReviewUrl={done.googleReviewUrl} place={place} />
        ) : bill.state === 'DONE' ? (
          <ReviewThanks googleReviewUrl={bill.googleReviewUrl} place={place} />
        ) : bill.state === 'WAIT' ? (
          <Message title="Not just yet">Your order is still being prepared. Scan this code again once your food has arrived to tell us how it was.</Message>
        ) : bill.state === 'CLOSED' ? (
          <Message title="Rating is closed">This bill can no longer be rated. Thank you for visiting {place}.</Message>
        ) : (
          <ReviewForm
            subheading={bill.tableNumber ? `Table ${bill.tableNumber} at ${place}` : place}
            dishes={bill.dishes}
            send={async (payload) => (await api.post(`/public/reviews/bill/${encodeURIComponent(token)}`, { sessionId: getSessionId(), ...payload })).data.data}
            onDone={(result, rating) => setDone({ rating, googleReviewUrl: result?.googleReviewUrl || null })}
          />
        )}
      </main>
    </div>
  );
};
