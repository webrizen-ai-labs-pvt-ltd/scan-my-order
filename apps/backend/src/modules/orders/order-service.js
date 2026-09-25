const crypto = require("crypto");
const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { verifyStoreAccess } = require("../menu/menu-service");
const { computeOrderTotals } = require("@smo/shared/pricing");
const { broadcastToStore, broadcastToCustomer } = require("./sse-service");
const { sendNotification } = require("../notifications/notification-service");
const { evaluateMenuItemAvailability } = require("../inventory/inventory-service");
const { 
  openItemRecordCache, 
  invalidateMaterialsCache, 
  invalidateMenuCache, 
  invalidateTablesCache 
} = require("../../lib/cache");

// Helper: Decode custom metadata stored in kitchenNotes
function decodeKitchenNotes(rawNotes) {
  if (!rawNotes) {
    return { customName: null, customIngredients: [], kitchenNotes: null, readableNotes: null };
  }
  if (typeof rawNotes === 'string' && rawNotes.startsWith('__CUSTOM__:')) {
    try {
      const jsonStr = rawNotes.slice('__CUSTOM__:'.length);
      const meta = JSON.parse(jsonStr);
      const ingList = (meta.customIngredients || []).map(i => `+${i.quantity}${i.unit} ${i.name}`).join(', ');
      const readable = [meta.customName, ingList ? `[${ingList}]` : '', meta.userNote].filter(Boolean).join(' | ');
      return {
        customName: meta.customName || null,
        customIngredients: meta.customIngredients || [],
        kitchenNotes: meta.userNote || null,
        readableNotes: readable
      };
    } catch (e) {
      return { customName: null, customIngredients: [], kitchenNotes: rawNotes, readableNotes: rawNotes };
    }
  }
  return { customName: null, customIngredients: [], kitchenNotes: rawNotes, readableNotes: rawNotes };
}

// Helper: Encode custom metadata into kitchenNotes string
function encodeKitchenNotes(customName, customIngredients, userNote) {
  if (!customName && (!customIngredients || customIngredients.length === 0)) {
    return userNote || null;
  }
  const meta = {
    customName: customName || null,
    customIngredients: customIngredients || [],
    userNote: userNote || ""
  };
  return `__CUSTOM__:${JSON.stringify(meta)}`;
}

// Helper: Serialize order item with first-class custom fields
function serializeOrderItem(item) {
  if (!item) return item;
  const decoded = decodeKitchenNotes(item.kitchenNotes);
  return {
    ...item,
    customName: decoded.customName,
    customIngredients: decoded.customIngredients,
    kitchenNotes: decoded.kitchenNotes,
    readableNotes: decoded.readableNotes,
    displayName: decoded.customName || item.menuItem?.name || 'Item'
  };
}

// Helper: Serialize full order with items
function serializeOrder(order) {
  if (!order) return order;
  return {
    ...order,
    items: (order.items || []).map(serializeOrderItem)
  };
}

// Helper: Get or automatically provision a store's system "Open Custom Dish" MenuItem
async function getOrCreateSystemOpenItem(prisma, storeId) {
  const cached = openItemRecordCache.get(storeId);
  if (cached) return cached;

  let openItem = await prisma.menuItem.findFirst({
    where: {
      storeId,
      name: "Open Custom Dish"
    }
  });

  if (!openItem) {
    let category = await prisma.menuCategory.findFirst({
      where: {
        storeId,
        name: "Custom & Open Orders"
      }
    });

    if (!category) {
      category = await prisma.menuCategory.create({
        data: {
          storeId,
          name: "Custom & Open Orders",
          description: "System category for bespoke open items and dynamic custom creations",
          sortOrder: 999
        }
      });
    }

    openItem = await prisma.menuItem.create({
      data: {
        storeId,
        categoryId: category.id,
        name: "Open Custom Dish",
        description: "Bespoke dish created with custom ingredients on the fly",
        price: 0,
        dietary: "VEG",
        isManuallyDisabled: false,
        isSystemDisabled: false
      }
    });
  }

  if (openItem) {
    openItemRecordCache.set(storeId, openItem);
  }

  return openItem;
}

const MAX_CART_LINES = 100;
const MAX_LINE_QUANTITY = 99;

// Rejects malformed carts before any pricing happens. Custom/open dishes and
// priced ingredients are staff-only: customers could otherwise set their own prices.
function validateCartInput(itemsInput, { allowCustom }) {
  if (!Array.isArray(itemsInput) || itemsInput.length === 0) {
    throw createHttpError(400, "Order must contain at least one item");
  }
  if (itemsInput.length > MAX_CART_LINES) {
    throw createHttpError(400, `An order can have at most ${MAX_CART_LINES} lines`);
  }

  for (const item of itemsInput) {
    const quantity = item.quantity === undefined ? 1 : Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
      throw createHttpError(400, `Quantity must be a whole number between 1 and ${MAX_LINE_QUANTITY}`);
    }

    const isCustom = Boolean(item.isCustom || !item.menuItemId);
    const hasIngredients = Array.isArray(item.customIngredients) && item.customIngredients.length > 0;
    if (!allowCustom && (isCustom || item.customPrice !== undefined || hasIngredients)) {
      throw createHttpError(400, "Custom dishes and ingredient changes can only be added by staff");
    }

    if (isCustom) {
      const price = Number(item.customPrice);
      if (!Number.isInteger(price) || price < 0) {
        throw createHttpError(400, "Custom dish price must be a whole number of rupees (0 or more)");
      }
    }

    if (hasIngredients) {
      for (const ing of item.customIngredients) {
        const price = ing.price === undefined || ing.price === null || ing.price === '' ? 0 : Number(ing.price);
        const qty = Number(ing.quantity);
        if (!Number.isFinite(price) || price < 0 || !Number.isFinite(qty) || qty < 0) {
          throw createHttpError(400, "Ingredient price and quantity must be 0 or more");
        }
      }
    }
  }
}

