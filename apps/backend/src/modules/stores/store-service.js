const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { userRoles } = require("../../constants/roles");
const { DEFAULT_IMAGES } = require("@smo/shared");

// Helper to format store and provide default images
function serializeStore(store) {
  if (!store) return store;
  
  return {
    ...store,
    logo: store.tenant?.logo || store.logo || DEFAULT_IMAGES.storeLogo,
    banner: store.banner || DEFAULT_IMAGES.storeBanner
  };
}

async function createStore(actor, input) {
  const prisma = getPrismaClient();
  const { name, slug, banner, adminUser, adminUserId, address, contactPhone, contactEmail, operatingHours, taxRules } = input;

  if (!name || !slug) {
    throw createHttpError(400, "Store name and slug are required");
  }

  // Determine tenantId based on actor's role
  let tenantId;
  if (actor.role === userRoles.superAdmin) {
    tenantId = input.tenantId;
    if (!tenantId) {
      throw createHttpError(400, "tenantId is required for Super Admins creating a store");
    }
  } else if (actor.role === userRoles.tenantAdmin) {
    tenantId = actor.tenantId;
  } else {
    throw createHttpError(403, "Only Super Admins or Tenant Admins can create stores");
  }

  // Check if store slug is already used in this tenant
  const existingStore = await prisma.store.findUnique({
    where: {
      tenantId_slug: { tenantId, slug }
    }
  });

  if (existingStore) {
    throw createHttpError(409, "A store with this slug already exists for this tenant");
  }

  // Ensure at least one active TENANT_ADMIN exists for this tenant, OR we are creating one now
  if (!adminUser) {
    const tenantAdminCount = await prisma.user.count({
      where: {
        tenantId,
        role: userRoles.tenantAdmin,
        status: "ACTIVE"
      }
    });

    if (tenantAdminCount === 0) {
      throw createHttpError(400, "Cannot create a store for a tenant without an active TENANT_ADMIN. Please provide adminUser details.");
    }
  }

  const store = await prisma.$transaction(async (tx) => {
    const newStore = await tx.store.create({
      data: {
        tenantId,
        name,
        slug,
        banner,
        address,
        contactPhone,
        contactEmail,
        operatingHours,
        taxRules
      },
      include: { tenant: true }
    });

    // If adminUser is provided, create the store manager
    if (adminUser) {
      if (!adminUser.name || !adminUser.email || !adminUser.password) {
        throw createHttpError(400, "Name, email, and password are required for the new manager user");
      }
      
      const existingUser = await tx.user.findFirst({
        where: { email: adminUser.email, tenantId }
      });
      
      if (existingUser) {
         throw createHttpError(409, "User with this email already exists in the tenant");
      }
      
      const bcrypt = require("bcryptjs");
      const passwordHash = await bcrypt.hash(adminUser.password, 12);
      
      await tx.user.create({
        data: {
          tenantId,
          storeId: newStore.id,
          name: adminUser.name,
          email: adminUser.email,
          phone: adminUser.phone,
          passwordHash,
          role: userRoles.storeManager,
          status: "ACTIVE"
        }
      });
      
      // Send email
      try {
        const { getWelcomeEmailTemplate } = require("../../lib/templates/welcome-email");
        const { sendMail } = require("../../lib/mailer");
        const { env } = require("../../config/env");
        
        const html = getWelcomeEmailTemplate(adminUser.name, adminUser.email, adminUser.password, userRoles.storeManager, env.apps.adminUrl || 'http://localhost:5173');
        await sendMail({
          to: adminUser.email,
          subject: "Welcome to Scan My Order",
          html
        });
      } catch (err) {
        console.error("Failed to send welcome email:", err);
      }
    } else if (adminUserId) {
      const existingUser = await tx.user.findUnique({ where: { id: adminUserId } });
      if (!existingUser || existingUser.tenantId !== tenantId) {
        throw createHttpError(404, "User not found in this tenant");
      }
      await tx.user.update({
        where: { id: adminUserId },
        data: {
          storeId: newStore.id,
          role: existingUser.role === userRoles.tenantAdmin ? existingUser.role : userRoles.storeManager
        }
      });
    }

    return newStore;
  });

  return serializeStore(store);
}

async function getStores(actor, query = {}) {
  const prisma = getPrismaClient();
  let where = {};

  if (actor.role === userRoles.tenantAdmin) {
    where.tenantId = actor.tenantId;
  } else if (actor.role === userRoles.storeManager || actor.role === userRoles.waiter || actor.role === userRoles.cashier || actor.role === userRoles.kitchenStaff) {
    where.id = actor.storeId;
  } else if (actor.role === userRoles.superAdmin && query.tenantId) {
    where.tenantId = query.tenantId;
  } else if (actor.role !== userRoles.superAdmin) {
    throw createHttpError(403, "Forbidden");
  }

  const stores = await prisma.store.findMany({ 
    where,
    include: { tenant: true }
  });
  return stores.map(serializeStore);
}

