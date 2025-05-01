const { isTextMessage, isCallbackQuery } = require("../utils/messageUtils");
const logger = require("../utils/logger")("updateRouter");
const { bookingGraph } = require("../graph/bookingGraph"); // Import the graph

let handlerContext = {}; // To store injected dependencies

/**
 * Initializes the update router middleware with necessary handlers.
 *
 * @param {object} context - Dependency context.
 * @param {object} context.commandHandler - Handler for command messages.
 * @param {object} context.callbackQueryHandler - Handler for callback queries.
 * @param {object} context.bookingAgent - The booking agent instance.
 * @param {object} context.bookingGraph - The compiled booking graph instance.
 * @throws {Error} If required handlers are missing.
 */
function initialize(context) {
  if (
    !context ||
    !context.commandHandler ||
    !context.callbackQueryHandler ||
    !context.bookingAgent ||
    !context.bookingGraph
  ) {
    // Add bookingGraph check
    throw new Error(
      "UpdateRouter requires commandHandler, callbackQueryHandler, bookingAgent, and bookingGraph.",
    );
  }
  handlerContext = context;
  logger.info(
    "Update router initialized successfully with all handlers and booking graph.",
  );
}

/**
 * Telegraf middleware to route updates based on type and user state.
 *
 * @param {object} ctx - Telegraf context object.
 * @param {Function} next - Function to call the next middleware.
 */
async function routeUpdate(ctx, next) {
  const userId = ctx.state.user ? ctx.state.user.id : "unknown"; // Use internal DB user ID
  const telegramId = ctx.from ? ctx.from.id : "unknown";
  const userState = ctx.state.user ? ctx.state.user.state : "UNKNOWN";

  logger.info(
    { userId, telegramId, userState, updateType: ctx.updateType },
    "Routing update...",
  );

  if (ctx.message && ctx.message.text && ctx.message.text.startsWith("/")) {
    logger.info({ userId }, "Routing to command handler.");
    return handlerContext.commandHandler.handleCommand(ctx, next);
  } else if (isCallbackQuery(ctx)) {
    logger.info({ userId }, "Routing to callback query handler.");
    return handlerContext.callbackQueryHandler.handleCallbackQuery(ctx, next);
  } else if (isTextMessage(ctx)) {
    logger.info(
      { userId, userState },
      "Processing text message based on state.",
    );
    // Handle text messages based on user state
    if (userState === "BOOKING") {
      logger.info(
        { userId },
        "Routing text message to booking graph (in BOOKING state).",
      );
      let sessionId; // Define sessionId outside try for catch block logging
      try {
        const userTelegramId = ctx.state.user.telegram_id.toString(); // Use consistent telegramId variable
        sessionId = ctx.state.user.active_session_id; // Assign to outer scope variable
        const userInput = ctx.message.text;

        if (!sessionId) {
          logger.error(
            { userId: userTelegramId },
            "Cannot invoke graph: User is in BOOKING state but has no active_session_id.",
          );
          await ctx.reply(
            "Sorry, there's an issue with your current booking session. Please start again with /book.",
          );
          // TODO: Consider resetting user state here
          return;
        }

        // Minimal input for this turn - graph manages its full state via sessionId
        const graphInput = { userInput: userInput };

        logger.info(
          { userId: userTelegramId, sessionId },
          "Invoking booking graph...",
        );

        // Invoke graph, passing sessionId in config for memory scoping
        const finalState = await handlerContext.bookingGraph.invoke(
          graphInput,
          { configurable: { sessionId: sessionId } },
        );

        // Extract final output to send to user (adjust based on actual graph state structure)
        // Assuming the final outcome is in agentOutcome.output, needs verification based on graph definition
        const responseOutput = finalState?.agentOutcome?.output; // Example access path - VERIFY THIS PATH!

        if (responseOutput) {
          logger.info(
            { userId: userTelegramId, sessionId },
            "Graph returned output for user.",
          );
          await ctx.reply(responseOutput);
        } else {
          logger.warn(
            { userId: userTelegramId, sessionId, finalState },
            "Graph execution finished turn without direct user output.",
          );
          // Avoid sending generic message unless necessary, graph might handle this internally.
          // If the graph *always* sends a message or updates state appropriately, no default reply is needed.
        }
      } catch (err) {
        // Use userId and telegramId defined at the start of routeUpdate for reliable logging
        logger.error(
          { err, userId, telegramId, sessionId: sessionId || "unknown" },
          "Error invoking booking graph.",
        );
        await ctx.reply(
          "Sorry, an unexpected error occurred while processing your request.",
        );
        // TODO: Consider state reset?
      }
    } else {
      // Default handler for text messages when not in a specific state like 'BOOKING'
      logger.info(
        { userId, userState },
        "Received unhandled text message for current state.",
      );
      await ctx.reply(
        "I received your message, but I'm not sure how to handle it in the current context. Try starting with a command like /start or /help.",
      );
    }
  } else {
    logger.warn(
      { userId, updateType: ctx.updateType },
      "Received unhandled update type.",
    );
    // Optional: Reply for unhandled update types
    // await ctx.reply("Sorry, I don't know how to handle that type of message.");
    return next(); // Pass to other middleware if needed
  }
}

module.exports = {
  initialize,
  routeUpdate,
};
