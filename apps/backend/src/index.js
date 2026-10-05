const app = require("./app");
const { env } = require("./config/env");
const { startAllJobs, stopAllJobs } = require("./jobs");
const { getPrismaClient, disconnectPrisma } = require("./lib/prisma");
const { startPaymentReconciler, stopPaymentReconciler } = require("./modules/payments/payment-service");
const { startDispatchSweeper, stopDispatchSweeper } = require("./modules/waiter-calls/waiter-dispatch-engine");

const port = env.server.port;

const server = app.listen(port, "0.0.0.0", async () => {
  console.log(`Backend listening on port ${port} (exposed to local network)`);
  try {
    await getPrismaClient().$connect();
    console.log("Prisma connected eagerly to database");
  } catch (err) {
    console.error("Failed to connect eagerly to database:", err.message);
  }
  await startAllJobs();
  startPaymentReconciler();
  startDispatchSweeper();
});

async function handleShutdown(signal) {
  console.log(`Received ${signal}, closing server and disconnecting database...`);
  stopAllJobs();
  stopPaymentReconciler();
  stopDispatchSweeper();
  // Live-update streams never end on their own; close them so the server can shut down cleanly
  require("./modules/orders/sse-service").closeAllStreams();
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
  // Last resort if a request hangs
  setTimeout(() => process.exit(0), 10000).unref();
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
