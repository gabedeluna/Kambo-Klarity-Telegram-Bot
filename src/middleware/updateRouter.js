/**
 * Initializes the update router middleware with necessary handlers and returns
 * the configured routeUpdate middleware function.
 *
 * @param {object} deps - Dependency context.
 * @param {object} deps.commandHandler - Handler for command messages.
 * @param {object} deps.callbackQueryHandler - Handler for callback queries.
 * @param {object} deps.bookingAgent - The booking agent instance.
 * @param {object} deps.bookingGraph - The compiled booking graph instance.
 * @returns {Function} The configured routeUpdate middleware function.
 */
function initialize(deps) {
  const { logger: depLogger } = require("../core/logger");
  const logger = depLogger; // Use the logger obtained via require

  // --- Validate Dependencies ---
  const {
    commandHandler,
    callbackQueryHandler,
    bookingAgent,
    // bookingGraph, // Currently unused?
  } = deps || {};

  if (!commandHandler || !callbackQueryHandler || !bookingAgent) {
    const missing = [
      !commandHandler && "commandHandler",
      !callbackQueryHandler && "callbackQueryHandler",
      !bookingAgent && "bookingAgent",
    ]
      .filter(Boolean)
      .join(", ");
    logger.error(
      { missingDependencies: missing },
      `UpdateRouter initialization failed. Missing: ${missing}`,
    );
    throw new Error(
      `UpdateRouter requires commandHandler, callbackQueryHandler, and bookingAgent.`,
    );
  }

  logger.info(
    "Update router initialized. Returning configured routeUpdate function.",
  );

  /**
   * Telegraf middleware to route updates based on type and user state.
   *
   * @param {object} ctx - Telegraf context object.
   * @param {Function} next - Function to call the next middleware.
   */
  async function routeUpdate(ctx, next) {
    console.log(">>> routeUpdate START"); // DEBUG LOG
    const telegramId = ctx.from?.id;
    const user = ctx.state?.user; // Populated by preceding userState middleware
    const isNewUser = ctx.state?.isNewUser;

    try {
      // 1. Handle New User Registration
      if (isNewUser === true) {
        console.log(">>> routeUpdate NEW USER path"); // DEBUG LOG
        const userName = ctx.from?.first_name || "there";
        logger.info({ telegramId }, `New user detected: ${userName}`);
        console.log(">>> routeUpdate NEW USER before reply"); // DEBUG LOG
        await ctx.reply(
          `👋 Welcome, ${userName}! To get started, please tell me about your travel plans or use /help.`,
        );
        console.log(">>> routeUpdate NEW USER after reply, before return"); // DEBUG LOG
        return; // Stop processing further middleware
      }

      // 2. Handle Failed User Lookup (Error from previous middleware)
      if (user === undefined) {
        console.log(">>> routeUpdate FAILED LOOKUP path"); // DEBUG LOG
        logger.error(
          { userId: telegramId }, // Use actual telegramId for context
          "Cannot route update: User lookup failed previously.",
        );
        return; // Stop processing
      }

      // At this point, we have an existing user object
      const userState = user.state;
      const sessionId = user.active_session_id;

      // 3. Route Based on Update Type and User State
      if (ctx.updateType === "message" && ctx.message?.text) {
        const messageText = ctx.message.text;
        console.log(`>>> routeUpdate MESSAGE path - State: ${userState}`); // DEBUG LOG

        // 3.1 Handle Commands
        if (messageText.startsWith("/")) {
          console.log(">>> routeUpdate COMMAND path"); // DEBUG LOG
          logger.info(
            { telegramId, command: messageText },
            "Routing to command handler.",
          );
          await commandHandler.handleCommand(ctx, next); // Pass next for potential fallthrough
        }
        // 3.2 Handle Text Message during Booking
        else if (userState === "BOOKING") {
          console.log(">>> routeUpdate BOOKING path"); // DEBUG LOG
          if (!sessionId) {
            logger.error(
              { telegramId },
              "Cannot invoke graph: User is in BOOKING state but has no active_session_id.",
            );
            await ctx.reply(
              "There seems to be an issue with your current booking session. Please try starting a new request, perhaps with /book.",
            );
            return; // Stop processing
          }
          logger.debug(
            { telegramId, sessionId },
            "Routing message to booking graph",
          );
          const graphInput = { userInput: messageText };
          console.log(">>> routeUpdate BOOKING before invokeGraph"); // DEBUG LOG
          await bookingAgent.invokeGraph(sessionId, graphInput);
          console.log(">>> routeUpdate BOOKING after invokeGraph"); // DEBUG LOG
          // Agent is expected to handle the reply based on graphOutput
          return; // Stop processing after graph handles it
        }
        // 3.3. Handle Generic Text (IDLE state)
        else if (userState === "IDLE") {
          console.log(">>> routeUpdate IDLE TEXT path"); // DEBUG LOG
          logger.debug(
            { telegramId },
            "Handling generic text message in IDLE state.",
          );
          console.log(">>> routeUpdate IDLE TEXT before reply"); // DEBUG LOG
          await ctx.reply(
            "I received your message, but I'm not sure how to handle it in the current context. Try starting with a command like /start or /help.",
          );
          console.log(">>> routeUpdate IDLE TEXT after reply, before return"); // DEBUG LOG
          return; // Stop processing after generic reply
        } else {
          // Should not happen if states are handled
          console.log(`>>> routeUpdate UNKNOWN state TEXT path: ${userState}`); // DEBUG LOG
          logger.warn(
            { telegramId, userState },
            "User in unhandled state received text message.",
          );
          await ctx.reply(
            "I'm not sure how to handle that in my current state.",
          );
          return;
        }
      } else if (ctx.updateType === "callback_query") {
        console.log(">>> routeUpdate CALLBACK QUERY path"); // DEBUG LOG
        // 4. Route Callback Queries (IDLE or BOOKING state - handler decides)
        logger.info(
          { telegramId, data: ctx.callbackQuery?.data },
          "Routing callback query",
        );
        await callbackQueryHandler.handleCallbackQuery(ctx, next); // Pass next
      } else {
        console.log(`>>> routeUpdate UNHANDLED type path: ${ctx.updateType}`); // DEBUG LOG
        // 5. Warn and Pass Through Unhandled Update Types
        const messageType = ctx.message
          ? Object.keys(ctx.message).find(
              (key) =>
                key !== "message_id" &&
                key !== "date" &&
                key !== "chat" &&
                key !== "from" &&
                key !== "text",
            )
          : "unknown";
        logger.warn(
          { updateType: ctx.updateType, messageType },
          "Unhandled update type received.",
        );
        await next(); // Pass to next middleware
      }
    } catch (err) {
      console.error(">>> routeUpdate CAUGHT ERROR:", err); // DEBUG LOG
      logger.error(
        { err, telegramId },
        "Unhandled error during update processing.",
      );
      try {
        console.log(">>> routeUpdate ERROR before reply"); // DEBUG LOG
        await ctx.reply(
          "Apologies, an unexpected error occurred while processing your request.",
        );
        console.log(">>> routeUpdate ERROR after reply"); // DEBUG LOG
      } catch (replyErr) {
        console.error(">>> routeUpdate FAILED TO SEND ERROR REPLY:", replyErr); // DEBUG LOG
        logger.error(
          { err: replyErr, originalError: err, telegramId },
          "Error sending error reply to user.",
        );
      }
      // Do not call next() after an error
    } finally {
      // console.log(">>> routeUpdate FINALLY block"); // DEBUG LOG - Maybe too noisy
    }
  }

  return routeUpdate;
}

module.exports = { initialize };
