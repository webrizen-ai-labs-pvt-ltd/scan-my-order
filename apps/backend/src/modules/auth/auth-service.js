const { getPrismaClient } = require("../../lib/prisma");
const { signJwt } = require("../../lib/jwt");
const { hashPassword, verifyPassword } = require("../../lib/password");
const { normalizeEmail } = require("../../lib/email");
const { userRoles, userStatuses } = require("../../constants/roles");
const { verifyGoogleIdToken } = require("../../lib/google-auth");
const { createHttpError } = require("../../middleware/error-handler");
const { serializeUser } = require("../users/user-service");

function createUserToken(user) {
  return signJwt({
    sub: user.id,
    role: user.role,
    tenantId: user.tenantId,
    storeId: user.storeId
  });
}

async function bootstrapSuperAdmin(input) {
  const prisma = getPrismaClient();
  const existingSuperAdmin = await prisma.user.findFirst({
    where: {
      role: userRoles.superAdmin
    }
  });

  if (existingSuperAdmin) {
    throw createHttpError(409, "Super admin already exists");
  }

  const email = normalizeEmail(input.email);

  if (!email || !input.password) {
    throw createHttpError(400, "Email and password are required");
  }

  if (input.password.length < 8) {
    throw createHttpError(400, "Password must be at least 8 characters");
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name,
      profilePhoto: input.profilePhoto,
      passwordHash: await hashPassword(input.password),
      role: userRoles.superAdmin,
      status: userStatuses.active
    },
    include: {
      tenant: true,
      store: true
    }
  });

  return {
    token: createUserToken(user),
    user: serializeUser(user)
  };
}

async function login(input) {
  const prisma = getPrismaClient();
  const email = normalizeEmail(input.email);

  if (!email || !input.password) {
    throw createHttpError(400, "Email and password are required");
  }

  const tenant = input.tenantSlug
    ? await prisma.tenant.findUnique({
      where: {
        slug: input.tenantSlug
      }
    })
    : undefined;

  if (input.tenantSlug && !tenant) {
    throw createHttpError(401, "Invalid email or password");
  }

  const whereClause = {
    email,
    status: {
      not: userStatuses.deleted
    }
  };

  if (tenant) {
    whereClause.tenantId = tenant.id;
  } else if (input.tenantSlug) {
    // If they provided a slug but tenant wasn't found, this is handled above,
    // but just to be explicit
    whereClause.tenantId = "invalid";
  }

  const user = await prisma.user.findFirst({
    where: whereClause,
    include: {
      tenant: true,
      store: true
    }
  });

  if (!user || user.status !== userStatuses.active || !(await verifyPassword(input.password, user.passwordHash))) {
    throw createHttpError(401, "Invalid email or password");
  }

  await prisma.user.update({
    where: {
      id: user.id
    },
    data: {
      lastLoginAt: new Date()
    }
  });

  return {
    token: createUserToken(user),
    user: serializeUser(user)
  };
}

async function loginWithGoogle(input) {
  const prisma = getPrismaClient();

  if (!input.idToken) {
    throw createHttpError(400, "Google ID token is required");
  }

  const payload = await verifyGoogleIdToken(input.idToken);
  if (!payload || !payload.email) {
    throw createHttpError(401, "Invalid Google ID token");
  }

  const email = normalizeEmail(payload.email);

  let tenant = undefined;
  if (input.tenantSlug) {
    tenant = await prisma.tenant.findUnique({
      where: { slug: input.tenantSlug }
    });
    if (!tenant) {
      throw createHttpError(400, "Invalid tenant");
    }
  }

  const whereClause = {
    email,
    status: { not: userStatuses.deleted }
  };

  if (tenant) {
    whereClause.tenantId = tenant.id;
  }

  let user = await prisma.user.findFirst({
    where: whereClause,
    include: {
      tenant: true,
      store: true
    }
  });

  if (!user) {
    // Sign-up flow
    // Default to CUSTOMER role for new Google signups.
    user = await prisma.user.create({
      data: {
        email,
        name: payload.name || email.split("@")[0],
        role: userRoles.customer,
        status: userStatuses.active,
        tenantId: tenant ? tenant.id : null
      },
      include: {
        tenant: true,
        store: true
      }
    });
  } else if (user.status !== userStatuses.active) {
    throw createHttpError(403, "User account is not active");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  return {
    token: createUserToken(user),
    user: serializeUser(user)
  };
}

module.exports = {
  bootstrapSuperAdmin,
  createUserToken,
  login,
  loginWithGoogle
};
