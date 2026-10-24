const { AppError } = require("@smo/shared");
const { getPrismaClient } = require("../../lib/prisma");

// Orders still in progress: anything not yet settled or cancelled
const ACTIVE_ORDER_STATUS = { notIn: ['SETTLED', 'CANCELLED'] };

async function getDashboardMetrics(user) {
  const prisma = getPrismaClient();
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'TENANT_ADMIN') {
    throw new AppError("Unauthorized access to dashboard metrics", 403);
  }

  let storesCount;
  let usersCount;
  let recentOrders;
  let revenueAggregate;
  let activeOrdersCount;

  if (user.role === 'SUPER_ADMIN') {
    [storesCount, usersCount, recentOrders, revenueAggregate, activeOrdersCount] = await Promise.all([
      prisma.store.count(),
      prisma.user.count(),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { store: true }
      }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { status: 'SETTLED' }
      }),
      prisma.order.count({
        where: { status: ACTIVE_ORDER_STATUS }
      })
    ]);
  } else {
    [storesCount, usersCount, recentOrders, revenueAggregate, activeOrdersCount] = await Promise.all([
      prisma.store.count({
        where: { tenantId: user.tenantId }
      }),
      prisma.user.count({
        where: { tenantId: user.tenantId }
      }),
      prisma.order.findMany({
        where: { store: { tenantId: user.tenantId } },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { store: true }
      }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          status: 'SETTLED',
          store: { tenantId: user.tenantId }
        }
      }),
      prisma.order.count({
        where: {
          status: ACTIVE_ORDER_STATUS,
          store: { tenantId: user.tenantId }
        }
      })
    ]);
  }

  // Order amounts are stored in whole rupees
  const totalRevenue = revenueAggregate._sum.totalAmount || 0;

  // No history is kept to compare against yet, so there are no trends (null, not made up)
  return {
    metrics: [
      { title: "Total Revenue", value: `₹${totalRevenue.toLocaleString("en-IN")}`, trend: null },
      { title: "Active Stores", value: storesCount.toString(), trend: null },
      { title: "Total Staff", value: usersCount.toString(), trend: null },
      { title: "Active Orders", value: activeOrdersCount.toString(), trend: null },
    ],
    recentOrders
  };
}

module.exports = {
  getDashboardMetrics
};
