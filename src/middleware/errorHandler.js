/**
 * Global error handling middleware for Express.
 * Catches all errors thrown or passed to next() in the application,
 * logs them appropriately, and sends a consistent error response.
 *
 * @module middleware/errorHandler
 */
const logger = require("../core/logger");
// const AppError = require("../errors/AppError"); // Ensure type hint if needed

/**
 * Express error handling middleware.
 *
 * @param {Error} err - The error object
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  // Log the error with detailed context
  logger.error(
    {
      err: {
        // Log error details explicitly
        name: err.name,
        message: err.message,
        statusCode: err.statusCode,
        isOperational: err.isOperational,
        stack: err.stack, // Include stack for debugging
      },
      req: {
        // Log request details for context
        method: req.method,
        path: req.originalUrl, // Use originalUrl to get full path
        ip: req.ip,
        // Add other relevant request details if needed (headers, body - carefully!)
      },
    },
    `Unhandled error caught by error handler: ${err.message}`,
  );

  // Determine status code
  let statusCode = 500;
  if (err.isOperational) {
    // Trust operational errors
    statusCode = err.statusCode || 500; // Use error's code, default 500 if missing
  }
  // Potentially handle specific built-in error types here too if needed

  // Determine response message
  const message = err.isOperational ? err.message : "Internal Server Error";

  // Check if headers were already sent (e.g., by streaming response)
  if (res.headersSent) {
    return next(err); // Delegate to default Express handler if already sent
  }

  // Send response
  res.status(statusCode).json({
    status: "error", // Consistent status field
    message: message,
    // Optionally include error code or stack in development only
    ...(process.env.NODE_ENV !== "production" &&
      !err.isOperational && { stack: err.stack }),
  });
};

module.exports = errorHandler;