// Helper to deduce price from menu and calculate totals
// alreadyOrderedIds: menu items already on the order being edited — they stay even if now sold out
async function buildCartItems(prisma, storeId, itemsInput, { allowCustom = false, alreadyOrderedIds = new Set() } = {}) {
  validateCartInput(itemsInput, { allowCustom });
  let totalAmount = 0;
  const items = [];

  // Identify open / custom dishes that lack a menuItemId
  let openItemRecord = null;
  const hasCustomDishes = itemsInput.some(i => i.isCustom || !i.menuItemId);
  if (hasCustomDishes) {
    openItemRecord = await getOrCreateSystemOpenItem(prisma, storeId);
  }

  // Batch fetch all required menu items and modifier options in 1 round trip
  const menuItemIds = [...new Set(itemsInput.map(i => (i.isCustom || !i.menuItemId) ? openItemRecord?.id : i.menuItemId).filter(Boolean))];
  const allModIds = [...new Set(itemsInput.flatMap(i => i.modifiers || []).filter(Boolean))];

  const [menuItemsList, modifierOptionsList] = await Promise.all([
    menuItemIds.length > 0
      ? prisma.menuItem.findMany({
          where: { id: { in: menuItemIds } }
        })
      : [],
    allModIds.length > 0
      ? prisma.menuModifierOption.findMany({
          where: { id: { in: allModIds } },
          include: { group: true }
        })
      : []
  ]);

  const menuItemsMap = new Map(menuItemsList.map(m => [m.id, m]));
  const modifierOptionsMap = new Map(modifierOptionsList.map(o => [o.id, o]));
  
  for (const item of itemsInput) {
    const isCustom = Boolean(item.isCustom || !item.menuItemId);
    const targetMenuItemId = isCustom ? openItemRecord?.id : item.menuItemId;
    const menuItem = menuItemsMap.get(targetMenuItemId);
    
    const soldOut = menuItem && (menuItem.isManuallyDisabled || menuItem.isSystemDisabled) && !alreadyOrderedIds.has(menuItem.id);
    if (!menuItem || menuItem.storeId !== storeId || (!isCustom && soldOut)) {
      throw createHttpError(400, `MenuItem ${targetMenuItemId} is not available`);
    }
    
    let itemPrice = isCustom && item.customPrice !== undefined ? Number(item.customPrice) : menuItem.price;
    const modifiers = [];
    
    if (item.modifiers && item.modifiers.length > 0) {
      for (const modId of item.modifiers) {
        const option = modifierOptionsMap.get(modId);
        
        if (!option || option.group.menuItemId !== menuItem.id) {
          throw createHttpError(400, `Invalid modifier ${modId} for item ${menuItem.id}`);
        }
        
        itemPrice += option.price;
        modifiers.push({
          modifierOptionId: modId,
          priceAtOrder: option.price
        });
      }
    }

    // Add extra charges from custom ingredients if any
    if (item.customIngredients && Array.isArray(item.customIngredients)) {
      for (const ing of item.customIngredients) {
        if (ing.price && Number(ing.price) > 0) {
          itemPrice += Number(ing.price);
        }
      }
    }
    
    const quantity = item.quantity === undefined ? 1 : Number(item.quantity);
    totalAmount += itemPrice * quantity;

    // POS sends `notes`; older clients send `kitchenNotes`
    const lineNote = String(item.kitchenNotes || item.notes || '').slice(0, 300);
    const encodedNotes = encodeKitchenNotes(
      isCustom ? (item.customName || 'Open Custom Dish') : item.customName,
      item.customIngredients || [],
      lineNote
    );
    
    items.push({
      menuItemId: menuItem.id,
      quantity,
      kitchenNotes: encodedNotes,
      priceAtOrder: itemPrice, // Base price snapshot + ingredients
      modifiers: {
        create: modifiers
      }
    });
  }
  
  return { items, totalAmount };
}

// Table sessions expire after this much inactivity — but only once every order on them is closed
const SESSION_IDLE_MS = 2 * 60 * 60 * 1000;
const OPEN_ORDER_STATUSES = ['DRAFT', 'PENDING_VERIFICATION', 'PENDING_PAYMENT', 'PROCESSING', 'READY', 'SERVED'];
const STAFF_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER', 'CASHIER', 'WAITER'];

function generateSessionPin() {
  return String(crypto.randomInt(1000, 10000));
}

/**
 * Closes an idle session only when nothing on it is still open or unpaid.
 * Returns the session if it is still usable, otherwise null.
 */
async function expireIdleSession(db, session) {
  if (!session) return null;
  const lastActive = session.lastOrderAt || session.updatedAt || session.createdAt;
  if (Date.now() - lastActive.getTime() < SESSION_IDLE_MS) return session;

  const openOrders = await db.order.count({
    where: { tableSessionId: session.id, status: { in: OPEN_ORDER_STATUSES } }
  });
  if (openOrders > 0) return session;

  await db.tableSession.update({ where: { id: session.id }, data: { status: 'SETTLED' } });
  return null;
}

/**
 * Finds or creates the active session for a table under a per-table advisory lock,
 * so two simultaneous first orders can't open two sessions.
 */
