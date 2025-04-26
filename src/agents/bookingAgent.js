/**
 * @module agents/bookingAgent
 * @description Implements the core booking agent executor using LangChain's OpenAI Functions agent.
 * Wires together the LLM, prompt, tools, and memory manager.
 */

// LangChain Imports
const { ChatOpenAI } = require("@langchain/openai");
const {
  ChatPromptTemplate,
  MessagesPlaceholder,
} = require("@langchain/core/prompts");
const {
  createOpenAIFunctionsAgent,
  AgentExecutor,
} = require("langchain/agents"); // Note: Using 'langchain' based on request and memory
const { StructuredTool } = require("@langchain/core/tools");

// Application Dependencies
const stateManager = require("../tools/stateManager");
const telegramNotifier = require("../tools/telegramNotifier");
const GoogleCalendarTool = require("../tools/googleCalendar"); // Import the class
const toolSchemas = require("../tools/toolSchemas");
const { bookingAgentSystemPrompt } = require("../config/agentPrompts");
const sessionMemory = require("../memory/sessionMemory");

// Module-level variables
let llm;
let logger;
let config;
let agentTools = []; // Initialize as empty array
let googleCalendarToolInstance; // To hold the instance

/**
 * Initializes the booking agent and its dependencies.
 * Sets up the LLM, tools, logger, and configuration.
 *
 * @param {object} dependencies - The dependencies needed by the agent.
 * @param {object} dependencies.logger - The Pino logger instance.
 * @param {object} dependencies.config - The environment configuration object.
 * @param {import('@prisma/client').PrismaClient} dependencies.prisma - The Prisma client instance (needed for tool initialization).
 * @param {import('telegraf').Telegraf} dependencies.bot - The Telegraf bot instance (needed for tool initialization).
 */
