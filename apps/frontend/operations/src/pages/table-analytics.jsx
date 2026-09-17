import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import {
  Badge,
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DateRangePicker,
} from '@smo/ui';
import {
  Analytics01Icon,
  Store01Icon,
  Clock01Icon,
  Money01Icon,
  Download01Icon,
  Search01Icon,
  Loading03Icon,
  AlertCircleIcon,
  ArrowRight01Icon,
  DiningTableIcon,
  ChartBarLineIcon,
  ZapIcon,
  Xls01Icon,
  Pdf01Icon,
} from 'hugeicons-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const TIER_CONFIG = {
  TOP_EARNER: {
    label: 'Top Earner',
    badgeClass:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  },
  HIGH_TURNOVER: {
    label: 'High Turnover',
    badgeClass:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
  },
  LONG_DWELL: {
    label: 'Long Dwell',
    badgeClass:
      'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900',
  },
  BALANCED: {
    label: 'Balanced',
    badgeClass:
      'bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
  },
  UNDERUTILIZED: {
    label: 'Underutilized',
    badgeClass:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  },
};

const LABEL_CLASS =
  'mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300';

const CONTROL_CLASS =
  'h-10 rounded-md border-zinc-300 bg-white text-sm focus-visible:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-900';

const SECTION_TITLE_CLASS =
  'mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500';

const KPI_CELL_CLASS =
  'flex flex-col justify-between bg-white p-4 dark:bg-zinc-900';

