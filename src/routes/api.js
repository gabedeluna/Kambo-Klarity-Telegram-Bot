/**
 * @fileoverview Defines API routes for the Kambo Klarity application.
 * Handles endpoints primarily used for AJAX requests from the web interface
 * or external services (like waiver completion webhooks).
 */

const express = require("express");
const apiHandler = require("../handlers/apiHandler"); // Import the handler

let prisma, logger, telegramNotifier; // Added telegramNotifier
// let agentExecutor; // Keep commented out if planned for future use

/**
 * Initializes the API router module with required dependencies.
 * @param {object} deps - An object containing the dependencies.
 * @param {object} deps.prisma - The Prisma client instance.
 * @param {object} deps.logger - The logger instance.
 * @param {object} deps.telegramNotifier - The Telegram Notifier instance.
 * @param {object} [deps.agentExecutor] - The agent executor instance (optional).
 * @throws {Error} If required dependencies are missing.
 */
function initialize(deps) {
  prisma = deps.prisma;
  logger = deps.logger;
  telegramNotifier = deps.telegramNotifier; // Store telegramNotifier

  // Store optional dependencies if provided
  // agentExecutor = deps.agentExecutor;

  // Check required dependencies for the router itself (none specific for now)
  if (!prisma || !logger || !telegramNotifier) {
    throw new Error(
      "API Router Initialization Error: Missing required dependencies (prisma, logger, telegramNotifier).",
    );
  }

  // Initialize the specific handler needed by this router, passing all required deps
  apiHandler.initialize({ prisma, logger, telegramNotifier });
}

/**
 * Returns the configured Express router.
 * @returns {express.Router} The configured Express router.
 */
function getRouter() {
  // Define the router inside the function where it's used
  const router = express.Router();

  // Route to get user data for pre-filling forms
  router.get("/user-data", apiHandler.getUserDataApi);

  // Route to handle waiver form submissions
  router.post("/submit-waiver", apiHandler.submitWaiverApi); // Use the actual handler

  // Webhook route for waiver completion
  router.post("/waiver-completed", apiHandler.waiverCompletedWebhook); // Use the actual handler

  logger.info("API routes configured.");
  return router;
}

// Export the initialize function and the getter for the router.
module.exports = { initialize, getRouter };