function initializeAgent(dependencies) {
  if (
    !dependencies ||
    !dependencies.logger ||
    !dependencies.config ||
    !dependencies.prisma ||
    !dependencies.bot
  ) {
    const missing = [];
    if (!dependencies) missing.push("dependencies object");
    else {
      if (!dependencies.logger) missing.push("logger");
      if (!dependencies.config) missing.push("config");
      if (!dependencies.prisma) missing.push("prisma");
      if (!dependencies.bot) missing.push("bot");
    }
    // Use console.error as logger might not be available
    console.error(
      `FATAL: bookingAgent initialization failed. Missing: ${missing.join(", ")}.`,
    );
    throw new Error(
      `bookingAgent initialization failed. Missing dependencies: ${missing.join(", ")}`,
    );
  }

  logger = dependencies.logger;
  config = dependencies.config;

  // Initialize LLM
  llm = new ChatOpenAI({
    openAIApiKey: config.OPENAI_API_KEY,
    modelName: config.OPENAI_MODEL || "gpt-4-turbo", // Use config or default
    temperature: config.AGENT_TEMPERATURE || 0.2, // Use config or default
  });
  logger.info("[bookingAgent] ChatOpenAI LLM initialized.");

  // Initialize Tools that need it (using provided dependencies)
  // Note: Assuming tools have an 'initialize' function or similar mechanism
  // If not, adjust this section based on actual tool structure
  try {
    // stateManager doesn't have an explicit initialize, but uses logger injected via setLogger
    stateManager.setLogger(logger);

    // telegramNotifier requires initialization
    telegramNotifier.initialize({
      logger,
      config,
      prisma: dependencies.prisma,
      bot: dependencies.bot,
    });

    // googleCalendar is a class, instantiate it
    googleCalendarToolInstance = new GoogleCalendarTool({ logger });
  } catch (error) {
    logger.error(
      { err: error },
      "Failed to initialize one or more tools during agent setup.",
    );
    // Depending on severity, you might want to re-throw or handle differently
    throw new Error("Tool initialization failed.");
  }

  // Create StructuredTool instances
  agentTools = []; // Clear any previous tools if re-initializing

  // --- State Manager Tools ---
  agentTools.push(
    new StructuredTool({
      name: "reset_user_state",
      description:
        "Resets the user's booking-related state fields in the database (e.g., state, session_type, booking_slot, edit_msg_id). Call this when a booking flow is explicitly cancelled, successfully completed (after booking data is stored), or definitively concluded without a booking.",
      schema: toolSchemas.resetUserStateSchema,
      func: stateManager.resetUserState,
    }),
  );

  agentTools.push(
    new StructuredTool({
      name: "update_user_state",
      description:
        "Updates specific fields of a user's record in the database. Use this to change the user's current state (e.g., 'AWAITING_SLOT_CONFIRMATION'), store temporary data like a message ID to be edited, or update conversation history.",
      // IMPORTANT: Langchain expects the input to be a single object for OpenAI Functions.
      // Our current function takes (telegramId, dataToUpdate). We need an adapter or schema adjustment.
      // Quick Fix: Adapting the function call within the StructuredTool func.
      schema: toolSchemas.updateUserStateSchema, // This schema expects { telegramId: string, updates: object }
      func: async ({ telegramId, updates }) => {
        // Adapt the input here
        return stateManager.updateUserState(telegramId, updates);
      },
    }),
  );

  agentTools.push(
    new StructuredTool({
      name: "store_booking_data",
      description:
        "Stores the confirmed booking session type and start time for a user after they have confirmed their choice. Call this ONLY when a booking slot has been definitively chosen and confirmed by the user.",
      schema: toolSchemas.storeBookingDataSchema,
      func: async ({ telegramId, sessionType, bookingSlot }) => {
        // Adapt input
        return stateManager.storeBookingData(
          telegramId,
          sessionType,
          bookingSlot,
        );
      },
    }),
  );

  agentTools.push(
    new StructuredTool({
      name: "set_active_session_id",
      description:
        "Sets the active LangGraph session ID for a user in the database. This links the user's current interaction thread to a specific state machine instance. Call this when initiating a new stateful interaction (like a booking graph).",
      schema: toolSchemas.setActiveSessionIdSchema,
      func: stateManager.setActiveSessionId, // Already expects an object { telegramId, sessionId }
    }),
  );

  agentTools.push(
    new StructuredTool({
      name: "clear_active_session_id",
      description:
        "Clears the active LangGraph session ID for a user (sets it to null) in the database. Call this when a stateful interaction (like a booking graph) concludes or is explicitly reset, detaching the user from that specific graph instance.",
      schema: toolSchemas.clearActiveSessionIdSchema,
      func: stateManager.clearActiveSessionId, // Already expects an object { telegramId }
    }),
  );

  // --- Telegram Notifier Tools ---
  agentTools.push(
    new StructuredTool({
      name: "send_waiver_link",
      description:
        "Sends a message containing a button linking to the waiver web app form. Also stores the sent message's ID in the database for potential future edits (e.g., adding confirmation). Call this when the user needs to fill out the waiver form before confirming their booking.",
      schema: toolSchemas.sendWaiverLinkSchema,
      func: telegramNotifier.sendWaiverLink, // Assumes it takes an object
    }),
  );

  agentTools.push(
    new StructuredTool({
      name: "send_text_message",
      description:
        "Sends a simple text message to a given Telegram user ID. Use this for general communication, providing information, asking clarifying questions, or sending confirmations that don't require special formatting or buttons.",
      schema: toolSchemas.sendTextMessageSchema,
      func: telegramNotifier.sendTextMessage, // Assumes it takes an object
    }),
  );

  // --- Google Calendar Tools (using the instance) ---
  if (googleCalendarToolInstance) {
    agentTools.push(
      new StructuredTool({
        name: "find_free_slots",
        description:
          "STUB FUNCTION: Finds available time slots based on optional date range and duration. In the future, this will query the practitioner's Google Calendar. Currently returns predefined fake slots. Use this to check practitioner availability when a user asks for booking times or initiates a booking request.",
        schema: toolSchemas.findFreeSlotsSchema,
        // Bind the method to the instance to maintain 'this' context
        func: googleCalendarToolInstance.findFreeSlots.bind(
          googleCalendarToolInstance,
        ),
      }),
    );

    agentTools.push(
      new StructuredTool({
        name: "create_calendar_event",
        description:
          "STUB FUNCTION: Creates a calendar event in the practitioner's Google Calendar. Logs the input and returns a hardcoded success response. In the future, this will interact with the Google Calendar API. Call this ONLY after a user has confirmed their booking slot AND completed any prerequisite steps (like waiver submission).",
        schema: toolSchemas.createCalendarEventSchema,
        // Bind the method to the instance
        func: googleCalendarToolInstance.createCalendarEvent.bind(
          googleCalendarToolInstance,
        ),
      }),
    );
  } else {
    logger.error(
      "[bookingAgent] Google Calendar tool instance not available during tool setup.",
    );
  }

  logger.info(
    `[bookingAgent] Initialization complete. ${agentTools.length} tools configured.`,
  );
}

