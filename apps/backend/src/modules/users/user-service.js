const { getPrismaClient } = require("../../lib/prisma");
const { hashPassword } = require("../../lib/password");
const { normalizeEmail } = require("../../lib/email");
const { DEFAULT_IMAGES } = require("@smo/shared");
const {
  storeManagerManagedRoles,
  storeScopedRoles,
  tenantAdminManagedRoles,
  tenantScopedRoles,
  userRoles,
  userStatuses
} = require("../../constants/roles");
const { createHttpError } = require("../../middleware/error-handler");
const { sendMail } = require("../../lib/mailer");
const { env } = require("../../config/env");
const { getWelcomeEmailTemplate } = require("../../lib/templates/welcome-email");
const userInclude = {
  tenant: true,
  store: true
};

function serializeUser(user) {
  if (!user) {
    return undefined;
  }

  return {
    id: user.id,
    tenantId: user.tenantId,
    storeId: user.storeId,
    email: user.email,
    name: user.name,
    phone: user.phone,
    profilePhoto: user.profilePhoto || DEFAULT_IMAGES.profilePhoto,
    role: user.role,
    status: user.status,
    tenant: user.tenant ? {
      id: user.tenant.id,
      name: user.tenant.name,
      slug: user.tenant.slug,
      logo: user.tenant.logo,
      brandColor: user.tenant.brandColor,
      status: user.tenant.status
    } : undefined,
    store: user.store ? {
      id: user.store.id,
      name: user.store.name,
      slug: user.store.slug,
      banner: user.store.banner || DEFAULT_IMAGES.storeBanner,
      status: user.store.status
    } : undefined,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function canManageRole(actor, role) {
  if (actor.role === userRoles.superAdmin) {
    return true;
  }

  if (actor.role === userRoles.tenantAdmin) {
    return tenantAdminManagedRoles.includes(role);
  }

  if (actor.role === userRoles.storeManager) {
    return storeManagerManagedRoles.includes(role);
  }

  return false;
}

function assertValidRole(role) {
  if (!Object.values(userRoles).includes(role)) {
    throw createHttpError(400, "Invalid user role");
  }
}

function assertValidStatus(status) {
  if (!Object.values(userStatuses).includes(status)) {
    throw createHttpError(400, "Invalid user status");
  }
}

function getScopedWhere(actor) {
  if (actor.role === userRoles.superAdmin) {
    return {};
  }

  if (actor.role === userRoles.tenantAdmin) {
    return {
      tenantId: actor.tenantId
    };
  }

  if (actor.role === userRoles.storeManager) {
    return {
      tenantId: actor.tenantId,
      storeId: actor.storeId
    };
  }

  return {
    id: actor.id
  };
}

function assertCanManageUser(actor, targetUser) {
  const scope = getScopedWhere(actor);

  if (scope.id && scope.id !== targetUser.id) {
    throw createHttpError(403, "You can only manage your own user");
  }

  if (scope.tenantId && scope.tenantId !== targetUser.tenantId) {
    throw createHttpError(403, "User is outside your tenant");
  }

  if (scope.storeId && scope.storeId !== targetUser.storeId) {
    throw createHttpError(403, "User is outside your store");
  }

  if (actor.id !== targetUser.id && !canManageRole(actor, targetUser.role)) {
    throw createHttpError(403, "You cannot manage this user's role");
  }
}

async function assertStoreBelongsToTenant(tenantId, storeId) {
  if (!storeId) {
    return;
  }

  const store = await getPrismaClient().store.findFirst({
    where: {
      id: storeId,
      tenantId
    }
  });

  if (!store) {
    throw createHttpError(400, "Store does not belong to the selected tenant");
  }
}

function resolveUserScope(actor, inputRole, input) {
  const role = inputRole || userRoles.customer;
  let tenantId = input.tenantId || null;
  let storeId = input.storeId || null;

  assertValidRole(role);

  if (!canManageRole(actor, role)) {
    throw createHttpError(403, "You cannot manage this role");
  }

  if (actor.role === userRoles.tenantAdmin) {
    tenantId = actor.tenantId;
  }

  if (actor.role === userRoles.storeManager) {
    tenantId = actor.tenantId;
    storeId = actor.storeId;
  }

  if (role === userRoles.superAdmin) {
    tenantId = null;
    storeId = null;
  }

  const requiresStore = storeScopedRoles.includes(role);

  if (requiresStore) {
    if (!tenantId || !storeId) {
      throw createHttpError(400, "Tenant and store are required for this role");
    }
  } else if (tenantScopedRoles.includes(role)) {
    if (!tenantId) {
      throw createHttpError(400, `${role.replace('_', ' ')} accounts must be linked to a Tenant.`);
    }
    storeId = null;
  } else {
    storeId = null;
  }

  return {
    role,
    tenantId,
    storeId
  };
}

function buildUserFilters(actor, query) {
  const where = {
    ...getScopedWhere(actor),
    status: {
      not: userStatuses.deleted
    }
  };

  if (query.role) {
    assertValidRole(query.role);
    where.role = query.role;
  }

  if (query.status) {
    assertValidStatus(query.status);
    where.status = query.status;
  }

  if (actor.role === userRoles.superAdmin) {
    if (query.tenantId) {
      where.tenantId = query.tenantId;
    }

    if (query.storeId) {
      where.storeId = query.storeId;
    }
  }

  if (query.search) {
    where.OR = [
      {
        email: {
          contains: query.search,
          mode: "insensitive"
        }
      },
      {
        name: {
          contains: query.search,
          mode: "insensitive"
        }
      },
      {
        phone: {
          contains: query.search,
          mode: "insensitive"
        }
      }
    ];
  }

  return where;
}

async function listUsers(actor, query = {}) {
  const users = await getPrismaClient().user.findMany({
    where: buildUserFilters(actor, query),
    include: userInclude,
    orderBy: {
      createdAt: "desc"
    },
    take: Math.min(Number(query.limit || 50), 100),
    skip: Number(query.offset || 0)
  });

  return users.map(serializeUser);
}

async function getUserById(actor, id) {
  const user = await getPrismaClient().user.findFirst({
    where: {
      id,
      status: {
        not: userStatuses.deleted
      }
    },
    include: userInclude
  });

  if (!user) {
    throw createHttpError(404, "User not found");
  }

  assertCanManageUser(actor, user);

  return serializeUser(user);
}

async function createUser(actor, input) {
  const prisma = getPrismaClient();
  const email = normalizeEmail(input.email);
  const { role, tenantId, storeId } = resolveUserScope(actor, input.role, input);

  if (!email || !input.password) {
    throw createHttpError(400, "Email and password are required");
  }

  if (storeScopedRoles.includes(role)) {
    if (actor.role !== userRoles.superAdmin && actor.role !== userRoles.tenantAdmin) {
      throw createHttpError(403, "Staff accounts can only be provisioned by a Tenant Admin or Super Admin");
    }
  }

  // ENFORCEMENT: Staff roles must be linked to at least one store
  if (storeScopedRoles.includes(role)) {
    if (!storeId) {
      throw createHttpError(400, `${role.replace('_', ' ')} accounts must be linked to a store upon creation.`);
    }
  }

  if (input.password.length < 8) {
    throw createHttpError(400, "Password must be at least 8 characters");
  }

  if (input.status) {
    assertValidStatus(input.status);
  }

  await assertStoreBelongsToTenant(tenantId, storeId);

  const existingUser = await prisma.user.findFirst({
    where: {
      email,
      tenantId
    }
  });

  if (existingUser) {
    throw createHttpError(409, "A user with this email already exists in this tenant");
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name,
      phone: input.phone,
      profilePhoto: input.profilePhoto,
      passwordHash: await hashPassword(input.password),
      role,
      tenantId,
      storeId,
      status: input.status || userStatuses.active
    },
    include: userInclude
  });

  // Send Welcome Email if it's a Tenant Admin or Staff account
  if (role === userRoles.tenantAdmin || storeScopedRoles.includes(role)) {
    try {
      const html = getWelcomeEmailTemplate(input.name, email, input.password, role, env.apps.adminUrl || 'http://localhost:5173');
      await sendMail({
        to: email,
        subject: "Welcome to Scan My Order",
        html
      });
    } catch (err) {
      console.error("Failed to send welcome email:", err);
      // We don't fail the user creation if email fails
    }
  }

  return serializeUser(user);
}

