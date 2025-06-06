const { Markup } = require("telegraf");

/**
 * Initializes the update router middleware with necessary handlers and returns
 * the configured routeUpdate middleware function.
 *
 * @param {object} deps - Dependency context.
 * @param {object} deps.commandHandler - Handler for command messages.
 * @param {object} deps.callbackQueryHandler - Handler for callback queries.
 * @param {object} deps.logger - The logger instance.
 * @param {object} deps.config - Application configuration object.
 * @returns {Function} The configured routeUpdate middleware function.
 */

function initialize(deps) {
  // --- Validate Dependencies ---
  const { logger, commandHandler, callbackQueryHandler, config } = deps || {};

  if (!logger || !commandHandler || !callbackQueryHandler || !config) {
    const missing = [
      !logger && "logger",
      !commandHandler && "commandHandler",
      !callbackQueryHandler && "callbackQueryHandler",
      !config && "config",
    ]
      .filter(Boolean)
      .join(", ");

    // Log critical failure appropriately
    if (!logger) {
      // If logger itself is missing, use console.error
      console.error(
        `FATAL: UpdateRouter initialization failed. Missing dependencies, including logger. Missing: ${missing}`,
      );
    } else {
      // If logger is present, use it to log other missing dependencies
      logger.error(
        { missingDependencies: missing },
        `UpdateRouter initialization failed. Missing: ${missing}`,
      );
    }
    throw new Error(
      `UpdateRouter requires logger, commandHandler, callbackQueryHandler, and config.`,
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
    logger.debug(
      { telegramId: ctx.from?.id },
      "Processing update in routeUpdate middleware",
    );
    const telegramId = ctx.from?.id;
    const user = ctx.state?.user;
    const isNewUser = ctx.state?.isNewUser;

    try {
      // 1. Handle New User Registration
      if (isNewUser === true) {
        const userName = ctx.from?.first_name || "there";
        logger.info({ telegramId }, `New user detected: ${userName}`);

        // Construct the registration URL
        if (!config.ngrokUrl) {
          logger.error(
            { telegramId },
            "NGROK_URL is not configured. Cannot generate registration link.",
          );
          await ctx.reply(
            "Welcome! There seems to be an issue setting up your registration link right now.",
          );
          return;
        }
        // Append botServerUrl query parameter needed by the form's JS
        const registrationUrl = `${config.ngrokUrl}/registration-form.html?botServerUrl=${config.ngrokUrl}`;
        logger.info(
          { telegramId, registrationUrl },
          "Generated registration URL for new user.",
        );

        try {
          await ctx.reply(
            `👋 Welcome, ${userName}! Please complete your registration to get started.`,
            Markup.inlineKeyboard([
              Markup.button.webApp("Register Now", registrationUrl),
            ]),
          );
        } catch (replyError) {
          console.error(
            ">>> routeUpdate NEW USER path - REPLY FAILED:",
            replyError,
          );
          logger.error(
            { err: replyError, telegramId },
            "Failed to send welcome/registration reply to new user.",
          );
        }
        return;
      }

      // 2. Handle Failed User Lookup (Error from previous middleware)
      if (user === undefined) {
        logger.warn({ telegramId }, "User lookup failed, treating as new user");
        logger.error(
          { userId: telegramId },
          "Cannot route update: User lookup failed previously.",
        );
        return;
      }

      // At this point, we have an existing user object
      const userState = user.state;
      const sessionId = user.active_session_id;

      // 3. Route Based on Update Type and User State
      if (ctx.updateType === "message" && ctx.message?.text) {
        const messageText = ctx.message.text;
        logger.debug({ telegramId, userState }, "Processing message update");

        // 3.1 Handle Commands
        if (messageText.startsWith("/")) {
          logger.debug(
            { telegramId, command: ctx.message.text },
            "Routing to command handler",
          );
          logger.info(
            { telegramId, command: messageText },
            "Routing to command handler.",
          );
          await commandHandler.handleCommand(ctx, next);
        }
        // 3.2 Handle Text Message during Booking (Agent logic removed)
        else if (userState === "BOOKING") {
          logger.info(
            { telegramId, messageText, activeSessionId: sessionId },
            ">>> routeUpdate BOOKING path (text message) - Agent logic removed.",
          );
          // Previously, this section would invoke the bookingAgent.
          // Now, it might reply with a generic message or be removed if BOOKING state is handled differently.
          await ctx.reply(
            "I received your message, but the AI booking assistant is currently unavailable. Please use commands if you know them, or type /help.",
          );
          return;
        }
        // 3.3. Handle Generic Text (IDLE state)
        else if (userState === "IDLE") {
          logger.debug({ telegramId }, "Processing idle text message");
          logger.debug(
            { telegramId },
            "Handling generic text message in IDLE state.",
          );
          logger.debug({ telegramId }, "Sending idle text response");
          await ctx.reply(
            "I received your message, but I'm not sure how to handle it in the current context. Try starting with a command like /start or /help.",
          );
          logger.debug({ telegramId }, "Idle text response sent");
          return;
        } else {
          // Should not happen if states are handled
          logger.warn(
            { telegramId, userState },
            "Unknown user state for text message",
          );
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
        logger.debug(
          { telegramId, callbackData: ctx.callbackQuery?.data },
          "Routing to callback query handler",
        );
        // 4. Route Callback Queries (IDLE or BOOKING state - handler decides)
        logger.info(
          { telegramId, data: ctx.callbackQuery?.data },
          "Routing callback query",
        );
        await callbackQueryHandler.handleCallbackQuery(ctx, next);
      } else {
        logger.warn(
          { telegramId, updateType: ctx.updateType },
          "Unhandled update type",
        );
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
        await next();
      }
    } catch (err) {
      console.error(">>> routeUpdate CAUGHT ERROR:", err);
      logger.error(
        { err, telegramId },
        "Unhandled error during update processing.",
      );
      try {
        logger.error(
          { telegramId, error: err.message },
          "Error processing update, sending error response",
        );
        await ctx.reply(
          "Apologies, an unexpected error occurred while processing your request.",
        );
        logger.debug({ telegramId }, "Error response sent to user");
      } catch (replyErr) {
        console.error(">>> routeUpdate FAILED TO SEND ERROR REPLY:", replyErr);
        logger.error(
          { err: replyErr, originalError: err, telegramId },
          "Error sending error reply to user.",
        );
      }
      // Do not call next() after an error
    } finally {
      // Finally block - no logging needed
    }
  }

  return routeUpdate;
}

module.exports = { initialize };
