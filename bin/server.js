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
const bookingAgent = require("../src/agents/bookingAgent"); // Module with initialize
const graphNodes = require("../src/graph/nodes"); // Module with initialize
const graphEdges = require("../src/graph/edges"); // Simple object/module
const { initializeGraph } = require("../src/graph/bookingGraph.js"); // Function
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
  GoogleCalendarTool, // Pass the class
  bookingAgent, // Pass the module
  graphNodes, // Pass the module
  initializeGraph, // Pass the function
  graphEdges, // Pass the definitions
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
const { app: initializedApp } = initializeApp(deps); // Destructure the returned app

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
}

// 6. Export the *initialized* Express app instance for testing
module.exports = initializedApp; // Export initializedApp