async function getStoreById(actor, storeId) {
  const prisma = getPrismaClient();

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: { tenant: true }
  });

  if (!store) {
    throw createHttpError(404, "Store not found");
  }

  // Scope check
  if (actor.role !== userRoles.superAdmin) {
    if (actor.role === userRoles.tenantAdmin && actor.tenantId !== store.tenantId) {
      throw createHttpError(403, "Forbidden");
    }
    if (
      [userRoles.storeManager, userRoles.waiter, userRoles.cashier, userRoles.kitchenStaff].includes(actor.role) &&
      actor.storeId !== store.id
    ) {
      throw createHttpError(403, "Forbidden");
    }
  }

  return serializeStore(store);
}

async function updateStore(actor, storeId, input) {
  const prisma = getPrismaClient();
  
  // Verify access first
  const existingStore = await getStoreById(actor, storeId);

  // Determine if the actor can update. Only SUPER_ADMIN, TENANT_ADMIN, and STORE_MANAGER can update.
  if (
    actor.role !== userRoles.superAdmin &&
    actor.role !== userRoles.tenantAdmin &&
    actor.role !== userRoles.storeManager
  ) {
    throw createHttpError(403, "You do not have permission to update store details");
  }

  const { name, banner, status, adminUser, adminUserId, address, contactPhone, contactEmail, operatingHours, tenantId, taxRules } = input;

  const store = await prisma.$transaction(async (tx) => {
    // Determine the target tenant ID based on whether we are moving the store or keeping it
    const targetTenantId = (actor.role === userRoles.superAdmin && tenantId) ? tenantId : existingStore.tenantId;

    const updatedStore = await tx.store.update({
      where: { id: storeId },
      data: { name, banner, status, address, contactPhone, contactEmail, operatingHours, tenantId: targetTenantId, taxRules },
      include: { tenant: true }
    });

    // If adminUser is provided, create the store manager
    if (adminUser) {
      if (!adminUser.name || !adminUser.email || !adminUser.password) {
        throw createHttpError(400, "Name, email, and password are required for the new manager user");
      }
      
      const existingUser = await tx.user.findFirst({
        where: { email: adminUser.email, tenantId: existingStore.tenantId }
      });
      
      if (existingUser) {
         throw createHttpError(409, "User with this email already exists in the tenant");
      }
      
      const bcrypt = require("bcryptjs");
      const passwordHash = await bcrypt.hash(adminUser.password, 12);
      
      await tx.user.create({
        data: {
          tenantId: updatedStore.tenantId,
          storeId: updatedStore.id,
          name: adminUser.name,
          email: adminUser.email,
          phone: adminUser.phone,
          passwordHash,
          role: userRoles.storeManager,
          status: "ACTIVE"
        }
      });
      
      // Send email
      try {
        const { getWelcomeEmailTemplate } = require("../../lib/templates/welcome-email");
        const { sendMail } = require("../../lib/mailer");
        const { env } = require("../../config/env");
        
        const html = getWelcomeEmailTemplate(adminUser.name, adminUser.email, adminUser.password, userRoles.storeManager, env.apps.adminUrl || 'http://localhost:5173');
        await sendMail({
          to: adminUser.email,
          subject: "Welcome to Scan My Order",
          html
        });
      } catch (err) {
        console.error("Failed to send welcome email:", err);
      }
    } else if (adminUserId) {
      const existingUser = await tx.user.findUnique({ where: { id: adminUserId } });
      if (!existingUser || existingUser.tenantId !== updatedStore.tenantId) {
        throw createHttpError(404, "User not found in this tenant");
      }
      await tx.user.update({
        where: { id: adminUserId },
        data: {
          storeId: updatedStore.id,
          role: existingUser.role === userRoles.tenantAdmin ? existingUser.role : userRoles.storeManager
        }
      });
    }

    return updatedStore;
  });

  return serializeStore(store);
}

async function deleteStore(actor, storeId) {
  const prisma = getPrismaClient();
  
  // Verify access first
  const existingStore = await getStoreById(actor, storeId);

  if (actor.role !== userRoles.superAdmin && actor.role !== userRoles.tenantAdmin) {
    throw createHttpError(403, "Only Super Admins or Tenant Admins can delete a store");
  }

  await prisma.store.delete({
    where: { id: storeId }
  });

  return { success: true };
}

async function getStoreFloorStatus(actor, storeId) {
  const prisma = getPrismaClient();
  
  // Verify access first
  await getStoreById(actor, storeId);

  const orders = await prisma.order.findMany({
    where: {
      storeId,
      status: {
        in: ['DRAFT', 'PENDING_PAYMENT', 'PENDING_VERIFICATION', 'PROCESSING', 'READY', 'SERVED']
      }
    },
    select: {
      id: true,
      origin: true,
      status: true
    }
  });

  const activeTables = await prisma.table.count({
    where: {
      storeId,
      orders: {
        some: {
          status: { in: ['PROCESSING', 'READY', 'SERVED'] }
        }
      }
    }
  });

  const waiterCalls = await prisma.waiterCall.count({
    where: {
      storeId,
      status: { in: ['PENDING', 'ACKNOWLEDGED'] }
    }
  });

  return {
    orders,
    activeTables,
    waiterCalls
  };
}

module.exports = {
  createStore,
  getStores,
  getStoreById,
  updateStore,
  deleteStore,
  getStoreFloorStatus
};
