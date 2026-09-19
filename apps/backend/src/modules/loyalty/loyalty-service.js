const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { broadcastToCustomer } = require("../orders/sse-service");

const DEFAULT_LOYALTY_SETTINGS = {
  isEnabled: false,
  welcomeBonusCredits: 50,    // ₹50 one-time welcome bonus on first login/account at store
  cashbackPercentage: 5,      // 5% cashback on settled orders
  minOrderToEarn: 100,        // Minimum ₹100 order subtotal to earn cashback
  minOrderToRedeem: 200,      // Minimum ₹200 order subtotal to redeem wallet credits
  maxRedemptionPercent: 50,   // Max 50% of subtotal can be paid with credits
  allowPromoStacking: true,   // Allow stacking with promo coupon codes
  creditExpiryDays: 90        // Credits expire after 90 days (0 = never)
};

/**
 * Helper: Merge store.loyaltyRules JSON with defaults
 */
function parseLoyaltySettings(store) {
  if (!store) return { ...DEFAULT_LOYALTY_SETTINGS };
  const raw = typeof store.loyaltyRules === 'string'
    ? JSON.parse(store.loyaltyRules)
    : (store.loyaltyRules || {});
  return { ...DEFAULT_LOYALTY_SETTINGS, ...raw };
}

/**
 * Get store loyalty settings and aggregate wallet metrics
 */
async function getStoreLoyaltySettings(storeId) {
  const prisma = getPrismaClient();

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, name: true, loyaltyRules: true }
  });

  if (!store) {
    throw createHttpError(404, "Store not found");
  }

  const settings = parseLoyaltySettings(store);

  // Aggregate stats
  const aggregates = await prisma.customerStoreWallet.aggregate({
    where: { storeId },
    _count: { id: true },
    _sum: {
      balance: true,
      totalEarned: true,
      totalSpent: true
    }
  });

  return {
    settings,
    metrics: {
      totalWallets: aggregates._count.id || 0,
      currentOutstandingBalance: aggregates._sum.balance || 0,
      totalCreditsIssued: aggregates._sum.totalEarned || 0,
      totalCreditsRedeemed: aggregates._sum.totalSpent || 0
    }
  };
}

/**
 * Update store loyalty settings
 */
async function updateStoreLoyaltySettings(actor, storeId, input) {
  const prisma = getPrismaClient();

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, tenantId: true, loyaltyRules: true }
  });

  if (!store) {
    throw createHttpError(404, "Store not found");
  }

  const existingSettings = parseLoyaltySettings(store);
  const updatedSettings = {
    ...existingSettings,
    isEnabled: typeof input.isEnabled === 'boolean' ? input.isEnabled : existingSettings.isEnabled,
    welcomeBonusCredits: input.welcomeBonusCredits != null ? Math.max(0, Number(input.welcomeBonusCredits)) : existingSettings.welcomeBonusCredits,
    cashbackPercentage: input.cashbackPercentage != null ? Math.min(100, Math.max(0, Number(input.cashbackPercentage))) : existingSettings.cashbackPercentage,
    minOrderToEarn: input.minOrderToEarn != null ? Math.max(0, Number(input.minOrderToEarn)) : existingSettings.minOrderToEarn,
    minOrderToRedeem: input.minOrderToRedeem != null ? Math.max(0, Number(input.minOrderToRedeem)) : existingSettings.minOrderToRedeem,
    maxRedemptionPercent: input.maxRedemptionPercent != null ? Math.min(100, Math.max(1, Number(input.maxRedemptionPercent))) : existingSettings.maxRedemptionPercent,
    allowPromoStacking: typeof input.allowPromoStacking === 'boolean' ? input.allowPromoStacking : existingSettings.allowPromoStacking,
    creditExpiryDays: input.creditExpiryDays != null ? Math.max(0, Number(input.creditExpiryDays)) : existingSettings.creditExpiryDays
  };

  const updatedStore = await prisma.store.update({
    where: { id: storeId },
    data: { loyaltyRules: updatedSettings },
    select: { id: true, loyaltyRules: true }
  });

  return parseLoyaltySettings(updatedStore);
}

/**
 * Get or initialize customer wallet for a specific store.
 * Automatically grants Welcome Bonus if loyalty is enabled and not already granted.
 */
