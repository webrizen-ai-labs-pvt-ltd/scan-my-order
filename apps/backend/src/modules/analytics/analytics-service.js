const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { userRoles } = require("../../constants/roles");

/**
 * Calculate Table Analytics for Tenant Admin & Super Admin
 * Supports filtering by storeId ("ALL" or specific store), date range, capacity, and sorting.
 */
async function getTableAnalytics(actor, filters = {}) {
  // 1. RBAC Check: strictly Tenant Admin and Super Admin
  const allowedRoles = [userRoles.superAdmin, userRoles.tenantAdmin];
  if (!actor || !allowedRoles.includes(actor.role)) {
    throw createHttpError(403, "Access denied. Table analytics is reserved for Tenant Administrators.");
  }

  const prisma = getPrismaClient();

  // 2. Resolve Tenant Scope
  let tenantId = actor.tenantId;
  if (actor.role === userRoles.superAdmin && filters.tenantId) {
    tenantId = filters.tenantId;
  }
  if (!tenantId && actor.role !== userRoles.superAdmin) {
    throw createHttpError(400, "Tenant context required");
  }

  // 3. Resolve Stores to analyze
  const storeWhere = tenantId ? { tenantId } : {};
  if (filters.storeId && filters.storeId !== 'ALL') {
    storeWhere.id = filters.storeId;
  }

  const stores = await prisma.store.findMany({
    where: storeWhere,
    select: { id: true, name: true, slug: true, tenantId: true }
  });

  if (stores.length === 0) {
    return {
      summary: getEmptySummary(),
      tables: [],
      hourlyDistribution: getEmptyHourly(),
      storeBreakdown: [],
      period: { startDate: null, endDate: null, daysCount: 1 }
    };
  }

  const storeIds = stores.map(s => s.id);
  const storeMap = new Map(stores.map(s => [s.id, s.name]));

  // 4. Resolve Date Range
  const { startDate: rawStart, endDate: rawEnd, period = '7d' } = filters;
  let startDate;
  let endDate = new Date();

  if (rawStart && rawEnd) {
    startDate = new Date(rawStart);
    endDate = new Date(rawEnd);
  } else {
    // Presets
    const now = new Date();
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        break;
      case 'yesterday':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case '7d':
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
    }
  }

  const daysCount = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  // Standard operating hours assumption: 14 hours / day (e.g. 10 AM to 12 Midnight)
  const operatingHoursInPeriod = daysCount * 14;

  // 5. Fetch all tables across matching stores
  const tableWhere = {
    storeId: { in: storeIds }
  };
  if (filters.capacity && filters.capacity !== 'ALL') {
    tableWhere.capacity = parseInt(filters.capacity, 10);
  }

  const rawTables = await prisma.table.findMany({
    where: tableWhere,
    select: {
      id: true,
      storeId: true,
      tableNumber: true,
      capacity: true,
      isActive: true,
      createdAt: true
    },
    orderBy: [{ storeId: 'asc' }, { tableNumber: 'asc' }]
  });

  if (rawTables.length === 0) {
    return {
      summary: getEmptySummary(),
      tables: [],
      hourlyDistribution: getEmptyHourly(),
      storeBreakdown: [],
      period: { startDate, endDate, daysCount }
    };
  }

  const tableIds = rawTables.map(t => t.id);

  // 6. Parallel fetch of Orders, Sessions, WaiterCalls, Reservations
  const [orders, sessions, waiterCalls, reservations] = await Promise.all([
    // Orders attached to these tables in the date range
    prisma.order.findMany({
      where: {
        tableId: { in: tableIds },
        createdAt: { gte: startDate, lte: endDate },
        status: { not: 'CANCELLED' }
      },
      select: {
        id: true,
        tableId: true,
        tableSessionId: true,
        storeId: true,
        status: true,
        totalAmount: true,
        paymentModel: true,
        paymentMethod: true,
        cashAmount: true,
        onlineAmount: true,
        createdAt: true,
        updatedAt: true
      }
    }),

    // Table dining sessions in the date range
    prisma.tableSession.findMany({
      where: {
        tableId: { in: tableIds },
        createdAt: { gte: startDate, lte: endDate }
      },
      select: {
        id: true,
        tableId: true,
        storeId: true,
        status: true,
        paymentMethod: true,
        cashAmount: true,
        onlineAmount: true,
        createdAt: true,
        updatedAt: true
      }
    }),

    // Waiter assistance calls
    prisma.waiterCall.findMany({
      where: {
        tableId: { in: tableIds },
        createdAt: { gte: startDate, lte: endDate }
      },
      select: {
        id: true,
        tableId: true,
        type: true,
        status: true,
        createdAt: true
      }
    }),

    // Reservations (guarded lookup)
    prisma.tableReservation
      ? prisma.tableReservation.findMany({
          where: {
            tableId: { in: tableIds },
            startsAt: { gte: startDate, lte: endDate }
          },
          select: {
            id: true,
            tableId: true,
            status: true,
            partySize: true,
            startsAt: true
          }
        }).catch(() => [])
      : Promise.resolve([])
  ]);

  // 7. Group Data By Table
  const ordersByTable = new Map();
  const sessionsByTable = new Map();
  const callsByTable = new Map();
  const reservationsByTable = new Map();

  for (const o of orders) {
    if (!ordersByTable.has(o.tableId)) ordersByTable.set(o.tableId, []);
    ordersByTable.get(o.tableId).push(o);
  }

  for (const s of sessions) {
    if (!sessionsByTable.has(s.tableId)) sessionsByTable.set(s.tableId, []);
    sessionsByTable.get(s.tableId).push(s);
  }

  for (const c of waiterCalls) {
    if (!callsByTable.has(c.tableId)) callsByTable.set(c.tableId, []);
    callsByTable.get(c.tableId).push(c);
  }

  for (const r of reservations) {
    if (!reservationsByTable.has(r.tableId)) reservationsByTable.set(r.tableId, []);
    reservationsByTable.get(r.tableId).push(r);
  }

  // 8. Hourly Distribution Map (0-23 hours)
  const hourlyMap = new Map();
  for (let h = 0; h < 24; h++) {
    hourlyMap.set(h, { hour: h, label: formatHourLabel(h), sessionCount: 0, orderCount: 0, revenue: 0 });
  }

  for (const o of orders) {
    const hour = new Date(o.createdAt).getHours();
    const entry = hourlyMap.get(hour);
    if (entry) {
      entry.orderCount += 1;
      entry.revenue += o.totalAmount;
    }
  }

  for (const s of sessions) {
    const hour = new Date(s.createdAt).getHours();
    const entry = hourlyMap.get(hour);
    if (entry) {
      entry.sessionCount += 1;
    }
  }

  // 9. Compute Per-Table Metrics
  const tableAnalytics = rawTables.map(tbl => {
    const tblOrders = ordersByTable.get(tbl.id) || [];
    const tblSessions = sessionsByTable.get(tbl.id) || [];
    const tblCalls = callsByTable.get(tbl.id) || [];
    const tblRes = reservationsByTable.get(tbl.id) || [];

    const totalOrders = tblOrders.length;
    const totalRevenue = tblOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalSessions = Math.max(tblSessions.length, totalOrders > 0 ? 1 : 0);

    // Dwell Time Calculation:
    // From session createdAt to updatedAt for settled sessions, or last order
    const dwellDurations = [];
    for (const s of tblSessions) {
      if (s.status === 'SETTLED' && s.updatedAt && s.createdAt) {
        const diffMin = Math.round((new Date(s.updatedAt).getTime() - new Date(s.createdAt).getTime()) / (1000 * 60));
        if (diffMin > 5 && diffMin < 360) { // filter anomalies
          dwellDurations.push(diffMin);
        }
      }
    }

    const avgDwellMinutes = dwellDurations.length > 0
      ? Math.round(dwellDurations.reduce((a, b) => a + b, 0) / dwellDurations.length)
      : totalOrders > 0 ? 45 : 0; // standard default 45m if orders exist

    // Turnover: sessions per day
    const turnoverRate = Number((totalSessions / daysCount).toFixed(2));

    // AOV (Average Order Value)
    const aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // RevPASH = Revenue / (Capacity * operatingHoursInPeriod)
    const capacity = tbl.capacity || 4;
    const availableSeatHours = capacity * operatingHoursInPeriod;
    const revpash = availableSeatHours > 0 ? Number((totalRevenue / availableSeatHours).toFixed(2)) : 0;

    // Payment method breakdown
    let cashRevenue = 0;
    let onlineRevenue = 0;
    for (const o of tblOrders) {
      if (o.paymentMethod === 'CASH') cashRevenue += o.totalAmount;
      else if (o.paymentMethod === 'ONLINE') onlineRevenue += o.totalAmount;
      else if (o.paymentMethod === 'SPLIT') {
        cashRevenue += (o.cashAmount || 0);
        onlineRevenue += (o.onlineAmount || 0);
      } else {
        cashRevenue += o.totalAmount; // fallback
      }
    }

    // Reservations stats
    const totalReservations = tblRes.length;
    const noShowReservations = tblRes.filter(r => r.status === 'NO_SHOW').length;
    const completedReservations = tblRes.filter(r => r.status === 'COMPLETED' || r.status === 'SEATED').length;

    return {
      id: tbl.id,
      tableNumber: tbl.tableNumber,
      storeId: tbl.storeId,
      storeName: storeMap.get(tbl.storeId) || 'Store',
      capacity,
      isActive: tbl.isActive,
      totalOrders,
      totalSessions,
      totalRevenue,
      aov,
      turnoverRate,
      avgDwellMinutes,
      revpash,
      cashRevenue,
      onlineRevenue,
      waiterCallsCount: tblCalls.length,
      totalReservations,
      noShowReservations,
      completedReservations,
      performanceTier: 'BALANCED'
    };
  });

  // 10. Assign Performance Tiers
  if (tableAnalytics.length > 0) {
    const sortedByRev = [...tableAnalytics].sort((a, b) => b.totalRevenue - a.totalRevenue);
    const topThreshold = sortedByRev[Math.max(0, Math.floor(sortedByRev.length * 0.25))]?.totalRevenue || 0;

    for (const item of tableAnalytics) {
      if (item.totalRevenue >= topThreshold && item.totalRevenue > 0) {
        item.performanceTier = 'TOP_EARNER';
      } else if (item.turnoverRate >= 3.0) {
        item.performanceTier = 'HIGH_TURNOVER';
      } else if (item.avgDwellMinutes >= 75) {
        item.performanceTier = 'LONG_DWELL';
      } else if (item.totalRevenue === 0 && item.totalSessions === 0) {
        item.performanceTier = 'UNDERUTILIZED';
      } else {
        item.performanceTier = 'BALANCED';
      }
    }
  }

  // 11. Sorting
  const sortBy = filters.sortBy || 'totalRevenue';
  const sortDir = filters.sortDir === 'asc' ? 1 : -1;
  tableAnalytics.sort((a, b) => {
    if (sortBy === 'tableNumber') return (a.tableNumber - b.tableNumber) * sortDir;
    return ((a[sortBy] || 0) - (b[sortBy] || 0)) * sortDir;
  });

  // 12. Aggregate Brand-Wide / Store-Wide Summary KPIs
  const totalBrandRevenue = tableAnalytics.reduce((sum, t) => sum + t.totalRevenue, 0);
  const totalBrandOrders = tableAnalytics.reduce((sum, t) => sum + t.totalOrders, 0);
  const totalBrandSessions = tableAnalytics.reduce((sum, t) => sum + t.totalSessions, 0);
  const totalSeats = tableAnalytics.reduce((sum, t) => sum + t.capacity, 0);
  const overallAOV = totalBrandOrders > 0 ? Math.round(totalBrandRevenue / totalBrandOrders) : 0;
  const avgTurnover = tableAnalytics.length > 0
    ? Number((tableAnalytics.reduce((sum, t) => sum + t.turnoverRate, 0) / tableAnalytics.length).toFixed(2))
    : 0;

  const activeDwells = tableAnalytics.map(t => t.avgDwellMinutes).filter(d => d > 0);
  const avgBrandDwell = activeDwells.length > 0
    ? Math.round(activeDwells.reduce((a, b) => a + b, 0) / activeDwells.length)
    : 0;

  const totalSeatHours = totalSeats * operatingHoursInPeriod;
  const overallRevPASH = totalSeatHours > 0 ? Number((totalBrandRevenue / totalSeatHours).toFixed(2)) : 0;

  const topTable = [...tableAnalytics].sort((a, b) => b.totalRevenue - a.totalRevenue)[0] || null;
  const underutilizedCount = tableAnalytics.filter(t => t.performanceTier === 'UNDERUTILIZED').length;

  // 13. Store Breakdown (comparison between brand stores)
  const storeBreakdownMap = new Map();
  for (const t of tableAnalytics) {
    if (!storeBreakdownMap.has(t.storeId)) {
      storeBreakdownMap.set(t.storeId, {
        storeId: t.storeId,
        storeName: t.storeName,
        tableCount: 0,
        totalSeats: 0,
        totalRevenue: 0,
        totalSessions: 0,
        avgTurnover: 0
      });
    }
    const sb = storeBreakdownMap.get(t.storeId);
    sb.tableCount += 1;
    sb.totalSeats += t.capacity;
    sb.totalRevenue += t.totalRevenue;
    sb.totalSessions += t.totalSessions;
  }

  const storeBreakdown = Array.from(storeBreakdownMap.values()).map(sb => ({
    ...sb,
    tablesCount: sb.tableCount,
    revenue: sb.totalRevenue,
    orders: sb.totalSessions,
    avgTurnover: sb.tableCount > 0 ? Number((sb.totalSessions / (sb.tableCount * daysCount)).toFixed(2)) : 0
  }));

  const hourlyDistribution = Array.from(hourlyMap.values());

  return {
    summary: {
      totalRevenue: totalBrandRevenue,
      totalOrders: totalBrandOrders,
      totalSessions: totalBrandSessions,
      totalTables: tableAnalytics.length,
      totalSeats,
      overallAOV,
      avgTurnoverRate: avgTurnover,
      avgDwellMinutes: avgBrandDwell,
      overallRevPASH,
      underutilizedCount,
      topTable: topTable ? {
        tableNumber: topTable.tableNumber,
        storeName: topTable.storeName,
        revenue: topTable.totalRevenue,
        turnoverRate: topTable.turnoverRate
      } : null,
      hourlyDistribution,
      storeBreakdown
    },
    tables: tableAnalytics,
    hourlyDistribution,
    storeBreakdown,
    dateRange: {
      startDate,
      endDate
    },
    period: {
      startDate,
      endDate,
      daysCount,
      operatingHoursInPeriod
    }
  };
}

function getEmptySummary() {
  return {
    totalRevenue: 0,
    totalOrders: 0,
    totalSessions: 0,
    totalTables: 0,
    totalSeats: 0,
    overallAOV: 0,
    avgTurnoverRate: 0,
    avgDwellMinutes: 0,
    overallRevPASH: 0,
    underutilizedCount: 0,
    topTable: null,
    hourlyDistribution: getEmptyHourly(),
    storeBreakdown: []
  };
}

function getEmptyHourly() {
  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: formatHourLabel(h),
    sessionCount: 0,
    orderCount: 0,
    revenue: 0
  }));
}

function formatHourLabel(h) {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

module.exports = {
  getTableAnalytics
};
