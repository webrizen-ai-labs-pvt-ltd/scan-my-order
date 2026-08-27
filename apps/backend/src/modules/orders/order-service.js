const crypto = require("crypto");
const Razorpay = require("razorpay");
const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { verifyStoreAccess } = require("../menu/menu-service");
const { decrypt } = require("../../lib/encryption");
const { broadcastToStore } = require("./sse-service");
const { evaluateMenuItemAvailability } = require("../inventory/inventory-service");

// Helper to deduce price from menu and calculate totals
async function buildCartItems(prisma, storeId, itemsInput) {
  let totalAmount = 0;
  const items = [];
  
  for (const item of itemsInput) {
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: item.menuItemId }
    });
    
    if (!menuItem || menuItem.storeId !== storeId || menuItem.isManuallyDisabled || menuItem.isSystemDisabled) {
      throw createHttpError(400, `MenuItem ${item.menuItemId} is not available`);
    }
    
    let itemPrice = menuItem.price;
    const modifiers = [];
    
    if (item.modifiers && item.modifiers.length > 0) {
      for (const modId of item.modifiers) {
        const option = await prisma.menuModifierOption.findUnique({
          where: { id: modId },
          include: { group: true }
        });
        
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
    
    const quantity = item.quantity || 1;
    totalAmount += itemPrice * quantity;
    
    items.push({
      menuItemId: menuItem.id,
      quantity,
      kitchenNotes: item.kitchenNotes || null,
      priceAtOrder: menuItem.price, // Base price snapshot
      modifiers: {
        create: modifiers
      }
    });
  }
  
  return { items, totalAmount };
}

// 1. DRAFT CREATION
async function createOrder(storeId, actor, origin, input) {
  const prisma = getPrismaClient();
  const { type, tableId, paymentModel, items: itemsInput, promoCode } = input;
  
  // Validation based on Origin
  if (origin === 'QR_MENU') {
    if (!tableId) throw createHttpError(400, "tableId is required for QR_MENU orders");
  }
  
  const { items, totalAmount: subTotal } = await buildCartItems(prisma, storeId, itemsInput);
  const store = await prisma.store.findUnique({ where: { id: storeId } });

  let discountAmount = 0;
  let appliedPromoCodeId = null;

  if (promoCode) {
    const validPromo = await prisma.promoCode.findUnique({
       where: { storeId_code: { storeId, code: promoCode.toUpperCase() } }
    });
    
    if (validPromo && validPromo.isActive && (!validPromo.validUntil || validPromo.validUntil > new Date())) {
       if (subTotal >= validPromo.minOrderValue) {
          if (validPromo.discountType === 'PERCENTAGE') {
             discountAmount = Math.round(subTotal * (validPromo.discountValue / 100));
             if (validPromo.maxDiscount && discountAmount > validPromo.maxDiscount) {
                discountAmount = validPromo.maxDiscount;
             }
          } else {
             discountAmount = validPromo.discountValue;
          }
          if (discountAmount > subTotal) discountAmount = subTotal;
          appliedPromoCodeId = validPromo.id;
       } else {
          throw createHttpError(400, `Promo code requires minimum order value of ₹${validPromo.minOrderValue}`);
       }
    } else {
       throw createHttpError(400, "Invalid or expired promo code");
    }
  }

  let taxAmount = 0;
  if (store.taxRules && Array.isArray(store.taxRules)) {
     store.taxRules.forEach(tax => {
        taxAmount += Math.round(subTotal * (tax.rate / 100));
     });
  }

  const totalAmount = subTotal - discountAmount + taxAmount;
  
  let status = 'DRAFT';
  if (origin === 'QR_MENU' && paymentModel === 'POSTPAID') {
    status = 'PENDING_VERIFICATION';
  } else if (paymentModel === 'PREPAID') {
    status = 'PENDING_PAYMENT';
  } else if (origin === 'POS' && paymentModel === 'POSTPAID') {
    // A cashier punching a postpaid order can go straight to processing
    status = 'PROCESSING';
  }
  
  const order = await prisma.order.create({
    data: {
      storeId,
      origin,
      type,
      tableId: tableId || null,
      staffId: origin === 'POS' ? actor.id : null,
      paymentModel,
      status,
      subTotal,
      discountAmount,
      taxAmount,
      promoCodeId: appliedPromoCodeId,
      totalAmount,
      items: {
        create: items
      }
    },
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
  
  // Broadcast if it needs verification or went to processing
  if (status === 'PENDING_VERIFICATION') {
    broadcastToStore(storeId, 'ORDER_PENDING_VERIFICATION', order);
  } else if (status === 'PROCESSING') {
    await deductInventory(prisma, order);
    broadcastToStore(storeId, 'ORDER_PROCESSING', order);
  }
  
  // If prepaid, we need to generate a Razorpay order
  let paymentIntent = null;
  if (status === 'PENDING_PAYMENT') {
    paymentIntent = await generateRazorpayOrder(prisma, storeId, order);
  }
  
  return { order, paymentIntent };
}

async function generateRazorpayOrder(prisma, storeId, order) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { tenantId: true }
  });
  
  const gateway = await prisma.tenantPaymentGateway.findUnique({
    where: {
      tenantId_provider: {
        tenantId: store.tenantId,
        provider: 'RAZORPAY'
      }
    }
  });
  
  if (!gateway || !gateway.isActive) {
    throw createHttpError(400, "Razorpay is not configured for this tenant");
  }
  
  const razorpay = new Razorpay({
    key_id: decrypt(gateway.apiKey),
    key_secret: decrypt(gateway.secretKey)
  });
  
  const options = {
    amount: Math.round(order.totalAmount * 100), // Amount in paise
    currency: "INR",
    receipt: order.id
  };
  
  try {
    const rpOrder = await razorpay.orders.create(options);
    return rpOrder;
  } catch (error) {
    const errorMsg = error.error?.description || error.message || JSON.stringify(error);
    throw createHttpError(500, "Failed to communicate with Razorpay: " + errorMsg);
  }
}

