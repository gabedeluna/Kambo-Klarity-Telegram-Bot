/**
 * Base class for custom application errors.
 * Allows setting a status code and identifying operational errors.
 */
class AppError extends Error {
  /**
   * @param {string} message - Error message.
   * @param {number} statusCode - HTTP status code (e.g., 400, 404, 500).
   */
  constructor(message, statusCode) {
    super(message); // Call parent constructor (Error)

    this.statusCode = statusCode;
    // Indicate that this is an operational error we expect, not a programming bug
    this.isOperational = true;
    // Set the name for better identification
    this.name = this.constructor.name;

    // Capture stack trace, excluding constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
