/**
 * Prints just the receipt markup through a hidden iframe (window.print() would print the whole POS).
 * @param {HTMLElement|null} node Rendered <Receipt> element
 */
export function printReceipt(node) {
  if (!node) return;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`<!doctype html>
<html>
  <head>
    <title>Receipt</title>
    <style>
      body { font-family: monospace; font-size: 14px; margin: 0; padding: 20px; }
      .flex { display: flex; } .justify-between { justify-content: space-between; }
      .text-center { text-align: center; } .text-right { text-align: right; }
      .font-bold { font-weight: bold; } .text-xl { font-size: 1.25rem; }
      .text-lg { font-size: 1.125rem; } .text-base { font-size: 1rem; }
      .mb-4 { margin-bottom: 1rem; } .mb-2 { margin-bottom: 0.5rem; } .mb-1 { margin-bottom: 0.25rem; }
      .pb-2 { padding-bottom: 0.5rem; } .pt-2 { padding-top: 0.5rem; } .pt-1 { padding-top: 0.25rem; }
      .pl-2 { padding-left: 0.5rem; } .pr-2 { padding-right: 0.5rem; }
      .uppercase { text-transform: uppercase; } .border-b { border-bottom: 1px dashed black; }
      .border-t { border-top: 1px dashed black; }
      .flex-1 { flex: 1; } .w-10 { width: 2.5rem; } .w-16 { width: 4rem; }
      .text-xs { font-size: 0.75rem; } .mt-1 { margin-top: 0.25rem; }
      .tracking-wider { letter-spacing: 0.05em; }
    </style>
  </head>
  <body>${node.innerHTML}</body>
</html>`);
  doc.close();

  const win = iframe.contentWindow;
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } finally {
      setTimeout(() => iframe.remove(), 300);
    }
  }, 250);
}
