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

function errorHandler(error, _req, res, _next) {
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
