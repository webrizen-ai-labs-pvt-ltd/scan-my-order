// GST helpers shared by the backend (invoices) and the POS (corporate invoice form).

export const GST_STATES = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
  '97': 'Other Territory',
};

// SAC for restaurant / food-serving services
export const RESTAURANT_SAC = '996331';

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Checks a GSTIN's format, state code and check digit.
 * @returns {{ valid: boolean, gstin: string, stateCode?: string, stateName?: string, error?: string }}
 */
export function validateGstin(input) {
  const gstin = String(input || '').trim().toUpperCase();
  if (!gstin) return { valid: false, gstin, error: 'GSTIN is empty' };
  if (gstin.length !== 15) return { valid: false, gstin, error: 'GSTIN must be 15 characters' };
  if (!GSTIN_PATTERN.test(gstin)) return { valid: false, gstin, error: 'GSTIN format looks wrong' };

  const stateCode = gstin.slice(0, 2);
  if (!GST_STATES[stateCode]) return { valid: false, gstin, error: `Unknown state code ${stateCode}` };

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = CHARS.indexOf(gstin[i]) * ((i % 2) + 1);
    sum += Math.floor(product / 36) + (product % 36);
  }
  const check = CHARS[(36 - (sum % 36)) % 36];
  if (check !== gstin[14]) return { valid: false, gstin, error: 'GSTIN check digit does not match — please re-check it' };

  return { valid: true, gstin, stateCode, stateName: GST_STATES[stateCode] };
}

/** Indian financial year (April–March) for a date, in IST — e.g. "25-26" */
export function financialYear(date = new Date()) {
  const ist = new Date(new Date(date).getTime() + 5.5 * 60 * 60 * 1000);
  const year = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? year : year - 1;
  return `${String(start % 100).padStart(2, '0')}-${String((start + 1) % 100).padStart(2, '0')}`;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(n) {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}

function belowThousand(n) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', rest ? belowHundred(rest) : ''].filter(Boolean).join(' ');
}

/** "Rupees One Thousand Four Hundred Sixty Seven Only" (Indian grouping: crore, lakh, thousand) */
export function rupeesInWords(amount) {
  let n = Math.round(Math.abs(Number(amount) || 0));
  if (n === 0) return 'Rupees Zero Only';
  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (n) parts.push(belowThousand(n));
  return `Rupees ${parts.join(' ')} Only`;
}