async function resolveTableSession(prisma, storeId, tableId, origin, input) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`table_session:${tableId}`}))`;

    let session = await tx.tableSession.findFirst({
      where: { storeId, tableId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });
    session = await expireIdleSession(tx, session);

    if (!session) {
      return tx.tableSession.create({
        data: {
          storeId,
          tableId,
          pin: generateSessionPin(),
          sessionToken: crypto.randomBytes(24).toString('hex'),
          status: 'ACTIVE',
          lastOrderAt: new Date()
        }
      });
    }

    // Guests joining an occupied table must prove they belong to it; staff don't need the PIN
    if (origin === 'QR_MENU') {
      const providedToken = input.sessionToken ? String(input.sessionToken).trim() : null;
      const providedPin = input.pin ? String(input.pin).trim() : null;
      const isTokenValid = Boolean(providedToken && session.sessionToken && providedToken === session.sessionToken);
      const isPinValid = Boolean(providedPin && providedPin === session.pin);
      if (!isTokenValid && !isPinValid) {
        throw createHttpError(403, "Invalid Table PIN. An active dining session is in progress for this table. Please enter the 4-digit table PIN.");
      }
    }

    return tx.tableSession.update({
      where: { id: session.id },
      data: {
        sessionToken: session.sessionToken || crypto.randomBytes(24).toString('hex'),
        lastOrderAt: new Date()
      }
    });
  });
}

// 1. ORDER CREATION
async function createOrder(storeId, actor, origin, input) {
  const prisma = getPrismaClient();
  const { type, paymentModel, items: itemsInput, promoCode } = input;
  const tableId = input.tableId || null;

  if (!['PREPAID', 'POSTPAID'].includes(paymentModel)) {
    throw createHttpError(400, "paymentModel must be PREPAID or POSTPAID");
  }
  if (!['DINE_IN', 'TAKEAWAY', 'DELIVERY'].includes(type)) {
    throw createHttpError(400, "type must be DINE_IN, TAKEAWAY or DELIVERY");
  }
  if (origin === 'QR_MENU' && !tableId) {
    throw createHttpError(400, "tableId is required for QR_MENU orders");
  }

  const isStaff = origin === 'POS' && actor && STAFF_ROLES.includes(actor.role);
  if (origin === 'POS' && !isStaff) {
    throw createHttpError(403, "Only store staff can place POS orders");
  }

  if (tableId) {
    const table = await prisma.table.findUnique({ where: { id: tableId }, select: { storeId: true, isActive: true } });
    if (!table || table.storeId !== storeId || !table.isActive) {
      throw createHttpError(400, "Table not found for this store");
    }
  }

  const { items, totalAmount: subTotal } = await buildCartItems(prisma, storeId, itemsInput, { allowCustom: isStaff });
  const store = await prisma.store.findUnique({ where: { id: storeId } });

  let promo = null;
  if (promoCode) {
    promo = await prisma.promoCode.findUnique({
      where: { storeId_code: { storeId, code: String(promoCode).toUpperCase() } }
    });
    if (!promo || !promo.isActive || (promo.validUntil && promo.validUntil <= new Date())) {
      throw createHttpError(400, "Invalid or expired promo code");
    }
    if (subTotal < promo.minOrderValue) {
      throw createHttpError(400, `Promo code requires minimum order value of ₹${promo.minOrderValue}`);
    }
  }

  // Store Loyalty Credit Wallet Redemption
  let walletCredits = 0;
  if (input.applyWalletCredits) {
    if (!actor) {
      throw createHttpError(401, "Please log in to redeem store credits.");
    }
    const { previewWalletRedemption } = require("../loyalty/loyalty-service");
    const preview = await previewWalletRedemption(actor.id, storeId, subTotal, Number(input.walletCredits || 0));
    if (!preview.eligible) {
      throw createHttpError(400, preview.reason || "Unable to redeem store credits.");
    }
    if (preview.appliedCredits > 0) {
      if (promo && !preview.allowPromoStacking) {
        throw createHttpError(400, "Store credits cannot be combined with promo codes at this store.");
      }
      walletCredits = preview.appliedCredits;
    }
  }

  const totals = computeOrderTotals({
    subTotal,
    promo,
    walletDiscount: walletCredits,
    taxRules: store.taxRules
  });

  // Payment is never taken here — it is recorded as Payment rows (see payments module).
  let status;
  if (origin === 'QR_MENU' && paymentModel === 'POSTPAID') {
    status = 'PENDING_VERIFICATION';
  } else if (paymentModel === 'POSTPAID') {
    status = 'PROCESSING'; // A cashier punching a postpaid ticket sends it straight to the kitchen
  } else {
    status = totals.totalAmount === 0 ? 'PROCESSING' : 'PENDING_PAYMENT';
  }

  const tableSession = tableId ? await resolveTableSession(prisma, storeId, tableId, origin, input) : null;

  const order = await prisma.order.create({
    data: {
      storeId,
      origin,
      type,
      tableId,
      tableSessionId: tableSession ? tableSession.id : null,
      staffId: origin === 'POS' && actor ? actor.id : null,
      customerId: origin === 'QR_MENU' && actor ? actor.id : null,
      sessionId: input.sessionId || null,
      paymentModel,
      status,
      paidAt: paymentModel === 'PREPAID' && totals.totalAmount === 0 ? new Date() : null,
      subTotal: totals.subTotal,
      discountAmount: totals.discountAmount,
      walletDiscount: totals.walletDiscount,
      taxAmount: totals.taxAmount,
      promoCodeId: promo ? promo.id : null,
      totalAmount: totals.totalAmount,
      taxRules: Array.isArray(store.taxRules) ? store.taxRules : [],
      items: {
        create: items
      }
    },
    include: {
      table: true,
      tableSession: true,
      items: {
        include: {
          menuItem: true,
          modifiers: {
            include: { modifierOption: true }
          }
        }
      }
    }
  });

  // Deduct applied wallet credits from customer balance
  if (totals.walletDiscount > 0 && actor) {
    try {
      const { applyWalletCreditsOnOrder } = require("../loyalty/loyalty-service");
      await applyWalletCreditsOnOrder(prisma, actor.id, storeId, order.id, totals.walletDiscount);
    } catch (err) {
      console.error("[Loyalty Debit Error]", err.message);
    }
  }

  if (status === 'PENDING_VERIFICATION') {
    broadcastToStore(storeId, 'ORDER_PENDING_VERIFICATION', order);
    if (order.customerId) broadcastToCustomer(order.customerId, 'ORDER_PENDING_VERIFICATION', order);
    if (order.sessionId) broadcastToCustomer(order.sessionId, 'ORDER_PENDING_VERIFICATION', order);
    sendNotification({
      storeId,
      type: 'ORDER_PENDING_VERIFICATION',
      title: 'Order Pending Verification',
      body: `Table ${order.table?.tableNumber || 'N/A'}: Order #${order.id.slice(-6).toUpperCase()} requires waiter verification.`,
      data: { orderId: order.id, tableNumber: order.table?.tableNumber, sound: 'notification.mp3', url: '/waiter' },
      target: { roles: ['WAITER', 'STORE_MANAGER'], storeId }
    }).catch(() => {});
  } else if (status === 'PROCESSING') {
    await deductInventory(prisma, order);
    broadcastToStore(storeId, 'ORDER_PROCESSING', order);
    if (order.customerId) broadcastToCustomer(order.customerId, 'ORDER_PROCESSING', order);
    if (order.sessionId) broadcastToCustomer(order.sessionId, 'ORDER_PROCESSING', order);
    sendNotification({
      storeId,
      type: 'ORDER_PROCESSING',
      title: 'New Kitchen Order',
      body: `Table ${order.table?.tableNumber || 'N/A'}: Order #${order.id.slice(-6).toUpperCase()} received in kitchen.`,
      data: { orderId: order.id, tableNumber: order.table?.tableNumber, sound: 'notification.mp3', url: '/kds' },
      target: { roles: ['KITCHEN', 'STORE_MANAGER'], storeId }
    }).catch(() => {});
    if (order.customerId || order.sessionId) {
      sendNotification({
        storeId,
        type: 'ORDER_PROCESSING',
        title: 'Order Confirmed',
        body: `Your order #${order.id.slice(-6).toUpperCase()} is confirmed and being prepared!`,
        data: { orderId: order.id, sound: 'notification.mp3' },
        target: { customerId: order.customerId, sessionId: order.sessionId }
      }).catch(() => {});
    }
  } else if (status === 'PENDING_PAYMENT') {
    broadcastToStore(storeId, 'ORDER_PENDING_PAYMENT', order);
  }

  if (tableId) {
    invalidateTablesCache(storeId);
  }

  // Customers pay prepaid QR orders through Razorpay Checkout; staff collect POS payments on the checkout screen
  let paymentIntent = null;
  if (status === 'PENDING_PAYMENT' && origin === 'QR_MENU') {
    const { createCheckoutForOrder } = require("../payments/payment-service");
    try {
      paymentIntent = await createCheckoutForOrder(order);
    } catch (error) {
      await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
      throw error;
    }
  }

  // Optional one-step cash settle for POS "Quick Cash"
  let payNowSummary = null;
  if (status === 'PENDING_PAYMENT' && origin === 'POS' && input.payNow?.channel === 'CASH') {
    const { createPayment } = require("../payments/payment-service");
    try {
      const result = await createPayment(actor, storeId, {
        orderId: order.id,
        channel: 'CASH',
        amount: order.totalAmount,
        cashTendered: input.payNow.cashTendered
      });
      payNowSummary = result.summary;
    } catch (error) {
      await updateOrderStatus(actor, storeId, order.id, 'CANCELLED', true, { reason: 'Cash payment could not be recorded' });
      throw error;
    }
  }

  const finalOrder = payNowSummary ? await getOrderById(storeId, order.id) : serializeOrder(order);

  return {
    order: finalOrder,
    paymentIntent,
    paymentSummary: payNowSummary,
    tableSessionId: tableSession ? tableSession.id : null,
    sessionToken: tableSession ? tableSession.sessionToken : null,
    sessionPin: tableSession ? tableSession.pin : null
  };
}


