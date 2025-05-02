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
    initUserLookup,
    userLookupMiddleware,
    updateRouter, // Module with initialize and routeUpdate
    errorHandlerMiddleware,
    apiRoutes,
    formRoutes,
  } = deps;

  // --- Validate Core Dependencies ---
  if (
    !logger ||
    !prisma ||
    !bot ||
    !config ||
    !sessionTypes ||
    !stateManager ||
    !createTelegramNotifier ||
    !GoogleCalendarTool ||
    !bookingAgent ||
    !graphNodes ||
    !initializeGraph ||
    !graphEdges ||
    !commandHandler ||
    !callbackHandler ||
    !initUserLookup ||
    !userLookupMiddleware ||
    !updateRouter ||
    !errorHandlerMiddleware ||
    !apiRoutes ||
    !formRoutes
  ) {
    console.error("CRITICAL: Missing core dependencies for initializeApp.");
    throw new Error("Missing core dependencies for initializeApp.");
    // Optionally list missing deps
  }

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

  // --- Mount API & Form Routers ---
  app.use("/api", apiRoutes); // All routes in api.js will be prefixed with /api
  app.use("/", formRoutes); // Routes in forms.js mounted at the root
  logger.info("API and Form routers mounted.");

  // --- Initialization Logic (Moved inside) ---
  try {
    console.log(
      ">>> Initializing stateManager... (No longer needed, assumed initialized)",
    );
    // stateManager should be initialized before being passed in, if necessary.

    console.log("[DEBUG] About to create telegramNotifier...");
    const notifierInstance = createTelegramNotifier({
      bot,
      prisma,
      logger,
      config,
      sessionTypes,
    });
    console.log(">>> telegramNotifier instance created.");

    console.log("[DEBUG] About to create googleCalendar...");
    const googleCalendarInstance = new GoogleCalendarTool({ logger });
    console.log(">>> googleCalendar instance created.");

    console.log("[DEBUG] About to initialize bookingAgent...");
    bookingAgent.initializeAgent({
      logger,
      config,
      prisma,
      bot,
      notifier: notifierInstance,
      googleCalendar: googleCalendarInstance,
    });
    console.log(">>> bookingAgent initialized.");

    console.log("[DEBUG] About to initialize commandHandler...");
    commandHandler.initialize({ logger });
    console.log(">>> commandHandler initialized.");

    console.log("[DEBUG] About to initialize callbackHandler...");
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
    initUserLookup({ logger, prisma });
    console.log(">>> userLookup middleware initialized.");

    console.log(">>> Initializing updateRouter middleware...");
    updateRouter.initialize({
      logger,
      bookingAgent,
      callbackQueryHandler: callbackHandler,
      commandHandler,
      bookingGraph,
    });
    console.log(">>> updateRouter middleware initialized.");

    console.log(
      ">>> Initializing errorHandler middleware... (No longer needed, assumed initialized)",
    );
    // errorHandlerMiddleware should be ready to use when passed in

    console.log("Dependency initialization completed successfully.");
  } catch (initError) {
    console.error(
      "CRITICAL: Failed to initialize application dependencies within initializeApp. Exiting.",
      initError,
    );
    // We might not want to process.exit here, let the caller decide
    throw initError; // Re-throw the error
  }

  // --- Telegraf Middleware Registration ---
  console.log("Registering Telegraf middleware...");
  bot.use(userLookupMiddleware); // Apply user lookup first
  console.log("[app] User Lookup Middleware registered.");
  bot.use(updateRouter.routeUpdate); // Then the main update router
  console.log("[app] Update Router Middleware registered.");

  // Telegraf Global Error Handler
  bot.catch(errorHandlerMiddleware);
  console.log("Telegraf middleware and error handler registered.");

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
  return app; // Return the configured Express app
}

// --- Export the initialization function ---
module.exports = { initializeApp };
