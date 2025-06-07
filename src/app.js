const express = require("express");

const path = require("path"); // Keep path
// const allToolSchemas = require("./tools/toolSchemas"); // Removed as per user request
// --- Express App Setup and Initialization Function ---
async function initializeApp(deps) {
  // Made initializeApp async
  // Update dependency check to expect GoogleCalendarTool (class) and prisma
  const allDepsPresent =
    deps &&
    deps.logger &&
    deps.config &&
    deps.stateManager &&
    deps.GoogleCalendarTool && // Expect the class
    deps.prisma && // Expect prisma for other modules
    deps.apiRoutes && // Expect apiRoutes module
    deps.sessionsRouter; // Expect sessionsRouter module

  if (!allDepsPresent) {
    const missingDetails = {
      depsExists: !!deps,
      loggerExists: !!(deps && deps.logger),
      configExists: !!(deps && deps.config),
      stateManagerExists: !!(deps && deps.stateManager),
      GoogleCalendarToolExists: !!(deps && deps.GoogleCalendarTool),
      prismaExists: !!(deps && deps.prisma),
      apiRoutesExists: !!(deps && deps.apiRoutes),
      sessionsRouterExists: !!(deps && deps.sessionsRouter),
    };
    console.error(
      "initializeApp failed: Missing essential dependencies. Details:",
      missingDetails,
    );
    throw new Error(
      "Missing essential dependencies for initializeApp. Check console for details.",
    );
  }

  const {
    logger,
    config,
    bot,
    sessionTypes,
    stateManager,
    createTelegramNotifier,
    GoogleCalendarTool, // Destructure the class
    commandHandler,
    callbackHandler,
    userLookupMiddleware,
    updateRouter,
    errorHandlerMiddleware, // Assuming this is the module/middleware function
    prisma, // prisma is not directly used here, but by stateManager etc.
    apiRoutes, // Add apiRoutes here
    sessionsRouter, // Add sessionsRouter here
  } = deps;

  logger.info("Starting application initialization...");

  // --- Destructure Dependencies ---
  const {
    // bot,
    // sessionTypes,
    // createTelegramNotifier,
    // commandHandler,
    // callbackHandler,
    // initialize, // Corrected name
    // userLookupMiddleware,
    // updateRouter,
    // errorHandlerMiddleware,
    // apiRoutes, // REMOVE: apiRoutes is already destructured in the block above
    // sessionsRouter, // REMOVE: sessionsRouter is already destructured in the block above
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
    commandHandler,
    callbackHandler,
    userLookupMiddleware,
    updateRouter,
    errorHandlerMiddleware,
    apiRoutes, // Add apiRoutes to requiredDeps
    sessionsRouter, // Add sessionsRouter to requiredDeps
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
  const { initializeBookCommandHandler } = require("./commands/client/book");
  initializeBookCommandHandler({ notifier: notifierInstance, logger });
  logger.info("[Book Command Handler] Initialized.");

  // Initialize Start Command Handler
  const { initializeStartCommandHandler } = require("./commands/client/start");
  initializeStartCommandHandler({ notifier: notifierInstance, logger });
  logger.info("[Start Command Handler] Initialized.");

  // Initialize Inline Query Handler
  const {
    initializeInlineQueryHandler,
  } = require("./handlers/inlineQueryHandler");
  initializeInlineQueryHandler({ logger, prisma });
  logger.info("[Inline Query Handler] Initialized.");

  // --- Create Express App ---
  const app = express();
  logger.debug("Express app instance created");
  app.use(express.json()); // Middleware to parse JSON bodies
  logger.debug("Express JSON middleware configured");

  // Declare instances here to make them available in the return scope
  // let bookingGraphInstance; // Agent related - Removed
  let routeUpdate; // for updateRouter, also initialized in try and used for bot commands

  // Health check
  app.get("/health", (req, res) => {
    res.set("Content-Type", "text/plain");
    res.status(200).send("OK");
  });
  logger.debug("Health check endpoint registered");

  // Serve static files (HTML, CSS, JS for forms/admin)
  // Must come *before* API/Form routes if they share base paths
  const publicPath = path.join(__dirname, "..", "public");
  app.use(express.static(publicPath));
  logger.info(`Serving static files from: ${publicPath}`);

  // Serve node_modules in development mode for stagewise toolbar
  if (config.nodeEnv === "development") {
    const nodeModulesPath = path.join(__dirname, "..", "node_modules");
    app.use("/node_modules", express.static(nodeModulesPath));
    logger.info(
      `Serving node_modules from: ${nodeModulesPath} (development mode)`,
    );
  }

  // --- Initialize Routers before Mounting ---
  // Dependencies needed for formsRouter.initialize: logger, registrationHandler
  formsRouter.initialize({ logger, registrationHandler });
  logger.info("Forms router initialized.");

  // Dependencies needed for sessionsRouter.initialize: logger, prisma
  sessionsRouter.initialize({ logger, prisma });
  logger.info("Sessions router initialized.");

  // --- Mount Form Router ---
  // API router will be initialized and mounted after googleCalendarInstance is created
  app.use("/", formsRouter.router); // Access the exported router directly
  logger.info("Form router mounted.");

  // Create GoogleCalendarTool instance here
  const googleCalendarInstance = new GoogleCalendarTool({
    logger,
    config,
    prisma,
  });
  logger.info(
    "[GoogleCalendarTool] Instance created successfully inside initializeApp.",
  );

  // --- Initialize and Mount API Router ---
  // Dependencies needed for apiRoutes.initialize: prisma, logger, notifierInstance, bot, googleCalendarTool
  apiRoutes.initialize({
    prisma,
    logger,
    telegramNotifier: notifierInstance,
    bot,
    googleCalendarTool: googleCalendarInstance, // Pass the instance here
  });
  logger.info("API router initialized with GoogleCalendarTool.");

  app.use("/api", apiRoutes.getRouter()); // Call getRouter() to get the actual router
  logger.info("API router mounted.");

  // --- Mount Sessions Router ---
  app.use("/api/sessions", sessionsRouter.router); // Mount sessions router under /api/sessions
  logger.info("Sessions router mounted under /api/sessions.");

  // --- Initialization Logic (Moved inside) ---
  try {
    logger.debug("StateManager initialization assumed complete");
    // stateManager should be initialized before being passed in, if necessary.

    // Agent-related tool wrapping and initialization removed.
    // If any of these tools' functionalities (e.g., finding free slots, creating calendar events)
    // are needed outside the agent context, they will need to be invoked directly
    // using googleCalendarInstance, stateManager, or notifierInstance.

    commandHandler.initialize({ logger }); // Initialize the module
    logger.info("[commandHandler] Initialized.");

    callbackHandler.initialize({
      logger,
      stateManager, // Use injected stateManager
      // bookingAgent: bookingAgent, // Removed agent dependency
      telegramNotifier: notifierInstance,
    }); // Initialize the module
    logger.info("callbackQueryHandler initialized successfully.");

    // graphNodes.initializeNodes removed
    // bookingGraphInstance = initializeGraph removed

    // Initialize Telegraf middleware and handlers
    // User Lookup Middleware (scoped per user)
    logger.info("Initializing userLookup middleware...");
    // Ensure userLookupMiddleware.initialize is called if it's a factory for the middleware function
    // Assuming userLookupMiddleware itself IS the middleware if no initialize is part of its signature for direct app.use
    // However, there's also an 'initialize' function from '../src/middleware/userLookup'
    // Let's assume the 'initialize' from deps is for setting up its internal state if needed.
    if (deps.initialize) {
      deps.initialize({ logger, prisma }); // Call the initialize from userLookup module
      logger.info("userLookup module initialized (if applicable).");
    }
    // app.use(userLookupMiddleware); // If it were global Express middleware
    // logger.info('userLookupMiddleware (Express global) registered.');

    logger.info("Initializing updateRouter middleware...");
    routeUpdate = updateRouter.initialize({
      logger,
      // bookingAgent: bookingAgent, // Removed agent dependency
      callbackQueryHandler: callbackHandler, // Pass the module directly
      commandHandler: commandHandler, // Pass the module directly
      // bookingGraph: bookingGraphInstance, // Removed graph dependency
      stateManager, // Pass stateManager
      telegramNotifier: notifierInstance, // Pass notifier
      config, // Add config here
    });
    logger.info(
      "Update router initialized. Returning configured routeUpdate function.",
    );

    // Setup Telegraf bot commands and middleware
    // Note: userLookupMiddleware (if Telegraf middleware) would be used with bot.use()
    // For now, assuming it's implicitly handled or not Telegraf global middleware
    if (userLookupMiddleware && typeof userLookupMiddleware === "function") {
      bot.use(userLookupMiddleware); // Register as Telegraf middleware
      logger.info("userLookupMiddleware (Telegraf) registered.");
    }

    bot.use(routeUpdate); // Use the correct variable 'routeUpdate'
    logger.info("[app] Update Router Middleware registered.");

    // Telegraf Global Error Handler
    logger.debug("Registering Telegraf error handler");
    bot.catch(errorHandlerMiddleware);
    logger.info("Telegraf middleware and error handling configured");
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
  logger.info(
    `[app] Webhook callback route will be available at: ${secretPath}`,
  );
  logger.info(
    "[app] Automatic webhook setting and polling on startup have been REMOVED.",
  );
  logger.info(
    "[app] Bot will ONLY operate via webhook. Ensure webhook is set using `npm run webhook:set <YOUR_URL>`.",
  );

  /*
  // --- START OF COMMENTED OUT SECTION ---
  // Determine if a webhook URL *would* be configured based on environment
  const potentialWebhookUrl =
    config.nodeEnv === "development" && config.ngrokUrl
      ? `${config.ngrokUrl}${secretPath}`
      : config.nodeEnv === "production" && config.appUrl
        ? `${config.appUrl}${secretPath}`
        : null;

  // REMOVED: The block that called bot.telegram.setWebhook(potentialWebhookUrl)
  // REMOVED: The else if block that called bot.launch() for polling

  if (potentialWebhookUrl && config.nodeEnv !== "test") {
      logger.info(`[app] Webhook mode intended. Ensure webhook is set via manual script to: ${potentialWebhookUrl}`);
  } else if (!potentialWebhookUrl && config.nodeEnv !== "test") {
      logger.info('[app] Polling mode would have started here, but it has been disabled.');
  }
  // --- END OF COMMENTED OUT SECTION ---
  */

  // The webhook callback route MUST REMAIN to receive updates from Telegram
  app.post(secretPath, (req, res) => {
    // Use bot.handleUpdate, which processes the update and triggers middleware
    bot.handleUpdate(req.body, res);
  });
  logger.info(`Webhook callback handler registered at POST ${secretPath}`);

  // --- Express Global Error Handler (Last Middleware) ---
  // This catches errors *outside* Telegraf's processing (e.g., in Express routes)
  app.use(errorHandlerMiddleware);
  logger.debug("Express global error handler registered");

  logger.info("Application initialization completed successfully");

  // --- Return the initialized app and potentially other core components ---
  return {
    app,
    bot,
    // bookingAgent, // Removed
    commandHandler, // Return the module
    callbackHandler, // Return the module
    // bookingGraph: bookingGraphInstance, // Removed
    updateRouter: routeUpdate, // Return the initialized updateRouter instance
  }; // Make sure to return the app instance!
}

// --- Export the initialization function ---
module.exports = { initializeApp };