async function generatePaymentLink(actor, storeId, orderId) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.storeId !== storeId) {
    throw createHttpError(404, "Order not found");
  }
  
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { tenantId: true }
  });
  
  const gateway = await prisma.tenantPaymentGateway.findUnique({
    where: {
      tenantId_provider: {
        tenantId: store.tenantId,
        provider: 'RAZORPAY'
      }
    }
  });
  
  if (!gateway || !gateway.isActive) {
    throw createHttpError(400, "Razorpay is not configured for this tenant");
  }
  
  const razorpay = new Razorpay({
    key_id: decrypt(gateway.apiKey),
    key_secret: decrypt(gateway.secretKey)
  });
  
  const options = {
    amount: Math.round(order.totalAmount * 100), // Amount in paise
    currency: "INR",
    accept_partial: false,
    reference_id: `${order.id}_${Date.now()}`,
    description: `Payment for Order ${order.id}`,
    customer: {
      name: "Customer",
      contact: "+919876543210"
    },
    notify: {
      sms: false,
      email: false
    },
    reminder_enable: false,
    notes: {
      order_id: order.id
    }
  };
  
  try {
    const paymentLink = await razorpay.paymentLink.create(options);
    return paymentLink;
  } catch (error) {
    const errorMsg = error.error?.description || error.message || JSON.stringify(error);
    throw createHttpError(500, "Failed to create payment link: " + errorMsg);
  }
}

// 2. PAYMENT WEBHOOK VALIDATION (Razorpay)
async function handleRazorpayWebhook(tenantId, payload, signature, rawBody) {
  const prisma = getPrismaClient();
  
  const gateway = await prisma.tenantPaymentGateway.findUnique({
    where: {
      tenantId_provider: {
        tenantId,
        provider: 'RAZORPAY'
      }
    }
  });
  
  if (!gateway) throw createHttpError(400, "Gateway not found");
  
  const webhookSecret = gateway.secretKey ? decrypt(gateway.secretKey) : null; 
  if (!webhookSecret) throw createHttpError(400, "Webhook secret not configured");
  
  // Validate signature using raw body if available, otherwise stringified payload
  const bodyToVerify = rawBody || JSON.stringify(payload);
  const isValid = Razorpay.validateWebhookSignature(bodyToVerify, signature, webhookSecret);
  
  if (!isValid) {
    console.error("[Webhook Error] Signature mismatch! Body length:", bodyToVerify.length, "Signature:", signature);
    throw createHttpError(401, "Invalid webhook signature");
  }
  
  console.log(`[Webhook Success] Received event: ${payload.event}`);
  
  console.log("[Webhook] Received Razorpay Webhook:", payload.event);

  let orderId = null;

  // Handle standard payment captured
  if (payload.event === 'payment.captured' || payload.event === 'payment.authorized') {
    orderId = payload.payload.payment.entity.notes?.order_id;
  } 
  // Handle payment link paid
  else if (payload.event === 'payment_link.paid') {
    orderId = payload.payload.payment_link.entity.notes?.order_id;
    if (!orderId && payload.payload.payment_link.entity.reference_id) {
       orderId = payload.payload.payment_link.entity.reference_id.split('_')[0];
    }
  }

  if (orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (order) {
      if (order.status === 'PENDING_PAYMENT') {
        await updateOrderStatus(null, order.storeId, order.id, 'PROCESSING', true);
      } else if (order.paymentModel === 'POSTPAID' && order.status !== 'SETTLED' && order.status !== 'CANCELLED') {
        // If a postpaid order receives a successful payment via Waiter generated link, it is instantly settled.
        await updateOrderStatus(null, order.storeId, order.id, 'SETTLED', true);
      }
    } else {
      console.log("[Webhook] Order not found for ID:", orderId);
    }
  } else {
    console.log("[Webhook] Could not extract orderId from payload");
  }
  
  return { success: true };
}

