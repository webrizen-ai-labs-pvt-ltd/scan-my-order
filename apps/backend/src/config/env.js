const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "..", "..", ".env"),
  quiet: true
});

const requiredEnvNames = [
  "DATABASE_URL",
  "DIRECT_URL",
  "JWT_SECRET",
  "GOOGLE_CLIENT_ID",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "EMAIL_FROM",
  "ENCRYPTION_KEY"
];

function readEnv(name, fallback) {
  const value = process.env[name] || fallback;

  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

for (const name of requiredEnvNames) {
  readEnv(name);
}

const env = {
  isDevelopment: process.env.NODE_ENV !== "production",
  encryptionKey: readEnv("ENCRYPTION_KEY"),
  server: {
    port: Number(process.env.PORT || 8000),
    nodeEnv: process.env.NODE_ENV || "development",
    origin: process.env.ORIGIN || "http://localhost:5173"
  },
  database: {
    url: readEnv("DATABASE_URL"),
    directUrl: readEnv("DIRECT_URL")
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    secretKey: process.env.SUPABASE_SECRET_KEY,
    jwksUrl: process.env.SUPABASE_JWKS_URL
  },
  auth: {
    jwtSecret: readEnv("JWT_SECRET"),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
    googleClientId: readEnv("GOOGLE_CLIENT_ID"),
    rpId: process.env.RP_ID || "localhost",
    rpName: process.env.RP_NAME || "Scan My Order"
  },
  email: {
    host: readEnv("SMTP_HOST"),
    port: Number(readEnv("SMTP_PORT")),
    user: readEnv("SMTP_USER"),
    pass: readEnv("SMTP_PASS"),
    from: readEnv("EMAIL_FROM")
  },
  phonePe: {
    host: process.env.PHONEPE_HOST,
    merchantId: process.env.PHONEPE_MERCHANT_ID,
    saltKey: process.env.PHONEPE_SALT_KEY,
    saltIndex: process.env.PHONEPE_SALT_INDEX,
    redirectUrl: process.env.PHONEPE_REDIRECT_URL
  },
  apps: {
    apiUrl: process.env.API_URL || "http://localhost:8000",
    adminUrl: process.env.ADMIN_APP_URL,
    marketingUrl: process.env.MARKETING_APP_URL,
    menuUrl: process.env.MENU_APP_URL,
    operationsUrl: process.env.OPERATIONS_APP_URL
  }
};

module.exports = {
  env
};
