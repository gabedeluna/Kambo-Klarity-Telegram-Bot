const AppError = require("./AppError");

/**
 * Error class for resource not found situations.
 * Automatically sets status code to 404.
 */
class NotFoundError extends AppError {
  /**
   * @param {string} message - Error message, defaults to 'Resource not found'.
   */
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}

module.exports = NotFoundError;