async function getCustomerWallet(customerId, storeId) {
  const prisma = getPrismaClient();

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, name: true, loyaltyRules: true }
  });

  if (!store) {
    throw createHttpError(404, "Store not found");
  }

  const settings = parseLoyaltySettings(store);

  // Find or create wallet
  let wallet = await prisma.customerStoreWallet.findUnique({
    where: {
      customerId_storeId: {
        customerId,
        storeId
      }
    },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 20
      }
    }
  });

  if (!wallet) {
    wallet = await prisma.customerStoreWallet.create({
      data: {
        customerId,
        storeId,
        balance: 0,
        totalEarned: 0,
        totalSpent: 0
      },
      include: {
        transactions: true
      }
    });
  }

  // Check if eligible for Welcome Bonus
  if (settings.isEnabled && settings.welcomeBonusCredits > 0) {
    const existingBonus = await prisma.customerWalletTransaction.findFirst({
      where: {
        walletId: wallet.id,
        type: 'WELCOME_BONUS'
      }
    });

    if (!existingBonus) {
      const bonusAmount = settings.welcomeBonusCredits;
      const updatedWallet = await prisma.$transaction(async (tx) => {
        const w = await tx.customerStoreWallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: bonusAmount },
            totalEarned: { increment: bonusAmount }
          }
        });

        await tx.customerWalletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'WELCOME_BONUS',
            amount: bonusAmount,
            balanceAfter: w.balance,
            description: `Welcome bonus credits for joining ${store.name}!`
          }
        });

        return tx.customerStoreWallet.findUnique({
          where: { id: wallet.id },
          include: {
            transactions: {
              orderBy: { createdAt: 'desc' },
              take: 20
            }
          }
        });
      });

      wallet = updatedWallet;
    }
  }

  return {
    wallet: {
      id: wallet.id,
      storeId: wallet.storeId,
      customerId: wallet.customerId,
      balance: wallet.balance,
      totalEarned: wallet.totalEarned,
      totalSpent: wallet.totalSpent,
      updatedAt: wallet.updatedAt
    },
    transactions: wallet.transactions || [],
    storeRules: settings
  };
}

/**
 * Preview wallet redemption calculation for cart checkout
 */
async function previewWalletRedemption(customerId, storeId, subTotal, requestedCredits = 0) {
  const prisma = getPrismaClient();

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, loyaltyRules: true }
  });

  if (!store) {
    throw createHttpError(404, "Store not found");
  }

  const settings = parseLoyaltySettings(store);

  if (!settings.isEnabled) {
    return {
      eligible: false,
      reason: "Store credit rewards are not active for this store.",
      availableBalance: 0,
      maxRedeemable: 0,
      appliedCredits: 0
    };
  }

  const wallet = await prisma.customerStoreWallet.findUnique({
    where: {
      customerId_storeId: { customerId, storeId }
    }
  });

  const availableBalance = wallet ? wallet.balance : 0;

  if (availableBalance <= 0) {
    return {
      eligible: false,
      reason: "No credits available in your store wallet.",
      availableBalance: 0,
      maxRedeemable: 0,
      appliedCredits: 0
    };
  }

  if (subTotal < settings.minOrderToRedeem) {
    return {
      eligible: false,
      reason: `Minimum order value of ₹${settings.minOrderToRedeem} required to redeem credits.`,
      availableBalance,
      maxRedeemable: 0,
      appliedCredits: 0
    };
  }

  // Max redemption cap (e.g. 50% of subtotal)
  const maxCap = Math.floor(subTotal * (settings.maxRedemptionPercent / 100));
  const maxRedeemable = Math.min(availableBalance, maxCap);

  const appliedCredits = Math.min(
    Math.max(0, requestedCredits > 0 ? requestedCredits : maxRedeemable),
    maxRedeemable
  );

  return {
    eligible: true,
    availableBalance,
    maxRedeemable,
    appliedCredits,
    maxRedemptionPercent: settings.maxRedemptionPercent,
    allowPromoStacking: settings.allowPromoStacking
  };
}

/**
 * Apply credits during order creation within a Prisma transaction
 */
async function applyWalletCreditsOnOrder(tx, customerId, storeId, orderId, creditsAmount) {
  if (creditsAmount <= 0) return 0;

  const wallet = await tx.customerStoreWallet.findUnique({
    where: { customerId_storeId: { customerId, storeId } }
  });

  if (!wallet || wallet.balance < creditsAmount) {
    throw createHttpError(400, "Insufficient store credit balance.");
  }

  const newBalance = wallet.balance - creditsAmount;

  await tx.customerStoreWallet.update({
    where: { id: wallet.id },
    data: {
      balance: newBalance,
      totalSpent: { increment: creditsAmount }
    }
  });

  await tx.customerWalletTransaction.create({
    data: {
      walletId: wallet.id,
      orderId,
      type: 'ORDER_REDEMPTION',
      amount: -creditsAmount,
      balanceAfter: newBalance,
      description: `Redeemed on Order #${orderId.slice(-6).toUpperCase()}`
    }
  });

  return creditsAmount;
}

/**
 * Award cashback credits when an order reaches SETTLED
 */