// 3. LIFECYCLE MANAGEMENT
async function deductInventory(prisma, order) {
  const items = await prisma.orderItem.findMany({
    where: { orderId: order.id },
    include: {
      menuItem: { include: { recipe: true } },
      modifiers: {
        include: { modifierOption: { include: { recipe: true } } }
      }
    }
  });

  const transactions = [];
  const materialDeltas = new Map(); // materialId -> total consumed quantity

  for (const item of items) {
    // Deduct base item recipe if any
    if (item.menuItem?.recipe) {
      for (const rec of item.menuItem.recipe) {
        const consumeQty = rec.quantity * item.quantity;
        transactions.push({
          materialId: rec.rawMaterialId,
          type: 'CONSUME',
          quantity: consumeQty,
          reference: `Order ${order.id}`
        });
        materialDeltas.set(rec.rawMaterialId, (materialDeltas.get(rec.rawMaterialId) || 0) + consumeQty);
      }
    }

    // Deduct modifiers
    for (const mod of item.modifiers) {
      if (mod.modifierOption?.recipe) {
        for (const rec of mod.modifierOption.recipe) {
          const consumeQty = rec.quantity * item.quantity;
          transactions.push({
            materialId: rec.rawMaterialId,
            type: 'CONSUME',
            quantity: consumeQty,
            reference: `Order ${order.id} Mod`
          });
          materialDeltas.set(rec.rawMaterialId, (materialDeltas.get(rec.rawMaterialId) || 0) + consumeQty);
        }
      }
    }

    // Deduct custom ingredients
    const decoded = decodeKitchenNotes(item.kitchenNotes);
    if (decoded.customIngredients && Array.isArray(decoded.customIngredients)) {
      for (const ing of decoded.customIngredients) {
        if (ing.rawMaterialId && Number(ing.quantity) > 0) {
          const consumeQty = Number(ing.quantity) * item.quantity;
          transactions.push({
            materialId: ing.rawMaterialId,
            type: 'CONSUME',
            quantity: consumeQty,
            reference: `Order ${order.id} Ingredient: ${ing.name || 'Custom'}`
          });
          materialDeltas.set(ing.rawMaterialId, (materialDeltas.get(ing.rawMaterialId) || 0) + consumeQty);
        }
      }
    }
  }

  if (transactions.length > 0) {
    // 1. Batch insert stock transactions in single query
    await prisma.stockTransaction.createMany({ data: transactions });

    // 2. Decrement raw material stock in parallel
    await Promise.all(
      Array.from(materialDeltas.entries()).map(([materialId, qty]) =>
        prisma.rawMaterial.update({
          where: { id: materialId },
          data: { currentStock: { decrement: qty } }
        })
      )
    );

    // 3. Batch evaluate availability once per unique raw material
    await Promise.all(
      Array.from(materialDeltas.keys()).map(materialId =>
        evaluateMenuItemAvailability(prisma, materialId)
      )
    );

    // Invalidate caches
    const storeId = order.storeId || (await prisma.order.findUnique({ where: { id: order.id }, select: { storeId: true } }))?.storeId;
    if (storeId) {
      invalidateMaterialsCache(storeId);
      invalidateMenuCache(storeId);
    }
  }
}

// Helper: Revert inventory deductions when items are updated
async function revertInventoryDeduction(prisma, orderId) {
  const [order, items] = await Promise.all([
    prisma.order.findUnique({ where: { id: orderId }, select: { storeId: true } }),
    prisma.orderItem.findMany({
      where: { orderId },
      include: {
        menuItem: { include: { recipe: true } },
        modifiers: {
          include: { modifierOption: { include: { recipe: true } } }
        }
      }
    })
  ]);

  const transactions = [];
  const materialDeltas = new Map(); // materialId -> total restocked quantity

  for (const item of items) {
    if (item.menuItem?.recipe) {
      for (const rec of item.menuItem.recipe) {
        const restoreQty = rec.quantity * item.quantity;
        transactions.push({
          materialId: rec.rawMaterialId,
          type: 'RESTOCK',
          quantity: restoreQty,
          reference: `Revert Order ${orderId} (Manager Item Edit)`
        });
        materialDeltas.set(rec.rawMaterialId, (materialDeltas.get(rec.rawMaterialId) || 0) + restoreQty);
      }
    }

    for (const mod of item.modifiers) {
      if (mod.modifierOption?.recipe) {
        for (const rec of mod.modifierOption.recipe) {
          const restoreQty = rec.quantity * item.quantity;
          transactions.push({
            materialId: rec.rawMaterialId,
            type: 'RESTOCK',
            quantity: restoreQty,
            reference: `Revert Order ${orderId} Mod (Manager Item Edit)`
          });
          materialDeltas.set(rec.rawMaterialId, (materialDeltas.get(rec.rawMaterialId) || 0) + restoreQty);
        }
      }
    }

    const decoded = decodeKitchenNotes(item.kitchenNotes);
    if (decoded.customIngredients && Array.isArray(decoded.customIngredients)) {
      for (const ing of decoded.customIngredients) {
        if (ing.rawMaterialId && Number(ing.quantity) > 0) {
          const restoreQty = Number(ing.quantity) * item.quantity;
          transactions.push({
            materialId: ing.rawMaterialId,
            type: 'RESTOCK',
            quantity: restoreQty,
            reference: `Revert Order ${orderId} Ingredient: ${ing.name || 'Custom'}`
          });
          materialDeltas.set(ing.rawMaterialId, (materialDeltas.get(ing.rawMaterialId) || 0) + restoreQty);
        }
      }
    }
  }

  if (transactions.length > 0) {
    // 1. Batch insert restock transactions in single query
    await prisma.stockTransaction.createMany({ data: transactions });

    // 2. Increment raw material stock in parallel
    await Promise.all(
      Array.from(materialDeltas.entries()).map(([materialId, qty]) =>
        prisma.rawMaterial.update({
          where: { id: materialId },
          data: { currentStock: { increment: qty } }
        })
      )
    );

    // 3. Batch evaluate availability once per unique material
    await Promise.all(
      Array.from(materialDeltas.keys()).map(materialId =>
        evaluateMenuItemAvailability(prisma, materialId)
      )
    );

    if (order?.storeId) {
      invalidateMaterialsCache(order.storeId);
      invalidateMenuCache(order.storeId);
    }
  }
}

