require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { errorResponse } = require("./src/utils/response.js");

const authRoutes = require("./src/routes/authRoutes.js");
const adminRoutes = require("./src/routes/adminRoutes.js");
const ownerRoutes = require("./src/routes/ownerRoutes.js");
const userRoutes = require("./src/routes/userRoutes.js");
const storeRoutes = require("./src/routes/storeRoutes.js");

const app = express();
const PORT = process.env.PORT || 8000;

// Enable CORS and JSON body parser
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "Scan My Order Backend API",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Scan My Order Backend API",
    documentation: "/api/health",
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/owner", ownerRoutes);
app.use("/api/users", userRoutes);
app.use("/api/stores", storeRoutes);

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
