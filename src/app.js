// Add console.log for entry point
console.log(">>> Loading app.js...");

const express = require("express");
console.log(">>> express loaded.");

const path = require("path"); // Keep path

// --- Express App Setup and Initialization Function ---
function initializeApp(deps) {
  console.log("Starting application initialization...");

  // --- Destructure Dependencies ---
  const {
    logger,
    prisma,
    bot,
    config,
    sessionTypes,
    stateManager,
    createTelegramNotifier,
    GoogleCalendarTool,
    bookingAgent,
    graphNodes,
    initializeGraph,
    graphEdges,
    commandHandler,
    callbackHandler,
    initialize, // Corrected name
    userLookupMiddleware,
    updateRouter, // Module with initialize and routeUpdate
    errorHandlerMiddleware,
    apiRoutes,
    formsRouter, // Correct import
    registrationHandler, // Correct import
  } = deps;

  // --- Validate Core Dependencies --- (Improved Logging)
  const requiredDeps = {
    logger,
    prisma,
    bot,
    config,
    sessionTypes,
    stateManager,
    createTelegramNotifier,
    GoogleCalendarTool,
    bookingAgent,
    graphNodes,
    initializeGraph,
    graphEdges,
    commandHandler,
    callbackHandler,
    initialize, // Corrected name
    userLookupMiddleware,
    updateRouter,
    errorHandlerMiddleware,
    apiRoutes,
    formsRouter,
    registrationHandler,
  };

  const missing = Object.entries(requiredDeps)
    .filter(([, value]) => !value) // Find entries where the value is falsy
    .map(([key]) => key); // Get the keys (names) of missing dependencies

  if (missing.length > 0) {
    const missingList = missing.join(", ");
    console.error(
      `CRITICAL: Missing core dependencies for initializeApp: [${missingList}]`,
    );
    // Log the keys of the received deps object for easier comparison
    console.error("Received dependency keys:", Object.keys(deps));
    throw new Error(
      `Missing core dependencies for initializeApp: ${missingList}`,
    );
  }
  // --- End Improved Validation ---

  // --- Initialize Core Components ---
  const notifierInstance = createTelegramNotifier({
    bot,
    config,
    prisma,
    logger,
    sessionTypes,
    stateManager, // Pass stateManager here
  });
  logger.info("Telegram Notifier initialized.");

  // Initialize registrationHandler with its specific dependencies
  registrationHandler.initialize({
    prisma,
    logger,
    telegramNotifier: notifierInstance,
  });
  logger.info("Registration Handler initialized.");

  // Initialize Book Command Handler
  const { initializeBookCommandHandler } = require('./commands/client/book');
  initializeBookCommandHandler({ notifier: notifierInstance, logger });
  logger.info("[Book Command Handler] Initialized.");

  // --- Create Express App ---
  const app = express();
  console.log(">>> Express app created.");
  app.use(express.json()); // Middleware to parse JSON bodies
  console.log(">>> express.json middleware added.");

  // Health check
  app.get("/health", (req, res) => {
    res.set("Content-Type", "text/plain");
    res.status(200).send("OK");
  });
  console.log(">>> /health route added.");

  // Serve static files (HTML, CSS, JS for forms/admin)
  // Must come *before* API/Form routes if they share base paths
  const publicPath = path.join(__dirname, "..", "public");
  app.use(express.static(publicPath));
  logger.info(`Serving static files from: ${publicPath}`);

  // --- Initialize Routers before Mounting ---
  // Dependencies needed for apiRoutes.initialize: prisma, logger, notifierInstance, bot
  apiRoutes.initialize({
    prisma,
    logger,
    telegramNotifier: notifierInstance,
    bot,
  });
  logger.info("API router initialized.");

  // Dependencies needed for formsRouter.initialize: logger, registrationHandler
  formsRouter.initialize({ logger, registrationHandler });
  logger.info("Forms router initialized.");

  // --- Mount API & Form Routers ---
  app.use("/api", apiRoutes.getRouter()); // Call getRouter() to get the actual router
  app.use("/", formsRouter.router); // Access the exported router directly
  logger.info("API and Form routers mounted.");

  // --- Initialization Logic (Moved inside) ---
  try {
    console.log(
      ">>> Initializing stateManager... (No longer needed, assumed initialized)",
    );
    // stateManager should be initialized before being passed in, if necessary.

    const googleCalendarInstance = new GoogleCalendarTool({ logger });
    console.log(">>> googleCalendar instance created.");

    bookingAgent.initializeAgent({
      logger,
      config,
      prisma,
      bot,
      notifier: notifierInstance,
      googleCalendar: googleCalendarInstance,
      tools: [googleCalendarInstance], // Add the tools array - Assuming only Google Calendar for now
    });
    console.log(">>> bookingAgent initialized.");

    commandHandler.initialize({ logger });
    console.log(">>> commandHandler initialized.");

    callbackHandler.initialize({
      logger,
      stateManager, // Use injected stateManager
      bookingAgent,
      telegramNotifier: notifierInstance,
    });
    console.log(">>> callbackHandler initialized.");

    console.log(">>> Initializing graphNodes...");
    graphNodes.initializeNodes({
      logger,
      stateManager, // Use injected stateManager
      bookingAgent,
      googleCalendar: googleCalendarInstance,
      telegramNotifier: notifierInstance,
    });
    console.log(">>> graphNodes initialized.");

    console.log(">>> Compiling bookingGraph...");
    const bookingGraph = initializeGraph(graphNodes, graphEdges);
    console.log(">>> bookingGraph compiled.");

    console.log(">>> Initializing userLookup middleware...");
    initialize({ logger, prisma });
    console.log(">>> userLookup middleware initialized.");

    console.log(">>> Initializing updateRouter middleware...");
    const routeUpdate = updateRouter.initialize({
      logger,
      bookingAgent,
      callbackQueryHandler: callbackHandler, // Corrected name
      commandHandler,
      bookingGraph,
      config, // <<< ADD THIS LINE
    });
    console.log(">>> updateRouter middleware initialized.");

    console.log(
      ">>> Initializing errorHandler middleware... (No longer needed, assumed initialized)",
    );
    // errorHandlerMiddleware should be ready to use when passed in

    console.log("Dependency initialization completed successfully.");

    // --- Telegraf Middleware Registration (Moved INSIDE try block) ---
    console.log("Registering Telegraf middleware...");
    console.log(
      ">>> Registering userLookupMiddleware: Type =",
      typeof userLookupMiddleware,
    );
    bot.use(userLookupMiddleware); // Apply user lookup first
    console.log("[app] User Lookup Middleware registered.");

    console.log(">>> Registering routeUpdate: Type =", typeof routeUpdate); // Log correct variable
    bot.use(routeUpdate); // Use the correct variable 'routeUpdate'
    console.log("[app] Update Router Middleware registered.");

    // Telegraf Global Error Handler
    console.log(">>> Registering bot.catch handler");
    bot.catch(errorHandlerMiddleware);
    console.log("Telegraf middleware and error handler registered.");
    // --- End of Moved Block ---
  } catch (initError) {
    console.error(
      "CRITICAL: Failed to initialize application dependencies within initializeApp. Exiting.",
      initError,
    );
    // We might not want to process.exit here, let the caller decide
    throw initError; // Re-throw the error
  }

  // --- Webhook Setup ---
  const secretPath = `/telegraf/${bot.secretPathComponent()}`;
  console.log(`Bot webhook configured at path: ${secretPath}`);

  // Set the webhook (only if URLs provided)
  const webhookUrl =
    config.nodeEnv === "development" && config.ngrokUrl
      ? `${config.ngrokUrl}${secretPath}`
      : config.nodeEnv === "production" && config.appUrl
        ? `${config.appUrl}${secretPath}`
        : null;

  if (webhookUrl) {
    bot.telegram
      .setWebhook(webhookUrl)
      .then(() =>
        console.log(`[server] Webhook set successfully to: ${webhookUrl}`),
      )
      .catch((err) => console.error("[server] Error setting webhook", err));
  } else if (config.nodeEnv !== "test") {
    // Don't launch polling in tests
    // No webhook URL defined, launch in polling mode
    console.log(
      "[server] Webhook URL not found or invalid environment. Starting bot in polling mode...",
    );
    bot
      .launch()
      .then(() => {
        console.log("[server] Bot started in polling mode.");
      })
      .catch((err) => {
        console.error("[server] Error launching bot in polling mode:", err);
      });
  }

  // Add webhook callback route *after* setting the webhook
  // This route is where Telegram sends updates
  app.post(secretPath, (req, res) => {
    // Use bot.handleUpdate, which processes the update and triggers middleware
    bot.handleUpdate(req.body, res);
  });
  console.log(`Webhook callback handler registered at POST ${secretPath}`);

  // --- Express Global Error Handler (Last Middleware) ---
  // This catches errors *outside* Telegraf's processing (e.g., in Express routes)
  app.use(errorHandlerMiddleware);
  console.log("Express global error handler registered.");

  console.log("initializeApp function finished.");

  // --- Return the initialized app and potentially other core components ---
  return { app }; // Make sure to return the app instance!
}

// --- Export the initialization function ---
module.exports = { initializeApp };
