const crypto = require("crypto");
const { env } = require("../config/env");

const ALGORITHM = "aes-256-gcm";
// The key must be exactly 32 bytes (256 bits)
const KEY = Buffer.from(env.encryptionKey, "hex");

function encrypt(text) {
  if (!text) return text;
  
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  
  // Format: iv:authTag:encryptedText
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function decrypt(text) {
  if (!text) return text;
  
  const parts = text.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format");
  }
  
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

module.exports = {
  encrypt,
  decrypt
};
