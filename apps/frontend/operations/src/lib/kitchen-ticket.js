/**
 * Kitchen order tickets (KOT) for thermal printers.
 *
 * Printing goes through the browser: a hidden frame holding the ticket calls print(). In normal
 * Chrome that shows the print dialog; started with --kiosk-printing it prints straight to the
 * default printer with no dialog, which is how the kitchen PC prints automatically.
 */

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TYPE_LABEL = { DINE_IN: 'Dine-in', TAKEAWAY: 'Takeaway', DELIVERY: 'Delivery' };
const SOURCE_LABEL = { POS: 'Counter', QR_MENU: 'QR menu' };

/** Paper widths and the printable area inside them */
export const PAPER = {
  80: { page: '80mm', body: '72mm', title: '30px', item: '17px', text: '13px' },
  58: { page: '58mm', body: '50mm', title: '24px', item: '15px', text: '12px' },
};

function timeLabel(date) {
  return new Date(date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/**
 * Full HTML document for one ticket.
 * @param {object} order KDS order (items, table, type, origin, staff, createdAt)
 * @param {{ storeName?: string, paper?: 58|80, reprint?: boolean, test?: boolean }} opts
 */
export function kitchenTicketHtml(order, { storeName = '', paper = 80, reprint = false, test = false } = {}) {
  const p = PAPER[paper] || PAPER[80];
  const where = order.table
    ? `TABLE ${order.table.tableNumber}`
    : order.pickupNumber != null ? `PICKUP #${order.pickupNumber}` : (TYPE_LABEL[order.type] || 'Order').toUpperCase();
  const items = (order.items || []).filter(i => i.status !== 'REJECTED');
  const count = items.reduce((s, i) => s + i.quantity, 0);

  const rows = items.map(i => {
    const name = i.customName || i.menuItem?.name || 'Item';
    // Black-and-white paper: say it in words
    const mark = i.menuItem?.dietary === 'NON_VEG' ? '(NV)' : i.menuItem?.dietary === 'EGG' ? '(EGG)' : '';
    const mods = (i.modifiers || []).map(m => m.modifierOption?.name).filter(Boolean);
    const ingredients = (i.customIngredients || []).map(g => `${g.name} ${g.quantity}${g.unit || ''}`);
    return `
      <div class="item">
        <div class="line"><span class="qty">${esc(i.quantity)}×</span><span class="name">${esc(name)}${mark ? ` <span class="mark">${mark}</span>` : ''}</span></div>
        ${mods.map(m => `<div class="sub">+ ${esc(m)}</div>`).join('')}
        ${ingredients.length ? `<div class="sub">Recipe: ${esc(ingredients.join(', '))}</div>` : ''}
        ${i.kitchenNotes ? `<div class="note">NOTE: ${esc(i.kitchenNotes)}</div>` : ''}
      </div>`;
  }).join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>KOT ${esc(order.id.slice(-4).toUpperCase())}</title>
<style>
  @page { size: ${p.page} auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { width: ${p.body}; margin: 0 auto; padding: 3mm 0 6mm; font-family: 'Courier New', ui-monospace, monospace; color: #000; font-size: ${p.text}; line-height: 1.25; }
  .center { text-align: center; }
  .banner { border: 2px solid #000; text-align: center; font-weight: 700; padding: 1mm 0; margin-bottom: 2mm; letter-spacing: 1px; }
  .kicker { font-size: ${p.text}; font-weight: 700; letter-spacing: 2px; }
  .where { font-size: ${p.title}; font-weight: 800; line-height: 1.1; margin: 1mm 0; }
  .meta { display: flex; justify-content: space-between; gap: 2mm; }
  .rule { border-top: 1px dashed #000; margin: 2mm 0; }
  .rule.solid { border-top: 2px solid #000; }
  .item { margin: 0 0 2.5mm; break-inside: avoid; }
  .line { display: flex; gap: 2mm; font-size: ${p.item}; font-weight: 800; }
  .qty { min-width: 8mm; }
  .name { flex: 1; word-break: break-word; }
  .mark { font-size: ${p.text}; }
  .sub { padding-left: 10mm; }
  .note { margin: 1mm 0 0 10mm; font-weight: 800; }
  .foot { display: flex; justify-content: space-between; font-weight: 700; }
</style></head>
<body>
  ${test ? '<div class="banner">TEST PRINT</div>' : reprint ? '<div class="banner">REPRINT</div>' : ''}
  <div class="center">
    <div class="kicker">KITCHEN ORDER</div>
    <div class="where">${esc(where)}</div>
    ${storeName ? `<div>${esc(storeName)}</div>` : ''}
  </div>
  <div class="rule solid"></div>
  <div class="meta"><span>#${esc(order.id.slice(-4).toUpperCase())} · ${esc(TYPE_LABEL[order.type] || order.type || '')}</span><span>${esc(SOURCE_LABEL[order.origin] || '')}</span></div>
  <div class="meta"><span>${esc(timeLabel(order.createdAt))}</span><span>${order.staff?.name ? esc(order.staff.name) : ''}</span></div>
  <div class="rule"></div>
  ${rows || '<div class="center">No items</div>'}
  <div class="rule solid"></div>
  <div class="foot"><span>${count} item${count === 1 ? '' : 's'}</span><span>${order.paidAt ? 'PAID' : ''}</span></div>
</body></html>`;
}

/* ---------- printing, one ticket at a time ---------- */

const queue = [];
let busy = false;

function printNow(html) {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(frame);
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    // Let the ticket lay out, print, then clean up; the gap keeps back-to-back tickets separate
    setTimeout(() => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } finally {
        setTimeout(() => { frame.remove(); resolve(); }, 1200);
      }
    }, 250);
  });
}

async function drain() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const job = queue.shift();
    try { await printNow(job); } catch { /* one bad ticket must not stop the rest */ }
  }
  busy = false;
}

/** Adds a ticket to the print queue */
export function printKitchenTicket(order, opts) {
  queue.push(kitchenTicketHtml(order, opts));
  drain();
}

/* ---------- what this device has already printed ---------- */

const printedKey = (storeId) => `smo_kot_printed_${storeId}`;
const KEEP_MS = 3 * 24 * 60 * 60 * 1000;

function readPrinted(storeId) {
  try {
    const map = JSON.parse(localStorage.getItem(printedKey(storeId)) || '{}');
    const now = Date.now();
    // Forget tickets older than a few days so this never grows without bound
    return Object.fromEntries(Object.entries(map).filter(([, at]) => now - at < KEEP_MS));
  } catch {
    return {};
  }
}

export function wasPrinted(storeId, orderId) {
  return Boolean(readPrinted(storeId)[orderId]);
}

export function markPrinted(storeId, orderIds) {
  const map = readPrinted(storeId);
  for (const id of [].concat(orderIds)) map[id] = Date.now();
  try { localStorage.setItem(printedKey(storeId), JSON.stringify(map)); } catch { /* storage full or blocked */ }
}

/* ---------- per-device settings ---------- */

const settingsKey = (storeId) => `smo_kot_settings_${storeId}`;

export function readPrintSettings(storeId) {
  try {
    return { autoPrint: false, paper: 80, ...JSON.parse(localStorage.getItem(settingsKey(storeId)) || '{}') };
  } catch {
    return { autoPrint: false, paper: 80 };
  }
}

export function savePrintSettings(storeId, settings) {
  try { localStorage.setItem(settingsKey(storeId), JSON.stringify(settings)); } catch { /* ignore */ }
}

/** A sample order for "Test print" */
export function sampleOrder() {
  return {
    id: 'TEST0000TEST',
    type: 'DINE_IN',
    origin: 'POS',
    table: { tableNumber: 7 },
    staff: { name: 'Test' },
    createdAt: new Date().toISOString(),
    items: [
      { quantity: 2, menuItem: { name: 'Paneer Tikka', dietary: 'VEG' }, modifiers: [{ modifierOption: { name: 'Extra mint chutney' } }] },
      { quantity: 1, menuItem: { name: 'Chicken Biryani', dietary: 'NON_VEG' }, modifiers: [], kitchenNotes: 'Less spicy, no onion' },
      { quantity: 3, menuItem: { name: 'Butter Naan', dietary: 'VEG' }, modifiers: [] },
    ],
  };
}
