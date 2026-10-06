/**
 * Indian mobile numbers without OTP: we can't prove a guest owns the number, but we can reject
 * numbers that can't exist and the obvious fakes people type to get past a form.
 *
 * Rules (TRAI numbering): 10 digits, starting 6–9. "+91", "91" and a leading "0" are accepted
 * and removed. Fakes rejected: one or two distinct digits (9999999999, 9898989898), seven or more
 * of the same digit in a row, eight or more digits counting up or down (9876543210, 9123456789),
 * a short block repeated (9876598765), and a few well-known dummy numbers.
 */

const DUMMY_NUMBERS = new Set([
  '9876543210', '9123456789', '9012345678', '9898989898', '9988776655', '9999999999',
  '8888888888', '7777777777', '6666666666', '9000000000', '8000000000', '7000000000', '6000000000',
]);

function longestRun(digits, step) {
  let best = 1;
  let run = 1;
  for (let i = 1; i < digits.length; i++) {
    run = Number(digits[i]) - Number(digits[i - 1]) === step ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

/** True when the number is a short block repeated (98765 98765, 9812 9812 98) */
function isRepeatedBlock(digits) {
  for (let size = 2; size <= 5; size++) {
    const block = digits.slice(0, size);
    if (block.repeat(Math.ceil(digits.length / size)).slice(0, digits.length) === digits) return true;
  }
  return false;
}

/**
 * @param {string} input what the guest typed
 * @returns {{ phone: string } | { error: string }} the 10-digit number, or why it was rejected
 */
export function checkIndianMobile(input) {
  let digits = String(input || '').replace(/[\s\-().]/g, '');
  if (!digits) return { error: 'Enter your mobile number' };
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return { error: 'Enter your mobile number using digits only' };
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);

  if (digits.length !== 10) return { error: 'Enter your 10-digit mobile number' };
  if (!/^[6-9]/.test(digits)) return { error: 'Indian mobile numbers start with 6, 7, 8 or 9' };

  const fake = DUMMY_NUMBERS.has(digits)
    || new Set(digits).size <= 2
    || longestRun(digits, 0) >= 7
    || longestRun(digits, 1) >= 8
    || longestRun(digits, -1) >= 8
    || isRepeatedBlock(digits);
  if (fake) return { error: "That doesn't look like a real mobile number. We'll use it to tell you when your order is ready." };

  return { phone: digits };
}

