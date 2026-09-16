const crypto = require("crypto");
const Razorpay = require("razorpay");
const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { verifyStoreAccess } = require("../menu/menu-service");
const { decrypt } = require("../../lib/encryption");
const { broadcastToStore, broadcastToCustomer } = require("./sse-service");
const { evaluateMenuItemAvailability } = require("../inventory/inventory-service");

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

  return openItem;
}

// Helper to deduce price from menu and calculate totals
async function buildCartItems(prisma, storeId, itemsInput) {
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
    
    if (!menuItem || menuItem.storeId !== storeId || (!isCustom && (menuItem.isManuallyDisabled || menuItem.isSystemDisabled))) {
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
    
    const quantity = item.quantity || 1;
    totalAmount += itemPrice * quantity;

    const encodedNotes = encodeKitchenNotes(
      isCustom ? (item.customName || 'Open Custom Dish') : item.customName,
      item.customIngredients || [],
      item.kitchenNotes || ''
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
  
  const { paymentMethod, cashAmount, onlineAmount } = input;
  let resolvedPaymentMethod = null;
  let resolvedCashAmount = 0;
  let resolvedOnlineAmount = 0;

  if (paymentMethod) {
    if (!['CASH', 'ONLINE', 'SPLIT'].includes(paymentMethod)) {
      throw createHttpError(400, "Invalid paymentMethod. Must be CASH, ONLINE, or SPLIT");
    }
    resolvedPaymentMethod = paymentMethod;
    if (paymentMethod === 'CASH') {
      resolvedCashAmount = totalAmount;
      resolvedOnlineAmount = 0;
    } else if (paymentMethod === 'ONLINE') {
      resolvedCashAmount = 0;
      resolvedOnlineAmount = totalAmount;
    } else if (paymentMethod === 'SPLIT') {
      const cAmt = Number(cashAmount) || 0;
      const oAmt = Number(onlineAmount) || 0;
      if (cAmt + oAmt !== totalAmount) {
        throw createHttpError(400, `Split payment amounts (Cash ₹${cAmt} + Online ₹${oAmt}) must equal total amount ₹${totalAmount}`);
      }
      resolvedCashAmount = cAmt;
      resolvedOnlineAmount = oAmt;
    }
  }

  let status = 'DRAFT';
  if (origin === 'QR_MENU' && paymentModel === 'POSTPAID') {
    status = 'PENDING_VERIFICATION';
  } else if (paymentModel === 'PREPAID') {
    if (origin === 'POS' && resolvedPaymentMethod === 'CASH') {
      status = 'SETTLED';
    } else {
      status = 'PENDING_PAYMENT';
    }
  } else if (origin === 'POS' && paymentModel === 'POSTPAID') {
    // A cashier punching a postpaid order can go straight to processing
    status = 'PROCESSING';
  }

  // Handle Table Session Token / PIN Logic
  let tableSession = null;
  if (tableId) {
    tableSession = await prisma.tableSession.findFirst({
      where: {
        storeId,
        tableId,
        status: 'ACTIVE'
      }
    });

    if (!tableSession) {
      // First order for this table dining session: generate 4-digit numeric PIN (1000 - 9999)
      const generatedPin = String(Math.floor(1000 + Math.random() * 9000));
      tableSession = await prisma.tableSession.create({
        data: {
          storeId,
          tableId,
          pin: generatedPin,
          status: 'ACTIVE'
        }
      });
    } else {
      // Table has an active session in progress
      if (origin === 'QR_MENU') {
        const providedPin = input.pin ? String(input.pin).trim() : null;
        if (!providedPin || providedPin !== tableSession.pin) {
          throw createHttpError(403, "Invalid Table PIN. An active dining session is already in progress for this table. Please enter the 4-digit table PIN.");
        }
      }
    }
  }
  
  const order = await prisma.order.create({
    data: {
      storeId,
      origin,
      type,
      tableId: tableId || null,
      tableSessionId: tableSession ? tableSession.id : null,
      staffId: origin === 'POS' && actor ? actor.id : null,
      customerId: origin === 'QR_MENU' && actor ? actor.id : null,
      sessionId: input.sessionId || null,
      paymentModel,
      paymentMethod: resolvedPaymentMethod,
      cashAmount: resolvedCashAmount,
      onlineAmount: resolvedOnlineAmount,
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
  
  // Broadcast if it needs verification or went to processing
  if (status === 'PENDING_VERIFICATION') {
    broadcastToStore(storeId, 'ORDER_PENDING_VERIFICATION', order);
    if (order.customerId) broadcastToCustomer(order.customerId, 'ORDER_PENDING_VERIFICATION', order);
    if (order.sessionId) broadcastToCustomer(order.sessionId, 'ORDER_PENDING_VERIFICATION', order);
  } else if (status === 'PROCESSING') {
    await deductInventory(prisma, order);
    broadcastToStore(storeId, 'ORDER_PROCESSING', order);
    if (order.customerId) broadcastToCustomer(order.customerId, 'ORDER_PROCESSING', order);
    if (order.sessionId) broadcastToCustomer(order.sessionId, 'ORDER_PROCESSING', order);
  }
  
  // If prepaid, we need to generate a Razorpay order
  let paymentIntent = null;
  if (status === 'PENDING_PAYMENT') {
    paymentIntent = await generateRazorpayOrder(prisma, storeId, order);
  }
  
  return { 
    order, 
    paymentIntent,
    tableSessionId: tableSession ? tableSession.id : null,
    sessionPin: tableSession ? tableSession.pin : null
  };
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

async function generatePaymentLink(actor, storeId, orderId, customOnlineAmount = null) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.storeId !== storeId) {
    throw createHttpError(404, "Order not found");
  }

  let payableAmount = order.totalAmount;
  if (customOnlineAmount && Number(customOnlineAmount) > 0) {
    payableAmount = Number(customOnlineAmount);
  } else if (order.paymentMethod === 'SPLIT' && order.onlineAmount > 0) {
    payableAmount = order.onlineAmount;
  }

  if (order.paymentLinkId && order.paymentLinkUrl && !customOnlineAmount && order.onlineAmount === payableAmount) {
    return {
      id: order.paymentLinkId,
      short_url: order.paymentLinkUrl,
      totalAmount: payableAmount
    };
  }
  
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { tenantId: true, name: true, slug: true }
  });
  
  const gateway = await prisma.tenantPaymentGateway.findUnique({
    where: {
      tenantId_provider: {
        tenantId: store.tenantId,
        provider: 'RAZORPAY'
      }
    }
  });

  // Determine UPI VPA:
  // 1) Gateway merchantId if contains '@' (e.g. restaurant@okhdfcbank)
  // 2) Default restaurant UPI VPA
  const upiVpa = (gateway?.merchantId && gateway.merchantId.includes('@'))
    ? gateway.merchantId
    : 'scanmyorder@okaxis';

  const payeeName = store.name || 'Restaurant';
  const orderRef = order.id.slice(-6).toUpperCase();
  const trRef = `ORD_${order.id}_${Date.now()}`;
  
  // Standard NPCI UPI dynamic QR deep-link format
  const upiUrl = `upi://pay?pa=${upiVpa}&pn=${encodeURIComponent(payeeName)}&am=${payableAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order #${orderRef}`)}&tr=${trRef}`;
  const qrId = `upi_qr_${order.id}_${Date.now()}`;

  // Optionally create a Razorpay Order for tracking if credentials exist
  if (gateway && gateway.isActive) {
    try {
      const razorpay = new Razorpay({
        key_id: decrypt(gateway.apiKey),
        key_secret: decrypt(gateway.secretKey)
      });
      await razorpay.orders.create({
        amount: Math.round(payableAmount * 100),
        currency: "INR",
        receipt: `ord_${order.id.slice(-8)}_${Date.now().toString().slice(-4)}`,
        notes: {
          order_id: order.id,
          payable_amount: String(payableAmount),
          upi_vpa: upiVpa
        }
      });
    } catch (e) {
      console.warn("[UPI Dynamic QR] Notice on optional Razorpay order tracking:", e.message || e);
    }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentLinkId: qrId,
      paymentLinkUrl: upiUrl,
      onlineAmount: payableAmount,
      paymentMethod: payableAmount < order.totalAmount ? 'SPLIT' : (order.paymentMethod || 'ONLINE'),
      cashAmount: payableAmount < order.totalAmount ? (order.totalAmount - payableAmount) : order.cashAmount
    }
  });

  return {
    id: qrId,
    short_url: upiUrl,
    totalAmount: payableAmount,
    is_upi_dynamic_qr: true
  };
}

async function checkPaymentStatus(storeId, orderId) {
  const prisma = getPrismaClient();
  
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.storeId !== storeId) {
    throw createHttpError(404, "Order not found");
  }
  
  if (order.status === 'SETTLED' || (order.status === 'PROCESSING' && order.paymentModel === 'PREPAID')) {
    return { status: 'success' };
  }
  
  if (!order.paymentLinkId) {
    return { status: 'pending' };
  }

  // Check if Razorpay order tracking reports paid (if gateway configured)
  try {
    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { tenantId: true } });
    const gateway = await prisma.tenantPaymentGateway.findUnique({
      where: { tenantId_provider: { tenantId: store.tenantId, provider: 'RAZORPAY' } }
    });
    if (gateway && gateway.isActive) {
      const razorpay = new Razorpay({
        key_id: decrypt(gateway.apiKey),
        key_secret: decrypt(gateway.secretKey)
      });
      const rpOrders = await razorpay.orders.all({ receipt: orderId });
      const paidOrder = rpOrders?.items?.find(o => o.status === 'paid');
      if (paidOrder) {
        const newStatus = order.paymentModel === 'PREPAID' ? 'PROCESSING' : 'SETTLED';
        await updateOrderStatus(null, storeId, orderId, newStatus, true);
        return { status: 'success' };
      }
    }
  } catch (err) {
    // ignore
  }

  return { status: 'pending' };
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
    const tableSessionId = payload.payload.payment_link.entity.notes?.tableSessionId ||
      (payload.payload.payment_link.entity.reference_id?.startsWith('sess_') ? payload.payload.payment_link.entity.reference_id.split('_')[1] : null);

    if (tableSessionId) {
      await settleTableSession(null, null, tableSessionId, true);
      return { success: true };
    }

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

async function verifyRazorpayPayment(actor, storeId, orderId, manual = false, isPolling = false) {
  const prisma = getPrismaClient();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  
  if (!order || order.storeId !== storeId) throw createHttpError(404, "Order not found");

  if (actor) {
    if (actor.role === 'CUSTOMER') {
      if (order.customerId !== actor.id) {
        throw createHttpError(403, "Forbidden");
      }
    } else {
      await verifyStoreAccess(actor, storeId);
    }
  }
  
  if (['PROCESSING', 'SETTLED', 'READY', 'SERVED'].includes(order.status)) {
    return { success: true, status: order.status, message: "Order is already paid/processed." };
  }

  // Check if Razorpay order is paid (if gateway configured)
  let rpOrderPaid = false;
  try {
    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { tenantId: true } });
    const gateway = await prisma.tenantPaymentGateway.findUnique({
      where: { tenantId_provider: { tenantId: store.tenantId, provider: 'RAZORPAY' } }
    });
    if (gateway && gateway.isActive) {
      const razorpay = new Razorpay({
        key_id: decrypt(gateway.apiKey),
        key_secret: decrypt(gateway.secretKey)
      });
      const rpOrders = await razorpay.orders.all({ receipt: orderId });
      if (rpOrders?.items?.some(o => o.status === 'paid')) {
        rpOrderPaid = true;
      }
    }
  } catch (e) {
    // ignore
  }

  // If order was paid via gateway or staff manually verified
  if (rpOrderPaid || (manual || !isPolling)) {
    const newStatus = order.paymentModel === 'POSTPAID' ? 'SETTLED' : 'PROCESSING';
    await updateOrderStatus(actor, storeId, orderId, newStatus, true);
    return { 
      success: true, 
      status: newStatus, 
      message: rpOrderPaid 
        ? "Payment verified successfully via Razorpay Order!" 
        : "UPI QR Payment verified successfully!" 
    };
  }

  return { success: false, status: order.status, message: "Payment pending on UPI QR." };
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
  
  for (const item of items) {
    // Deduct base item recipe if any
    if (item.menuItem?.recipe) {
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
    }
    
    // Deduct modifiers
    for (const mod of item.modifiers) {
      if (mod.modifierOption?.recipe) {
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

    // Deduct custom ingredients
    const decoded = decodeKitchenNotes(item.kitchenNotes);
    if (decoded.customIngredients && Array.isArray(decoded.customIngredients)) {
      for (const ing of decoded.customIngredients) {
        if (ing.rawMaterialId && Number(ing.quantity) > 0) {
          const consumeQty = Number(ing.quantity) * item.quantity;
          await prisma.stockTransaction.create({
            data: {
              materialId: ing.rawMaterialId,
              type: 'CONSUME',
              quantity: consumeQty,
              reference: `Order ${order.id} Ingredient: ${ing.name || 'Custom'}`
            }
          });
          await prisma.rawMaterial.update({
            where: { id: ing.rawMaterialId },
            data: { currentStock: { decrement: consumeQty } }
          });
          await evaluateMenuItemAvailability(prisma, ing.rawMaterialId);
        }
      }
    }
  }
}

// Helper: Revert inventory deductions when items are updated
async function revertInventoryDeduction(prisma, orderId) {
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    include: {
      menuItem: { include: { recipe: true } },
      modifiers: {
        include: { modifierOption: { include: { recipe: true } } }
      }
    }
  });

  for (const item of items) {
    if (item.menuItem?.recipe) {
      for (const rec of item.menuItem.recipe) {
        const restoreQty = rec.quantity * item.quantity;
        await prisma.stockTransaction.create({
          data: {
            materialId: rec.rawMaterialId,
            type: 'RESTOCK',
            quantity: restoreQty,
            reference: `Revert Order ${orderId} (Manager Item Edit)`
          }
        });
        await prisma.rawMaterial.update({
          where: { id: rec.rawMaterialId },
          data: { currentStock: { increment: restoreQty } }
        });
        await evaluateMenuItemAvailability(prisma, rec.rawMaterialId);
      }
    }

    for (const mod of item.modifiers) {
      if (mod.modifierOption?.recipe) {
        for (const rec of mod.modifierOption.recipe) {
          const restoreQty = rec.quantity * item.quantity;
          await prisma.stockTransaction.create({
            data: {
              materialId: rec.rawMaterialId,
              type: 'RESTOCK',
              quantity: restoreQty,
              reference: `Revert Order ${orderId} Mod (Manager Item Edit)`
            }
          });
          await prisma.rawMaterial.update({
            where: { id: rec.rawMaterialId },
            data: { currentStock: { increment: restoreQty } }
          });
          await evaluateMenuItemAvailability(prisma, rec.rawMaterialId);
        }
      }
    }

    const decoded = decodeKitchenNotes(item.kitchenNotes);
    if (decoded.customIngredients && Array.isArray(decoded.customIngredients)) {
      for (const ing of decoded.customIngredients) {
        if (ing.rawMaterialId && Number(ing.quantity) > 0) {
          const restoreQty = Number(ing.quantity) * item.quantity;
          await prisma.stockTransaction.create({
            data: {
              materialId: ing.rawMaterialId,
              type: 'RESTOCK',
              quantity: restoreQty,
              reference: `Revert Order ${orderId} Ingredient: ${ing.name || 'Custom'}`
            }
          });
          await prisma.rawMaterial.update({
            where: { id: ing.rawMaterialId },
            data: { currentStock: { increment: restoreQty } }
          });
          await evaluateMenuItemAvailability(prisma, ing.rawMaterialId);
        }
      }
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

  if (order.status === 'CANCELLED') {
    throw createHttpError(400, "Cannot modify items in a cancelled order");
  }

  const { items: itemsInput } = input;
  if (!itemsInput || !Array.isArray(itemsInput) || itemsInput.length === 0) {
    throw createHttpError(400, "Order must contain at least one item");
  }

  const { items: newItemsData, totalAmount: newSubTotal } = await buildCartItems(prisma, storeId, itemsInput);

  // Recalculate promo discount if applicable
  let discountAmount = 0;
  if (order.promoCodeId && order.promoCode) {
    const promo = order.promoCode;
    if (newSubTotal >= promo.minOrderValue) {
      if (promo.discountType === 'PERCENTAGE') {
        discountAmount = Math.round(newSubTotal * (promo.discountValue / 100));
        if (promo.maxDiscount && discountAmount > promo.maxDiscount) {
          discountAmount = promo.maxDiscount;
        }
      } else {
        discountAmount = promo.discountValue;
      }
      if (discountAmount > newSubTotal) discountAmount = newSubTotal;
    }
  }

  // Recalculate taxes
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  let taxAmount = 0;
  if (store.taxRules && Array.isArray(store.taxRules)) {
    store.taxRules.forEach(tax => {
      taxAmount += Math.round(newSubTotal * (tax.rate / 100));
    });
  }

  const newTotalAmount = newSubTotal - discountAmount + taxAmount;

  // Inventory reconciliation:
  const wasDeducted = ['PROCESSING', 'READY', 'SERVED', 'COMPLETED', 'BILL_REQUESTED'].includes(order.status);
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
        totalAmount: newTotalAmount,
        updatedAt: new Date()
      }
    });
  });

  // Re-deduct inventory with updated items if order was already in processing
  if (wasDeducted) {
    await deductInventory(prisma, { id: order.id });
  }

  const updatedOrder = await getOrderById(storeId, order.id);

  // Broadcast real-time SSE updates to POS, KDS, Waiter, and Customer
  broadcastToStore(storeId, 'ORDER_UPDATED', updatedOrder);
  if (order.customerId) {
    broadcastToCustomer(order.customerId, 'ORDER_UPDATED', updatedOrder);
  }

  return updatedOrder;
}

async function updateOrderStatus(actor, storeId, orderId, newStatus, isSystem = false, tenderDetails = null) {
  if (!isSystem && actor) {
    await verifyStoreAccess(actor, storeId);
  }
  
  const prisma = getPrismaClient();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  
  if (!order || order.storeId !== storeId) {
    throw createHttpError(404, "Order not found");
  }

  const validStatuses = ['DRAFT', 'PENDING_VERIFICATION', 'PENDING_PAYMENT', 'PROCESSING', 'READY', 'SERVED', 'SETTLED', 'CANCELLED'];
  if (!validStatuses.includes(newStatus)) {
    throw createHttpError(400, `Invalid order status: ${newStatus}`);
  }
  
  // Inventory reconciliation on status change:
  const wasDeducted = ['PROCESSING', 'READY', 'SERVED', 'SETTLED'].includes(order.status);
  const willBeDeducted = ['PROCESSING', 'READY', 'SERVED', 'SETTLED'].includes(newStatus);

  if (newStatus === 'CANCELLED' && wasDeducted) {
    // Revert inventory when order is cancelled
    await revertInventoryDeduction(prisma, order.id);
  } else if (willBeDeducted && !wasDeducted) {
    // Deduct inventory if moving from DRAFT, PENDING_VERIFICATION, PENDING_PAYMENT, or CANCELLED to active/settled
    await deductInventory(prisma, order);
  }
  
  if (newStatus === 'SERVED' && order.paymentModel === 'PREPAID') {
    newStatus = 'SETTLED';
  }
  
  const updateData = { status: newStatus };
  if (tenderDetails) {
    if (tenderDetails.paymentMethod) updateData.paymentMethod = tenderDetails.paymentMethod;
    if (tenderDetails.cashAmount !== undefined) updateData.cashAmount = Number(tenderDetails.cashAmount);
    if (tenderDetails.onlineAmount !== undefined) updateData.onlineAmount = Number(tenderDetails.onlineAmount);
  } else if (newStatus === 'SETTLED' && !order.paymentMethod) {
    updateData.paymentMethod = 'CASH';
    updateData.cashAmount = order.totalAmount;
    updateData.onlineAmount = 0;
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

// 6. TABLE SESSION SETTLEMENT & BILLING
async function settleTableSession(actor, storeId, tableSessionId, isSystem = false, tenderDetails = null) {
  const prisma = getPrismaClient();
  const session = await prisma.tableSession.findUnique({
    where: { id: tableSessionId },
    include: { table: true }
  });

  if (!session) throw createHttpError(404, "Table session not found");
  const actualStoreId = storeId || session.storeId;
  if (!isSystem && actor) {
    await verifyStoreAccess(actor, actualStoreId);
  }

  const activeOrders = await prisma.order.findMany({
    where: {
      tableSessionId,
      status: { notIn: ['SETTLED', 'CANCELLED'] }
    },
    include: {
      items: { include: { menuItem: true, modifiers: { include: { modifierOption: true } } } },
      table: true
    }
  });

  const totalSessionAmount = activeOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  let paymentMethod = tenderDetails?.paymentMethod || null;
  let cashAmount = tenderDetails?.cashAmount !== undefined ? Number(tenderDetails.cashAmount) : 0;
  let onlineAmount = tenderDetails?.onlineAmount !== undefined ? Number(tenderDetails.onlineAmount) : 0;

  if (paymentMethod === 'CASH') {
    cashAmount = totalSessionAmount;
    onlineAmount = 0;
  } else if (paymentMethod === 'ONLINE') {
    cashAmount = 0;
    onlineAmount = totalSessionAmount;
  } else if (!paymentMethod && isSystem) {
    paymentMethod = 'ONLINE';
    cashAmount = 0;
    onlineAmount = totalSessionAmount;
  } else if (!paymentMethod) {
    paymentMethod = 'CASH';
    cashAmount = totalSessionAmount;
    onlineAmount = 0;
  }

  if (activeOrders.length > 0) {
    await prisma.order.updateMany({
      where: {
        tableSessionId,
        status: { notIn: ['SETTLED', 'CANCELLED'] }
      },
      data: {
        status: 'SETTLED',
        paymentMethod,
        cashAmount: activeOrders.length === 1 ? cashAmount : Math.round(cashAmount / activeOrders.length),
        onlineAmount: activeOrders.length === 1 ? onlineAmount : Math.round(onlineAmount / activeOrders.length)
      }
    });
  }

  const updatedSession = await prisma.tableSession.update({
    where: { id: tableSessionId },
    data: {
      status: 'SETTLED',
      paymentMethod,
      cashAmount,
      onlineAmount
    }
  });

  for (const order of activeOrders) {
    const settledOrder = { ...order, status: 'SETTLED', paymentMethod, cashAmount, onlineAmount };
    broadcastToStore(actualStoreId, 'ORDER_SETTLED', settledOrder);
    if (order.customerId) broadcastToCustomer(order.customerId, 'ORDER_SETTLED', settledOrder);
    if (order.sessionId) broadcastToCustomer(order.sessionId, 'ORDER_SETTLED', settledOrder);
  }
  broadcastToStore(actualStoreId, 'TABLE_SESSION_SETTLED', { tableSessionId, tableId: session.tableId });

  return { success: true, tableSessionId, settledOrdersCount: activeOrders.length, session: updatedSession };
}

async function generateSessionPaymentLink(actor, storeId, tableSessionId, customOnlineAmount = null) {
  if (actor) await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();

  const session = await prisma.tableSession.findUnique({
    where: { id: tableSessionId },
    include: {
      table: true,
      orders: {
        where: { status: { notIn: ['SETTLED', 'CANCELLED'] } }
      }
    }
  });

  if (!session || session.storeId !== storeId) {
    throw createHttpError(404, "Table session not found");
  }

  if (session.orders.length === 0) {
    throw createHttpError(400, "No unsettled orders in this session");
  }

  const totalAmount = session.orders.reduce((sum, o) => sum + o.totalAmount, 0);
  if (totalAmount <= 0) {
    throw createHttpError(400, "Total amount must be greater than 0");
  }

  let payableAmount = totalAmount;
  if (customOnlineAmount && Number(customOnlineAmount) > 0) {
    payableAmount = Number(customOnlineAmount);
  }

  // Check if an existing link exists matching amount
  const existingLink = session.orders.find(o => o.paymentLinkUrl && o.paymentLinkId);
  if (existingLink && !customOnlineAmount && existingLink.onlineAmount === payableAmount) {
    return {
      id: existingLink.paymentLinkId,
      short_url: existingLink.paymentLinkUrl,
      totalAmount: payableAmount
    };
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { tenantId: true, name: true, slug: true }
  });

  const gateway = await prisma.tenantPaymentGateway.findUnique({
    where: {
      tenantId_provider: {
        tenantId: store.tenantId,
        provider: 'RAZORPAY'
      }
    }
  });

  const upiVpa = (gateway?.merchantId && gateway.merchantId.includes('@'))
    ? gateway.merchantId
    : 'scanmyorder@okaxis';

  const payeeName = store.name || 'Restaurant';
  const tableNum = session.table?.tableNumber || '';
  const trRef = `SESS_${tableSessionId}_${Date.now()}`;
  const upiUrl = `upi://pay?pa=${upiVpa}&pn=${encodeURIComponent(payeeName)}&am=${payableAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Table ${tableNum} Bill`)}&tr=${trRef}`;
  const qrId = `upi_sess_${tableSessionId}_${Date.now()}`;

  // Optionally create a Razorpay Order for tracking if gateway is configured
  if (gateway && gateway.isActive) {
    try {
      const razorpay = new Razorpay({
        key_id: decrypt(gateway.apiKey),
        key_secret: decrypt(gateway.secretKey)
      });
      await razorpay.orders.create({
        amount: Math.round(payableAmount * 100),
        currency: "INR",
        receipt: `sess_${tableSessionId.slice(-8)}_${Date.now().toString().slice(-4)}`,
        notes: {
          tableSessionId,
          payable_amount: String(payableAmount),
          upi_vpa: upiVpa
        }
      });
    } catch (e) {
      console.warn("[UPI Dynamic QR Session] Notice on optional Razorpay order tracking:", e.message || e);
    }
  }

  await prisma.order.updateMany({
    where: {
      tableSessionId,
      status: { notIn: ['SETTLED', 'CANCELLED'] }
    },
    data: {
      paymentLinkId: qrId,
      paymentLinkUrl: upiUrl,
      onlineAmount: payableAmount,
      paymentMethod: payableAmount < totalAmount ? 'SPLIT' : 'ONLINE',
      cashAmount: payableAmount < totalAmount ? (totalAmount - payableAmount) : 0
    }
  });

  await prisma.tableSession.update({
    where: { id: tableSessionId },
    data: {
      paymentMethod: payableAmount < totalAmount ? 'SPLIT' : 'ONLINE',
      onlineAmount: payableAmount,
      cashAmount: payableAmount < totalAmount ? (totalAmount - payableAmount) : 0
    }
  });

  return {
    id: qrId,
    short_url: upiUrl,
    totalAmount: payableAmount,
    is_upi_dynamic_qr: true
  };
}

