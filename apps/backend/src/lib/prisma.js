let PrismaClient;
let Prisma;
try {
  ({ PrismaClient, Prisma } = require("../generated/prisma_v2"));
} catch (e) {
  try {
    ({ PrismaClient, Prisma } = require("../generated/prisma"));
  } catch (e2) {
    ({ PrismaClient, Prisma } = require("@prisma/client"));
  }
}
const { env } = require("../config/env");

let prisma;

function getPrismaClient() {
  if (!prisma) {
    let url = env.database.url;
    // A pool of connections so requests from different screens run side by side instead of queuing
    // behind one connection (connection_limit=1 is only meant for serverless functions).
    if (url && !url.includes("connection_limit")) {
      url += (url.includes("?") ? "&" : "?") + `connection_limit=${env.database.connectionLimit}`;
    }
    if (url && url.includes("pgbouncer=true")) {
      console.warn("[DB] DATABASE_URL uses the transaction pooler (pgbouncer=true): every query costs extra round trips. Use the session pooler (port 5432) for a long-running server.");
    }

    prisma = new PrismaClient({
      datasources: url ? { db: { url } } : undefined,
      log: env.isDevelopment ? ["error", "warn"] : ["error"]
    });
  }

  return prisma;
}

async function disconnectPrisma() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }
}

module.exports = {
  Prisma,
  disconnectPrisma,
  getPrismaClient
};
