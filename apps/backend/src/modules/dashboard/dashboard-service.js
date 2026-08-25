const { AppError } = require("@smo/shared");
const { getPrismaClient } = require("../../lib/prisma");

async function getDashboardMetrics(user) {
  const prisma = getPrismaClient();
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'TENANT_ADMIN') {
    throw new AppError("Unauthorized access to dashboard metrics", 403);
  }

  let storesCount = 0;
  let usersCount = 0;
  let recentOrders = [];
  
  if (user.role === 'SUPER_ADMIN') {
    storesCount = await prisma.store.count();
    usersCount = await prisma.user.count();
    recentOrders = await prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { store: true }
    });
  } else {
    storesCount = await prisma.store.count({
      where: { tenantId: user.tenantId }
    });
    usersCount = await prisma.user.count({
      where: { tenantId: user.tenantId }
    });
    recentOrders = await prisma.order.findMany({
      where: { store: { tenantId: user.tenantId } },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { store: true }
    });
  }

  let revenueAggregate;
  if (user.role === 'SUPER_ADMIN') {
      revenueAggregate = await prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { status: 'SETTLED' }
      });
  } else {
      revenueAggregate = await prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { 
            status: 'SETTLED',
            store: { tenantId: user.tenantId }
        }
      });
  }

  const totalRevenue = (revenueAggregate._sum.totalAmount || 0) / 100;

  return {
    metrics: [
      { title: "Total Revenue", value: `₹${totalRevenue.toFixed(2)}`, trend: "+12.5%" },
      { title: "Active Stores", value: storesCount.toString(), trend: "+2" },
      { title: "Total Staff", value: usersCount.toString(), trend: "+5%" },
      { title: "Active Orders", value: "24", trend: "+10%" },
    ],
    recentOrders
  };
}

module.exports = {
  getDashboardMetrics
};