/**
 * Runs the booking agent executor for a given user input and Telegram ID.
 *
 * @param {object} params - The parameters for running the agent.
 * @param {string} params.userInput - The user's latest message/input.
 * @param {string|number} params.telegramId - The Telegram ID of the user initiating the request.
 * @returns {Promise<{success: boolean, output?: string, error?: string}>} - An object containing the agent's final output or an error message.
 */
async function runBookingAgent({ userInput, telegramId }) {
  if (!llm || !agentTools || agentTools.length === 0 || !logger || !config) {
    console.error(
      "[runBookingAgent] FATAL: Agent not properly initialized. Call initializeAgent() first.",
    );
    // Attempt to use logger if available, otherwise console
    const log = logger || console;
    log.error(
      "[runBookingAgent] Agent dependencies (LLM, tools, logger, config) missing or incomplete.",
    );
    return { success: false, error: "Agent not initialized" };
  }

  logger.info({ telegramId, userInput }, "Running booking agent...");

  try {
    // Get Memory (Temporary keying by telegramId)
    const memory = sessionMemory.getMemoryForSession(String(telegramId));

    // Prepare Prompt
    const currentDateTime = new Date().toISOString();
    // TEMP Placeholders - Fetch real data in later phases
    const userName = "User"; // TODO: Fetch from DB or context
    const sessionType = "Unknown"; // TODO: Fetch from DB or context

    const formattedSystemPrompt = bookingAgentSystemPrompt
      .replace("{current_date_time}", currentDateTime)
      .replace("{user_name}", userName)
      .replace("{session_type}", sessionType);

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", formattedSystemPrompt],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad"),
    ]);

    // Create Agent
    const agent = await createOpenAIFunctionsAgent({
      llm,
      tools: agentTools,
      prompt,
    });

    // Create Agent Executor
    const agentExecutor = new AgentExecutor({
      agent,
      tools: agentTools,
      memory,
      verbose: config.NODE_ENV !== "production",
      // returnIntermediateSteps: true, // Enable for detailed debugging if needed
      handleParsingErrors: (error) => {
        // Add robust error handling
        logger.error({ err: error }, "Agent parsing error occurred.");
        return "Agent encountered an internal error. Please try rephrasing your request.";
      },
    });

    // Invoke Agent
    logger.debug({ telegramId }, "Invoking agent executor...");
    const result = await agentExecutor.invoke({ input: userInput });

    logger.info(
      { telegramId, output: result.output },
      "Agent execution successful.",
    );
    return { success: true, output: result.output };
  } catch (error) {
    logger.error({ telegramId, err: error }, "Agent execution failed");
    return { success: false, error: "Agent execution failed" };
  }
}

module.exports = {
  initializeAgent,
  runBookingAgent,
};
