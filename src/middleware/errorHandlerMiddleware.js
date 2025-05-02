// src/middleware/errorHandlerMiddleware.js

const { createLogger } = require("../core/logger"); // Adjust path as needed
const logger = createLogger(); // Create a logger instance for this middleware

/**
 * Centralized Express error handling middleware.
 * Catches errors passed via next(err) from any route or middleware preceding it.
 * Logs the error and sends a generic 500 response.
 *
 * @param {Error} err - The error object.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
function errorHandlerMiddleware(err, req, res, next) {
  // Log the error with details
  logger.error(
    {
      err: {
        message: err.message,
        stack: err.stack,
        // Include additional properties if available (e.g., err.status)
        ...(err.status && { status: err.status }),
        ...(err.code && { code: err.code }),
      },
      req: {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        headers: req.headers, // Be cautious logging sensitive headers
        body: req.body, // Be cautious logging sensitive body data
      },
    },
    "Unhandled error occurred",
  );

  // If headers have already been sent, delegate to the default Express handler
  if (res.headersSent) {
    return next(err);
  }

  // Determine status code - use error's status or default to 500
  const statusCode = typeof err.status === "number" ? err.status : 500;

  // Send a generic error response to the client
  res.status(statusCode).json({
    success: false,
    error: {
      message: statusCode === 500 ? "Internal Server Error" : err.message,
      // Optionally include more details in development environments
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    },
  });
}

// Export the middleware function directly
module.exports = errorHandlerMiddleware;
