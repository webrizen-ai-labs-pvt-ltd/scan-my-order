const { createApiError } = require("@smo/shared");

function createHttpError(statusCode, message, details = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function notFoundHandler(req, _res, next) {
  next(createHttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// Database rule violations the code didn't check for: a readable answer instead of a 500
const PRISMA_ERRORS = {
  P2002: [409, "This already exists."],          // unique constraint
  P2025: [404, "That record no longer exists."], // record to update/delete not found
  P2003: [409, "This is still linked to other records."] // foreign key
};

function errorHandler(error, _req, res, _next) {
  const mapped = !error.statusCode && PRISMA_ERRORS[error.code];
  if (mapped) {
    const detail = String(error.message || '').split('\n').filter(Boolean).pop();
    console.warn(`[API ${mapped[0]}] Prisma ${error.code}: ${detail}`);
    return res.status(mapped[0]).json(createApiError(mapped[1], { code: error.code }));
  }
  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) {
    console.error("[Backend Server Error]", error);
  } else {
    console.warn(`[API ${statusCode}] ${error.message}`);
  }

  res.status(statusCode).json(createApiError(
    statusCode === 500 ? "Internal server error" : error.message,
    error.details || {}
  ));
}

module.exports = {
  createHttpError,
  errorHandler,
  notFoundHandler
};
