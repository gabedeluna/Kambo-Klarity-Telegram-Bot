/**
 * @fileoverview Defines API routes for the Kambo Klarity application.
 * Handles endpoints primarily used for AJAX requests from the web interface
 * or external services (like waiver completion webhooks).
 */

const express = require("express");
const apiHandler = require("../handlers/apiHandler"); // Import the handler

let prisma, logger; // Removed unused 'agentExecutor', 'notifier' for now
// let agentExecutor, notifier; // Keep these commented out if planned for future use

/**
 * Initializes the API router module with required dependencies.
 * @param {object} deps - An object containing the dependencies.
 * @param {object} deps.prisma - The Prisma client instance.
 * @param {object} deps.logger - The logger instance.
 * @param {object} [deps.agentExecutor] - The agent executor instance (optional).
 * @param {object} [deps.notifier] - The notifier instance (optional).
 * @throws {Error} If required dependencies are missing.
 */
function initialize(deps) {
  prisma = deps.prisma;
  logger = deps.logger;

  // Store optional dependencies if provided
  // agentExecutor = deps.agentExecutor;
  // notifier = deps.notifier;

  // Initialize the specific handler needed by this router
  apiHandler.initialize({ prisma, logger });
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

  // Route to handle form submissions (placeholder)
  router.post("/submit-waiver", (req, res) =>
    res
      .status(501)
      .json({
        success: false,
        message: "POST /api/submit-waiver Not Implemented Yet",
      }),
  );

  // Route to handle waiver completion webhook (placeholder)
  router.post("/waiver-completed", (req, res) => {
    logger.warn("Received POST /waiver-completed - Not Implemented Yet.");
    res
      .status(501)
      .json({
        success: false,
        message: "POST /waiver-completed Not Implemented Yet",
      });
  });

  return router;
}

// Export the initialize function and the getter for the router.
module.exports = { initialize, getRouter };
