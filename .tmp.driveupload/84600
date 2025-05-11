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
const { HumanMessage } = require("@langchain/core/messages");
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
  const provider = deps.provider || "openai";
  const { logger, prisma, googleCalendar, notifier } = deps;

  // 1. Select and Configure the LLM (Use local config)
  let llm;
  if (provider === "gemini") {
    if (!deps.config.googleApiKey) {
      logger.error("Gemini provider selected, but GOOGLE_API_KEY is missing.");
      throw new Error("Missing Google API Key for booking agent (Gemini)");
    }
    llm = new ChatGoogleGenerativeAI({
      apiKey: deps.config.googleApiKey,
      modelName: "gemini-pro",
    });
  } else {
    if (!deps.config.openaiApiKey) {
      logger.error("OpenAI provider selected, but OPENAI_API_KEY is missing.");
      throw new Error("Missing OpenAI API Key for booking agent");
    }
    llm = new ChatOpenAI({
      openAIApiKey: deps.config.openaiApiKey,
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
      tools: deps.tools,
      prompt,
    });
    executor = new AgentExecutor({
      agent: agentRunnable,
      tools: deps.tools,
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
    const llmWithTools = llm.bindTools(deps.tools);

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
      tools: deps.tools,
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
    logger,
    prisma,
    googleCalendar,
    notifier,
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

  // 1. Retrieve Session Memory using stateManager
  let sessionMemory;
  let chatHistory = [];
  try {
    sessionMemory = await stateManager.retrieveSessionMemory(telegramId);
    if (sessionMemory && sessionMemory.chatHistory) {
      // Ensure history is in the correct format (BaseMessage instances)
      // This might require mapping if retrieveSessionMemory returns plain objects
      chatHistory = sessionMemory.chatHistory;
    } else {
      logger.warn(
        { telegramId },
        "No existing session memory found or history missing.",
      );
    }
  } catch (error) {
    logger.error({ err: error, telegramId }, "Error retrieving session memory");
  }

  // 3. Invoke the Agent Executor
  try {
    logger.info({ telegramId, input: userInput }, "Invoking booking agent");

    // Prepare input for the executor
    const agentInput = {
      input: userInput,
      chat_history: chatHistory,
      // Include other context if the agent/prompt expects it
      // e.g., telegram_id: telegramId (if needed for tools)
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
