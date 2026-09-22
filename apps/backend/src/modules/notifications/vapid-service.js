const fs = require("node:fs");
const path = require("node:path");
const webPush = require("web-push");

const VAPID_FILE = path.resolve(__dirname, "..", "..", "..", ".vapid.json");

let vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: process.env.VAPID_SUBJECT || "mailto:support@scanmyorder.com"
};

// If not present in environment, check file or generate
if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  try {
    if (fs.existsSync(VAPID_FILE)) {
      const data = JSON.parse(fs.readFileSync(VAPID_FILE, "utf-8"));
      if (data.publicKey && data.privateKey) {
        vapidKeys.publicKey = data.publicKey;
        vapidKeys.privateKey = data.privateKey;
        if (data.subject) vapidKeys.subject = data.subject;
      }
    }
  } catch (err) {
    console.warn("[VAPID] Could not read .vapid.json, generating new keys...", err.message);
  }

  if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    const generated = webPush.generateVAPIDKeys();
    vapidKeys.publicKey = generated.publicKey;
    vapidKeys.privateKey = generated.privateKey;
    try {
      fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2), "utf-8");
      console.log("[VAPID] Generated and saved new VAPID keys to .vapid.json");
    } catch (writeErr) {
      console.warn("[VAPID] Could not write .vapid.json to disk:", writeErr.message);
    }
  }
}

try {
  webPush.setVapidDetails(
    vapidKeys.subject,
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
  console.log("[VAPID] WebPush VAPID details configured successfully.");
} catch (configErr) {
  console.error("[VAPID] Failed to configure VAPID details:", configErr.message);
}

function getVapidPublicKey() {
  return vapidKeys.publicKey;
}

module.exports = {
  webPush,
  getVapidPublicKey
};
