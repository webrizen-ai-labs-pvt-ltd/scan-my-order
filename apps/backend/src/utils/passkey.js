const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");

const RP_ID = process.env.RP_ID || "localhost";
const RP_NAME = process.env.RP_NAME || "Scan My Order";
const ORIGIN = process.env.ORIGIN || "http://localhost:5173";

// Memory cache for user challenge options during WebAuthn flow
const challengeStore = new Map();

async function getPasskeyRegistrationOptions(user) {
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new Uint8Array(Buffer.from(user.id)),
    userName: user.email,
    userDisplayName: user.name,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  challengeStore.set(`reg_${user.id}`, options.challenge);
  return options;
}

async function verifyPasskeyRegistration(userOrUserId, response, expectedChallengeFromClient) {
  const userId = typeof userOrUserId === "object" ? userOrUserId?.id : userOrUserId;
  const storedChallenge = userId ? challengeStore.get(`reg_${userId}`) : null;
  const expectedChallenge = storedChallenge || expectedChallengeFromClient;

  if (!expectedChallenge) {
    throw new Error("Challenge expired or not found");
  }

  const allowedOrigins = [
    ORIGIN,
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:8000",
    "http://127.0.0.1:5173",
  ];

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: allowedOrigins,
    expectedRPID: RP_ID,
  });

  if (userId) {
    challengeStore.delete(`reg_${userId}`);
  }
  return verification;
}

async function getPasskeyAuthenticationOptions(userPasskeys = []) {
  const allowCredentials = userPasskeys.map((pk) => ({
    id: pk.credentialId,
    transports: pk.transports ? (typeof pk.transports === "string" ? JSON.parse(pk.transports) : pk.transports) : undefined,
  }));

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials,
    userVerification: "preferred",
  });

  const challengeKey = `auth_${options.challenge}`;
  challengeStore.set(challengeKey, options.challenge);
  challengeStore.set(options.challenge, options.challenge);
  return { options, challengeKey };
}

async function verifyPasskeyAuthentication(response, passkey, challengeKey) {
  const expectedChallenge = challengeStore.get(challengeKey) || challengeKey;
  if (!expectedChallenge) {
    throw new Error("Challenge expired or not found");
  }

  const allowedOrigins = [
    ORIGIN,
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:8000",
    "http://127.0.0.1:5173",
  ];

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: allowedOrigins,
    expectedRPID: RP_ID,
    credential: {
      id: passkey.credentialId,
      publicKey: passkey.publicKey,
      counter: Number(passkey.counter),
    },
  });

  challengeStore.delete(challengeKey);
  return verification;
}

module.exports = {
  getPasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  getPasskeyAuthenticationOptions,
  verifyPasskeyAuthentication,
};
