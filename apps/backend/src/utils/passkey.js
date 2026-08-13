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

async function verifyPasskeyRegistration(user, response) {
  const expectedChallenge = challengeStore.get(`reg_${user.id}`);
  if (!expectedChallenge) {
    throw new Error("Challenge expired or not found");
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });

  challengeStore.delete(`reg_${user.id}`);
  return verification;
}

async function getPasskeyAuthenticationOptions(userPasskeys = []) {
  const allowCredentials = userPasskeys.map((pk) => ({
    id: pk.credentialId,
    transports: pk.transports ? pk.transports.split(",") : undefined,
  }));

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials,
    userVerification: "preferred",
  });

  const challengeKey = `auth_${options.challenge}`;
  challengeStore.set(challengeKey, options.challenge);
  return { options, challengeKey };
}

async function verifyPasskeyAuthentication(response, passkey, challengeKey) {
  const expectedChallenge = challengeStore.get(challengeKey);
  if (!expectedChallenge) {
    throw new Error("Challenge expired or not found");
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
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