// 4. MANAGER UPDATE ORDER ITEMS (POST-PLACEMENT EDITING)
async function updateOrderItems(actor, storeId, orderId, input) {
  const allowedRoles = ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER'];
  if (!allowedRoles.includes(actor.role)) {
    throw createHttpError(403, "Access denied. Only Store Managers and Administrators can modify items in placed orders.");
  }
  await verifyStoreAccess(actor, storeId);

  const prisma = getPrismaClient();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      promoCode: true
    }
  });

  if (!order || order.storeId !== storeId) {
    throw createHttpError(404, "Order not found");
  }

  if (['CANCELLED', 'SETTLED'].includes(order.status)) {
    throw createHttpError(400, `Cannot modify items in a ${order.status.toLowerCase()} order`);
  }
  // Once money has been taken against an order its total is locked
  const takenPayments = await prisma.payment.count({
    where: { orderId: order.id, status: { in: ['PAID', 'PENDING'] } }
  });
  if (order.paidAt || takenPayments > 0) {
    throw createHttpError(409, "This order already has payments against it. Cancel pending payments or place a new order for extra items.");
  }
  if (order.tableSessionId) {
    const sessionPayments = await prisma.payment.count({
      where: { tableSessionId: order.tableSessionId, status: { in: ['PAID', 'PENDING'] } }
    });
    if (sessionPayments > 0) {
      throw createHttpError(409, "The table bill is being paid. Cancel pending payments before editing orders.");
    }
  }

  const { items: itemsInput } = input;

  // Lines already on the order keep the price they were sold at; only new lines use today's menu
  const existingItems = await prisma.orderItem.findMany({
    where: { orderId: order.id },
    include: { modifiers: true }
  });
  const { items: builtItems } = await buildCartItems(prisma, storeId, itemsInput, {
    allowCustom: true,
    alreadyOrderedIds: new Set(existingItems.map(i => i.menuItemId))
  });
  const existingById = new Map(existingItems.map(i => [i.id, i]));
  const ingredientExtras = (ings) => (Array.isArray(ings) ? ings : [])
    .reduce((sum, ing) => sum + (Number(ing.price) > 0 ? Number(ing.price) : 0), 0);

  const newItemsData = builtItems.map((built, idx) => {
    const input = itemsInput[idx];
    const source = input.orderItemId ? existingById.get(input.orderItemId) : null;
    const isCustom = Boolean(input.isCustom || !input.menuItemId);
    if (!source || isCustom || source.menuItemId !== built.menuItemId) return built;

    const oldModIds = source.modifiers.map(m => m.modifierOptionId).sort().join(',');
    const newModIds = [...(input.modifiers || [])].sort().join(',');
    if (oldModIds !== newModIds) return built;

    const oldExtras = ingredientExtras(decodeKitchenNotes(source.kitchenNotes).customIngredients);
    return {
      ...built,
      priceAtOrder: source.priceAtOrder - oldExtras + ingredientExtras(input.customIngredients),
      modifiers: {
        create: source.modifiers.map(m => ({ modifierOptionId: m.modifierOptionId, priceAtOrder: m.priceAtOrder }))
      }
    };
  });
  const newSubTotal = newItemsData.reduce((sum, itm) => sum + itm.priceAtOrder * itm.quantity, 0);

  // Tax at the rates in force when the order was placed (older orders fall back to the store's current rules)
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  const taxRules = Array.isArray(order.taxRules) ? order.taxRules : (Array.isArray(store.taxRules) ? store.taxRules : []);

  // A promo that no longer meets its minimum after the edit is removed from the order
  const promo = order.promoCode && newSubTotal >= (order.promoCode.minOrderValue || 0) ? order.promoCode : null;

  const totals = computeOrderTotals({
    subTotal: newSubTotal,
    promo,
    walletDiscount: order.walletDiscount,
    taxRules
  });
  const { discountAmount, taxAmount, totalAmount: newTotalAmount } = totals;
  // Credits that no longer fit the smaller bill go back to the customer
  const walletRefund = Math.max(0, (order.walletDiscount || 0) - totals.walletDiscount);

  // Inventory reconciliation:
  const wasDeducted = ['PROCESSING', 'READY', 'SERVED'].includes(order.status);
  if (wasDeducted) {
    await revertInventoryDeduction(prisma, order.id);
  }

  // Replace order items atomically in transaction
  await prisma.$transaction(async (tx) => {
    // Delete existing items (modifiers cascade delete)
    await tx.orderItem.deleteMany({
      where: { orderId: order.id }
    });

    // Create new items
    for (const itm of newItemsData) {
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          menuItemId: itm.menuItemId,
          quantity: itm.quantity,
          kitchenNotes: itm.kitchenNotes,
          priceAtOrder: itm.priceAtOrder,
          modifiers: itm.modifiers
        }
      });
    }

    // Update order totals
    await tx.order.update({
      where: { id: order.id },
      data: {
        subTotal: newSubTotal,
        taxAmount,
        discountAmount,
        walletDiscount: totals.walletDiscount,
        promoCodeId: promo ? promo.id : null,
        taxRules,
        totalAmount: newTotalAmount,
        updatedAt: new Date()
      }
    });
  });

  // Re-deduct inventory with updated items if order was already in processing
  if (wasDeducted) {
    await deductInventory(prisma, { id: order.id });
  }

  if (walletRefund > 0 && order.customerId) {
    const { refundWalletCredits } = require("../loyalty/loyalty-service");
    await refundWalletCredits(prisma, {
      customerId: order.customerId,
      storeId,
      orderId: order.id,
      amount: walletRefund,
      description: `Credits returned after Order #${order.id.slice(-6).toUpperCase()} was edited`
    }).catch(err => console.error("[Loyalty Refund Error on Edit]", err.message));
  }

  const updatedOrder = await getOrderById(storeId, order.id);

  // Broadcast real-time SSE updates to POS, KDS, Waiter, and Customer
  broadcastToStore(storeId, 'ORDER_UPDATED', updatedOrder);
  if (order.customerId) {
    broadcastToCustomer(order.customerId, 'ORDER_UPDATED', updatedOrder);
  }

  return updatedOrder;
}

// Which status changes staff may make by hand. Payment-driven moves (→ PROCESSING after
// a prepaid payment, → SETTLED once paid) go through the payments module as system updates.
const STATUS_TRANSITIONS = {
  DRAFT: ['PROCESSING', 'CANCELLED'],
  PENDING_VERIFICATION: ['PROCESSING', 'CANCELLED'],
  PENDING_PAYMENT: ['CANCELLED'],
  PROCESSING: ['READY', 'CANCELLED'],
  READY: ['SERVED', 'CANCELLED'],
  SERVED: ['SETTLED'],
  SETTLED: [],
  CANCELLED: []
};