async function updateUser(actor, id, input) {
  const prisma = getPrismaClient();
  const existingUser = await prisma.user.findFirst({
    where: {
      id,
      status: {
        not: userStatuses.deleted
      }
    },
    include: userInclude
  });

  if (!existingUser) {
    throw createHttpError(404, "User not found");
  }

  assertCanManageUser(actor, existingUser);

  const data = {};

  if (input.name !== undefined) {
    data.name = input.name;
  }

  if (input.phone !== undefined) {
    data.phone = input.phone;
  }

  if (input.profilePhoto !== undefined) {
    data.profilePhoto = input.profilePhoto;
  }

  if (input.password !== undefined) {
    if (input.password.length < 8) {
      throw createHttpError(400, "Password must be at least 8 characters");
    }

    data.passwordHash = await hashPassword(input.password);
  }

  if (input.role || input.tenantId !== undefined || input.storeId !== undefined) {
    const scope = resolveUserScope(actor, input.role || existingUser.role, {
      tenantId: input.tenantId === undefined ? existingUser.tenantId : input.tenantId,
      storeId: input.storeId === undefined ? existingUser.storeId : input.storeId
    });

    await assertStoreBelongsToTenant(scope.tenantId, scope.storeId);

    data.role = scope.role;
    data.tenantId = scope.tenantId;
    data.storeId = scope.storeId;
  }

  const user = await prisma.user.update({
    where: {
      id
    },
    data,
    include: userInclude
  });

  return serializeUser(user);
}

async function updateUserStatus(actor, id, status) {
  assertValidStatus(status);

  const prisma = getPrismaClient();
  const existingUser = await prisma.user.findUnique({
    where: {
      id
    },
    include: userInclude
  });

  if (!existingUser) {
    throw createHttpError(404, "User not found");
  }

  assertCanManageUser(actor, existingUser);

  const user = await prisma.user.update({
    where: {
      id
    },
    data: {
      status
    },
    include: userInclude
  });

  return serializeUser(user);
}

function deleteUser(actor, id) {
  return updateUserStatus(actor, id, userStatuses.deleted);
}

module.exports = {
  createUser,
  deleteUser,
  getUserById,
  listUsers,
  serializeUser,
  updateUser,
  updateUserStatus
};
