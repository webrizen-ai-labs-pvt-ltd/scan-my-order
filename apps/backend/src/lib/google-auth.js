const { OAuth2Client } = require("google-auth-library");
const { env } = require("../config/env");

let googleClient;

function getGoogleClient() {
  if (!googleClient) {
    googleClient = new OAuth2Client(env.auth.googleClientId);
  }

  return googleClient;
}

async function verifyGoogleIdToken(idToken) {
  const ticket = await getGoogleClient().verifyIdToken({
    idToken,
    audience: env.auth.googleClientId
  });

  return ticket.getPayload();
}

module.exports = {
  getGoogleClient,
  verifyGoogleIdToken
};
