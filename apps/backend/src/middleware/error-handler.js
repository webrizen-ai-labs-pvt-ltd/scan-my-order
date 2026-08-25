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
  console.error("[Backend Error]", error);
  const statusCode = error.statusCode || 500;

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
