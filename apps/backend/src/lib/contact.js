const { createHttpError } = require("../middleware/error-handler");

/** Phone/WhatsApp number: digits with an optional leading +, 10–15 digits. Empty → null. */
function cleanPhone(value, label = "phone number") {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const compact = raw.replace(/[\s()-]/g, "");
  if (!/^\+?\d{10,15}$/.test(compact)) throw createHttpError(400, `Enter a valid ${label}`);
  return compact;
}

/** Email address, lower-cased. Empty → null. */
function cleanEmail(value) {
  const email = String(value || "").trim().toLowerCase().slice(0, 120);
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw createHttpError(400, "Enter a valid email address");
  return email;
}

module.exports = { cleanPhone, cleanEmail };
