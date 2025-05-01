const { logger } = require("../core/logger");

// Dependencies to be injected
let bookingAgent;
// These will be used in future implementations
// eslint-disable-next-line no-unused-vars
let commandHandler;
// eslint-disable-next-line no-unused-vars
let callbackHandler;

/**
 * Initializes the update router middleware with necessary dependencies.
 * @param {object} deps - Dependencies object.
 * @param {object} deps.bookingAgent - The booking agent instance.
 * @param {object} deps.commandHandler - Handler for bot commands.
 * @param {object} deps.callbackHandler - Handler for callback queries.
 */
function initialize(deps) {
  if (!deps.bookingAgent) {
    throw new Error(
      "Dependency Error: bookingAgent is required for updateRouter.",
    );
  }
  if (!deps.commandHandler) {
    throw new Error(
      "Dependency Error: commandHandler is required for updateRouter.",
    );
  }
  if (!deps.callbackHandler) {
    throw new Error(
      "Dependency Error: callbackHandler is required for updateRouter.",
    );
  }
  bookingAgent = deps.bookingAgent;
  commandHandler = deps.commandHandler;
  callbackHandler = deps.callbackHandler;
  logger.info("Update router initialized successfully.");
}

/**
 * Telegraf middleware to route updates based on type and user state.
 * Must be placed *after* userLookupMiddleware.
 * @param {object} ctx - Telegraf context object.
 * @param {Function} next - Telegraf next middleware function.
 */
// eslint-disable-next-line no-unused-vars
async function updateRouterMiddleware(ctx, next) {
  const userState = ctx.state.user?.state; // Assumes user state is attached by userLookupMiddleware
  const updateType = ctx.updateType;

  logger.debug(
    { updateType, userState, userId: ctx.state.user?.id },
    "Routing update...",
  );

  try {
    if (updateType === "message") {
      const message = ctx.message;
      if (message.text) {
        if (message.text.startsWith("/")) {
          // Handle commands
          logger.debug(
            { command: message.text, userId: ctx.state.user?.id },
            "Routing command...",
          );
          // Placeholder: Route to command handler
          // await commandHandler.handle(ctx);
          await ctx.reply("Command received (handler placeholder)."); // Replace with actual handler call
        } else {
          // Handle regular text messages
          if (userState === "BOOKING") {
            logger.info(
              { userId: ctx.state.user?.id },
              "User in BOOKING state, routing to booking agent.",
            );
            await bookingAgent.runBookingAgent({
              telegramId: ctx.from.id.toString(),
              message: message.text,
            });
          } else {
            logger.debug(
              { userId: ctx.state.user?.id, state: userState },
              "User not in BOOKING state, sending generic reply.",
            );
            await ctx.reply("Got it. How can I help you today?");
          }
        }
      } else {
        // Handle non-text messages (photos, stickers, etc.)
        logger.debug(
          { userId: ctx.state.user?.id },
          "Received non-text message.",
        );
        await ctx.reply("I can only process text messages right now.");
      }
    } else if (updateType === "callback_query") {
      // Handle callback queries (inline buttons)
      logger.debug(
        { callbackData: ctx.callbackQuery.data, userId: ctx.state.user?.id },
        "Routing callback query...",
      );
      // Placeholder: Route to callback handler
      // await callbackHandler.handle(ctx);
      await ctx.answerCbQuery("Callback received (handler placeholder)."); // Replace with actual handler call
      // Optionally edit the original message or send a new one
      // await ctx.editMessageText('Processing your selection...');
    } else {
      // Handle other update types (inline_query, chosen_inline_result, etc.)
      logger.warn(
        { updateType, userId: ctx.state.user?.id },
        "Received unhandled update type.",
      );
      // Optionally call next() if other middleware should handle this
      // return next();
    }
  } catch (error) {
    logger.error(
      { err: error, userId: ctx.state.user?.id, updateType },
      "Error processing update in router.",
    );
    // Avoid crashing the bot, send a generic error message
    try {
      await ctx.reply(
        "Sorry, something went wrong while processing your request.",
      );
    } catch (replyError) {
      logger.error({ err: replyError }, "Failed to send error reply to user.");
    }
  }
  // If not handled or passed to next, stop processing here
}

module.exports = {
  initialize,
  updateRouterMiddleware,
};
