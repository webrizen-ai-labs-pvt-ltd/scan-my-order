const {
  generateRegistrationOptions: generateRegistrationOptionsWebAuthn,
  verifyRegistrationResponse,
  generateAuthenticationOptions: generateAuthenticationOptionsWebAuthn,
  verifyAuthenticationResponse
} = require("@simplewebauthn/server");
const { getPrismaClient } = require("../../lib/prisma");
const { env } = require("../../config/env");
const { createHttpError } = require("../../middleware/error-handler");
const { normalizeEmail } = require("../../lib/email");
const { userStatuses } = require("../../constants/roles");
const { createUserToken } = require("./auth-service");
const { serializeUser } = require("../users/user-service");
const jwt = require("jsonwebtoken");

// Helper to convert Uint8Array to Buffer for Prisma (PostgreSQL Bytes)
function uint8ArrayToBuffer(arr) {
  return Buffer.from(arr);
}

// Helper to convert base64url credential ID to string
function bufferToBase64url(buf) {
  return buf.toString("base64url");
}

const getExpectedOrigins = () => {
  return [
    env.server.origin,
    env.apps.adminUrl,
    env.apps.operationsUrl,
    "http://localhost:5173",
    "http://localhost:5176"
  ].filter(Boolean);
};

async function generateRegistrationOptions(actor) {
  const prisma = getPrismaClient();

  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    include: { passkeys: true }
  });

  if (!user) {
    throw createHttpError(404, "User not found");
  }

  const options = await generateRegistrationOptionsWebAuthn({
    rpName: env.auth.rpName,
    rpID: env.auth.rpId,
    userID: Buffer.from(user.id), // userID must be Uint8Array
    userName: user.email,
    userDisplayName: user.name || user.email,
    attestationType: "none",
    excludeCredentials: user.passkeys.map(passkey => ({
      id: passkey.credentialId,
      type: "public-key"
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred"
    }
  });

  // Save challenge to user
  await prisma.user.update({
    where: { id: user.id },
    data: { currentChallenge: options.challenge }
  });

  return options;
}

async function verifyRegistration(actor, response) {
  const prisma = getPrismaClient();

  const user = await prisma.user.findUnique({
    where: { id: actor.id }
  });

  if (!user || !user.currentChallenge) {
    throw createHttpError(400, "No registration challenge found");
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: getExpectedOrigins(),
      expectedRPID: env.auth.rpId,
      requireUserVerification: true
    });
  } catch (error) {
    throw createHttpError(400, error.message);
  }

  const { verified, registrationInfo } = verification;

  if (!verified || !registrationInfo) {
    throw createHttpError(400, "Passkey verification failed");
  }

  const { credential } = registrationInfo;
  const { id: credentialID, publicKey: credentialPublicKey, counter } = credential;
  const transports = response.response.transports ? response.response.transports.join(",") : null;

  await prisma.$transaction([
    prisma.passkey.create({
      data: {
        userId: user.id,
        credentialId: credentialID,
        publicKey: uint8ArrayToBuffer(credentialPublicKey),
        counter: BigInt(counter),
        transports: transports
      }
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { currentChallenge: null } // Clear challenge
    })
  ]);

  return { success: true };
}

async function generateAuthOptions(input = {}) {
  const prisma = getPrismaClient();
  const email = input.email ? normalizeEmail(input.email) : null;
  
  let user = null;
  
  if (email) {
    const tenant = input.tenantSlug
      ? await prisma.tenant.findUnique({ where: { slug: input.tenantSlug } })
      : undefined;

    if (input.tenantSlug && !tenant) {
      throw createHttpError(400, "Invalid tenant");
    }

    user = await prisma.user.findFirst({
      where: {
        email,
        tenantId: tenant ? tenant.id : null,
        status: { not: userStatuses.deleted }
      },
      include: { passkeys: true }
    });

    if (!user) {
      throw createHttpError(404, "User not found");
    }
  }

  const options = await generateAuthenticationOptionsWebAuthn({
    rpID: env.auth.rpId,
    allowCredentials: user ? user.passkeys.map(passkey => ({
      id: passkey.credentialId,
      type: "public-key",
      transports: passkey.transports ? passkey.transports.split(",") : undefined
    })) : [], // Empty array triggers discoverable credentials
    userVerification: "preferred"
  });

  // Since we might not have a user yet, sign the challenge securely in a short-lived stateless token
  const challengeToken = jwt.sign({ challenge: options.challenge }, env.auth.jwtSecret, { expiresIn: '5m' });

  // Add the token to the options so the frontend can send it back
  return { ...options, challengeToken };
}

async function verifyAuth(input) {
  const prisma = getPrismaClient();
  const response = input.response;
  const challengeToken = input.challengeToken;

  if (!response || !challengeToken) {
    throw createHttpError(400, "Passkey response and challenge token are required");
  }

  // 1. Verify stateless challenge token
  let expectedChallenge;
  try {
    const decoded = jwt.verify(challengeToken, env.auth.jwtSecret);
    expectedChallenge = decoded.challenge;
  } catch (err) {
    throw createHttpError(400, "Authentication session expired or invalid");
  }

  // 2. Look up the passkey to find the user
  const passkey = await prisma.passkey.findUnique({
    where: { credentialId: response.id },
    include: { user: true }
  });

  if (!passkey) {
    throw createHttpError(401, "Invalid passkey");
  }

  const user = passkey.user;

  if (user.status === userStatuses.deleted || user.status === userStatuses.disabled) {
    throw createHttpError(403, "Account is disabled or deleted");
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: getExpectedOrigins(),
      expectedRPID: env.auth.rpId,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
        transports: passkey.transports ? passkey.transports.split(",") : undefined
      },
      requireUserVerification: true
    });
  } catch (error) {
    throw createHttpError(401, error.message);
  }

  const { verified, authenticationInfo } = verification;

  if (!verified || !authenticationInfo) {
    throw createHttpError(401, "Passkey authentication failed");
  }

  await prisma.$transaction([
    prisma.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: BigInt(authenticationInfo.newCounter),
        lastUsedAt: new Date()
      }
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date()
      }
    })
  ]);

  const refreshedUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { tenant: true, store: true }
  });

  return {
    token: createUserToken(refreshedUser),
    user: serializeUser(refreshedUser)
  };
}

async function listPasskeys(actor) {
  const prisma = getPrismaClient();

  const passkeys = await prisma.passkey.findMany({
    where: { userId: actor.id },
    select: {
      id: true,
      createdAt: true,
      lastUsedAt: true,
      transports: true
    }
  });

  return passkeys;
}

async function deletePasskey(actor, passkeyId) {
  const prisma = getPrismaClient();

  const passkey = await prisma.passkey.findUnique({
    where: { id: passkeyId }
  });

  if (!passkey || passkey.userId !== actor.id) {
    throw createHttpError(404, "Passkey not found");
  }

  await prisma.passkey.delete({
    where: { id: passkeyId }
  });

  return { success: true };
}

module.exports = {
  generateAuthOptions,
  generateRegistrationOptions,
  verifyAuth,
  verifyRegistration,
  listPasskeys,
  deletePasskey
};