async function verifySessionPayment(actor, storeId, tableSessionId, manual = false, isPolling = false) {
  const prisma = getPrismaClient();
  const session = await prisma.tableSession.findUnique({
    where: { id: tableSessionId },
    include: {
      orders: {
        where: { status: { notIn: ['SETTLED', 'CANCELLED'] } }
      }
    }
  });

  if (!session || session.storeId !== storeId) throw createHttpError(404, "Session not found");
  if (actor) await verifyStoreAccess(actor, storeId);

  if (session.status === 'SETTLED' || session.orders.length === 0) {
    return { success: true, status: 'SETTLED', message: "Session already settled." };
  }

  // Check if Razorpay order is paid
  let rpOrderPaid = false;
  try {
    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { tenantId: true } });
    const gateway = await prisma.tenantPaymentGateway.findUnique({
      where: { tenantId_provider: { tenantId: store.tenantId, provider: 'RAZORPAY' } }
    });
    if (gateway && gateway.isActive) {
      const razorpay = new Razorpay({
        key_id: decrypt(gateway.apiKey),
        key_secret: decrypt(gateway.secretKey)
      });
      const rpOrders = await razorpay.orders.all({ receipt: `sess_${tableSessionId.slice(-8)}` });
      if (rpOrders?.items?.some(o => o.status === 'paid')) {
        rpOrderPaid = true;
      }
    }
  } catch (e) {
    // ignore
  }

  if (rpOrderPaid || (manual || !isPolling)) {
    await settleTableSession(actor, storeId, tableSessionId, true);
    return { 
      success: true, 
      status: 'SETTLED', 
      message: rpOrderPaid
        ? "Payment confirmed via Razorpay Order and table session settled!"
        : "UPI QR Payment confirmed and table session settled!" 
    };
  }

  return { success: false, status: 'PENDING', message: "Payment pending on UPI QR." };
}

