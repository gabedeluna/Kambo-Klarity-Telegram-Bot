// src/middleware/commandRouter.js
let logger;
let commandRegistry;

/**
 * Initializes the commandRouter middleware with dependencies.
 * @param {object} deps - Dependencies object.
 * @param {object} deps.logger - Logger instance.
 * @param {object} deps.commandRegistry - The command registry object.
 */
function initialize(deps) {
  if (!deps.logger || !deps.commandRegistry) {
    console.error(
      "FATAL [commandRouter]: Initialization failed. Missing 'logger' or 'commandRegistry'.",
    );
    process.exit(1);
  }
  logger = deps.logger;
  commandRegistry = deps.commandRegistry;
  logger.info("[commandRouterMiddleware] Initialized successfully.");
}

/**
 * Telegraf middleware to route commands based on user role.
 */
async function commandRouterMiddleware(ctx, next) {
  if (!ctx.message?.text?.startsWith("/") || !ctx.state?.user) {
    logger.debug(
      "[commandRouter] Not a command or no user state. Passing to next middleware.",
    );
    return next(); // Not a command for this router, or prerequisites not met
  }

  const commandTextParts = ctx.message.text.substring(1).split(" ");
  const commandName = commandTextParts[0].toLowerCase(); // Ensure only first part is command
  const userRole = ctx.state.user.role || "client"; // Default to 'client' if role not set
  const userId = ctx.state.user.telegram_id;

  logger.info(
    { userId, userRole, command: commandName },
    "[commandRouter] Attempting to route command.",
  );

  let handlerInfo = null;
  if (commandRegistry[userRole] && commandRegistry[userRole][commandName]) {
    handlerInfo = commandRegistry[userRole][commandName];
  }

  if (handlerInfo && typeof handlerInfo.handler === "function") {
    logger.info(
      {
        userId,
        command: commandName,
        handlerName: handlerInfo.handler.name || "anonymous",
      },
      `[commandRouter] Executing handler for command '${commandName}'.`,
    );
    try {
      await handlerInfo.handler(ctx);
    } catch (handlerError) {
      logger.error(
        { err: handlerError, userId, command: commandName },
        "[commandRouter] Error executing command handler.",
      );
      await ctx
        .reply("Sorry, an error occurred while processing your command.")
        .catch((e) =>
          logger.error({ e }, "Failed to send error reply in command router"),
        );
    }
  } else {
    logger.warn(
      { userId, userRole, command: commandName },
      "[commandRouter] No handler found for command for this role, or command is unknown.",
    );
    await ctx
      .reply(
        "Unknown command or you are not authorized. Type /help for commands available to you.",
      )
      .catch((e) =>
        logger.error({ e }, "Failed to send unknown command reply"),
      );
  }
  return; // Command processed (or deemed unknown/unauthorized), stop further middleware processing for this update.
}

module.exports = {
  initialize,
  commandRouterMiddleware,
};
