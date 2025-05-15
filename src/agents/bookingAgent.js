/**
 * @module agents/bookingAgent
 * @description Implements the core booking agent executor using LangChain's OpenAI Functions agent.
 * Wires together the LLM, prompt, tools, and memory manager.
 */

// LangChain Imports
const { ChatOpenAI } = require("@langchain/openai");
const {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIFunctionsAgentOutputParser,
} = require("@langchain/google-genai");
const {
  ChatPromptTemplate,
  MessagesPlaceholder,
} = require("@langchain/core/prompts");
const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const {
  AgentExecutor,
  createOpenAIFunctionsAgent,
} = require("langchain/agents");
const { RunnableSequence } = require("@langchain/core/runnables");

// Application Dependencies
const stateManager = require("../tools/stateManager");
const { bookingAgentSystemPrompt } = require("../config/agentPrompts");

// Module-level variables to hold the initialized components for each provider
const agentExecutors = {};

/**
 * Initializes the booking agent with required dependencies and configuration.
 * Sets up the LLM, tools, logger, and configuration.
 *
 * @param {object} dependencies - The dependencies needed by the agent.
 * @param {object} dependencies.logger - The Pino logger instance.
 * @param {import('@prisma/client').PrismaClient} dependencies.prisma - The Prisma client instance (needed for tool initialization).
 * @param {import('telegraf').Telegraf} dependencies.bot - The Telegraf bot instance (needed for tool initialization).
 * @param {object} dependencies.notifier - The initialized TelegramNotifier instance.
 * @param {object} dependencies.googleCalendar - The instantiated GoogleCalendarTool instance.
 * @param {string} [dependencies.provider="openai"] - The AI provider ('openai' or 'gemini').
 */
async function initializeAgent(deps) {
  // Destructure only the dependencies that are directly passed and used at this level
  // or are needed for storing in agentExecutors.
  const {
    logger,
    config,
    tools,
    stateManager,
    prisma, // Assuming prisma might be needed by runBookingAgent via agentExecutors
    googleCalendar, // Assuming googleCalendar might be needed by runBookingAgent via agentExecutors
    notifier, // Assuming notifier might be needed by runBookingAgent via agentExecutors
    provider: providerOption, // provider is optional
  } = deps;

  // Ensure logger is defined before using it
  if (!logger) {
    // Fallback or throw error if logger is absolutely critical and not provided
    console.error(
      "[AGENT_INIT] CRITICAL: Logger instance was not provided to initializeAgent.",
    );
    // Optionally, create a default logger here if that's a valid fallback
    // For now, let's re-throw to make the missing dependency explicit
    throw new Error("[AGENT_INIT] Logger instance is undefined.");
  }

  const provider = providerOption || "openai";

  // Detailed logging for deps.tools (Step 2 from user's plan) - changed to logger.info
  logger.info(
    { toolsPassedToAgent: tools },
    "[AGENT_INIT] Tools being passed to agent/LLM for binding/creation.",
  );
  if (tools && Array.isArray(tools)) {
    tools.forEach((tool, index) => {
      logger.info(
        {
          toolIndex: index,
          toolName: tool ? tool.name : "UNDEFINED_NAME",
          toolDescription: tool ? tool.description : "UNDEFINED_DESCRIPTION",
          isFunction: typeof tool === "function",
          isObject: typeof tool === "object",
          toolKeys: tool ? Object.keys(tool) : "NOT_AN_OBJECT",
        },
        `[AGENT_INIT] Inspecting tool at index ${index}`,
      );
    });
  } else {
    logger.warn(
      { tools: tools },
      "[AGENT_INIT] deps.tools is not an array or is undefined!",
    );
  }

  // 1. Select and Configure the LLM (Use local config)
  let llm;
  if (provider === "gemini") {
    if (!config.googleApiKey) {
      logger.error("Gemini provider selected, but GOOGLE_API_KEY is missing.");
      throw new Error("Missing Google API Key for booking agent (Gemini)");
    }
    llm = new ChatGoogleGenerativeAI({
      apiKey: config.googleApiKey,
      modelName: "gemini-pro",
    });
  } else {
    if (!config.openaiApiKey) {
      logger.error("OpenAI provider selected, but OPENAI_API_KEY is missing.");
      throw new Error("Missing OpenAI API Key for booking agent");
    }
    llm = new ChatOpenAI({
      openAIApiKey: config.openaiApiKey,
      modelName: "gpt-4-turbo-preview",
    });
  }
  logger.debug(
    { provider, modelName: llm?.modelName },
    "Selected LLM for agent.",
  );

  // 2. Create the Prompt
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", bookingAgentSystemPrompt],
    new MessagesPlaceholder("chat_history"),
    new HumanMessage("{input}"),
    new MessagesPlaceholder("agent_scratchpad"),
  ]);
  logger.debug("Created agent prompt template.");

  // 3. Create Agent Runnable and Executor (Provider-Specific)
  let agentRunnable;
  let executor;

  if (provider === "openai") {
    // OpenAI uses createOpenAIFunctionsAgent
    agentRunnable = await createOpenAIFunctionsAgent({
      llm,
      tools,
      prompt,
    });
    executor = new AgentExecutor({
      agent: agentRunnable,
      tools,
      verbose: true,
      handleParsingErrors: (error) => {
        // Log the error and return a fallback message
        logger.error({ err: error }, "Agent parsing error");
        return "Agent encountered an internal error parsing the response.";
      },
    });
    logger.debug("Created OpenAI Functions agent runnable and executor.");
  } else if (provider === "gemini") {
    // Gemini: Bind tools directly to the model and use LCEL
    const llmWithTools = llm.bindTools(tools);

    // Create the runnable sequence for Gemini
    agentRunnable = RunnableSequence.from([
      {
        input: (i) => i.input,
        chat_history: (i) => i.chat_history,
        agent_scratchpad: (i) => i.intermediate_steps,
      },
      prompt,
      llmWithTools,
      new GoogleGenerativeAIFunctionsAgentOutputParser(),
    ]);

    // Use the standard AgentExecutor constructor for the runnable sequence
    executor = AgentExecutor.fromAgentAndTools({
      agent: agentRunnable,
      tools,
      verbose: true,
      handleParsingErrors: (error) => {
        // Log the error and return a fallback message
        logger.error({ err: error }, "Agent parsing error (Gemini)");
        return "Agent encountered an internal error parsing the response.";
      },
    });
    logger.debug("Created Gemini agent runnable and executor using bindTools.");
  } else {
    // Should not happen if validated earlier, but good practice
    throw new Error(`Unsupported provider for agent creation: ${provider}`);
  }

  // 4. Store components (Executor is the main part needed by runBookingAgent)
  agentExecutors[provider] = {
    executor,
    logger, // Already destructured and verified
    stateManager, // Already destructured
    config, // Already destructured
    prisma, // Store if provided
    googleCalendar, // Store if provided
    notifier, // Store if provided
  };
  logger.info(
    `Booking agent initialized successfully for provider: ${provider}`,
  );
}

