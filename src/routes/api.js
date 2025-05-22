/**
 * @fileoverview Defines API routes for the Kambo Klarity application.
 * Handles endpoints primarily used for AJAX requests from the web interface
 * or external services (like waiver completion webhooks).
 */

const express = require("express");
const apiHandler = require("../handlers/apiHandler"); // Import the handler

let prisma, logger, telegramNotifier, bot, googleCalendarTool; // Added bot and googleCalendarTool
// let agentExecutor; // Keep commented out if planned for future use

/**
 * Initializes the API router module with required dependencies.
 * @param {object} deps - An object containing the dependencies.
 * @param {object} deps.prisma - The Prisma client instance.
 * @param {object} deps.logger - The logger instance.
 * @param {object} deps.telegramNotifier - The Telegram Notifier instance.
 * @param {object} deps.bot - The Telegraf bot instance.
 * @param {object} deps.googleCalendarTool - The GoogleCalendarTool instance.
 * @param {object} [deps.agentExecutor] - The agent executor instance (optional).
 * @throws {Error} If required dependencies are missing.
 */
function initialize(deps) {
  prisma = deps.prisma;
  logger = deps.logger;
  telegramNotifier = deps.telegramNotifier; // Store telegramNotifier
  bot = deps.bot; // Store bot
  googleCalendarTool = deps.googleCalendarTool; // Store googleCalendarTool

  // Store optional dependencies if provided
  // agentExecutor = deps.agentExecutor;

  // Check required dependencies for the router itself (none specific for now)
  // And check dependencies needed for the handler
  if (!prisma || !logger || !telegramNotifier || !bot || !googleCalendarTool) {
    // Added bot and googleCalendarTool check
    throw new Error(
      "API Router Initialization Error: Missing required dependencies (prisma, logger, telegramNotifier, bot, googleCalendarTool).", // Added bot and GCT to message
    );
  }

  // Initialize the specific handler needed by this router, passing all required deps
  apiHandler.initialize({
    prisma,
    logger,
    telegramNotifier,
    bot,
    googleCalendarTool,
  }); // Pass bot and googleCalendarTool
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

  // Route to get calendar availability
  router.get("/calendar/availability", apiHandler.getAvailability); // New route

  logger.info("API routes configured.");
  return router;
}

// Export the initialize function and the getter for the router.
module.exports = { initialize, getRouter };
