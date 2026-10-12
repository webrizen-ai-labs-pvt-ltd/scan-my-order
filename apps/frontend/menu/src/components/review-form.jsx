import React, { useState } from 'react';
import { Loading03Icon, LinkSquare02Icon } from 'hugeicons-react';

const WORDS = ['', 'Poor', 'Not great', 'Okay', 'Good', 'Loved it'];

const Star = ({ filled, size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9L12 2.6z"
      className={filled ? 'fill-amber-400 stroke-amber-500' : 'fill-transparent stroke-zinc-300 dark:stroke-zinc-600'}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

/** Five stars, read-only (used as decoration next to a figure or label) */
export const StarRow = ({ value = 0, size = 18 }) => (
  <span className="flex shrink-0" aria-hidden="true">{[1, 2, 3, 4, 5].map(n => <Star key={n} filled={n <= value} size={size} />)}</span>
);

/** Five stars to tap. Tapping the current value again clears it when `clearable`. */
const Stars = ({ value, onChange, size = 36, label, clearable = false }) => (
  <div role="radiogroup" aria-label={label} className="flex items-center gap-1">
    {[1, 2, 3, 4, 5].map(n => (
      <button
        key={n}
        type="button"
        role="radio"
        aria-checked={value === n}
        aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
        onClick={() => onChange(clearable && value === n ? 0 : n)}
        className="rounded-md p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-90 transition-transform"
      >
        <Star filled={n <= value} size={size} />
      </button>
    ))}
  </div>
);

/** A dish's average on the menu, e.g. "★ 4.3 (27)". Rendered only when the server sends a rating. */
export const DishRating = ({ rating, count }) => (rating ? (
  <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300" title={`Rated ${rating} out of 5 by ${count} guests`}>
    <Star filled size={13} /> {rating.toFixed(1)} <span className="font-normal text-zinc-400">({count})</span>
  </span>
) : null);

/**
 * The rating form: overall stars (required), stars per dish and a comment (both optional).
 * Used in the menu's sheet and on the page behind the QR printed on a bill.
 *
 * @param {object} props
 * @param {React.ElementType} [props.Title] Heading element (a sheet passes its own title component)
 * @param {string} props.subheading e.g. "Table 4 at Northern Lights Cafe"
 * @param {Array<{ menuItemId: string, name: string }>} props.dishes
 * @param {(payload: { rating: number, comment?: string, items: object[] }) => Promise<object>} props.send Saves it; may throw
 * @param {(result: object, rating: number) => void} props.onDone
 * @param {(err: any) => boolean} [props.onError] Return true when the error was handled (no message shown)
 * @param {() => void} [props.onLater] Shows a "Not now" button
 */
export const ReviewForm = ({ Title = 'h1', subheading, dishes, send, onDone, onError, onLater }) => {
  const [rating, setRating] = useState(0);
  const [dishRatings, setDishRatings] = useState({});
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!rating || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await send({
        rating,
        comment: comment.trim() || undefined,
        items: Object.entries(dishRatings).filter(([, value]) => value > 0).map(([menuItemId, value]) => ({ menuItemId, rating: value })),
      });
      onDone(result, rating);
    } catch (err) {
      if (!onError?.(err)) setError(err?.response?.data?.error?.message || err?.response?.data?.message || 'Could not save your rating. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <Title className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50">How was your order?</Title>
        <p className="text-sm text-zinc-500">{subheading}</p>
      </div>

      <div className="flex flex-col items-center gap-1">
        <Stars value={rating} onChange={setRating} label="Overall rating" />
        <span className="h-5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">{WORDS[rating]}</span>
      </div>

      {dishes.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">Rate the dishes <span className="font-normal normal-case">(optional)</span></p>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {dishes.map(dish => (
              <li key={dish.menuItemId} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-sm text-zinc-900 dark:text-zinc-100">{dish.name}</span>
                <Stars
                  size={24}
                  clearable
                  label={`Rate ${dish.name}`}
                  value={dishRatings[dish.menuItemId] || 0}
                  onChange={(value) => setDishRatings(prev => ({ ...prev, [dish.menuItemId]: value }))}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="text-xs font-bold uppercase tracking-wide text-zinc-500">
        Anything to add? <span className="font-normal normal-case">(optional, only the restaurant sees this)</span>
        <textarea
          rows={2}
          maxLength={500}
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="What did you like, or what went wrong?"
          className="mt-1.5 w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-zinc-900 outline-none focus:border-amber-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </label>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={!rating || busy}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-amber-400 text-[15px] font-bold text-zinc-950 disabled:opacity-50"
        >
          {busy ? <Loading03Icon size={18} className="animate-spin" /> : rating ? 'Send rating' : 'Tap a star to rate'}
        </button>
        {onLater && <button type="button" onClick={onLater} disabled={busy} className="h-9 text-sm font-semibold text-zinc-500">Not now</button>}
      </div>
    </div>
  );
};

/**
 * Shown after rating. Every guest is offered the Google review link, whatever they scored.
 *
 * @param {object} props
 * @param {number} [props.rating] What they just gave (absent when they come back to a bill already rated)
 */
export const ReviewThanks = ({ Title = 'h1', rating, googleReviewUrl, place, onClose }) => (
  <div className="flex flex-col items-center text-center gap-3">
    {rating ? <StarRow value={rating} size={26} /> : null}
    <Title className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50">Thank you!</Title>
    <p className="text-sm text-zinc-500">
      {!rating ? `This bill has already been rated. Thanks for telling ${place} how it was.`
        : rating <= 2 ? `We’re sorry it wasn’t right. The manager at ${place} has been told.`
          : `Your rating helps ${place} and other guests.`}
    </p>
    {googleReviewUrl && (
      <div className="mt-1 w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Would you share it on Google too?</p>
        <p className="mt-0.5 text-xs text-zinc-500">An honest review there helps other people decide.</p>
        <a
          href={googleReviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-zinc-900 text-sm font-bold text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Review on Google <LinkSquare02Icon size={15} />
        </a>
      </div>
    )}
    {onClose && <button type="button" onClick={onClose} className="mt-1 text-sm font-semibold text-zinc-500 underline underline-offset-2">Close</button>}
  </div>
);