async function getTableSessionBill(storeId, tableSessionId) {
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
    totalDiscount += order.discountAmount;
    grandTotal += order.totalAmount;

    for (const item of order.items) {
      const key = `${item.menuItemId}_${item.priceAtOrder}`;
      if (itemsMap.has(key)) {
        const existing = itemsMap.get(key);
        existing.quantity += item.quantity;
      } else {
        itemsMap.set(key, {
          name: item.menuItem?.name || 'Item',
          price: item.priceAtOrder,
          quantity: item.quantity,
          dietary: item.menuItem?.dietary || 'VEG',
          modifiers: item.modifiers.map(m => m.modifierOption?.name).filter(Boolean)
        });
      }
    }
  }

  return {
    session: {
      id: session.id,
      pin: session.pin,
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
      createdAt: o.createdAt
    })),
    aggregatedItems: Array.from(itemsMap.values()),
    subTotal,
    discountAmount: totalDiscount,
    taxAmount: totalTax,
    totalAmount: grandTotal
  };
}

async function getTableSessionStatus(storeId, tableNumber) {
  const prisma = getPrismaClient();
  const table = await prisma.table.findUnique({
    where: {
      storeId_tableNumber: {
        storeId,
        tableNumber: parseInt(tableNumber, 10)
      }
    }
  });

  if (!table) throw createHttpError(404, "Table not found");

  const activeSession = await prisma.tableSession.findFirst({
    where: {
      storeId,
      tableId: table.id,
      status: 'ACTIVE'
    }
  });

  return {
    tableNumber: table.tableNumber,
    tableId: table.id,
    hasActiveSession: !!activeSession,
    tableSessionId: activeSession?.id || null
  };
}

module.exports = {
  createOrder,
  handleRazorpayWebhook,
  updateOrderStatus,
  updateOrderItems,
  getKdsOrders,
  getActiveOrders,
  generatePaymentLink,
  checkPaymentStatus,
  verifyRazorpayPayment,
  getOrderById,
  getOrderHistory,
  settleTableSession,
  generateSessionPaymentLink,
  verifySessionPayment,
  getTableSessionBill,
  getTableSessionStatus
};
