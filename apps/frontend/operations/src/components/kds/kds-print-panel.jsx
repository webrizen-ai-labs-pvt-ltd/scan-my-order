import React, { useEffect, useRef, useState } from 'react';
import { PrinterIcon, Cancel01Icon } from 'hugeicons-react';
import { printKitchenTicket, sampleOrder } from '../../lib/kitchen-ticket';

/**
 * KDS print settings for this device: auto-print, paper width, test print and catching up
 * on tickets that came in while this screen was off. Dropdown under the header's Print button.
 */
export const KdsPrintPanel = ({ settings, onChange, unprinted, storeName, onPrintUnprinted, onClose }) => {
  const [showSetup, setShowSetup] = useState(false);
  const ref = useRef(null);

  // Close on outside click or Escape
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  return (
    <div ref={ref} role="dialog" aria-label="Ticket printing" className="absolute right-0 top-full mt-2 z-30 w-[380px] rounded-2xl border border-zinc-700 bg-zinc-900 text-zinc-100 shadow-2xl">
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-zinc-800">
        <div>
          <div className="text-base font-bold">Kitchen tickets</div>
          <div className="text-xs text-zinc-400">Settings for this screen only.</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-md text-zinc-400 hover:text-white"><Cancel01Icon size={16} /></button>
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">
        {/* Auto-print */}
        <label className="flex items-start justify-between gap-4 cursor-pointer">
          <span>
            <span className="block text-sm font-bold">Auto-print new orders</span>
            <span className="block text-xs text-zinc-400">A ticket prints as soon as an order reaches the kitchen.</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.autoPrint}
            onClick={() => onChange({ autoPrint: !settings.autoPrint })}
            className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${settings.autoPrint ? 'bg-green-500' : 'bg-zinc-700'}`}
          >
            <span className={`absolute top-1 size-5 rounded-full bg-white transition-transform ${settings.autoPrint ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </label>

        {/* Paper */}
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-bold">Paper width</span>
          <div className="flex items-center gap-0.5 rounded-lg border border-zinc-700 p-0.5" role="radiogroup" aria-label="Paper width">
            {[80, 58].map(w => (
              <button key={w} type="button" role="radio" aria-checked={settings.paper === w} onClick={() => onChange({ paper: w })}
                className={`px-3 py-1 rounded-md text-xs font-bold ${settings.paper === w ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:text-white'}`}>
                {w} mm
              </button>
            ))}
          </div>
        </div>

        {unprinted.length > 0 && (
          <div className="rounded-xl border border-amber-700/60 bg-amber-950/40 px-3 py-2.5 flex items-center justify-between gap-3">
            <span className="text-xs text-amber-200">{unprinted.length} ticket{unprinted.length === 1 ? '' : 's'} on the board {unprinted.length === 1 ? 'hasn’t' : 'haven’t'} been printed here.</span>
            <button type="button" onClick={onPrintUnprinted} className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500 text-zinc-950 text-xs font-black hover:bg-amber-400">
              Print {unprinted.length}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => printKitchenTicket(sampleOrder(), { storeName, paper: settings.paper, test: true })}
          className="h-10 rounded-xl border border-zinc-700 text-sm font-bold flex items-center justify-center gap-2 hover:bg-zinc-800"
        >
          <PrinterIcon size={16} /> Test print
        </button>

        {/* Silent printing setup */}
        <div className="rounded-xl bg-zinc-950 border border-zinc-800">
          <button type="button" onClick={() => setShowSetup(v => !v)} aria-expanded={showSetup} className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-300 flex items-center justify-between">
            Print without the dialog (kitchen PC setup)
            <span className="text-zinc-500">{showSetup ? '−' : '+'}</span>
          </button>
          {showSetup && (
            <ol className="px-4 pb-3 text-xs text-zinc-400 list-decimal list-inside space-y-1.5">
              <li>Install the thermal printer’s Windows driver and <strong className="text-zinc-200">set it as the default printer</strong> (Settings → Bluetooth & devices → Printers).</li>
              <li>In the printer’s <em>Printing preferences</em>, pick the <strong className="text-zinc-200">{settings.paper} mm</strong> roll paper size.</li>
              <li>
                Make a Chrome shortcut on the desktop, open its <em>Properties</em>, and add this to the end of <em>Target</em>:
                <code className="mt-1 block rounded bg-zinc-800 px-2 py-1 font-mono text-[11px] text-zinc-200 select-all">--kiosk-printing</code>
              </li>
              <li>Close every Chrome window, open Chrome from that shortcut and sign in to this KDS.</li>
              <li>Turn on <strong className="text-zinc-200">Auto-print</strong> above and press <strong className="text-zinc-200">Test print</strong>: it should print with no dialog.</li>
              <li className="text-zinc-500">No printer yet? Set “Microsoft Print to PDF” as default to see each ticket as a PDF.</li>
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};
