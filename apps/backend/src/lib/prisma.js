const { PrismaClient } = require("@prisma/client");
const { env } = require("../config/env");

let prisma;

function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient({
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
  disconnectPrisma,
  getPrismaClient
};
