/**
 * Minimal fixed-window rate limiter (in-memory, per process).
 * Good enough to stop brute force on small public endpoints like table PIN checks.
 */
const { createHttpError } = require("../middleware/error-handler");

function rateLimit({ windowMs, max, keyFn, message = "Too many attempts. Please wait and try again." }) {
  const hits = new Map(); // key -> { count, resetAt }

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, Math.max(windowMs, 60_000));
  if (sweep.unref) sweep.unref();

  return (req, _res, next) => {
    const key = keyFn ? keyFn(req) : req.ip;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return next(createHttpError(429, message, { retryAfterSeconds: retryAfter }));
    }
    next();
  };
}

module.exports = { rateLimit };