// Extra role limits on top of STATUS_TRANSITIONS
const ROLE_ALLOWED_TARGETS = {
  KITCHEN_STAFF: ['READY'],
  WAITER: ['PROCESSING', 'SERVED', 'CANCELLED'],
  CASHIER: ['PROCESSING', 'READY', 'SERVED', 'SETTLED', 'CANCELLED']
};

function assertStaffTransition(actor, order, newStatus) {
  const allowed = STATUS_TRANSITIONS[order.status] || [];
  if (!allowed.includes(newStatus)) {
    throw createHttpError(409, `Cannot move an order from ${order.status} to ${newStatus}`);
  }

  const roleTargets = ROLE_ALLOWED_TARGETS[actor.role];
  if (actor.role === 'CUSTOMER' || (roleTargets && !roleTargets.includes(newStatus))) {
    throw createHttpError(403, `Your role cannot mark orders as ${newStatus}`);
  }
  // Waiters may only reject orders that haven't been accepted yet
  if (actor.role === 'WAITER' && newStatus === 'CANCELLED' && order.status !== 'PENDING_VERIFICATION') {
    throw createHttpError(403, "Only managers and cashiers can cancel accepted orders");
  }
  if (newStatus === 'SETTLED' && !order.paidAt) {
    throw createHttpError(409, "Collect payment from the checkout screen before settling this order");
  }
}

/**
 * @param {object} [options]
 * @param {string} [options.reason] Required when staff cancel an order
 */
async function updateOrderStatus(actor, storeId, orderId, newStatus, isSystem = false, options = {}) {
  if (!isSystem) {
    if (!actor) throw createHttpError(401, "Authentication required");
    await verifyStoreAccess(actor, storeId);
  }

  const prisma = getPrismaClient();
  const order = await prisma.order.findUnique({ where: { id: orderId } });

  if (!order || order.storeId !== storeId) {
    throw createHttpError(404, "Order not found");
  }

  const validStatuses = Object.keys(STATUS_TRANSITIONS);
  if (!validStatuses.includes(newStatus)) {
    throw createHttpError(400, `Invalid order status: ${newStatus}`);
  }
  if (order.status === newStatus) {
    return getOrderById(storeId, orderId);
  }

  const cancelReason = typeof options.reason === 'string' ? options.reason.trim().slice(0, 200) : '';

  if (!isSystem) {
    assertStaffTransition(actor, order, newStatus);
    if (newStatus === 'CANCELLED') {
      if (cancelReason.length < 3) {
        throw createHttpError(400, "Please give a reason for cancelling this order");
      }
      const paid = await prisma.payment.count({ where: { orderId, status: 'PAID' } });
      if (paid > 0 || order.paidAt) {
        throw createHttpError(409, "This order has been paid. Refund the customer before cancelling it.");
      }
    }
  }

  // Inventory reconciliation on status change:
  const wasDeducted = ['PROCESSING', 'READY', 'SERVED', 'SETTLED'].includes(order.status);
  const willBeDeducted = ['PROCESSING', 'READY', 'SERVED', 'SETTLED'].includes(newStatus);

  if (newStatus === 'CANCELLED' && wasDeducted) {
    await revertInventoryDeduction(prisma, order.id);
  } else if (willBeDeducted && !wasDeducted) {
    await deductInventory(prisma, order);
  }

  // A paid order is finished once it has been served
  if (newStatus === 'SERVED' && order.paidAt) {
    newStatus = 'SETTLED';
  }

  const updateData = { status: newStatus };

  if (newStatus === 'CANCELLED') {
    updateData.cancelReason = cancelReason || 'Cancelled by system';
    updateData.cancelledAt = new Date();
    updateData.cancelledById = !isSystem && actor ? actor.id : null;
    const { cancelPendingPaymentsFor } = require("../payments/payment-service");
    await cancelPendingPaymentsFor(storeId, { orderId }).catch(err => console.warn("[Cancel] pending payments:", err.message));
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: updateData,
    include: {
      table: true,
      items: {
        include: {
          menuItem: true,
          modifiers: {
            include: { modifierOption: true }
          }
        }
      }
    }
  });

  // Award cashback if transitioning to SETTLED, or refund wallet credits if cancelled
  if (newStatus === 'SETTLED') {
    try {
      const { creditOrderCashback } = require("../loyalty/loyalty-service");
      await creditOrderCashback(orderId);
    } catch (e) {
      console.error("[Loyalty Cashback Error on Status]", e.message);
    }
  } else if (newStatus === 'CANCELLED' && order.walletDiscount > 0 && order.customerId) {
    const { refundWalletCredits } = require("../loyalty/loyalty-service");
    await refundWalletCredits(prisma, {
      customerId: order.customerId,
      storeId,
      orderId: order.id,
      amount: order.walletDiscount,
      description: `Refund of credits for cancelled Order #${order.id.slice(-6).toUpperCase()}`
    }).catch(err => console.error("[Loyalty Refund Error on Cancel]", err.message));
  }
  
  // Broadcast updates across the store (KDS, POS, Waiter, Customer)
  broadcastToStore(storeId, `ORDER_${newStatus}`, updatedOrder);
  broadcastToStore(storeId, 'ORDER_UPDATED', updatedOrder);
  if (updatedOrder.customerId) {
    broadcastToCustomer(updatedOrder.customerId, `ORDER_${newStatus}`, updatedOrder);
    broadcastToCustomer(updatedOrder.customerId, 'ORDER_UPDATED', updatedOrder);
  }
  if (updatedOrder.sessionId) {
    broadcastToCustomer(updatedOrder.sessionId, `ORDER_${newStatus}`, updatedOrder);
    broadcastToCustomer(updatedOrder.sessionId, 'ORDER_UPDATED', updatedOrder);
  }

  // Centralized Quantum Notification dispatch on status changes
  try {
    const tableNum = updatedOrder.table?.tableNumber || 'N/A';
    const shortId = updatedOrder.id.slice(-6).toUpperCase();
    
    if (newStatus === 'PROCESSING') {
      sendNotification({
        storeId,
        type: 'ORDER_PROCESSING',
        title: 'Order Cooking',
        body: `Table ${tableNum}: Order #${shortId} is being prepared in the kitchen.`,
        data: { orderId: updatedOrder.id, tableNumber: tableNum, sound: 'notification.mp3', url: '/kds' },
        target: { roles: ['KITCHEN', 'STORE_MANAGER'], storeId }
      }).catch(() => {});
      if (updatedOrder.customerId || updatedOrder.sessionId) {
        sendNotification({
          storeId,
          type: 'ORDER_PROCESSING',
          title: 'Food is Cooking',
          body: `The kitchen has started preparing your order #${shortId}!`,
          data: { orderId: updatedOrder.id, sound: 'notification.mp3' },
          target: { customerId: updatedOrder.customerId, sessionId: updatedOrder.sessionId }
        }).catch(() => {});
      }
    } else if (newStatus === 'READY') {
      sendNotification({
        storeId,
        type: 'ORDER_READY',
        title: 'Order Ready for Pickup',
        body: `Table ${tableNum}: Order #${shortId} is hot and ready to serve!`,
        data: { orderId: updatedOrder.id, tableNumber: tableNum, sound: 'notification.mp3', url: '/waiter' },
        target: { roles: ['WAITER', 'STORE_MANAGER'], storeId }
      }).catch(() => {});
      if (updatedOrder.customerId || updatedOrder.sessionId) {
        sendNotification({
          storeId,
          type: 'ORDER_READY',
          title: 'Your Order is Ready!',
          body: `Order #${shortId} is ready and will be served to your table shortly!`,
          data: { orderId: updatedOrder.id, sound: 'notification.mp3' },
          target: { customerId: updatedOrder.customerId, sessionId: updatedOrder.sessionId }
        }).catch(() => {});
      }
    } else if (newStatus === 'SERVED') {
      if (updatedOrder.customerId || updatedOrder.sessionId) {
        sendNotification({
          storeId,
          type: 'ORDER_SERVED',
          title: 'Enjoy Your Meal!',
          body: `Order #${shortId} has been served. Have a wonderful dining experience!`,
          data: { orderId: updatedOrder.id, sound: 'notification.mp3' },
          target: { customerId: updatedOrder.customerId, sessionId: updatedOrder.sessionId }
        }).catch(() => {});
      }
    } else if (newStatus === 'SETTLED') {
      sendNotification({
        storeId,
        type: 'ORDER_SETTLED',
        title: 'Order Settled',
        body: `Table ${tableNum}: Order #${shortId} settled for ₹${updatedOrder.totalAmount}.`,
        data: { orderId: updatedOrder.id, tableNumber: tableNum, sound: 'notification.mp3', url: '/pos' },
        target: { roles: ['STORE_MANAGER', 'WAITER'], storeId }
      }).catch(() => {});
      if (updatedOrder.customerId || updatedOrder.sessionId) {
        sendNotification({
          storeId,
          type: 'ORDER_SETTLED',
          title: 'Payment Received',
          body: `Thank you for dining with us! Order #${shortId} has been paid and settled.`,
          data: { orderId: updatedOrder.id, sound: 'notification.mp3' },
          target: { customerId: updatedOrder.customerId, sessionId: updatedOrder.sessionId }
        }).catch(() => {});
      }
    } else if (newStatus === 'CANCELLED') {
      sendNotification({
        storeId,
        type: 'ORDER_CANCELLED',
        title: 'Order Cancelled',
        body: `Table ${tableNum}: Order #${shortId} was cancelled — ${updatedOrder.cancelReason}.`,
        data: { orderId: updatedOrder.id, tableNumber: tableNum, sound: 'notification.mp3' },
        target: { storeId }
      }).catch(() => {});
      if (updatedOrder.customerId || updatedOrder.sessionId) {
        sendNotification({
          storeId,
          type: 'ORDER_CANCELLED',
          title: 'Order Cancelled',
          body: `Order #${shortId} has been cancelled.`,
          data: { orderId: updatedOrder.id, sound: 'notification.mp3' },
          target: { customerId: updatedOrder.customerId, sessionId: updatedOrder.sessionId }
        }).catch(() => {});
      }
    }
  } catch (notifErr) {
    console.warn('[OrderStatus Notification Error]', notifErr.message);
  }

  // Invalidate table status cache on relevant status transitions
  invalidateTablesCache(storeId);
  
  return updatedOrder;
}

