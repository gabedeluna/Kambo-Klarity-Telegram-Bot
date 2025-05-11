// src/middleware/loggingMiddleware.js

let logger;

/**
 * Initializes the logging middleware with the logger instance.
 * @param {object} deps - Dependencies object.
 * @param {object} deps.logger - The logger instance.
 */
function initialize(deps) {
  if (!deps.logger) {
    console.error(
      "FATAL: loggingMiddleware initialization failed. Missing logger.",
    );
    throw new Error("Missing logger dependency for loggingMiddleware");
  }
  logger = deps.logger;
  logger.info("[loggingMiddleware] Initialized successfully.");
}

/**
 * Express middleware function to log incoming requests.
 * Logs method, URL, and originating IP address.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
function logRequest(req, res, next) {
  if (!logger) {
    console.error("Logging middleware called before initialization!");
    return next(); // Continue without logging if logger isn't ready
  }

  // Log basic request info
  logger.info(
    {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip, // Express provides the IP
      headers: {
        "user-agent": req.headers["user-agent"],
        referer: req.headers["referer"],
      },
    },
    "Incoming request",
  );

  // Continue to the next middleware/route handler
  next();
}

module.exports = {
  initialize,
  logRequest, // Export the middleware function itself
};
