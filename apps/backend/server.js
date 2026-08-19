require("dotenv").config();
const express = require("express");
const cors = require("cors");
const prisma = require("./src/config/prisma.js");
const { errorResponse } = require("./src/utils/response.js");

const authRoutes = require("./src/routes/authRoutes.js");
const adminRoutes = require("./src/routes/adminRoutes.js");
const ownerRoutes = require("./src/routes/ownerRoutes.js");
const userRoutes = require("./src/routes/userRoutes.js");
const storeRoutes = require("./src/routes/storeRoutes.js");
const subscriptionRoutes = require("./src/routes/subscriptionRoutes.js");
const tableRoutes = require("./src/routes/tableRoutes.js");
const orderRoutes = require("./src/routes/orderRoutes.js");

const app = express();
const PORT = process.env.PORT || 8000;

// Enable CORS for all origins
app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Live Diagnostic Health Check Handler for Render Monitoring
 */
async function healthCheckHandler(req, res) {
  const startTime = Date.now();
  const checks = {
    database: { status: "unknown", latencyMs: 0 },
    supabase: { status: "unknown", latencyMs: 0 },
    services: {
      passkeyAuth: process.env.RP_ID ? "configured" : "unconfigured",
      nodemailerSmtp: process.env.SMTP_HOST ? "configured" : "unconfigured",
      phonepeSandbox: process.env.PHONEPE_MERCHANT_ID ? "configured" : "unconfigured",
    },
    system: {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      nodeVersion: process.version,
    },
  };

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database.status = "healthy";
    checks.database.latencyMs = Date.now() - dbStart;
  } catch (err) {
    checks.database.status = "error";
    checks.database.error = err.message;
  }

  try {
    const sbUrl = process.env.SUPABASE_URL || "https://quavkrhpvecpeajqxtav.supabase.co";
    const sbStart = Date.now();
    const sbRes = await fetch(`${sbUrl}/rest/v1/`, { method: "HEAD", signal: AbortSignal.timeout(3000) }).catch(() => null);
    checks.supabase.status = sbRes ? "healthy" : "unreachable";
    checks.supabase.latencyMs = Date.now() - sbStart;
  } catch (err) {
    checks.supabase.status = "unreachable";
  }

  const isHealthy = checks.database.status === "healthy";
  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "healthy" : "degraded",
    service: "Scan My Order Backend API",
    environment: process.env.NODE_ENV || "production",
    timestamp: new Date().toISOString(),
    totalResponseTimeMs: Date.now() - startTime,
    checks,
  });
}

app.get("/api/health", healthCheckHandler);
app.get("/health", healthCheckHandler);

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Scan My Order Backend API",
    health: "/api/health",
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/owner", ownerRoutes);
app.use("/api/users", userRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/orders", orderRoutes);

// 404 Handler
app.use((req, res) => {
  return errorResponse(res, `Route ${req.originalUrl} not found`, 404);
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err);
  return errorResponse(res, err.message || "Internal server error", 500);
});

app.listen(PORT, () => {
  console.log(`🚀 Scan My Order Backend Server running on port ${PORT}`);
});

module.exports = app;