async function verifyRazorpayPayment(actor, storeId, orderId) {
  if (actor) await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.storeId !== storeId) throw createHttpError(404, "Order not found");
  
  if (['PROCESSING', 'SETTLED', 'READY', 'SERVED'].includes(order.status)) {
    return { success: true, status: order.status, message: "Order is already paid/processed." };
  }

  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { tenantId: true } });
  const gateway = await prisma.tenantPaymentGateway.findUnique({
    where: { tenantId_provider: { tenantId: store.tenantId, provider: 'RAZORPAY' } }
  });
  
  if (!gateway || !gateway.isActive) throw createHttpError(400, "Razorpay is not configured");
  
  const razorpay = new Razorpay({
    key_id: decrypt(gateway.apiKey),
    key_secret: decrypt(gateway.secretKey)
  });

  try {
    // 1. Check recent payment links
    let match = null;
    try {
      const links = await razorpay.paymentLink.all({ count: 50 });
      const items = links?.payment_links || links?.items || [];
      const allMatches = items.filter(l => l.notes?.order_id === orderId || (l.reference_id && l.reference_id.startsWith(`${orderId}_`)));
      match = allMatches.find(l => l.status === 'paid' || l.status === 'partially_paid');
    } catch(err) {
      console.warn("Could not fetch payment links:", err.message || err);
    }
    
    if (match && (match.status === 'paid' || match.status === 'partially_paid')) {
      let newStatus = order.paymentModel === 'POSTPAID' ? 'SETTLED' : 'PROCESSING';
      await updateOrderStatus(null, storeId, orderId, newStatus, true);
      return { success: true, status: newStatus, message: "Payment verified successfully via Link!" };
    }

    // 2. Check Razorpay Orders (Prepaid POS without QR)
    let rpOrder = null;
    try {
      const rpOrders = await razorpay.orders.all({ receipt: orderId });
      if (rpOrders && rpOrders.items && rpOrders.items.length > 0) {
        rpOrder = rpOrders.items[0];
      }
    } catch(err) {
      console.warn("Could not fetch razorpay orders:", err.message || err);
    }

    if (rpOrder && rpOrder.status === 'paid') {
      await updateOrderStatus(null, storeId, orderId, 'PROCESSING', true);
      return { success: true, status: 'PROCESSING', message: "Payment verified successfully via Order!" };
    }

    return { success: false, status: order.status, message: "Payment not completed yet on Razorpay." };

  } catch (err) {
    console.error("Razorpay verification failed:", err);
    const msg = err.error?.description || err.message || err.description || String(err);
    throw createHttpError(500, "Failed to verify with Razorpay: " + msg);
  }
}

// 3. LIFECYCLE MANAGEMENT
async function deductInventory(prisma, order) {
  // Simple deduction loop for V1
  const items = await prisma.orderItem.findMany({
    where: { orderId: order.id },
    include: {
      menuItem: { include: { recipe: true } },
      modifiers: {
        include: { modifierOption: { include: { recipe: true } } }
      }
    }
  });
  
  for (const item of items) {
    // Deduct base item
    for (const rec of item.menuItem.recipe) {
      await prisma.stockTransaction.create({
        data: {
          materialId: rec.rawMaterialId,
          type: 'CONSUME',
          quantity: rec.quantity * item.quantity,
          reference: `Order ${order.id}`
        }
      });
      await prisma.rawMaterial.update({
        where: { id: rec.rawMaterialId },
        data: { currentStock: { decrement: rec.quantity * item.quantity } }
      });
      await evaluateMenuItemAvailability(prisma, rec.rawMaterialId);
    }
    
    // Deduct modifiers
    for (const mod of item.modifiers) {
      for (const rec of mod.modifierOption.recipe) {
        await prisma.stockTransaction.create({
          data: {
            materialId: rec.rawMaterialId,
            type: 'CONSUME',
            quantity: rec.quantity * item.quantity,
            reference: `Order ${order.id} Mod`
          }
        });
        await prisma.rawMaterial.update({
          where: { id: rec.rawMaterialId },
          data: { currentStock: { decrement: rec.quantity * item.quantity } }
        });
        await evaluateMenuItemAvailability(prisma, rec.rawMaterialId);
      }
    }
  }
}

async function updateOrderStatus(actor, storeId, orderId, newStatus, isSystem = false) {
  if (!isSystem && actor) {
    await verifyStoreAccess(actor, storeId);
  }
  
  const prisma = getPrismaClient();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  
  if (!order || order.storeId !== storeId) {
    throw createHttpError(404, "Order not found");
  }
  
  // State machine rules
  if (newStatus === 'PROCESSING' && (order.status === 'PENDING_VERIFICATION' || order.status === 'PENDING_PAYMENT')) {
    // Waiter approved QR POSTPAID order, or Razorpay webhook confirmed PREPAID order
    await deductInventory(prisma, order);
  }
  
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { status: newStatus }
  });
  
  // Broadcast
  broadcastToStore(storeId, `ORDER_${newStatus}`, updatedOrder);
  
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
  
  return orders;
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
  
  return await prisma.order.findMany({
    where,
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
    },
    orderBy: { createdAt: 'desc' }
  });
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
    orders,
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
  return order;
}

module.exports = {
  createOrder,
  handleRazorpayWebhook,
  updateOrderStatus,
  getKdsOrders,
  getActiveOrders,
  generatePaymentLink,
  verifyRazorpayPayment,
  getOrderById,
  getOrderHistory
};
