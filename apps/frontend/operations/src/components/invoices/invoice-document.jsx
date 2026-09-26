import React from 'react';

// Inline styles on purpose: the invoice is printed by copying its HTML into a blank frame.
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const S = {
  page: { fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 12, color: '#111', background: '#fff', padding: 24, maxWidth: 760, margin: '0 auto', lineHeight: 1.45 },
  row: { display: 'flex', justifyContent: 'space-between', gap: 16 },
  muted: { color: '#555' },
  h1: { fontSize: 18, fontWeight: 700, margin: 0 },
  box: { border: '1px solid #d4d4d8', borderRadius: 6, padding: 10, flex: 1 },
  label: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: '#71717a', marginBottom: 4 },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 14 },
  th: { textAlign: 'left', padding: '6px 6px', borderBottom: '1px solid #a1a1aa', fontSize: 11 },
  td: { padding: '5px 6px', borderBottom: '1px solid #e4e4e7', verticalAlign: 'top' },
  num: { textAlign: 'right', whiteSpace: 'nowrap' },
  stamp: { border: '1px solid #b91c1c', color: '#b91c1c', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11 },
};

const CHANNEL = { CASH: 'Cash', UPI_OFFLINE: 'UPI', RAZORPAY: 'Online (UPI/Card)' };

/**
 * GST invoice / credit note, rendered from the frozen snapshot saved when it was issued.
 */
export const InvoiceDocument = React.forwardRef(({ invoice }, ref) => {
  if (!invoice) return null;
  const s = invoice.snapshot || {};
  const sup = s.supplier || {};
  const b = invoice.billTo;
  const isCreditNote = invoice.kind === 'CREDIT_NOTE';
  const isTaxInvoice = sup.gstinValid !== false && sup.gstin;
  const title = isCreditNote ? 'Credit Note' : isTaxInvoice ? 'Tax Invoice' : 'Bill';

  return (
    <div ref={ref} style={S.page}>
      <div style={S.row}>
        <div>
          <div style={S.h1}>{sup.legalName}</div>
          {sup.tradeName && sup.tradeName !== sup.legalName && <div>{sup.tradeName}</div>}
          {(sup.registeredAddress || sup.outlet?.address) && <div style={S.muted}>{sup.registeredAddress || sup.outlet?.address}</div>}
          {sup.outlet?.name && <div style={S.muted}>Outlet: {sup.outlet.name}{sup.outlet.phone ? ` · ${sup.outlet.phone}` : ''}</div>}
          <div>GSTIN: <strong>{sup.gstin || '—'}</strong>{sup.stateName ? ` · ${sup.stateName} (${sup.stateCode})` : ''}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ ...S.h1, fontSize: 16 }}>{title}</div>
          <div><strong>{invoice.number}</strong></div>
          <div style={S.muted}>{new Date(invoice.issuedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          {invoice.relatedNumber && <div style={S.muted}>{isCreditNote ? 'Against' : 'Replaces'} {invoice.relatedNumber}</div>}
          {invoice.status === 'CANCELLED' && <div style={{ marginTop: 4 }}><span style={S.stamp}>CANCELLED</span></div>}
        </div>
      </div>

      <div style={{ ...S.row, marginTop: 14 }}>
        {b ? (
          <div style={S.box}>
            <div style={S.label}>Bill to</div>
            <div><strong>{b.name}</strong></div>
            {b.address && <div>{b.address}</div>}
            {b.gstin && <div>GSTIN: <strong>{b.gstin}</strong>{b.stateName ? ` · ${b.stateName} (${b.stateCode})` : ''}</div>}
            {b.employeeName && <div>Attn: {b.employeeName}{b.employeeId ? ` (${b.employeeId})` : ''}</div>}
          </div>
        ) : (
          <div style={S.box}>
            <div style={S.label}>Bill to</div>
            <div>Walk-in guest</div>
          </div>
        )}
        <div style={S.box}>
          <div style={S.label}>Details</div>
          {s.placeOfSupply && <div>Place of supply: {s.placeOfSupply.name} ({s.placeOfSupply.code})</div>}
          {s.tableNumber != null && <div>Table: {s.tableNumber}</div>}
          {b?.poNumber && <div>PO / Ref: {b.poNumber}</div>}
          {b?.costCenter && <div>Cost centre: {b.costCenter}</div>}
          {b?.guests && <div>Guests: {b.guests}</div>}
          {b?.purpose && <div>Purpose: {b.purpose}</div>}
          {isCreditNote && s.creditNoteReason && <div>Reason: {s.creditNoteReason}</div>}
        </div>
      </div>

      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>#</th>
            <th style={S.th}>Description</th>
            <th style={S.th}>SAC</th>
            <th style={{ ...S.th, ...S.num }}>Qty</th>
            <th style={{ ...S.th, ...S.num }}>Rate</th>
            <th style={{ ...S.th, ...S.num }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {(s.lines || []).map((l, i) => (
            <tr key={i}>
              <td style={S.td}>{i + 1}</td>
              <td style={S.td}>{l.name}</td>
              <td style={S.td}>{l.sac}</td>
              <td style={{ ...S.td, ...S.num }}>{l.quantity}</td>
              <td style={{ ...S.td, ...S.num }}>{money(l.rate)}</td>
              <td style={{ ...S.td, ...S.num }}>{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ ...S.table, width: 320, marginLeft: 'auto' }}>
        <tbody>
          <tr><td style={S.td}>Subtotal</td><td style={{ ...S.td, ...S.num }}>{money(s.subTotal)}</td></tr>
          {s.discount > 0 && <tr><td style={S.td}>Discount</td><td style={{ ...S.td, ...S.num }}>−{money(s.discount)}</td></tr>}
          {s.storeCredits > 0 && <tr><td style={S.td}>Store credits</td><td style={{ ...S.td, ...S.num }}>−{money(s.storeCredits)}</td></tr>}
          <tr><td style={S.td}>Taxable value</td><td style={{ ...S.td, ...S.num }}>{money(s.taxableValue)}</td></tr>
          {(s.taxes || []).map(t => (
            <tr key={t.name}><td style={S.td}>{t.name} @ {t.rate}%</td><td style={{ ...S.td, ...S.num }}>{money(t.amount)}</td></tr>
          ))}
          <tr>
            <td style={{ ...S.td, fontWeight: 700, borderBottom: '2px solid #111' }}>{isCreditNote ? 'Credit total' : 'Total'}</td>
            <td style={{ ...S.td, ...S.num, fontWeight: 700, borderBottom: '2px solid #111' }}>{money(s.totalAmount)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: 8 }}><strong>{s.amountInWords}</strong></div>
      {(s.payments || []).length > 0 && (
        <div style={{ ...S.muted, marginTop: 6 }}>
          {isCreditNote ? 'Refunded by: ' : 'Paid by: '}
          {s.payments.map(p => `${CHANNEL[p.channel] || p.channel} ${money(Math.abs(p.amount))}`).join(' · ')}
        </div>
      )}
      <div style={{ ...S.muted, marginTop: 18, fontSize: 10 }}>
        {isTaxInvoice ? `This is a computer-generated ${title.toLowerCase()} and does not need a signature.` : 'The supplier GSTIN is missing or invalid, so this is not a tax invoice.'}
      </div>
    </div>
  );
});
InvoiceDocument.displayName = 'InvoiceDocument';
