// Add console.log for entry point
console.log(">>> Loading app.js...");

const express = require("express");
console.log(">>> express loaded.");

const path = require("path"); // Keep path
const { DynamicStructuredTool } = require("langchain/tools"); // Changed to DynamicStructuredTool
// Removed toolSchemas import as it's no longer used

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
    deps.prisma; // Expect prisma for other modules

  if (!allDepsPresent) {
    const missingDetails = {
      depsExists: !!deps,
      loggerExists: !!(deps && deps.logger),
      configExists: !!(deps && deps.config),
      stateManagerExists: !!(deps && deps.stateManager),
      GoogleCalendarToolExists: !!(deps && deps.GoogleCalendarTool),
      prismaExists: !!(deps && deps.prisma),
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
    bookingAgent,
    graphNodes,
    initializeGraph,
    graphEdges, // Add graphEdges here
    commandHandler,
    callbackHandler,
    userLookupMiddleware,
    updateRouter,
    errorHandlerMiddleware, // Assuming this is the module/middleware function
    prisma, // prisma is not directly used here, but by stateManager etc.
  } = deps;

  logger.info("Starting application initialization...");

  // --- Destructure Dependencies ---
  const {
    // bot,
    // sessionTypes,
    // createTelegramNotifier,
    // bookingAgent,
    // graphNodes,
    // initializeGraph,
    // graphEdges,
    // commandHandler,
    // callbackHandler,
    // initialize, // Corrected name
    // userLookupMiddleware,
    // updateRouter,
    // errorHandlerMiddleware,
    // apiRoutes,
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
    commandHandler,
    callbackHandler,
    userLookupMiddleware,
    updateRouter,
    errorHandlerMiddleware,
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

  // --- Create Express App ---
  const app = express();
  console.log(">>> Express app created.");
  app.use(express.json()); // Middleware to parse JSON bodies
  console.log(">>> express.json middleware added.");

  // Declare instances here to make them available in the return scope
  let bookingGraphInstance; // Renamed from bookingGraph for clarity if needed, or keep as bookingGraph
  let routeUpdate; // for updateRouter, also initialized in try and used for bot commands

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
  // apiRoutes.initialize({
  //   prisma,
  //   logger,
  //   telegramNotifier: notifierInstance,
  //   bot,
  // });
  // logger.info("API router initialized.");

  // Dependencies needed for formsRouter.initialize: logger, registrationHandler
  formsRouter.initialize({ logger, registrationHandler });
  logger.info("Forms router initialized.");

  // --- Mount API & Form Routers ---
  // app.use("/api", apiRoutes.getRouter()); // Call getRouter() to get the actual router
  app.use("/", formsRouter.router); // Access the exported router directly
  logger.info("API and Form routers mounted.");

  // Create GoogleCalendarTool instance here
  const googleCalendarInstance = new GoogleCalendarTool({ logger, config });
  logger.info(
    "[GoogleCalendarTool] Instance created successfully inside initializeApp.",
  );

  // --- Initialization Logic (Moved inside) ---
  try {
    console.log(
      ">>> Initializing stateManager... (No longer needed, assumed initialized)",
    );
    // stateManager should be initialized before being passed in, if necessary.

    // Wrap GoogleCalendarTool methods as LangChain StructuredTools
    const findFreeSlotsTool = new DynamicStructuredTool({
      schema: allToolSchemas.findFreeSlotsSchema,
      name: "findFreeSlots",
      description:
        "Searches the practitioner's calendar for available time slots for a kambo session. Input can include desired date range and session duration. Returns a list of available slots or an empty list if none are found.",
      func: async (input) => googleCalendarInstance.findFreeSlots(input),
    });

    const createCalendarEventTool = new DynamicStructuredTool({
      schema: allToolSchemas.createCalendarEventSchema,
      name: "createCalendarEvent",
      description:
        "Creates a new event on the practitioner's calendar. Requires start time, end time, summary, and optionally a description and attendee email. Returns the event ID upon successful creation.",
      func: async (input) => googleCalendarInstance.createCalendarEvent(input),
    });

    // Add deleteCalendarEventTool
    // For now, assuming a schema like { eventId: string } exists or will be added.
    // If allToolSchemas.deleteCalendarEventSchema does not exist, this will cause an error later.
    // const deleteCalendarEventTool = new DynamicStructuredTool({
    //   schema: allToolSchemas.deleteCalendarEventSchema, // Placeholder
    //   name: "deleteCalendarEvent",
    //   description: "Deletes a calendar event using its event ID.",
    //   func: async (input) => googleCalendarInstance.deleteCalendarEvent(input.eventId),
    // });

    // Wrap StateManager methods as LangChain StructuredTools
    const resetUserStateTool = new DynamicStructuredTool({
      schema: allToolSchemas.resetUserStateSchema,
      name: "resetUserState",
      description:
        "Resets the user's state in the conversation, clearing any temporary booking information or active session details. Useful if the user wants to start over or cancels mid-process.",
      func: async (input) => stateManager.resetUserState(input.telegramId),
    });

    const updateUserStateTool = new DynamicStructuredTool({
      schema: allToolSchemas.updateUserStateSchema,
      name: "updateUserState",
      description:
        "Updates specific fields in the user's state. Can be used to store temporary information like a selected booking slot or to modify conversation history.",
      func: async (input) =>
        stateManager.updateUserState(input.telegramId, input.updates),
    });

    const storeBookingDataTool = new DynamicStructuredTool({
      schema: allToolSchemas.storeBookingDataSchema,
      name: "storeBookingData",
      description:
        "Stores the confirmed booking details (Telegram ID, booking slot, session type) into the database. This is typically called after the user confirms their chosen time slot.",
      func: async (input) => stateManager.storeBookingData(input),
    });

    // Wrap TelegramNotifier methods as LangChain StructuredTools
    const sendWaiverLinkTool = new DynamicStructuredTool({
      schema: allToolSchemas.sendWaiverLinkSchema,
      name: "sendWaiverLink",
      description:
        "Sends a message to the user containing the waiver link and information about their confirmed booking. The message text can be customized.",
      func: async (input) => notifierInstance.sendWaiverLink(input),
    });

    const sendTextMessageTool = new DynamicStructuredTool({
      schema: allToolSchemas.sendTextMessageSchema,
      name: "sendTextMessage",
      description:
        "Sends a simple text message to the user. Used for general communication, clarifications, or providing information that isn't part of a structured tool interaction.",
      func: async (input) => notifierInstance.sendTextMessage(input),
    });

    // New tools from the prompt
    const getUserProfileDataTool = new DynamicStructuredTool({
      schema: allToolSchemas.getUserProfileDataSchema,
      name: "getUserProfileData",
      description:
        "Retrieves basic profile data for the user, such as their name or registration status.",
      func: async (input) => stateManager.getUserProfileData(input),
    });

    const getUserPastSessionsTool = new DynamicStructuredTool({
      schema: allToolSchemas.getUserPastSessionsSchema,
      name: "getUserPastSessions",
      description:
        "Retrieves a summary or list of the user's past completed Kambo sessions.",
      func: async (input) => stateManager.getUserPastSessions(input),
    });

    // Consolidate all tools into an array
    const allTools = [
      findFreeSlotsTool,
      createCalendarEventTool,
      // deleteCalendarEventTool, // Add when schema and function are ready
      resetUserStateTool,
      updateUserStateTool,
      storeBookingDataTool,
      sendWaiverLinkTool,
      sendTextMessageTool,
      getUserProfileDataTool,
      getUserPastSessionsTool,
    ];

    logger.info(
      { toolCount: allTools.length, toolNames: allTools.map((t) => t.name) },
      "All DynamicStructuredTools created and collected.",
    );

    // Initialize Booking Agent with all dependencies including the tools
    // The bookingAgent is the module itself, initializeAgent is a function within it
    await bookingAgent.initializeAgent({
      tools: allTools,
      stateManager, // Pass the initialized stateManager
      logger, // Pass the logger
      config, // Pass the config
      prisma, // Pass prisma instance
      googleCalendar: googleCalendarInstance, // Pass the created googleCalendarInstance
      notifier: notifierInstance, // Pass the created notifierInstance
      // provider: 'openai', // Optionally specify provider, defaults to openai in agent
    });
    logger.info("Booking Agent initialized successfully.");

    // Initialize command and callback handlers, passing the resolved agent instance
    commandHandler.initialize({ logger }); // Initialize the module
    logger.info("[commandHandler] Initialized.");

    callbackHandler.initialize({
      logger,
      stateManager, // Use injected stateManager
      bookingAgent: bookingAgent, // Pass the agent module
      telegramNotifier: notifierInstance,
    }); // Initialize the module
    logger.info("callbackQueryHandler initialized successfully.");

    graphNodes.initializeNodes({
      logger,
      stateManager, // Use injected stateManager
      bookingAgent: bookingAgent, // Pass the agent module
      googleCalendar: googleCalendarInstance,
      telegramNotifier: notifierInstance,
    });
    logger.info("[Graph Nodes] Initialized successfully.");

    // Compile the graph
    bookingGraphInstance = initializeGraph({
      graphNodes,
      graphEdges,
      logger,
    });
    logger.info("bookingGraph compiled.");

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
      bookingAgent: bookingAgent, // Pass the agent module
      callbackQueryHandler: callbackHandler, // Pass the module directly
      commandHandler: commandHandler, // Pass the module directly
      bookingGraph: bookingGraphInstance, // Pass the compiled graph
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
  console.log(`Webhook callback handler registered at POST ${secretPath}`);

  // --- Express Global Error Handler (Last Middleware) ---
  // This catches errors *outside* Telegraf's processing (e.g., in Express routes)
  app.use(errorHandlerMiddleware);
  console.log("Express global error handler registered.");

  console.log("initializeApp function finished.");

  // --- Return the initialized app and potentially other core components ---
  return {
    app,
    bot,
    bookingAgent, // Now this will be the bookingAgent module itself
    commandHandler, // Return the module
    callbackHandler, // Return the module
    bookingGraph: bookingGraphInstance, // Return the compiled graph
    updateRouter: routeUpdate, // Return the initialized updateRouter instance
  }; // Make sure to return the app instance!
}

// --- Export the initialization function ---
module.exports = { initializeApp };