export const TableAnalytics = () => {
  const { user } = useAuthStore();
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState('ALL');
  const [datePreset, setDatePreset] = useState('30d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Filters & Sorting
  const [capacityFilter, setCapacityFilter] = useState('ALL');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('revenue_desc');
  const [viewMode, setViewMode] = useState('cards');

  // Data & UI State
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inspectTable, setInspectTable] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    api
      .get('/stores')
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data.data)) {
          setStores(res.data.data);
        }
      })
      .catch((err) =>
        console.error('Failed to load stores for analytics:', err)
      );
  }, []);

  const getDateRangeParams = useCallback(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date(now);

    if (datePreset === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (datePreset === 'yesterday') {
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (datePreset === '7d') {
      start.setDate(now.getDate() - 7);
    } else if (datePreset === '30d') {
      start.setDate(now.getDate() - 30);
    } else if (datePreset === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (datePreset === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (datePreset === 'custom') {
      if (customStartDate) start = new Date(customStartDate);
      if (customEndDate) {
        end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
      }
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, [datePreset, customStartDate, customEndDate]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { startDate, endDate } = getDateRangeParams();
      const params = { storeId: selectedStoreId, startDate, endDate };
      const res = await api.get('/analytics/tables', { params });
      if (res.data?.success) {
        setAnalytics(res.data.data);
      } else {
        setError(res.data?.message || 'Failed to load table analytics');
      }
    } catch (err) {
      console.error('Error fetching table analytics:', err);
      if (err.response?.status === 403) {
        setError(
          'Access denied. Table Analytics is strictly reserved for Tenant Administrators.'
        );
      } else {
        setError(
          err.response?.data?.message ||
            'An error occurred while fetching table analytics.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, getDateRangeParams]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const filteredTables = useMemo(() => {
    if (!analytics?.tables) return [];

    return analytics.tables
      .filter((table) => {
        if (capacityFilter === '2' && table.capacity !== 2) return false;
        if (capacityFilter === '4' && table.capacity !== 4) return false;
        if (capacityFilter === '6' && table.capacity !== 6) return false;
        if (capacityFilter === '8+' && table.capacity < 8) return false;

        if (tierFilter !== 'ALL' && table.performanceTier !== tierFilter)
          return false;

        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const matchNumber =
            `table ${table.tableNumber}`.toLowerCase().includes(query) ||
            `${table.tableNumber}`.includes(query);
          const matchStore = (table.storeName || '')
            .toLowerCase()
            .includes(query);
          const matchTier = (table.performanceTier || '')
            .toLowerCase()
            .includes(query);
          if (!matchNumber && !matchStore && !matchTier) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'revenue_desc') return b.totalRevenue - a.totalRevenue;
        if (sortBy === 'turnover_desc') return b.turnoverRate - a.turnoverRate;
        if (sortBy === 'dwell_desc') return b.avgDwellMinutes - a.avgDwellMinutes;
        if (sortBy === 'revpash_desc') return b.revpash - a.revpash;
        if (sortBy === 'orders_desc') return b.totalOrders - a.totalOrders;
        if (sortBy === 'table_asc') return a.tableNumber - b.tableNumber;
        return 0;
      });
  }, [analytics?.tables, capacityFilter, tierFilter, searchQuery, sortBy]);

  const hourlyData = useMemo(() => {
    return (
      analytics?.hourlyDistribution ||
      analytics?.summary?.hourlyDistribution ||
      []
    );
  }, [analytics]);

  const storeBreakdownData = useMemo(() => {
    return (
      analytics?.storeBreakdown || analytics?.summary?.storeBreakdown || []
    );
  }, [analytics]);

  const dateRangeData = useMemo(() => {
    return (
      analytics?.dateRange ||
      analytics?.period || {
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
      }
    );
  }, [analytics]);

  const totalBrandTablesCount = useMemo(() => {
    if (
      analytics?.summary?.totalTables != null &&
      analytics.summary.totalTables > 0
    ) {
      return analytics.summary.totalTables;
    }
    return stores.reduce((sum, s) => {
      const count =
        s._count?.tables ??
        (storeBreakdownData.find((sb) => sb.storeId === s.id)?.tablesCount ||
          0);
      return sum + count;
    }, 0);
  }, [analytics?.summary?.totalTables, stores, storeBreakdownData]);

  const peakHour = useMemo(() => {
    if (!hourlyData || hourlyData.length === 0) return null;
    const sorted = [...hourlyData].sort((a, b) => b.orderCount - a.orderCount);
    return sorted[0]?.orderCount > 0 ? sorted[0] : null;
  }, [hourlyData]);

  const handleSelectPreset = (presetId) => {
    setDatePreset(presetId);
    if (presetId === 'custom' && (!customStartDate || !customEndDate)) {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 30);
      setCustomStartDate(start.toISOString().slice(0, 10));
      setCustomEndDate(end.toISOString().slice(0, 10));
    }
  };

  // ---------- Export: Excel ----------
  const handleExportExcel = () => {
    if (!analytics?.tables) return;
    setIsExporting(true);

    try {
      const brandName = user?.tenant?.name || 'Brand';
      const timestamp = new Date().toISOString().slice(0, 10);
      const storeScope =
        selectedStoreId === 'ALL'
          ? 'All_Stores'
          : (
              stores.find((s) => s.id === selectedStoreId)?.name || 'Store'
            ).replace(/\s+/g, '_');

      const tableRows = filteredTables.map((t) => ({
        'Table #': t.tableNumber,
        Store: t.storeName,
        'Capacity (Seats)': t.capacity,
        'Performance Tier':
          TIER_CONFIG[t.performanceTier]?.label || t.performanceTier,
        'Total Revenue (₹)': t.totalRevenue,
        'Orders Count': t.totalOrders,
        'Dine-in Sessions': t.totalSessions,
        'AOV (₹)': t.aov,
        'Turnover (Sessions/Day)': t.turnoverRate,
        'Avg Dwell Time (Mins)': t.avgDwellMinutes,
        'RevPASH (₹/Seat-Hour)': t.revpash,
        'Cash Revenue (₹)': t.cashRevenue,
        'Online Revenue (₹)': t.onlineRevenue,
        'Waiter Calls': t.waiterCallsCount,
        Reservations: t.totalReservations,
        'No-Show Reservations': t.noShowReservations,
      }));

      const wsTables = XLSX.utils.json_to_sheet(tableRows);
      wsTables['!cols'] = [
        { wch: 10 },
        { wch: 22 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
        { wch: 16 },
        { wch: 12 },
        { wch: 24 },
        { wch: 22 },
        { wch: 24 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 20 },
      ];

      const summary = analytics.summary || {};
      const summaryRows = [
        { Metric: 'Brand Name', Value: brandName },
        {
          Metric: 'Store Scope',
          Value:
            selectedStoreId === 'ALL'
              ? 'All Brand Stores'
              : stores.find((s) => s.id === selectedStoreId)?.name ||
                selectedStoreId,
        },
        {
          Metric: 'Period Range',
          Value: `${new Date(
            dateRangeData.startDate
          ).toLocaleDateString()} to ${new Date(
            dateRangeData.endDate
          ).toLocaleDateString()}`,
        },
        {
          Metric: 'Total Dine-in Revenue (₹)',
          Value: summary.totalRevenue || 0,
        },
        { Metric: 'Total Completed Orders', Value: summary.totalOrders || 0 },
        { Metric: 'Total Table Sessions', Value: summary.totalSessions || 0 },
        { Metric: 'Total Active Tables', Value: summary.totalTables || 0 },
        { Metric: 'Total Floor Seats', Value: summary.totalSeats || 0 },
        { Metric: 'Overall Brand AOV (₹)', Value: summary.overallAOV || 0 },
        {
          Metric: 'Average Table Turnover (Sessions/Day)',
          Value: summary.avgTurnoverRate || 0,
        },
        {
          Metric: 'Average Customer Dwell (Mins)',
          Value: summary.avgDwellMinutes || 0,
        },
        {
          Metric: 'Brand RevPASH (₹/Seat-Hour)',
          Value: summary.overallRevPASH || 0,
        },
        {
          Metric: 'Underutilized Tables Count',
          Value: summary.underutilizedCount || 0,
        },
        {
          Metric: 'Top Performing Table',
          Value: summary.topTable
            ? `Table ${summary.topTable.tableNumber} (${summary.topTable.storeName}) - ₹${(
                summary.topTable.revenue || 0
              ).toLocaleString('en-IN')}`
            : 'N/A',
        },
        {
          Metric: 'Report Generated At',
          Value: new Date().toLocaleString(),
        },
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      wsSummary['!cols'] = [{ wch: 38 }, { wch: 40 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');
      XLSX.utils.book_append_sheet(wb, wsTables, 'Table Intelligence');

      if (storeBreakdownData.length > 1) {
        const storeRows = storeBreakdownData.map((s) => ({
          'Store Name': s.storeName,
          'Active Tables': s.tablesCount || s.tableCount || 0,
          'Total Revenue (₹)': s.revenue || s.totalRevenue || 0,
          Orders: s.orders || s.totalOrders || s.totalSessions || 0,
          'Avg Turnover (Sessions/Day)': s.avgTurnover || 0,
          'RevPASH (₹/Seat-Hour)': s.avgRevpash || 0,
        }));
        const wsStores = XLSX.utils.json_to_sheet(storeRows);
        wsStores['!cols'] = [
          { wch: 25 },
          { wch: 15 },
          { wch: 18 },
          { wch: 12 },
          { wch: 28 },
          { wch: 24 },
        ];
        XLSX.utils.book_append_sheet(wb, wsStores, 'Store Comparison');
      }

      XLSX.writeFile(
        wb,
        `${brandName}_Table_Analytics_${storeScope}_${timestamp}.xlsx`
      );
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert('Failed to generate Excel file: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // ---------- Export: PDF ----------
  const handleExportPDF = () => {
    if (!analytics?.tables) return;
    setIsExporting(true);

    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      });
      const brandName = user?.tenant?.name || 'Brand Executive Suite';
      const summary = analytics.summary || {};
      const storeScope =
        selectedStoreId === 'ALL'
          ? 'All Brand Stores'
          : stores.find((s) => s.id === selectedStoreId)?.name || 'Store';
      const dateRangeStr = `${new Date(
        dateRangeData.startDate
      ).toLocaleDateString()} - ${new Date(
        dateRangeData.endDate
      ).toLocaleDateString()}`;

      doc.setFillColor(24, 24, 27);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 65, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(`${brandName} - Table Intelligence Report`, 40, 32);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(161, 161, 170);
      doc.text(
        `Scope: ${storeScope}   |   Date Range: ${dateRangeStr}   |   Exported: ${new Date().toLocaleString()}`,
        40,
        50
      );

      const kpis = [
        [
          'Total Revenue',
          `INR ${summary.totalRevenue.toLocaleString('en-IN')}`,
        ],
        ['Turnover Rate', `${summary.avgTurnoverRate} sess/day`],
        ['Avg Dwell Time', `${summary.avgDwellMinutes} mins`],
        ['RevPASH', `INR ${summary.overallRevPASH}/seat-hr`],
        ['Completed Orders', `${summary.totalOrders}`],
        ['Active Tables', `${summary.totalTables} (${summary.totalSeats} seats)`],
      ];

      autoTable(doc, {
        head: [kpis.map((k) => k[0])],
        body: [kpis.map((k) => k[1])],
        startY: 80,
        theme: 'plain',
        headStyles: {
          fillColor: [244, 244, 245],
          textColor: [113, 113, 122],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center',
        },
        bodyStyles: {
          fillColor: [250, 250, 250],
          textColor: [24, 24, 27],
          fontStyle: 'bold',
          fontSize: 11,
          halign: 'center',
        },
        styles: { cellPadding: 8 },
      });

      const tableData = filteredTables.map((t) => [
        `T-${t.tableNumber}`,
        t.storeName,
        `${t.capacity} seats`,
        TIER_CONFIG[t.performanceTier]?.label || t.performanceTier,
        `INR ${t.totalRevenue.toLocaleString('en-IN')}`,
        t.totalOrders,
        `${t.turnoverRate}/day`,
        `${t.avgDwellMinutes}m`,
        `INR ${t.revpash}`,
        `INR ${t.aov}`,
        `${t.waiterCallsCount}`,
      ]);

      autoTable(doc, {
        head: [
          [
            'Table',
            'Store',
            'Capacity',
            'Tier',
            'Revenue',
            'Orders',
            'Turnover',
            'Dwell',
            'RevPASH',
            'AOV',
            'Calls',
          ],
        ],
        body: tableData,
        startY: doc.lastAutoTable.finalY + 15,
        theme: 'striped',
        headStyles: {
          fillColor: [39, 39, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
        },
        bodyStyles: { fontSize: 8, textColor: [39, 39, 42] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { cellPadding: 5 },
      });

      doc.save(
        `${brandName.replace(/\s+/g, '_')}_Table_Report_${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`
      );
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Failed to generate PDF: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // ---------- Render ----------
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-end sm:justify-between dark:border-zinc-800">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              <ZapIcon size={11} />
              Executive Suite
            </span>
          </div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            <Analytics01Icon
              size={20}
              className="text-amber-600 dark:text-amber-400"
            />
            Table Analytics &amp; Revenue Yield
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            Seating turnover, dwell velocity, customer yield (RevPASH), and
            floor-space efficiency across your brand.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={loadAnalytics}
            disabled={loading}
            className="rounded-none rounded-l-full"
          >
            <Loading03Icon
              size={12}
              className={loading ? 'animate-spin' : ''}
            />
            <span>Refresh</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={isExporting || loading || !analytics}
            className="rounded-none"
          >
            <Xls01Icon size={12} />
            <span>Excel</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleExportPDF}
            disabled={isExporting || loading || !analytics}
            className="rounded-none rounded-r-full"
          >
            <Pdf01Icon size={12} />
            <span>PDF</span>
          </Button>
        </div>
      </div>

      {/* Context Switcher */}
      <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Store Scope */}
          <div className="lg:col-span-4">
            <label className={LABEL_CLASS}>
              <Store01Icon size={13} className="mr-1 inline text-zinc-400" />
              Store Scope
            </label>
            <Select
              value={selectedStoreId}
              onValueChange={setSelectedStoreId}
            >
              <SelectTrigger className={CONTROL_CLASS}>
                <SelectValue placeholder="Select Store Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-sm">
                  All Brand Stores ({totalBrandTablesCount}{' '}
                  {totalBrandTablesCount === 1 ? 'table' : 'tables'})
                </SelectItem>
                {stores.map((s) => {
                  const count =
                    s._count?.tables ??
                    (storeBreakdownData.find((sb) => sb.storeId === s.id)
                      ?.tablesCount || 0);
                  return (
                    <SelectItem key={s.id} value={s.id} className="text-sm">
                      {s.name} ({count} {count === 1 ? 'table' : 'tables'})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Period Preset + Custom Range */}
          <div className="lg:col-span-8">
            <label className={LABEL_CLASS}>Period</label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-0.5 rounded-md border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-800 dark:bg-zinc-800/50">
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: '7d', label: 'Last 7D' },
                  { id: '30d', label: 'Last 30D' },
                  { id: 'this_month', label: 'This Month' },
                  { id: 'last_month', label: 'Last Month' },
                  { id: 'custom', label: 'Custom' },
                ].map((preset) => {
                  const active = datePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`whitespace-nowrap rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700'
                          : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {datePreset === 'custom' && (
                <DateRangePicker
                  dateRange={{
                    from: customStartDate ? new Date(customStartDate) : null,
                    to: customEndDate ? new Date(customEndDate) : null,
                  }}
                  onDateRangeChange={(range) => {
                    if (range?.from) {
                      setCustomStartDate(
                        range.from.toISOString().slice(0, 10)
                      );
                    }
                    if (range?.to) {
                      setCustomEndDate(range.to.toISOString().slice(0, 10));
                    }
                  }}
                  placeholder="Select custom date range"
                  className="w-56"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 p-3.5 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircleIcon size={16} className="shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && !analytics && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-zinc-200 bg-zinc-200 sm:grid-cols-3 lg:grid-cols-5 dark:border-zinc-800 dark:bg-zinc-800">
            {[1, 2, 3, 4, 5].map((n) => (
              <Skeleton key={n} className="h-28 rounded-none" />
            ))}
          </div>
          <Skeleton className="h-44 rounded-md" />
          <Skeleton className="h-96 rounded-md" />
        </div>
      )}

      {/* Content */}
      {analytics && (
        <>
          {/* KPI Bar */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-zinc-200 bg-zinc-200 sm:grid-cols-3 lg:grid-cols-5 dark:border-zinc-800 dark:bg-zinc-800">
            {/* Revenue */}
            <div className={KPI_CELL_CLASS}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Dine-In Revenue
                </span>
                <Money01Icon
                  size={14}
                  className="shrink-0 text-emerald-600 dark:text-emerald-400"
                />
              </div>
              <div className="mt-3 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                ₹{analytics.summary.totalRevenue.toLocaleString('en-IN')}
              </div>
              <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                AOV{' '}
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  ₹{analytics.summary.overallAOV}
                </span>{' '}
                · {analytics.summary.totalOrders} orders
              </div>
            </div>

            {/* Turnover */}
            <div className={KPI_CELL_CLASS}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Turnover Velocity
                </span>
                <ChartBarLineIcon
                  size={14}
                  className="shrink-0 text-sky-600 dark:text-sky-400"
                />
              </div>
              <div className="mt-3 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {analytics.summary.avgTurnoverRate}
                <span className="ml-1 text-sm font-normal text-zinc-500">
                  sess/day
                </span>
              </div>
              <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                {analytics.summary.totalSessions} sessions ·{' '}
                {analytics.summary.totalTables} tables
              </div>
            </div>

            {/* Dwell */}
            <div className={KPI_CELL_CLASS}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Average Dwell
                </span>
                <Clock01Icon
                  size={14}
                  className="shrink-0 text-violet-600 dark:text-violet-400"
                />
              </div>
              <div className="mt-3 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {analytics.summary.avgDwellMinutes}
                <span className="ml-1 text-sm font-normal text-zinc-500">
                  mins
                </span>
              </div>
              <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                First order → bill settle
              </div>
            </div>

            {/* RevPASH */}
            <div className={KPI_CELL_CLASS}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  RevPASH
                </span>
                <ZapIcon
                  size={14}
                  className="shrink-0 text-amber-600 dark:text-amber-400"
                />
              </div>
              <div className="mt-3 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                ₹{analytics.summary.overallRevPASH}
                <span className="ml-1 text-sm font-normal text-zinc-500">
                  /seat-hr
                </span>
              </div>
              <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                Across {analytics.summary.totalSeats} floor seats
              </div>
            </div>

            {/* Top Table */}
            <div className={KPI_CELL_CLASS}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Highest Yield Table
                </span>
                <DiningTableIcon
                  size={14}
                  className="shrink-0 text-amber-600 dark:text-amber-400"
                />
              </div>
              {analytics.summary.topTable ? (
                <>
                  <div className="mt-3 truncate text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    Table {analytics.summary.topTable.tableNumber}
                  </div>
                  <div className="mt-1 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                    {analytics.summary.topTable.storeName} · ₹
                    {analytics.summary.topTable.revenue.toLocaleString('en-IN')}
                  </div>
                </>
              ) : (
                <div className="mt-3 text-sm text-zinc-400">
                  No activity in period
                </div>
              )}
            </div>
          </div>

          {/* Heatmap + Store Breakdown */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Heatmap */}
            <div className="rounded-md border border-zinc-200 bg-white lg:col-span-2 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    <Clock01Icon
                      size={14}
                      className="text-amber-600 dark:text-amber-400"
                    />
                    Hourly Table Demand
                  </h3>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    Order concentration by hour of day (00:00 – 23:00)
                  </p>
                </div>
                {peakHour && (
                  <Badge
                    variant="outline"
                    className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    Peak: {peakHour.hour}:00 ({peakHour.orderCount} orders)
                  </Badge>
                )}
              </div>
              <div className="px-5 py-5">
                <div
                  className="flex h-32 items-end gap-1 pt-6"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(24, minmax(0, 1fr))',
                  }}
                >
                  {hourlyData.map((slot) => {
                    const maxOrders = Math.max(
                      ...hourlyData.map((s) => s.orderCount),
                      1
                    );
                    const heightPercent = Math.max(
                      Math.round((slot.orderCount / maxOrders) * 100),
                      4
                    );
                    const isPeak = peakHour && slot.hour === peakHour.hour;

                    return (
                      <div
                        key={slot.hour}
                        className="group relative flex h-full flex-col items-center justify-end gap-1"
                      >
                        <div className="pointer-events-none absolute -top-9 z-20 whitespace-nowrap rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-black">
                          {slot.hour}:00 · {slot.orderCount} orders (₹
                          {slot.revenue.toLocaleString('en-IN')})
                        </div>
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-t transition-colors ${
                            isPeak
                              ? 'bg-amber-400 group-hover:bg-amber-500'
                              : slot.orderCount > 0
                              ? 'bg-zinc-700 group-hover:bg-zinc-900 dark:bg-zinc-500 dark:group-hover:bg-zinc-300'
                              : 'bg-zinc-100 dark:bg-zinc-800/50'
                          }`}
                        />
                        <span className="text-[9px] text-zinc-400">
                          {slot.hour % 4 === 0 ? `${slot.hour}h` : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Store Breakdown */}
            <div className="rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  <Store01Icon
                    size={14}
                    className="text-emerald-600 dark:text-emerald-400"
                  />
                  Store Breakdown
                </h3>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Performance across brand locations
                </p>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {storeBreakdownData.map((s) => (
                  <div
                    key={s.storeId}
                    className="px-5 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {s.storeName}
                      </span>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                        ₹{(s.revenue || s.totalRevenue || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span>
                        {s.tablesCount || s.tableCount || 0} tables ·{' '}
                        {s.orders || 0} orders
                      </span>
                      <span className="tabular-nums">
                        Turnover {s.avgTurnover || 0}/day
                      </span>
                    </div>
                  </div>
                ))}
                {storeBreakdownData.length === 0 && (
                  <div className="px-5 py-6 text-center text-xs text-zinc-400">
                    No store data in period
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                {/* Search */}
                <div className="flex-1">
                  <label className={LABEL_CLASS}>Search</label>
                  <div className="relative">
                    <Search01Icon
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                    />
                    <Input
                      type="text"
                      placeholder="Table #, store, or tier…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`${CONTROL_CLASS} pl-9`}
                    />
                  </div>
                </div>

                {/* Capacity */}
                <div className="w-full sm:w-40">
                  <label className={LABEL_CLASS}>Capacity</label>
                  <Select
                    value={capacityFilter}
                    onValueChange={setCapacityFilter}
                  >
                    <SelectTrigger className={CONTROL_CLASS}>
                      <SelectValue placeholder="Capacity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-sm">
                        All Capacities
                      </SelectItem>
                      <SelectItem value="2" className="text-sm">
                        2 Seater
                      </SelectItem>
                      <SelectItem value="4" className="text-sm">
                        4 Seater
                      </SelectItem>
                      <SelectItem value="6" className="text-sm">
                        6 Seater
                      </SelectItem>
                      <SelectItem value="8+" className="text-sm">
                        8+ Seater
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Tier */}
                <div className="w-full sm:w-44">
                  <label className={LABEL_CLASS}>Performance Tier</label>
                  <Select value={tierFilter} onValueChange={setTierFilter}>
                    <SelectTrigger className={CONTROL_CLASS}>
                      <SelectValue placeholder="Performance Tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-sm">
                        All Tiers
                      </SelectItem>
                      <SelectItem value="TOP_EARNER" className="text-sm">
                        Top Earners
                      </SelectItem>
                      <SelectItem value="HIGH_TURNOVER" className="text-sm">
                        High Turnover
                      </SelectItem>
                      <SelectItem value="LONG_DWELL" className="text-sm">
                        Long Dwell
                      </SelectItem>
                      <SelectItem value="BALANCED" className="text-sm">
                        Balanced
                      </SelectItem>
                      <SelectItem value="UNDERUTILIZED" className="text-sm">
                        Underutilized
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort */}
                <div className="w-full sm:w-56">
                  <label className={LABEL_CLASS}>Sort By</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className={CONTROL_CLASS}>
                      <SelectValue placeholder="Sort By" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="revenue_desc" className="text-sm">
                        Revenue: High → Low
                      </SelectItem>
                      <SelectItem value="turnover_desc" className="text-sm">
                        Turnover: High → Low
                      </SelectItem>
                      <SelectItem value="revpash_desc" className="text-sm">
                        RevPASH: High → Low
                      </SelectItem>
                      <SelectItem value="dwell_desc" className="text-sm">
                        Dwell: High → Low
                      </SelectItem>
                      <SelectItem value="orders_desc" className="text-sm">
                        Orders: High → Low
                      </SelectItem>
                      <SelectItem value="table_asc" className="text-sm">
                        Table Number (Asc)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* View Toggle */}
                <div className="shrink-0">
                  <label className={LABEL_CLASS}>View</label>
                  <div className="flex items-center rounded-md border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-800 dark:bg-zinc-800/50">
                    <button
                      type="button"
                      onClick={() => setViewMode('cards')}
                      className={`whitespace-nowrap rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        viewMode === 'cards'
                          ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700'
                          : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                      }`}
                    >
                      Cards
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('table')}
                      className={`whitespace-nowrap rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        viewMode === 'table'
                          ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700'
                          : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                      }`}
                    >
                      Table
                    </button>
                  </div>
                </div>
              </div>

              {/* Filter summary */}
              <div className="flex items-center justify-between border-t border-zinc-100 pt-3 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <span>
                  Showing {filteredTables.length} of {analytics.tables.length}{' '}
                  tables
                </span>
                {(capacityFilter !== 'ALL' ||
                  tierFilter !== 'ALL' ||
                  searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCapacityFilter('ALL');
                      setTierFilter('ALL');
                      setSearchQuery('');
                    }}
                    className="font-medium text-amber-700 hover:underline dark:text-amber-400"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Results */}
          {filteredTables.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-zinc-200 bg-white px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
                <DiningTableIcon size={24} />
              </div>
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                No tables match your filter
              </h3>
              <p className="mt-1 max-w-sm text-xs text-zinc-500 dark:text-zinc-400">
                Try widening your date range, adjusting the tier filter, or
                clearing search criteria.
              </p>
            </div>
          ) : viewMode === 'cards' ? (
            /* Cards View */
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredTables.map((t) => {
                const tier =
                  TIER_CONFIG[t.performanceTier] || TIER_CONFIG.BALANCED;
                const totalRev = t.cashRevenue + t.onlineRevenue;
                const onlinePercent =
                  totalRev > 0
                    ? Math.round((t.onlineRevenue / totalRev) * 100)
                    : 0;

                return (
                  <div
                    key={t.tableId}
                    className="flex flex-col overflow-hidden rounded-md border border-zinc-200 bg-white transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                  >
                    {/* Card header */}
                    <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-xs font-semibold tabular-nums text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                          {t.tableNumber}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            Table {t.tableNumber}
                          </div>
                          <div className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                            {t.storeName}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`shrink-0 px-1.5 py-0.5 text-[10px] font-medium ${tier.badgeClass}`}
                      >
                        {tier.label}
                      </Badge>
                    </div>

                    {/* Card body */}
                    <div className="flex-1 space-y-3 p-4">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                          ₹{t.totalRevenue.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {t.capacity} seats
                        </span>
                      </div>

                      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-md border border-zinc-100 bg-zinc-50/60 p-2.5 text-[11px] dark:border-zinc-800 dark:bg-zinc-800/30">
                        <div>
                          <dt className="text-[10px] text-zinc-400">
                            Turnover
                          </dt>
                          <dd className="font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                            {t.turnoverRate}/day
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-zinc-400">RevPASH</dt>
                          <dd className="font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                            ₹{t.revpash}/hr
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-zinc-400">
                            Avg Dwell
                          </dt>
                          <dd className="font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                            {t.avgDwellMinutes}m
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-zinc-400">Orders</dt>
                          <dd className="font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                            {t.totalOrders} · ₹{t.aov}
                          </dd>
                        </div>
                      </dl>

                      {totalRev > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-zinc-400">
                            <span>Cash ₹{t.cashRevenue}</span>
                            <span>Online ₹{t.onlineRevenue}</span>
                          </div>
                          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-emerald-500/20">
                            <div
                              style={{ width: `${100 - onlinePercent}%` }}
                              className="h-full bg-emerald-500"
                            />
                            <div
                              style={{ width: `${onlinePercent}%` }}
                              className="h-full bg-sky-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card footer */}
                    <div className="border-t border-zinc-100 p-3 dark:border-zinc-800">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setInspectTable(t)}
                        className="h-8 w-full rounded-md border-zinc-300 text-xs font-medium dark:border-zinc-700"
                      >
                        Deep Breakdown
                        <ArrowRight01Icon size={13} className="ml-1.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Table
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Store
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Capacity
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Tier
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Revenue
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Turnover
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        RevPASH
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Dwell
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Orders
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        AOV
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Calls / Res
                      </th>
                      <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredTables.map((t) => {
                      const tier =
                        TIER_CONFIG[t.performanceTier] || TIER_CONFIG.BALANCED;
                      return (
                        <tr
                          key={t.tableId}
                          className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                        >
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                            Table {t.tableNumber}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-300">
                            {t.storeName}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-300">
                            {t.capacity} seats
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <Badge
                              variant="outline"
                              className={`px-1.5 py-0.5 text-[10px] font-medium ${tier.badgeClass}`}
                            >
                              {tier.label}
                            </Badge>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                            ₹{t.totalRevenue.toLocaleString('en-IN')}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                            {t.turnoverRate}/day
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                            ₹{t.revpash}/hr
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-300">
                            {t.avgDwellMinutes}m
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-300">
                            {t.totalOrders}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-300">
                            ₹{t.aov}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-500 dark:text-zinc-400">
                            {t.waiterCallsCount} / {t.totalReservations}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setInspectTable(t)}
                              className="h-7 rounded-md px-2.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                              Inspect
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Inspect Dialog */}
      {inspectTable && (
        <Dialog
          open={!!inspectTable}
          onOpenChange={() => setInspectTable(null)}
        >
          <DialogContent className="max-w-2xl rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <DialogHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <DialogTitle className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    <DiningTableIcon
                      size={18}
                      className="text-amber-600 dark:text-amber-400"
                    />
                    Table {inspectTable.tableNumber} Deep Dive
                  </DialogTitle>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Store:{' '}
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                      {inspectTable.storeName}
                    </span>{' '}
                    · Capacity {inspectTable.capacity} seats
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={`shrink-0 px-1.5 py-0.5 text-[10px] font-medium ${
                    TIER_CONFIG[inspectTable.performanceTier]?.badgeClass ||
                    TIER_CONFIG.BALANCED.badgeClass
                  }`}
                >
                  {TIER_CONFIG[inspectTable.performanceTier]?.label ||
                    inspectTable.performanceTier}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-5 pt-2">
              {/* Financial & Yield */}
              <div>
                <h4 className={SECTION_TITLE_CLASS}>
                  Financial &amp; Yield Performance
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-zinc-200 p-3.5 dark:border-zinc-800">
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      Total Period Revenue
                    </span>
                    <div className="mt-1 text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                      ₹{inspectTable.totalRevenue.toLocaleString('en-IN')}
                    </div>
                    <span className="mt-1 block text-[10px] text-zinc-500 dark:text-zinc-400">
                      AOV ₹{inspectTable.aov} · {inspectTable.totalOrders}{' '}
                      orders
                    </span>
                  </div>
                  <div className="rounded-md border border-zinc-200 p-3.5 dark:border-zinc-800">
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      RevPASH (Hourly Yield)
                    </span>
                    <div className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      ₹{inspectTable.revpash}
                      <span className="ml-1 text-xs font-normal text-zinc-500">
                        /seat-hr
                      </span>
                    </div>
                    <span className="mt-1 block text-[10px] text-zinc-500 dark:text-zinc-400">
                      Capacity utilization benchmark
                    </span>
                  </div>
                </div>
              </div>

              {/* Seating Dynamics */}
              <div>
                <h4 className={SECTION_TITLE_CLASS}>
                  Seating Dynamics &amp; Customer Flow
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-md border border-zinc-200 p-2.5 text-center dark:border-zinc-800">
                    <span className="block text-[10px] text-zinc-400">
                      Turnover
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {inspectTable.turnoverRate}/day
                    </span>
                  </div>
                  <div className="rounded-md border border-zinc-200 p-2.5 text-center dark:border-zinc-800">
                    <span className="block text-[10px] text-zinc-400">
                      Avg Dwell
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {inspectTable.avgDwellMinutes}m
                    </span>
                  </div>
                  <div className="rounded-md border border-zinc-200 p-2.5 text-center dark:border-zinc-800">
                    <span className="block text-[10px] text-zinc-400">
                      Sessions
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {inspectTable.totalSessions}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment + Service */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-zinc-200 p-3.5 dark:border-zinc-800">
                  <h5 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                    Payment Breakdown
                  </h5>
                  <div className="flex justify-between py-1 text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      Cash
                    </span>
                    <span className="font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                      ₹{inspectTable.cashRevenue}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      Online / UPI
                    </span>
                    <span className="font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                      ₹{inspectTable.onlineRevenue}
                    </span>
                  </div>
                </div>

                <div className="rounded-md border border-zinc-200 p-3.5 dark:border-zinc-800">
                  <h5 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                    Service &amp; Reservations
                  </h5>
                  <div className="flex justify-between py-1 text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      Waiter Calls
                    </span>
                    <span className="font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                      {inspectTable.waiterCallsCount}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      Reservations
                    </span>
                    <span className="font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                      {inspectTable.totalReservations} (
                      {inspectTable.noShowReservations} no-show)
                    </span>
                  </div>
                </div>
              </div>

              {/* Recommendation */}
              <div className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50/60 p-3.5 text-xs dark:border-amber-900/50 dark:bg-amber-950/20">
                <ZapIcon
                  size={14}
                  className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                />
                <div className="space-y-0.5 text-amber-900 dark:text-amber-200">
                  <span className="block font-semibold">
                    Executive Floor Recommendation
                  </span>
                  <span className="block leading-snug">
                    {inspectTable.performanceTier === 'TOP_EARNER' &&
                      'This is a primary revenue driver. Maintain prime seating setup and fast clearing turnaround during lunch and dinner rushes.'}
                    {inspectTable.performanceTier === 'HIGH_TURNOVER' &&
                      'Exceptional customer turnover rate. Ideal for rapid ordering, combo specials, and quick service patron groups.'}
                    {inspectTable.performanceTier === 'LONG_DWELL' &&
                      `Customers spend extended time at this table (${inspectTable.avgDwellMinutes}m). Promote high-margin appetizers, desserts, and beverages to maximize total ticket value.`}
                    {inspectTable.performanceTier === 'UNDERUTILIZED' &&
                      'Low utilization detected. Consider checking table placement, lighting, QR visibility, or prioritizing reservations towards this table.'}
                    {inspectTable.performanceTier === 'BALANCED' &&
                      'Stable throughput and healthy dwell timing. Consistent performance across standard operating hours.'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={() => setInspectTable(null)}
                className="h-9 rounded-md bg-amber-400 px-4 text-sm font-semibold text-zinc-950 hover:bg-amber-500"
              >
                Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default TableAnalytics;