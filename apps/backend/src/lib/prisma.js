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
    if (url && url.includes("pgbouncer=true") && !url.includes("connection_limit")) {
      url += (url.includes("?") ? "&" : "?") + "connection_limit=1";
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
