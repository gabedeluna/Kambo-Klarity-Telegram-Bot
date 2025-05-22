// Main server startup script

// 1. Require the initializer function and core singletons
const { initializeApp } = require("../src/app");
const config = require("../src/core/env");
const logger = require("../src/core/logger");
const prisma = require("../src/core/prisma");
const bot = require("../src/core/bot");
const sessionTypes = require("../src/core/sessionTypes");

// 2. Require tools, agents, graph components, handlers, middleware, routes
const stateManager = require("../src/tools/stateManager");
const { createTelegramNotifier } = require("../src/tools/telegramNotifier"); // Factory
const GoogleCalendarTool = require("../src/tools/googleCalendar.js"); // Class
const commandHandler = require("../src/handlers/commandHandler"); // Module with initialize
const callbackHandler = require("../src/handlers/callbackQueryHandler"); // Simple function/module
const {
  initialize,
  userLookupMiddleware,
} = require("../src/middleware/userLookup"); // Functions
const updateRouter = require("../src/middleware/updateRouter"); // Module with initialize and routeUpdate
const errorHandlerMiddleware = require("../src/middleware/errorHandler"); // Function
const apiRoutes = require("../src/routes/api"); // Express Router
const formsRouter = require("../src/routes/forms"); // Express Router
const registrationHandler = require("../src/handlers/registrationHandler"); // Module with initialize

// 3. Prepare dependencies object
// Note: Some dependencies might need prior initialization if they aren't singletons
// or if they depend on each other *before* being passed to initializeApp.
// Based on app.js, notifier and calendar are created *inside* initializeApp,
// others are initialized *inside*. Let's pass factories/modules where needed.

const deps = {
  logger,
  prisma,
  bot,
  config,
  sessionTypes,
  stateManager,
  createTelegramNotifier, // Pass the factory
  GoogleCalendarTool, // Pass the CLASS itself
  commandHandler, // Pass the module
  callbackHandler, // Pass the handler
  initialize, // Pass the initializer function
  userLookupMiddleware, // Pass the middleware function
  updateRouter, // Pass the module
  errorHandlerMiddleware, // Pass the middleware function
  apiRoutes, // Pass the router
  formsRouter, // Pass the router
  registrationHandler, // Pass the module
};

// 4. Call the initializer function to get the configured Express app
// This is where the internal initialization of notifier, calendar, agent etc. happens
// Renamed main to represent its core function of app initialization
async function initializeAndReturnApp() {
  // This function now solely focuses on creating and configuring the Express app
  logger.info("Initializing application components...");

  // Call setLogger for stateManager if it's intended to use the main logger instance
  stateManager.setLogger(logger); // Ensure stateManager uses the main logger

  // stateManager module doesn't have an initialize method based on its structure.
  // It's a collection of functions using a shared prisma client.
  // So, stateManagerInstance will be the module itself.
  const stateManagerInstance = stateManager;

  // Create notifier instance but we don't need to use it directly as app.js creates its own
  // Keep this for potential future use or debugging
  createTelegramNotifier({
    bot,
    prisma,
    logger,
    config,
    sessionTypes,
    stateManager: stateManagerInstance, // Pass the initialized stateManager
  });
  // errorHandlerMiddleware is the middleware function itself, no initialize needed.
  const errorHandlerInstance = errorHandlerMiddleware;

  // Initialize app and its dependent components
  const { app: initializedApp } = await initializeApp({
    ...deps, // Spread the global deps object
    stateManager: stateManagerInstance, // Pass the stateManager module (as instance)
  });

  logger.info("Application initialization completed successfully.");

  // Configure Telegraf webhook
  const secretPath = `/telegraf/${bot.secretPathComponent()}`;
  if (!config.ngrokUrl) {
    logger.warn("NGROK_URL is not set. Webhook will not be set for Telegraf.");
  } else {
    try {
      await bot.telegram.setWebhook(`${config.ngrokUrl}${secretPath}`);
      logger.info(`Webhook set to ${config.ngrokUrl}${secretPath}`);
    } catch (webhookError) {
      logger.error({ err: webhookError }, "Failed to set Telegraf webhook.");
      // Continue without webhook if setting fails, but log it.
    }
  }
  // Mount the Telegraf webhook handler. Express will pass matching requests to Telegraf.
  initializedApp.use(secretPath, bot.webhookCallback(secretPath));
  logger.info(`Telegraf webhook callback registered at POST ${secretPath}`);

  // Centralized error handling middleware - should be last
  initializedApp.use(errorHandlerInstance); // Use the errorHandlerMiddleware directly
  logger.info("Express error handler registered.");

  return initializedApp; // Return the configured Express app
}

