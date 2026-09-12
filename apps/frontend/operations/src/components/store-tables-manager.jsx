import React, { useCallback, useEffect, useState } from 'react';
import api from '../lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import { Card, CardContent, Button, Input, Skeleton } from '@smo/ui';
import {
  QrCodeIcon,
  Download01Icon,
  PlusSignIcon,
  Delete02Icon,
  AlertCircleIcon,
  DocumentCodeIcon,
  Loading03Icon,
  Cancel01Icon,
} from 'hugeicons-react';

const sortByNumber = (a, b) => a.tableNumber - b.tableNumber;

export const StoreTablesManager = ({ storeId, storeSlug, brandSlug }) => {
  // `tables === null` means "never loaded" → only then do we show skeletons.
  const [tables, setTables] = useState(null);
  const [error, setError] = useState('');

  // Loading flags — one per independent action so buttons only disable themselves.
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [savingCapacityId, setSavingCapacityId] = useState(null);
  const [deletingIds, setDeletingIds] = useState(() => new Set());

  // Form state
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newCapacity, setNewCapacity] = useState('4');
  const [editingTableId, setEditingTableId] = useState(null);
  const [editCapacityVal, setEditCapacityVal] = useState('4');

  /* ─────────────────────────────────────────────────────────────
     FETCH — silent mode never touches `isRefreshing`, so background
     refreshes don't cause any flicker at all.
  ───────────────────────────────────────────────────────────── */
  const fetchTables = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await api.get(`/stores/${storeId}/tables`);
      if (res.data.success) setTables(res.data.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load tables');
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, [storeId]);

  // Reset to skeleton ONLY when store changes — this is the "one skeleton per store" rule.
  useEffect(() => {
    setTables(null);
    setError('');
    fetchTables({ silent: true });
  }, [storeId, fetchTables]);

  /* ─────────────────────────────────────────────────────────────
     ADD TABLE — optimistic insert, silent revalidate on success.
  ───────────────────────────────────────────────────────────── */
  const handleAddTable = async (e) => {
    e.preventDefault();
    const parsedNumber = parseInt(newTableNumber, 10);
    const parsedCapacity = parseInt(newCapacity, 10) || 4;
    if (!parsedNumber || parsedNumber < 1) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticRow = {
      id: tempId,
      tableNumber: parsedNumber,
      capacity: parsedCapacity,
      _optimistic: true,
    };

    // Snapshot for rollback
    const previousTables = tables;

    setTables(prev => [...(prev || []), optimisticRow].sort(sortByNumber));
    setNewTableNumber('');
    setNewCapacity('4');
    setIsAddingTable(true);
    setError('');

    try {
      await api.post(`/stores/${storeId}/tables`, {
        tableNumber: parsedNumber,
        capacity: parsedCapacity,
      });
      // Silent revalidate to swap temp row → real row without any flicker.
      await fetchTables({ silent: true });
    } catch (err) {
      // Rollback and restore the form values so the user can retry.
      setTables(previousTables);
      setNewTableNumber(String(parsedNumber));
      setNewCapacity(String(parsedCapacity));
      setError(err.response?.data?.error?.message || 'Failed to add table');
    } finally {
      setIsAddingTable(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────
     EDIT CAPACITY — inline optimistic update with per-row spinner.
  ───────────────────────────────────────────────────────────── */
  const handleSaveCapacity = async (tableId) => {
    const cap = parseInt(editCapacityVal, 10);
    if (isNaN(cap) || cap < 1) return;

    const previousTables = tables;
    setSavingCapacityId(tableId);
    setEditingTableId(null);
    setError('');

    // Optimistically update the row.
    setTables(prev => prev.map(t => (t.id === tableId ? { ...t, capacity: cap } : t)));

    try {
      await api.patch(`/stores/${storeId}/tables/${tableId}`, { capacity: cap });
    } catch (err) {
      setTables(previousTables);
      setError(err.response?.data?.error?.message || 'Failed to update table capacity');
    } finally {
      setSavingCapacityId(null);
    }
  };

  /* ─────────────────────────────────────────────────────────────
     DELETE — optimistic removal (row vanishes → no spinner needed).
  ───────────────────────────────────────────────────────────── */
  const handleDelete = async (table) => {
    if (deletingIds.has(table.id)) return;
    if (!window.confirm(`Delete Table ${table.tableNumber}? This cannot be undone.`)) return;

    const previousTables = tables;
    setDeletingIds(prev => {
      const next = new Set(prev);
      next.add(table.id);
      return next;
    });
    setError('');
    setTables(prev => prev.filter(t => t.id !== table.id));

    try {
      await api.delete(`/stores/${storeId}/tables/${table.id}`);
    } catch (err) {
      setTables(previousTables);
      setError(err.response?.data?.error?.message || 'Failed to delete table');
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(table.id);
        return next;
      });
    }
  };

  /* ─────────────────────────────────────────────────────────────
     QR / PDF (unchanged logic, kept intact)
  ───────────────────────────────────────────────────────────── */
  const getQRUrl = (tableNumber) => {
    const domain =
      window.location.hostname === 'localhost'
        ? 'http://localhost:5173'
        : 'https://menu.scanmyorder.com';
    return `${domain}/${brandSlug}/${storeSlug}?table=${tableNumber}`;
  };

  const getCanvasForTable = (tableNumber) => {
    return new Promise((resolve) => {
      const svg = document.getElementById(`qr-${tableNumber}`);
      if (!svg) return resolve(null);
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      const logo = new Image();
      logo.crossOrigin = 'anonymous';

      img.onload = () => {
        canvas.width = img.width + 80;
        canvas.height = img.height + 140;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'black';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Scan to Order', canvas.width / 2, 40);
        ctx.font = 'bold 28px Arial';
        ctx.fillText(`Table ${tableNumber}`, canvas.width / 2, 80);

        ctx.drawImage(img, 40, 100);

        logo.onload = () => {
          const logoSize = 40;
          const qrX = 40;
          const qrY = 100;
          const qrSize = img.width;
          const logoX = qrX + qrSize / 2 - logoSize / 2;
          const logoY = qrY + qrSize / 2 - logoSize / 2;

          ctx.fillStyle = 'white';
          ctx.fillRect(logoX - 2, logoY - 2, logoSize + 4, logoSize + 4);

          ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
          resolve(canvas.toDataURL('image/png'));
        };
        logo.onerror = () => resolve(canvas.toDataURL('image/png'));
        logo.src = '/logo.svg';
      };

      img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
    });
  };

  const downloadAllQRsAsPDF = async () => {
    setIsGeneratingPDF(true);
    setError('');
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();

      const qrWidth = 80;
      const qrHeight = 100;
      const cols = 2;
      const margin = (pageWidth - qrWidth * cols) / (cols + 1);
      const topMargin = 20;

      let x = margin;
      let y = topMargin;
      let qrsOnPage = 0;

      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        const dataUrl = await getCanvasForTable(table.tableNumber);

        if (dataUrl) {
          pdf.addImage(dataUrl, 'PNG', x, y, qrWidth, qrHeight);
          qrsOnPage++;

          if (qrsOnPage % 2 === 0) {
            x = margin;
            y += qrHeight + 10;
          } else {
            x += qrWidth + margin;
          }

          if (qrsOnPage === 4 && i < tables.length - 1) {
            pdf.addPage();
            qrsOnPage = 0;
            x = margin;
            y = topMargin;
          }
        }
      }

      pdf.save(`${storeSlug}-table-qrs.pdf`);
    } catch (err) {
      console.error(err);
      setError('Failed to generate PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const downloadQR = async (tableNumber) => {
    const pngFile = await getCanvasForTable(tableNumber);
    if (!pngFile) return;
    const downloadLink = document.createElement('a');
    downloadLink.download = `table-${tableNumber}-qr.png`;
    downloadLink.href = pngFile;
    downloadLink.click();
  };

  /* ─────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────── */
  const isInitialLoading = tables === null;

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            Tables & QR Codes
            {isRefreshing && !isInitialLoading && (
              <Loading03Icon
                size={14}
                className="animate-spin text-zinc-400"
                aria-label="Refreshing"
              />
            )}
          </h3>
          <p className="text-sm text-zinc-500">
            Manage your tables and print QR codes for dine-in ordering.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {!isInitialLoading && tables.length > 0 && (
            <Button
              variant="link"
              onClick={downloadAllQRsAsPDF}
              disabled={isGeneratingPDF}
              aria-busy={isGeneratingPDF}
            >
              {isGeneratingPDF ? (
                <>
                  <Loading03Icon size={16} className="animate-spin" /> Generating PDF…
                </>
              ) : (
                <>
                  <DocumentCodeIcon size={16} /> Bulk Export PDF
                </>
              )}
            </Button>
          )}

          <form onSubmit={handleAddTable} className="flex items-center gap-1.5">
            <Input
              type="number"
              min="1"
              placeholder="Table No."
              value={newTableNumber}
              onChange={(e) => setNewTableNumber(e.target.value)}
              disabled={isAddingTable}
              className="w-24 h-9 text-xs rounded-l-full border-y border-l border-zinc-500/20"
              required
            />
            <Input
              type="number"
              min="1"
              max="40"
              placeholder="Seats"
              value={newCapacity}
              onChange={(e) => setNewCapacity(e.target.value)}
              disabled={isAddingTable}
              className="w-20 h-9 text-xs rounded-none border-y border-zinc-500/20"
              title="Seating Capacity"
              required
            />
            <Button
              type="submit"
              disabled={isAddingTable || !newTableNumber}
              size="sm"
              className="h-9 rounded-l-none"
              aria-busy={isAddingTable}
            >
              {isAddingTable ? (
                <Loading03Icon size={15} className="mr-1 animate-spin" />
              ) : (
                <PlusSignIcon size={15} className="mr-1" />
              )}
              {isAddingTable ? 'Adding…' : 'Add Table'}
            </Button>
          </form>
        </div>
      </div>

      {/* ── Error banner (dismissible) ── */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md border border-red-100 dark:border-red-900/40"
        >
          <AlertCircleIcon size={16} className="shrink-0" />
          <span className="flex-1 min-w-0">{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            aria-label="Dismiss error"
            className="shrink-0 rounded p-0.5 hover:bg-red-100 dark:hover:bg-red-900/40"
          >
            <Cancel01Icon size={14} />
          </button>
        </div>
      )}

      {/* ── Body ── */}
      {isInitialLoading ? (
        // Skeleton is ONLY rendered on the very first load for this store.
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : tables.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl">
          <QrCodeIcon size={48} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
          <h4 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No tables yet</h4>
          <p className="text-sm text-zinc-500">
            Add a table number above to generate your first QR code.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {tables.map(table => {
            const isSavingCap = savingCapacityId === table.id;
            const isOptimistic = table._optimistic === true;

            return (
              <Card
                key={table.id}
                className={`border-zinc-200 dark:border-zinc-800 text-center flex flex-col group transition-opacity ${isOptimistic ? 'opacity-70' : 'opacity-100'
                  }`}
              >
                <CardContent className="p-6 flex-1 flex flex-col items-center justify-between gap-4">
                  <div className="w-full flex justify-between items-start">
                    <div className="text-left">
                      <h4 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 leading-tight">
                        Table {table.tableNumber}
                      </h4>

                      {editingTableId === table.id ? (
                        <div className="flex items-center gap-1 mt-1.5">
                          <Input
                            type="number"
                            min="1"
                            max="40"
                            value={editCapacityVal}
                            onChange={(e) => setEditCapacityVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveCapacity(table.id);
                              if (e.key === 'Escape') setEditingTableId(null);
                            }}
                            disabled={isSavingCap}
                            className="w-14 h-6 text-xs px-1 py-0"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveCapacity(table.id)}
                            disabled={isSavingCap}
                            className="text-[11px] bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed text-zinc-900 px-2 py-0.5 rounded font-semibold inline-flex items-center gap-1"
                          >
                            {isSavingCap && <Loading03Icon size={11} className="animate-spin" />}
                            {isSavingCap ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTableId(null)}
                            disabled={isSavingCap}
                            className="text-[11px] text-zinc-400 hover:text-zinc-600 disabled:opacity-50 px-1"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTableId(table.id);
                            setEditCapacityVal(String(table.capacity || 4));
                          }}
                          disabled={isSavingCap || isOptimistic}
                          className="text-[11px] inline-flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-60 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded-full font-medium transition-colors mt-1"
                          title="Click to edit seating capacity"
                        >
                          <span>{table.capacity || 4} Seats</span>
                          <span className="text-zinc-400 text-[9px]">✎</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(table)}
                      disabled={isOptimistic}
                      className="text-zinc-400 hover:text-red-500 disabled:opacity-30 disabled:pointer-events-none opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1"
                      title="Delete Table"
                      aria-label={`Delete Table ${table.tableNumber}`}
                    >
                      <Delete02Icon size={18} />
                    </button>
                  </div>

                  <div className="bg-white p-3 rounded-xl shadow-sm border border-zinc-100 mx-auto relative">
                    <QRCodeSVG
                      id={`qr-${table.tableNumber}`}
                      value={getQRUrl(table.tableNumber)}
                      size={140}
                      level="L"
                      includeMargin={false}
                      imageSettings={{
                        src: '/logo.png',
                        x: undefined,
                        y: undefined,
                        height: 20,
                        width: 20,
                        opacity: 1,
                        excavate: true,
                      }}
                    />
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => downloadQR(table.tableNumber)}
                    disabled={isOptimistic}
                  >
                    <Download01Icon size={14} className="mr-1.5" />
                    Download QR
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};