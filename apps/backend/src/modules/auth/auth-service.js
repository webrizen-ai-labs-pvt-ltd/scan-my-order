const { getPrismaClient } = require("../../lib/prisma");
const { signJwt } = require("../../lib/jwt");
const { hashPassword, verifyPassword } = require("../../lib/password");
const { normalizeEmail } = require("../../lib/email");
const { userRoles, userStatuses } = require("../../constants/roles");
const { verifyGoogleIdToken } = require("../../lib/google-auth");
const { createHttpError } = require("../../middleware/error-handler");
const { serializeUser } = require("../users/user-service");
const { authUserCache } = require("../../lib/cache");
const { sendMail } = require("../../lib/mailer");

function createUserToken(user) {
  return signJwt({
    sub: user.id,
    role: user.role,
    tenantId: user.tenantId,
    storeId: user.storeId,
    // Password changes bump the version, which ends every older session
    tv: user.tokenVersion || 0
  });
}

// Only account owners change their own password; everyone else is reset by a manager
const SELF_PASSWORD_ROLES = [userRoles.superAdmin, userRoles.tenantAdmin];

function assertCanChangeOwnPassword(actor) {
  if (!SELF_PASSWORD_ROLES.includes(actor.role)) {
    throw createHttpError(403, "Ask your manager to reset your password");
  }
}

async function getOwnPasswordStatus(actor) {
  const user = await getPrismaClient().user.findUnique({ where: { id: actor.id }, select: { passwordHash: true } });
  return {
    canChange: SELF_PASSWORD_ROLES.includes(actor.role),
    hasPassword: Boolean(user?.passwordHash)
  };
}

/**
 * Changes (or first sets, for Google sign-ups) the signed-in owner's password. Every other
 * session is signed out; the returned token keeps this device signed in.
 */
async function changeOwnPassword(actor, input = {}) {
  assertCanChangeOwnPassword(actor);
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user) throw createHttpError(404, "User not found");

  const newPassword = typeof input.newPassword === "string" ? input.newPassword : "";
  if (newPassword.length < 8) throw createHttpError(400, "New password must be at least 8 characters");
  if (newPassword.length > 128) throw createHttpError(400, "New password must be at most 128 characters");

  if (user.passwordHash) {
    // 400, not 401: a wrong current password must not sign the user out
    if (!input.currentPassword || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw createHttpError(400, "Current password is incorrect");
    }
    if (await verifyPassword(newPassword, user.passwordHash)) {
      throw createHttpError(400, "New password must be different from the current one");
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword), tokenVersion: { increment: 1 } },
    include: { tenant: true, store: true }
  });
  authUserCache.del(user.id);

  // Heads-up in case it wasn't them (never blocks the change)
  Promise.resolve().then(() => sendMail({
    to: updated.email,
    subject: "Your Scan My Order password was changed",
    text: `Hi ${updated.name || ""}, the password for ${updated.email} was ${user.passwordHash ? "changed" : "set"} on ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST. All other devices were signed out. If this wasn't you, contact support immediately.`
  })).catch(err => console.warn("[Auth] password-change email:", err.message));

  return { token: createUserToken(updated), user: serializeUser(updated) };
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

async function customerRegister(input) {
  const prisma = getPrismaClient();
  const email = normalizeEmail(input.email);
  if (!email || !input.password) {
    throw createHttpError(400, "Email and password are required");
  }

  let tenant = null;
  if (input.tenantSlug) {
    tenant = await prisma.tenant.findUnique({ where: { slug: input.tenantSlug } });
  }

  const whereClause = {
    email,
    status: { not: userStatuses.deleted }
  };
  if (tenant) {
    whereClause.tenantId = tenant.id;
  }

  const existing = await prisma.user.findFirst({ where: whereClause });
  if (existing) {
    throw createHttpError(409, "An account with this email already exists. Please log in.");
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name || email.split("@")[0],
      phone: input.phone || null,
      passwordHash: await hashPassword(input.password),
      role: userRoles.customer,
      status: userStatuses.active,
      tenantId: tenant ? tenant.id : null
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

module.exports = {
  changeOwnPassword,
  getOwnPasswordStatus,
  bootstrapSuperAdmin,
  createUserToken,
  customerRegister,
  login,
  loginWithGoogle
};
