const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { userRoles } = require("../../constants/roles");

async function listTenants(actor, query = {}) {
  const where = {};
  
  if (actor.role !== 'SUPER_ADMIN') {
    if (!actor.tenantId) {
      return [];
    }
    where.id = actor.tenantId;
  }

  const tenants = await getPrismaClient().tenant.findMany({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      logo: true,
      brandColor: true,
      description: true,
      gstin: true,
      companyLegalName: true,
      registeredAddress: true,
      createdAt: true,
      subscription: {
        include: { plan: true }
      },
      stores: {
        select: {
          id: true,
          name: true,
          status: true
        }
      },
      users: {
        where: { role: 'TENANT_ADMIN' },
        select: {
          id: true,
          name: true,
          email: true,
          status: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return tenants;
}

async function getTenantById(actor, id) {
  if (actor.role !== 'SUPER_ADMIN' && actor.tenantId !== id) {
    throw createHttpError(403, "Forbidden");
  }

  const tenant = await getPrismaClient().tenant.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      logo: true,
      brandColor: true,
      description: true,
      gstin: true,
      companyLegalName: true,
      registeredAddress: true,
      createdAt: true,
      subscription: {
        include: { plan: true }
      },
      stores: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true
        }
      },
      users: {
        where: { role: 'TENANT_ADMIN' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true
        }
      }
    }
  });

  if (!tenant) throw createHttpError(404, "Tenant not found");
  return tenant;
}

async function createTenant(actor, input) {
  if (actor.role !== 'SUPER_ADMIN') {
    throw createHttpError(403, "Only Super Admins can create brands");
  }

  const { 
    name, slug, adminUser, adminUserId, 
    logo, brandColor, description, gstin, companyLegalName, registeredAddress 
  } = input;

  if (!name || !slug) {
    throw createHttpError(400, "Brand name and slug are required");
  }

  const prisma = getPrismaClient();

  // Check unique slug
  const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
  if (existingTenant) {
    throw createHttpError(409, "A brand with this slug already exists");
  }

  // We require an admin user to be provided so the brand has an owner
  if (!adminUserId && (!adminUser || !adminUser.name || !adminUser.email || !adminUser.password)) {
    throw createHttpError(400, "An owner (Tenant Admin) must be provisioned or selected when creating a new brand");
  }

  const tenant = await prisma.$transaction(async (tx) => {
    const newTenant = await tx.tenant.create({
      data: { 
        name, slug, status: "ACTIVE",
        logo, brandColor, description, gstin, companyLegalName, registeredAddress
      }
    });

    if (adminUserId) {
      const existingUser = await tx.user.findUnique({ where: { id: adminUserId } });
      if (!existingUser) throw createHttpError(404, "Selected user not found");
      
      await tx.user.update({
        where: { id: adminUserId },
        data: {
          tenantId: newTenant.id,
          role: userRoles.tenantAdmin
        }
      });
    } else {
      // Check if user email already exists globally
      const existingUser = await tx.user.findFirst({
        where: { email: adminUser.email }
      });
      
      if (existingUser) {
        throw createHttpError(409, "User with this email already exists");
      }

      const bcrypt = require("bcryptjs");
      const passwordHash = await bcrypt.hash(adminUser.password, 12);
      
      await tx.user.create({
        data: {
          tenantId: newTenant.id,
          name: adminUser.name,
          email: adminUser.email,
          phone: adminUser.phone,
          passwordHash,
          role: userRoles.tenantAdmin,
          status: "ACTIVE"
        }
      });

      // Send email
      try {
        const { getWelcomeEmailTemplate } = require("../../lib/templates/welcome-email");
        const { sendMail } = require("../../lib/mailer");
        const { env } = require("../../config/env");
        
        const html = getWelcomeEmailTemplate(adminUser.name, adminUser.email, adminUser.password, userRoles.tenantAdmin, env.apps.adminUrl || 'http://localhost:5173');
        await sendMail({
          to: adminUser.email,
          subject: "Welcome to Scan My Order",
          html
        });
      } catch (err) {
        console.error("Failed to send welcome email:", err);
      }
    }

    return newTenant;
  });

  return getTenantById(actor, tenant.id);
}

async function updateTenant(actor, id, input) {
  if (actor.role !== 'SUPER_ADMIN' && (actor.role !== 'TENANT_ADMIN' || actor.tenantId !== id)) {
    throw createHttpError(403, "You do not have permission to update this brand's details");
  }

  const prisma = getPrismaClient();
  const { 
    name, status,
    logo, brandColor, description, gstin, companyLegalName, registeredAddress
  } = input; // We don't allow changing slug to prevent breaking URLs

  const updateData = {
    name,
    logo, brandColor, description, gstin, companyLegalName, registeredAddress
  };

  if (actor.role === 'SUPER_ADMIN' && status) {
    updateData.status = status;
  }

  const tenant = await prisma.tenant.update({
    where: { id },
    data: updateData
  });

  return getTenantById(actor, tenant.id);
}

async function deleteTenant(actor, id) {
  if (actor.role !== 'SUPER_ADMIN') {
    throw createHttpError(403, "Only Super Admins can delete brands");
  }

  const prisma = getPrismaClient();
  
  // Hard delete cascade will remove stores and users
  await prisma.tenant.delete({
    where: { id }
  });

  return { success: true };
}

module.exports = {
  listTenants,
  getTenantById,
  createTenant,
  updateTenant,
  deleteTenant
};