async function creditOrderCashback(orderId) {
  const prisma = getPrismaClient();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      store: { select: { id: true, name: true, loyaltyRules: true } }
    }
  });

  if (!order || !order.customerId || order.status !== 'SETTLED') {
    return null;
  }

  const settings = parseLoyaltySettings(order.store);
  if (!settings.isEnabled || settings.cashbackPercentage <= 0) {
    return null;
  }

  // Ensure wallet exists
  let wallet = await prisma.customerStoreWallet.findUnique({
    where: {
      customerId_storeId: {
        customerId: order.customerId,
        storeId: order.storeId
      }
    }
  });

  if (!wallet) {
    wallet = await prisma.customerStoreWallet.create({
      data: {
        customerId: order.customerId,
        storeId: order.storeId,
        balance: 0,
        totalEarned: 0,
        totalSpent: 0
      }
    });
  }

  // Check if cashback was already credited for this order
  const existingCashback = await prisma.customerWalletTransaction.findFirst({
    where: {
      walletId: wallet.id,
      orderId: order.id,
      type: 'ORDER_CASHBACK'
    }
  });

  if (existingCashback) {
    return existingCashback;
  }

  // Calculate eligible paid amount (excluding previous credits and promo discount)
  const eligibleAmount = Math.max(0, (order.subTotal || 0) - (order.discountAmount || 0) - (order.walletDiscount || 0));

  if (eligibleAmount < settings.minOrderToEarn) {
    return null;
  }

  const cashbackCredits = Math.round(eligibleAmount * (settings.cashbackPercentage / 100));
  if (cashbackCredits <= 0) {
    return null;
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedWallet = await tx.customerStoreWallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: cashbackCredits },
        totalEarned: { increment: cashbackCredits }
      }
    });

    const txRecord = await tx.customerWalletTransaction.create({
      data: {
        walletId: wallet.id,
        orderId: order.id,
        type: 'ORDER_CASHBACK',
        amount: cashbackCredits,
        balanceAfter: updatedWallet.balance,
        description: `${settings.cashbackPercentage}% Cashback on Order #${order.id.slice(-6).toUpperCase()}`
      }
    });

    return { updatedWallet, txRecord };
  });

  // Notify customer in real-time
  broadcastToCustomer(order.customerId, 'CUSTOMER_WALLET_UPDATED', {
    balance: result.updatedWallet.balance,
    earnedAmount: cashbackCredits,
    storeId: order.storeId
  });

  return result.txRecord;
}

/**
 * Store Manager / Owner manual adjustment (e.g. goodwill compensation)
 */
async function manualAdjustCredits(actor, storeId, customerId, amount, reason) {
  const prisma = getPrismaClient();

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount === 0) {
    throw createHttpError(400, "Valid credit adjustment amount is required");
  }

  // Get or create wallet
  let wallet = await prisma.customerStoreWallet.findUnique({
    where: {
      customerId_storeId: { customerId, storeId }
    }
  });

  if (!wallet) {
    wallet = await prisma.customerStoreWallet.create({
      data: { customerId, storeId, balance: 0, totalEarned: 0, totalSpent: 0 }
    });
  }

  if (numAmount < 0 && wallet.balance + numAmount < 0) {
    throw createHttpError(400, `Cannot deduct more credits than customer balance (Current: ₹${wallet.balance}).`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedWallet = await tx.customerStoreWallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: numAmount },
        ...(numAmount > 0 ? { totalEarned: { increment: numAmount } } : { totalSpent: { increment: Math.abs(numAmount) } })
      }
    });

    const txRecord = await tx.customerWalletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'MANUAL_ADJUSTMENT',
        amount: numAmount,
        balanceAfter: updatedWallet.balance,
        description: reason || `Manual adjustment by ${actor.name || 'Store Staff'}`
      }
    });

    return { updatedWallet, txRecord };
  });

  broadcastToCustomer(customerId, 'CUSTOMER_WALLET_UPDATED', {
    balance: result.updatedWallet.balance,
    storeId
  });

  return result;
}

/**
 * List customers with wallets for store owner management view
 */
async function getStoreCustomersWithWallets(storeId, search = "") {
  const prisma = getPrismaClient();

  const whereUser = {
    customerWallets: {
      some: { storeId }
    }
  };

  if (search && search.trim()) {
    const q = search.trim();
    whereUser.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } }
    ];
  }

  const customers = await prisma.user.findMany({
    where: whereUser,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      customerWallets: {
        where: { storeId },
        select: {
          id: true,
          balance: true,
          totalEarned: true,
          totalSpent: true,
          updatedAt: true,
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 5
          }
        }
      }
    },
    take: 50,
    orderBy: { createdAt: 'desc' }
  });

  return customers.map(c => ({
    id: c.id,
    name: c.name || 'Guest User',
    email: c.email,
    phone: c.phone,
    wallet: c.customerWallets[0] || null
  }));
}

module.exports = {
  DEFAULT_LOYALTY_SETTINGS,
  parseLoyaltySettings,
  getStoreLoyaltySettings,
  updateStoreLoyaltySettings,
  getCustomerWallet,
  previewWalletRedemption,
  applyWalletCreditsOnOrder,
  creditOrderCashback,
  manualAdjustCredits,
  getStoreCustomersWithWallets
};