/**
 * Runs the booking agent for a given user input.
 *
 * @param {object} params - The parameters for running the agent.
 * @param {string} params.userInput - The user's latest message.
 * @param {string | number} params.telegramId - The user's Telegram ID.
 * @param {string} [params.provider="openai"] - The AI provider ('openai' or 'gemini').
 * @returns {Promise<{success: boolean, output?: string, error?: string}>} - An object containing the agent's final output or an error message.
 */
async function runBookingAgent({ userInput, telegramId, provider = "openai" }) {
  // Retrieve components for the determined provider
  const components = agentExecutors[provider];

  if (!components || !components.executor) {
    // Use console.error for initialization issues
    console.error(
      `[runBookingAgent] FATAL: Agent components for provider '${provider}' not initialized. Call initializeAgent() first.`,
    );
    return { success: false, error: "Agent not initialized" };
  }

  // Destructure components for easier access
  const { executor, logger } = components;

  // 1. Retrieve chat history using stateManager
  // Note: sessionMemory variable was previously defined but not used
  let chatHistory = [];
  try {
    // Use getUserProfileData to fetch the whole user profile
    const profileResult = await stateManager.getUserProfileData({ telegramId });

    if (
      profileResult.success &&
      profileResult.data &&
      profileResult.data.conversation_history
    ) {
      let rawHistory = profileResult.data.conversation_history;
      // Attempt to parse if it's a JSON string
      if (typeof rawHistory === "string") {
        try {
          rawHistory = JSON.parse(rawHistory);
        } catch (parseError) {
          logger.error(
            { err: parseError, telegramId },
            "Error parsing conversation_history JSON string.",
          );
          rawHistory = []; // Fallback to empty history on parse error
        }
      }

      // Ensure rawHistory is an array before mapping
      if (Array.isArray(rawHistory)) {
        chatHistory = rawHistory
          .map((msg) => {
            if (msg.type === "human") return new HumanMessage(msg.content);
            if (msg.type === "ai") return new AIMessage(msg.content);
            // Log unknown message types, but don't break the flow
            logger.warn(
              { telegramId, unknownMsgType: msg.type },
              "Unknown message type in conversation_history",
            );
            return null; // Or a generic message type if appropriate
          })
          .filter(Boolean); // Filter out any nulls from unknown types
      } else {
        logger.warn(
          { telegramId, historyType: typeof rawHistory },
          "conversation_history is not an array or a parsable JSON string array.",
        );
      }
    } else if (profileResult.success && profileResult.data) {
      logger.info(
        { telegramId },
        "No conversation_history found in user profile.",
      );
    } else {
      logger.warn(
        {
          telegramId,
          success: profileResult.success,
          error: profileResult.error,
        },
        "Failed to retrieve user profile or profile data missing for session memory.",
      );
    }
  } catch (error) {
    logger.error(
      { err: error, telegramId },
      "Error retrieving and processing session memory from user profile",
    );
    // chatHistory remains empty
  }

  // Get current date and time
  const now = new Date();
  const currentDateTimeString = now.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    timeZoneName: "short",
  });

  // 3. Invoke the Agent Executor
  try {
    logger.info({ telegramId, input: userInput }, "Invoking booking agent");

    // Prepare input for the executor
    const agentInput = {
      input: userInput,
      chat_history: chatHistory,
      current_date_time: currentDateTimeString, // Add current date and time
      // TODO: Add other dynamic prompt variables like user_name, session_type, past_session_dates_summary
      // These would typically be fetched here or passed into runBookingAgent
      user_name: "Valued User", // Placeholder - replace with actual user name from state/DB
      session_type: "Kambo Session", // Placeholder - replace with actual session type from state
      past_session_dates_summary: "No past sessions on record.", // Placeholder - replace with actual summary
    };

    const result = await executor.invoke(agentInput);

    logger.info(
      { telegramId, output: result.output },
      "Agent invocation successful",
    );

    // 4. Store Agent Response (Optional, depending on state management needs)
    // ...

    return { success: true, output: result.output };
  } catch (err) {
    logger.error(
      { error: err, telegramId, input: userInput },
      "Error invoking booking agent executor",
    );
    return { success: false, error: `Agent execution failed: ${err.message}` };
  }
}

module.exports = {
  initializeAgent,
  runBookingAgent,
};
