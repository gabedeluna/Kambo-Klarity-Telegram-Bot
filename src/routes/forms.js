/**
 * @fileoverview Defines routes for handling HTML form submissions.
 * These routes typically receive POST requests from standard HTML forms.
 */

const express = require("express");
const router = express.Router();

let logger; // Module-level logger variable
let regHandler; // Module-level registration handler variable

/**
 * Initializes the forms router with dependencies.
 * @param {object} deps - Dependencies object.
 * @param {object} deps.logger - Logger instance.
 * @param {object} deps.registrationHandler - Registration handler instance.
 */
function initialize(deps) {
  if (!deps || !deps.logger || !deps.registrationHandler) {
    // Added !deps check
    // Check for registrationHandler
    console.error(
      "FATAL: formsRouter initialization failed. Missing dependencies.",
      {
        // Log actual presence rather than boolean cast if deps might be null/undefined
        logger: deps ? !!deps.logger : false,
        registrationHandler: deps ? !!deps.registrationHandler : false,
      },
    );
    throw new Error("Missing dependencies for formsRouter");
  }
  logger = deps.logger;
  regHandler = deps.registrationHandler; // Assign handler
  logger.info("[formsRouter] Initialized successfully.");
}

// Define Routes
// GET routes for serving HTML form pages (e.g., /register.html) are handled
// by the express.static middleware in app.js, so they don't need to be defined here.
router.post("/submit-registration", (req, res, next) => {
  logger?.info(
    `[forms.js] Received POST to /submit-registration for user: ${req.body?.telegramId || "UnknownTelegramId"}`,
  );

  // Ensure regHandler is initialized before calling its method
  if (
    !regHandler ||
    typeof regHandler.handleRegistrationSubmit !== "function"
  ) {
    logger.error(
      "Registration handler or submit method not initialized or not a function.",
    );
    return res
      .status(500)
      .send("Internal Server Error: Registration handler not ready.");
  }
  // Delegate to the initialized handler's method
  regHandler.handleRegistrationSubmit(req, res, next);
});

module.exports = { initialize, router };
