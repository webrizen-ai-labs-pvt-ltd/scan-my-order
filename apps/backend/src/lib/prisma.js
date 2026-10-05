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
    // Supabase's session pooler (port 5432) gives the whole project only ~15 connections, shared by
    // every server and script using this database; the transaction pooler (6543, pgbouncer=true)
    // shares connections and doesn't run out. Migrations use DIRECT_URL instead.
    if (url && /pooler\.supabase\.com:5432/.test(url)) {
      console.warn("[DB] DATABASE_URL uses Supabase's session pooler (port 5432), limited to ~15 connections for the whole project. Use the transaction pooler (port 6543 with pgbouncer=true) for servers.");
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
