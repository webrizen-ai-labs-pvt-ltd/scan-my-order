const app = require("./app");
const { env } = require("./config/env");
const { startJobs } = require("./jobs/cleanup");
const { getPrismaClient, disconnectPrisma } = require("./lib/prisma");

const port = env.server.port;

const server = app.listen(port, "0.0.0.0", async () => {
  console.log(`Backend listening on port ${port} (exposed to local network)`);
  try {
    await getPrismaClient().$connect();
    console.log("Prisma connected eagerly to database");
  } catch (err) {
    console.error("Failed to connect eagerly to database:", err.message);
  }
  startJobs();
});

async function handleShutdown(signal) {
  console.log(`Received ${signal}, closing server and disconnecting database...`);
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