// 4. KDS FETCH
async function getKdsOrders(actor, storeId) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  const orders = await prisma.order.findMany({
    where: {
      storeId,
      status: { in: ['PROCESSING'] }
    },
    select: {
      id: true,
      type: true,
      table: {
        select: { tableNumber: true }
      },
      items: {
        select: {
          quantity: true,
          kitchenNotes: true,
          menuItem: { select: { name: true } },
          modifiers: {
            select: { modifierOption: { select: { name: true } } }
          }
        }
      },
      createdAt: true
    },
    orderBy: { createdAt: 'asc' }
  });
  
  return orders.map(serializeOrder);
}

// 5. STAFF INBOX & POS ACTIVE ORDERS
async function getActiveOrders(actor, storeId, statuses = []) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  const where = { storeId };
  if (statuses && statuses.length > 0) {
    where.status = { in: statuses };
  } else {
    where.status = { notIn: ['SETTLED', 'CANCELLED'] }; // default to all active
  }
  
  const orders = await prisma.order.findMany({
    where,
    include: {
      table: true,
      tableSession: true,
      items: {
        include: {
          menuItem: true,
          modifiers: {
            include: { modifierOption: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return orders.map(serializeOrder);
}

async function getOrderHistory(actor, storeId, filters = {}) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  const { page = 1, limit = 20, search, status, paymentModel, origin, startDate, endDate } = filters;
  
  const where = { storeId };
  
  if (search) {
    where.id = { contains: search, mode: 'insensitive' };
  }
  
  if (status) {
    where.status = status;
  }
  
  if (paymentModel) {
    where.paymentModel = paymentModel;
  }
  
  if (origin) {
    where.origin = origin;
  }
  
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }
  
  const skip = (page - 1) * limit;
  
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: {
        table: true,
        staff: { select: { name: true } },
        cancelledBy: { select: { name: true } },
        items: {
          include: {
            menuItem: true,
            modifiers: {
              include: { modifierOption: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit, 10)
    })
  ]);
  
  return {
    orders: orders.map(serializeOrder),
    pagination: {
      total,
      pages: Math.ceil(total / limit),
      current: parseInt(page, 10),
      limit: parseInt(limit, 10)
    }
  };
}

async function getOrderById(storeId, orderId) {
  const prisma = getPrismaClient();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      table: true,
      cancelledBy: { select: { name: true } },
      payments: {
        where: { status: 'PAID' },
        orderBy: { paidAt: 'asc' },
        select: { id: true, channel: true, amount: true, cashTendered: true, changeDue: true, paidAt: true }
      },
      items: {
        include: {
          menuItem: true,
          modifiers: {
            include: { modifierOption: true }
          }
        }
      }
    }
  });
  if (!order || order.storeId !== storeId) {
    throw createHttpError(404, "Order not found");
  }
  return serializeOrder(order);
}

// 6. TABLE SESSION BILLING
// Payment for a whole table goes through the payments module (Payment rows with tableSessionId).

/**
 * @param {object} [options]
 * @param {boolean} [options.includePin] Only staff callers may see the table PIN
 */
async function getTableSessionBill(storeId, tableSessionId, { includePin = false } = {}) {
  const prisma = getPrismaClient();
  const session = await prisma.tableSession.findUnique({
    where: { id: tableSessionId },
    include: {
      table: true,
      store: {
        include: {
          tenant: true
        }
      },
      orders: {
        include: {
          items: {
            include: {
              menuItem: true,
              modifiers: {
                include: { modifierOption: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!session || session.storeId !== storeId) {
    throw createHttpError(404, "Table session not found");
  }

  const validOrders = session.orders.filter(o => o.status !== 'CANCELLED');
  const itemsMap = new Map();

  let subTotal = 0;
  let totalTax = 0;
  let totalDiscount = 0;
  let grandTotal = 0;

  for (const order of validOrders) {
    subTotal += order.subTotal;
    totalTax += order.taxAmount;
    totalDiscount += order.discountAmount + (order.walletDiscount || 0);
    grandTotal += order.totalAmount;

    for (const rawItem of order.items) {
      const item = serializeOrderItem(rawItem);
      const modifierNames = item.modifiers.map(m => m.modifierOption?.name).filter(Boolean);
      const key = `${item.menuItemId}_${item.priceAtOrder}_${item.displayName}_${modifierNames.join(',')}`;
      if (itemsMap.has(key)) {
        itemsMap.get(key).quantity += item.quantity;
      } else {
        itemsMap.set(key, {
          name: item.displayName,
          price: item.priceAtOrder,
          quantity: item.quantity,
          dietary: item.menuItem?.dietary || 'VEG',
          modifiers: modifierNames
        });
      }
    }
  }

  return {
    session: {
      id: session.id,
      ...(includePin ? { pin: session.pin } : {}),
      status: session.status,
      paymentMethod: session.paymentMethod,
      cashAmount: session.cashAmount || 0,
      onlineAmount: session.onlineAmount || 0,
      tableNumber: session.table.tableNumber,
      createdAt: session.createdAt
    },
    store: {
      name: session.store.name,
      address: session.store.address,
      contactPhone: session.store.contactPhone,
      gstin: session.store.tenant?.gstin,
      companyLegalName: session.store.tenant?.companyLegalName || session.store.tenant?.name,
      taxRules: session.store.taxRules || []
    },
    ordersCount: validOrders.length,
    orders: validOrders.map(o => ({
      id: o.id,
      paymentModel: o.paymentModel,
      status: o.status,
      totalAmount: o.totalAmount,
      paidAt: o.paidAt,
      createdAt: o.createdAt
    })),
    aggregatedItems: Array.from(itemsMap.values()),
    subTotal,
    discountAmount: totalDiscount,
    taxAmount: totalTax,
    totalAmount: grandTotal
  };
}

async function findTableByNumber(prisma, storeId, tableNumber) {
  const num = parseInt(tableNumber, 10);
  if (!Number.isInteger(num)) throw createHttpError(400, "Invalid table number");
  const table = await prisma.table.findUnique({
    where: { storeId_tableNumber: { storeId, tableNumber: num } }
  });
  if (!table || !table.isActive) throw createHttpError(404, "Table not found");
  return table;
}

/**
 * Public: tells a guest whether the table is in use and whether their saved token belongs to it.
 * Never reveals the PIN and never accepts a PIN guess (use joinTableSession, which is rate limited).
 */
async function getTableSessionStatus(storeId, tableNumber, clientToken = null) {
  const prisma = getPrismaClient();
  const table = await findTableByNumber(prisma, storeId, tableNumber);

  let activeSession = await prisma.tableSession.findFirst({
    where: { storeId, tableId: table.id, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' }
  });
  activeSession = await expireIdleSession(prisma, activeSession);

  if (!activeSession) {
    return {
      tableNumber: table.tableNumber,
      tableId: table.id,
      hasActiveSession: false,
      tableSessionId: null,
      isJoined: false,
      expiresAt: null
    };
  }

  const isJoined = Boolean(clientToken && activeSession.sessionToken && clientToken === activeSession.sessionToken);
  const lastActive = activeSession.lastOrderAt || activeSession.updatedAt || activeSession.createdAt;

  return {
    tableNumber: table.tableNumber,
    tableId: table.id,
    hasActiveSession: true,
    // The session id unlocks the bill, so only guests already in the session get it
    tableSessionId: isJoined ? activeSession.id : null,
    isJoined,
    expiresAt: new Date(lastActive.getTime() + SESSION_IDLE_MS).toISOString()
  };
}

async function joinTableSession(storeId, tableNumber, pin) {
  const prisma = getPrismaClient();
  const table = await findTableByNumber(prisma, storeId, tableNumber);

  let activeSession = await prisma.tableSession.findFirst({
    where: { storeId, tableId: table.id, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' }
  });
  activeSession = await expireIdleSession(prisma, activeSession);

  if (!activeSession) {
    throw createHttpError(404, "No active dining session found on this table.");
  }

  const inputPin = String(pin || '').trim();
  if (inputPin !== activeSession.pin) {
    throw createHttpError(403, "Invalid Table PIN. Please enter the 4-digit PIN displayed on your companion's device or ask a waiter.");
  }

  let sessionToken = activeSession.sessionToken;
  if (!sessionToken) {
    sessionToken = crypto.randomBytes(24).toString('hex');
    await prisma.tableSession.update({
      where: { id: activeSession.id },
      data: { sessionToken }
    });
  }

  return {
    success: true,
    tableNumber: table.tableNumber,
    tableSessionId: activeSession.id,
    sessionToken,
    sessionPin: activeSession.pin
  };
}

/**
 * Staff: the active session for a table (used by POS to add items to an occupied table).
 */
async function getActiveTableSession(actor, storeId, tableId) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  const session = await prisma.tableSession.findFirst({
    where: { storeId, tableId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    include: {
      table: true,
      orders: {
        where: { status: { not: 'CANCELLED' } },
        orderBy: { createdAt: 'asc' },
        include: { items: { include: { menuItem: true, modifiers: { include: { modifierOption: true } } } } }
      }
    }
  });
  if (!session) return null;
  return {
    id: session.id,
    pin: session.pin,
    tableId: session.tableId,
    tableNumber: session.table.tableNumber,
    createdAt: session.createdAt,
    orders: session.orders.map(serializeOrder),
    totalAmount: session.orders.reduce((s, o) => s + o.totalAmount, 0)
  };
}

// 6. FAST ORDER STATS (INDEXED COUNTS FOR REALTIME POS DASHBOARD)
async function getOrderStats(actor, storeId) {
  if (actor) {
    await verifyStoreAccess(actor, storeId);
  }
  const prisma = getPrismaClient();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [totalToday, activeCount] = await Promise.all([
    prisma.order.count({
      where: {
        storeId,
        createdAt: { gte: startOfDay }
      }
    }),
    prisma.order.count({
      where: {
        storeId,
        status: { notIn: ['SETTLED', 'CANCELLED'] }
      }
    })
  ]);

  return { totalToday, activeCount };
}

module.exports = {
  createOrder,
  updateOrderStatus,
  updateOrderItems,
  getKdsOrders,
  getActiveOrders,
  getOrderStats,
  getOrderById,
  getOrderHistory,
  getTableSessionBill,
  getTableSessionStatus,
  joinTableSession,
  getActiveTableSession,
  serializeOrder
};