// This function handles starting the server if the script is run directly
async function startServer(appToStart) {
  const PORT = config.PORT || 3000;
  const server = appToStart.listen(PORT, () => {
    logger.info(`[server] Server started successfully.`);
    logger.info(`[server] Listening on port ${PORT}`);
    logger.info(
      `[server] Health check available at http://localhost:${PORT}/health`,
    );
  });

  server.on("error", (error) => {
    if (error.syscall !== "listen") {
      // Not a listen error, rethrow
      logger.error({ err: error }, "[server] Unexpected server error");
      throw error;
    }
    // Handle specific listen errors
    switch (error.code) {
      case "EACCES":
        logger.error(`[server] Port ${PORT} requires elevated privileges.`);
        process.exit(1);
        break;
      case "EADDRINUSE":
        logger.error(`[server] Port ${PORT} is already in use.`);
        process.exit(1);
        break;
      default:
        logger.error(
          { err: error, code: error.code },
          "[server] Failed to start listening",
        );
        throw error;
    }
  });

  const signals = ["SIGINT", "SIGTERM"];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info(`[server] Received ${signal}. Shutting down gracefully...`);
      const forceExitTimeout = setTimeout(() => {
        logger.warn(
          "[server] Graceful shutdown timed out after 10 seconds. Forcing exit.",
        );
        logger.flush(); // Ensure logs are written before forced exit
        process.exit(1); // Force exit
      }, 10000); // 10-second timeout

      try {
        // Close the HTTP server
        await new Promise((resolve, reject) => {
          server.close((err) => {
            if (err) {
              logger.error({ err }, "[server] Error closing HTTP server.");
              return reject(err);
            }
            logger.info("[server] HTTP server closed.");
            resolve();
          });
        });
        clearTimeout(forceExitTimeout);
        logger.info(
          "[server] Graceful shutdown complete. Exiting process now.",
        );
        logger.flush();
        process.exit(0);
      } catch (shutdownError) {
        clearTimeout(forceExitTimeout);
        logger.error(
          { err: shutdownError },
          "[server] Error during graceful shutdown.",
        );
        logger.flush();
        process.exit(1);
      }
    });
  });
  return server; // Return the http.Server instance, though not strictly needed by direct run
}

// Main execution logic:
// Determines if the script is run directly or required as a module.
if (require.main === module && process.env.NODE_ENV !== "test") {
  // If run directly AND NOT IN TEST MODE, initialize the app and then start the server
  initializeAndReturnApp()
    .then((appInitialized) => startServer(appInitialized))
    .catch((error) => {
      // Use console.error as logger might not be initialized if error is very early
      const effectiveLogger = global.logger || console; // Check if global logger is set
      effectiveLogger.error(
        "CRITICAL: Failed to start application.",
        error.stack || error,
      );
      if (global.logger && global.logger.fatal) {
        // Check if full logger is available
        global.logger.fatal(
          { err: error, stack: error.stack },
          "CRITICAL: Application startup failed.",
        );
      }
      process.exit(1);
    });
} else {
  // If required as a module (e.g., for testing, or if run directly in test mode but not as main),
  // export a promise that resolves to the initialized Express app instance.
  // This ensures that startServer() with its process listeners is not called during tests.
  module.exports = initializeAndReturnApp();
}
