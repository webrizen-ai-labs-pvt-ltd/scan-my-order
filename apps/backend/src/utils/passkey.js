const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");

const RP_NAME = process.env.RP_NAME || "Scan My Order";

function getRpId(req) {
  const origin = req?.headers?.origin || req?.headers?.referer || "";

  // 1. If request comes from scanmyorder.com or subdomains, return apex domain 'scanmyorder.com'
  if (origin.includes("scanmyorder.com")) {
    return "scanmyorder.com";
  }

  // 2. If request comes from local dev
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
    return "localhost";
  }

  // 3. Extract domain from custom origin / vercel deployment preview
  if (origin.startsWith("http://") || origin.startsWith("https://")) {
    try {
      const hostname = new URL(origin).hostname;
      return hostname;
    } catch {}
  }

  // 4. Default fallback: check process.env.RP_ID or 'scanmyorder.com' in production
  if (process.env.RP_ID && process.env.RP_ID !== "localhost") {
    return process.env.RP_ID;
  }

  return process.env.NODE_ENV === "production" ? "scanmyorder.com" : "localhost";
}

function getAllowedOrigins(req) {
  const origin = req?.headers?.origin || req?.headers?.referer || "";
  let currentOrigin = "";
  if (origin.startsWith("http://") || origin.startsWith("https://")) {
    try {
      currentOrigin = new URL(origin).origin;
    } catch {}
  }

  const envOrigins = [
    currentOrigin,
    process.env.ORIGIN,
    process.env.ADMIN_APP_URL,
    process.env.MENU_APP_URL,
    process.env.OPERATIONS_APP_URL,
    process.env.MARKETING_APP_URL,
    "https://admin.scanmyorder.com",
    "https://operations.scanmyorder.com",
    "https://menu.scanmyorder.com",
    "https://scanmyorder.com",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:8000",
  ];
  return Array.from(new Set(envOrigins.filter(Boolean)));
}

// Memory cache for user challenge options during WebAuthn flow
const challengeStore = new Map();

async function getPasskeyRegistrationOptions(user, req) {
  const rpID = getRpId(req);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: new Uint8Array(Buffer.from(user.id)),
    userName: user.email,
    userDisplayName: user.name,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  challengeStore.set(options.challenge, options.challenge);
  if (user.id) {
    challengeStore.set(`reg_${user.id}`, options.challenge);
  }
  return options;
}

async function verifyPasskeyRegistration(userOrUserId, response, expectedChallengeFromClient, req) {
  const userId = typeof userOrUserId === "object" ? userOrUserId?.id : userOrUserId;
  const storedChallenge = userId ? challengeStore.get(`reg_${userId}`) : null;
  const expectedChallenge = storedChallenge || challengeStore.get(expectedChallengeFromClient) || expectedChallengeFromClient;

  if (!expectedChallenge) {
    throw new Error("Challenge expired or not found");
  }

  const rpID = getRpId(req);
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: getAllowedOrigins(req),
    expectedRPID: rpID,
  });

  if (userId) {
    challengeStore.delete(`reg_${userId}`);
  }
  if (expectedChallengeFromClient) {
    challengeStore.delete(expectedChallengeFromClient);
  }
  return verification;
}

async function getPasskeyAuthenticationOptions(userPasskeys = [], req) {
  const allowCredentials = userPasskeys.map((pk) => ({
    id: pk.credentialId,
    transports: pk.transports ? (typeof pk.transports === "string" ? JSON.parse(pk.transports) : pk.transports) : undefined,
  }));

  const rpID = getRpId(req);
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: "preferred",
  });

  challengeStore.set(options.challenge, options.challenge);
  return { options, challengeKey: options.challenge };
}

async function verifyPasskeyAuthentication(response, passkey, challengeKey, req) {
  const expectedChallenge = challengeStore.get(challengeKey) || challengeKey;
  if (!expectedChallenge) {
    throw new Error("Challenge expired or not found");
  }

  const rpID = getRpId(req);
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: getAllowedOrigins(req),
    expectedRPID: rpID,
    credential: {
      id: passkey.credentialId,
      publicKey: passkey.publicKey,
      counter: Number(passkey.counter),
    },
  });

  if (challengeKey) {
    challengeStore.delete(challengeKey);
  }
  return verification;
}

module.exports = {
  getPasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  getPasskeyAuthenticationOptions,
  verifyPasskeyAuthentication,
};
