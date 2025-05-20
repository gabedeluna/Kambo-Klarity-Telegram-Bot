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
async function main() {
  try {
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
      // errorHandlerMiddleware from global deps is passed, which app.js uses.
      // notifierInstance is used by this file's errorHandlerInstance below if needed,
      // but app.js uses the createTelegramNotifier factory directly.
    });

    logger.info("Application initialization completed successfully.");

    // Configure Telegraf webhook
    // The webhook path is constructed from a base path and a secret derived from the bot token
    // This is a security measure to prevent unauthorized POST requests to the bot's endpoint.
    // Example: /telegraf/some_secret_path_derived_from_token
    const secretPath = `/telegraf/${bot.secretPathComponent()}`;

    // Set the webhook. Telegraf will make a request to this URL with updates from Telegram.
    // NGROK_URL must be set in the environment for local development.
    if (!config.ngrokUrl) {
      logger.warn(
        "NGROK_URL is not set. Webhook will not be set. Bot will rely on polling (if enabled elsewhere) or will not receive updates via webhook.",
      );
    } else {
      await bot.telegram.setWebhook(`${config.ngrokUrl}${secretPath}`);
      logger.info(`Webhook set to ${config.ngrokUrl}${secretPath}`);
    }

    // Mount the Telegraf webhook handler. Express will pass matching requests to Telegraf.
    initializedApp.use(secretPath, bot.webhookCallback(secretPath));
    logger.info(`Telegraf webhook callback registered at POST ${secretPath}`);

    // Centralized error handling middleware - should be last
    // Make sure this is the Express middleware, not the Telegraf error handler
    initializedApp.use(errorHandlerInstance); // Use the errorHandlerMiddleware directly
    logger.info("Express error handler registered.");

    // Determine port from environment or default to 3000
    const PORT = config.PORT || 3000;

    // 5. Start listening using the *initialized* app
    // Only start listening if the script is run directly
    if (require.main === module) {
      const server = initializedApp.listen(PORT, () => {
        // Use initializedApp here
        logger.info(`[server] Server started successfully.`);
        logger.info(`[server] Listening on port ${PORT}`);
        logger.info(
          `[server] Health check available at http://localhost:${PORT}/health`,
        );
        // Note: The actual webhook URL depends on NGROK_URL + secret path.
        // The secret path component is logged in app.js.
        // For local dev, combine NGROK_URL and that path.
      });

      // Handle potential errors during server startup
      server.on("error", (error) => {
        if (error.syscall !== "listen") {
          throw error;
        }

        // Handle specific listen errors with friendly messages
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
            throw error;
        }
      });
// Graceful shutdown logic
      const signals = ['SIGINT', 'SIGTERM'];

      signals.forEach(signal => {
        process.on(signal, async () => { // Make handler async
          logger.info(`[server] Received ${signal}. Shutting down gracefully...`);

          const forceExitTimeout = setTimeout(() => {
            logger.warn('[server] Graceful shutdown timed out after 10 seconds. Forcing exit.');
            logger.flush(); // Ensure logs are written before forced exit
            process.exit(1); // Force exit
          }, 10000); // 10-second timeout

          try {
            // Close the HTTP server
            await new Promise((resolve, reject) => {
              server.close((err) => {
                if (err) {
                  logger.error({ err }, '[server] Error closing HTTP server.');
                  return reject(err);
                }
                logger.info('[server] HTTP server closed.');
                resolve();
              });
            });

            // Telegraf bot.stop() is mainly for polling bots; for webhook bots, closing the server is key.
            // Prisma client should disconnect automatically due to its own SIGINT/SIGTERM handlers.

            clearTimeout(forceExitTimeout); // Clear the timeout as shutdown was successful
            logger.info('[server] Graceful shutdown complete. Exiting process now.');
            logger.flush(); // Ensure logs are written
            process.exit(0); // Exit successfully

          } catch (error) {
            clearTimeout(forceExitTimeout); // Clear the timeout
            logger.error({ err: error }, '[server] Error during graceful shutdown.');
            logger.flush(); // Ensure logs are written
            process.exit(1); // Exit with error
          }
        });
      });
    }

    // 6. Export the *initialized* Express app instance for testing
    module.exports = initializedApp; // Export initializedApp
  } catch (error) {
    console.error(
      "CRITICAL: Failed to start application in main function.",
      error,
    );
    logger.fatal(
      { err: error },
      "CRITICAL: Failed to start application in main function.",
    );
    process.exit(1);
  }
}

main();
