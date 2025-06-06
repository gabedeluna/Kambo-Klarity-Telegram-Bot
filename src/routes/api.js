/**
 * @fileoverview Defines API routes for the Kambo Klarity application.
 * Handles endpoints primarily used for AJAX requests from the web interface
 * or external services (like waiver completion webhooks).
 */

const express = require("express");
const apiHandler = require("../handlers/apiHandler"); // Main API handler
const sessionTypesApiHandler = require("../handlers/api/sessionTypesApiHandler"); // Handler for session type specific APIs
const bookingFlowApiHandler = require("../handlers/api/bookingFlowApiHandler"); // Handler for booking flow APIs
const placeholderApiHandler = require("../handlers/api/placeholderApiHandler"); // Handler for placeholder booking APIs
const config = require("../core/env"); // Configuration for frontend config endpoint

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

  // Initialize the sessionTypesApiHandler, passing only the logger
  sessionTypesApiHandler.initialize({ logger });

  // Initialize the bookingFlowApiHandler, passing only the logger
  bookingFlowApiHandler.initialize({ logger });

  // Initialize the placeholderApiHandler, passing required dependencies
  placeholderApiHandler.initialize({ prisma, logger, googleCalendarTool });
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

  // Route to get session type details by ID
  router.get("/session-types/:id", sessionTypesApiHandler.getSessionTypeById);

  // Route to get all session types (for calendar component)
  router.get("/sessions", apiHandler.getSessionTypes);

  // Route to get frontend configuration (BOT_USERNAME, WEBAPP_NAME)
  router.get("/config", (req, res) => {
    try {
      const frontendConfig = {
        botUsername: config.botUsername,
        webAppName: config.webAppName,
      };

      res.json({
        success: true,
        data: frontendConfig,
      });
    } catch (error) {
      logger.error({ error }, "Failed to get frontend configuration");
      res.status(500).json({
        success: false,
        message: "Failed to get configuration",
      });
    }
  });

  // Feature 4: Placeholder booking routes
  router.post(
    "/gcal-placeholder-bookings",
    placeholderApiHandler.createGCalPlaceholder,
  );
  router.delete(
    "/gcal-placeholder-bookings/:placeholderId",
    placeholderApiHandler.deleteGCalPlaceholder,
  );

  // Booking Flow API Routes
  router.post(
    "/booking-flow/start-primary",
    bookingFlowApiHandler.handleStartPrimaryFlow,
  );
  router.get(
    "/booking-flow/start-invite/:inviteToken",
    bookingFlowApiHandler.handleStartInviteFlow,
  );
  router.post(
    "/booking-flow/continue",
    bookingFlowApiHandler.handleContinueFlow,
  );

  // Invite Context API Route (for StartApp integration)
  router.get("/invite-context/:inviteToken", async (req, res, next) => {
    logger.info(
      { inviteToken: req.params.inviteToken },
      "GET invite context by token",
    );

    try {
      const { inviteToken } = req.params;

      if (!inviteToken) {
        return res.status(400).json({
          success: false,
          message: "Missing required parameter: inviteToken",
        });
      }

      // Find the invite and related session
      const sessionInvite = await prisma.sessionInvite.findFirst({
        where: {
          token: inviteToken,
          status: "pending", // Only allow pending invites
        },
        include: {
          sessions: {
            include: {
              SessionType: true,
            },
          },
        },
      });

      if (!sessionInvite) {
        return res.status(404).json({
          success: false,
          message: "Invite token not found or no longer valid",
        });
      }

      const session = sessionInvite.sessions;

      // Format session details
      const sessionDetails = {
        sessionTypeLabel: session.SessionType?.label || "Kambo Session",
        formattedDateTime: new Date(
          session.appointment_datetime,
        ).toLocaleString("en-US", {
          timeZone: "America/Chicago",
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      };

      // Flow configuration for friend waiver
      const flowConfiguration = {
        formType:
          session.SessionType?.waiverType === "NONE"
            ? "KAMBO_WAIVER_FRIEND_V1"
            : session.SessionType?.waiverType + "_FRIEND",
        allowsGroupInvites: session.SessionType?.allowsGroupInvites || false,
        maxGroupSize: session.SessionType?.maxGroupSize || 1,
      };

      res.json({
        success: true,
        data: {
          inviteToken: inviteToken,
          sessionTypeId: session.session_type_id,
          appointmentDateTimeISO: session.appointment_datetime.toISOString(),
          sessionDetails: sessionDetails,
          flowConfiguration: flowConfiguration,
        },
      });
    } catch (error) {
      logger.error(
        { error, inviteToken: req.params.inviteToken },
        "Failed to get invite context by token",
      );
      next(error);
    }
  });

  logger.info("API routes configured.");
  return router;
}

// Export the initialize function and the getter for the router.
module.exports = { initialize, getRouter };
