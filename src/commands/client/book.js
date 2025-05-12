// src/commands/client/book.js
let localNotifierInstance;
let localLogger;

/**
 * Initializes the book command handler with necessary dependencies.
 * @param {object} deps - Dependencies object.
 * @param {object} deps.notifier - The initialized telegramNotifier instance.
 * @param {object} deps.logger - The logger instance.
 */
function initializeBookCommandHandler(deps) {
  if (!deps || !deps.notifier || !deps.logger) {
    const log = deps.logger || console;
    log.error("[bookCommandHandler] Initialization failed: Missing notifier or logger dependency.");
    // Consider the impact of not having dependencies. For now, it will log an error if used without init.
    return;
  }
  localNotifierInstance = deps.notifier;
  localLogger = deps.logger;
  localLogger.info("[bookCommandHandler] Initialized successfully.");
}

/**
 * Handles the /book command for clients.
 * @param {object} ctx - Telegraf context object.
 */
async function handleBookCommand(ctx) {
  const logger = localLogger || console; // Use localLogger or fallback
  const notifier = localNotifierInstance;

  if (!notifier) {
    logger.error("[/book] Command handler called but notifier instance is not available. Ensure initializeBookCommandHandler was called with dependencies.");
    await ctx.reply("Sorry, the booking service is currently unavailable. Please try again later.");
    return;
  }

  const telegramId = ctx.from.id.toString();
  logger.info({ userId: telegramId }, `[/book] Client command received. Calling sendSessionTypeSelector.`);

  try {
    const result = await notifier.sendSessionTypeSelector({ telegramId });
    // sendSessionTypeSelector handles sending messages to the user, including error messages for some cases.
    // Log any issues reported by the notifier.
    if (result && !result.success) {
      logger.error({ userId: telegramId, error: result.error, warning: result.warning }, "[/book] sendSessionTypeSelector indicated an issue.");
      // If the notifier itself didn't send a message for this specific error, consider a generic one.
      // Example: if (result.error && result.error === "Some specific error not handled by user message in notifier") {
      //   await ctx.reply("An unexpected issue occurred. Please contact support.");
      // }
    }
  } catch (e) {
    logger.error({err: e, userId: telegramId }, "[/book] Exception during sendSessionTypeSelector call.");
    await ctx.reply("Sorry, an unexpected error occurred while trying to start booking.");
  }
}

module.exports = {
  initializeBookCommandHandler,
  handleBookCommand,
};
