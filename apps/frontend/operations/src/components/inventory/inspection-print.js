import { amount, dayAndTime, fullDay, lotDeadline, qty } from './inv-format';
import { rangeText } from './inv-checks';
import { licenceDeadline } from './inv-licences';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const dash = (value) => (value === null || value === undefined || value === '' ? '—' : esc(value));
const dayName = (day) => new Date(`${day}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

const table = (head, rows, empty) => (rows.length === 0
  ? `<p class="none">${esc(empty)}</p>`
  : `<table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`);

/** The inspection pack as a plain document, ready to print or save as a PDF */
export function inspectionPackHtml(pack) {
  const { store } = pack;
  const hygieneRows = pack.hygiene.days.flatMap(d => (d.entries.length === 0
    ? [[esc(dayName(d.day)), '<b>Nothing recorded</b>', '', '', '']]
    : d.entries.map((e, i) => [
      i === 0 ? `${esc(dayName(d.day))}<br><span class="dim">${d.done} of ${d.expected} done</span>` : '',
      esc(e.name),
      e.kind === 'TEMPERATURE' ? `${esc(qty(e.value))} °C <span class="dim">(${esc(rangeText(e))})</span>` : '',
      e.ok ? 'Fine' : '<b>Problem</b>',
      [e.note ? esc(e.note) : '', `<span class="dim">${dash(e.actorName)}</span>`].filter(Boolean).join('<br>'),
    ])));

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Food safety records · ${esc(store.name)}</title>
    <style>
      @page { margin: 14mm; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; margin: 0; }
      h1 { font-size: 18px; margin: 0 0 2px; }
      h2 { font-size: 13px; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 1.5px solid #000; break-after: avoid; }
      p { margin: 2px 0; }
      .dim { color: #555; }
      .none { color: #555; font-style: italic; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; vertical-align: top; padding: 3px 6px 3px 0; border-bottom: 0.5px solid #bbb; }
      th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #000; }
      tr { break-inside: avoid; }
      .sign { margin-top: 28px; display: flex; gap: 40px; }
      .sign div { flex: 1; border-top: 1px solid #000; padding-top: 3px; }
    </style>
  </head>
  <body>
    <h1>${esc(store.name)}: food safety records</h1>
    <p>${[store.brand, store.address, store.phone].filter(Boolean).map(esc).join(' · ')}</p>
    <p class="dim">${[store.registrationNumber ? `Registration ${esc(store.registrationNumber)}` : '', store.gstin ? `GSTIN ${esc(store.gstin)}` : ''].filter(Boolean).join(' · ')}</p>
    <p class="dim">Records from ${esc(fullDay(pack.since))} to ${esc(fullDay(pack.generatedAt))} (${pack.days} days) · prepared ${esc(dayAndTime(pack.generatedAt))}${pack.generatedBy ? ` by ${esc(pack.generatedBy)}` : ''}</p>

    <h2>1. Licences and certificates</h2>
    ${table(['Licence', 'Number', 'Issued by', 'Validity'], pack.licences.map(l => [esc(l.name), dash(l.number), dash(l.issuedBy), esc(licenceDeadline(l)) + (l.expiresOn ? ` <span class="dim">(${esc(fullDay(l.expiresOn))})</span>` : '')]), 'No licences on record.')}

    <h2>2. Suppliers</h2>
    ${table(['Supplier', 'FSSAI licence number', 'GSTIN', 'Phone'], pack.suppliers.map(s => [esc(s.name), dash(s.fssaiNumber), dash(s.gstin), dash(s.phone)]), 'No suppliers on record.')}

    <h2>3. Stock on the shelves today</h2>
    ${table(['Ingredient', 'Quantity', 'Use by', 'Received', 'Supplier', 'Bill'], pack.stock.flatMap(m => (m.lots.length === 0
    ? [[esc(m.name), esc(amount(m.stock, m.unit)), '—', '—', '—', '—']]
    : m.lots.map((l, i) => [i === 0 ? esc(m.name) : '', esc(amount(l.remaining, m.unit)), l.state === 'EXPIRED' ? `<b>${esc(lotDeadline(l))}</b>` : esc(lotDeadline(l)), l.kind === 'RECEIVED' ? esc(fullDay(l.receivedAt)) : 'Before records began', dash(l.supplierName), dash(l.billNumber)]))), 'Nothing in stock.')}

    <h2>4. Deliveries received</h2>
    ${table(['Received', 'Supplier', 'Bill', 'Items and use-by dates', 'Received by'], pack.deliveries.map(d => [
    esc(dayAndTime(d.receivedAt)), dash(d.supplierName), dash(d.billNumber),
    d.lines.map(l => `${esc(l.name)} ${esc(amount(l.quantity, l.unit))}${l.expiresAt ? ` <span class="dim">(use by ${esc(fullDay(l.expiresAt))})</span>` : ''}`).join('<br>'),
    dash(d.receivedByName),
  ]), 'No deliveries in this period.')}

    <h2>5. Food thrown away</h2>
    ${table(['When', 'Ingredient', 'Quantity', 'Reason', 'Recorded by'], pack.wastage.map(w => [esc(dayAndTime(w.at)), esc(w.name), esc(amount(w.quantity, w.unit)), dash(w.reason), dash(w.actorName)]), 'Nothing recorded as thrown away in this period.')}

    <h2>6. Daily hygiene checks</h2>
    ${table(['Day', 'Check', 'Reading', 'Result', 'Action taken · checked by'], hygieneRows, 'No hygiene checks recorded in this period.')}

    <div class="sign"><div>Prepared by (name and signature)</div><div>Date</div></div>
  </body>
</html>`;
}

/** Prints the inspection pack through a hidden frame, so only the document is printed */
export function printInspectionPack(pack) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(inspectionPackHtml(pack));
  doc.close();
  const win = iframe.contentWindow;
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } finally {
      setTimeout(() => iframe.remove(), 1000);
    }
  }, 250);
}
