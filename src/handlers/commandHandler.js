/**
 * @fileoverview Handles incoming Telegram commands by looking them up in the registry
 * and executing the corresponding handler function.
 */

const commandRegistry = require("../commands/registry");

let dependencies = {};

/**
 * Initializes the command handler.
 * @param {object} deps - Dependencies (currently just logger).
 * @param {object} deps.logger - Pino logger instance.
 */
function initialize(deps) {
  if (!deps || !deps.logger) {
    throw new Error("CommandHandler requires logger dependency.");
  }
  dependencies = deps;
  dependencies.logger.info("[commandHandler] Initialized.");
}

/**
 * Parses and handles an incoming command message.
 * @param {object} ctx - Telegraf context object.
 */
async function handleCommand(ctx) {
  const { logger: log } = dependencies; // Use injected logger
  const command = ctx.message.text.split(" ")[0].substring(1); // Extract command without '/'
  const userRole = ctx.state.user?.role || "client";
  const userId = ctx.state.user?.id || ctx.from?.id;

  log.info({ command, userRole, userId }, `Attempting to handle command.`);

  let commandDefinition;
  if (userRole === "admin" && commandRegistry.admin[command]) {
    commandDefinition = commandRegistry.admin[command];
  } else if (commandRegistry.client[command]) {
    // Fallback to client commands if not found in admin or if user is client
    commandDefinition = commandRegistry.client[command];
  } else if (commandRegistry.admin[command]) {
    // Handle case where client tries admin command (maybe log or specific reply?)
    log.warn(
      { command, userId, userRole },
      "Client attempted to use an admin-only command.",
    );
    // For now, treat as unknown command for the client
    commandDefinition = null;
  }

  if (commandDefinition && typeof commandDefinition.handler === "function") {
    log.info({ command, userRole, userId }, `Executing handler for command.`);
    try {
      await commandDefinition.handler(ctx);
    } catch (error) {
      log.error(
        { err: error, command, userId },
        "Error executing command handler.",
      );
      try {
        await ctx.reply(
          "Sorry, an error occurred while processing that command.",
        );
      } catch (replyError) {
        log.error(
          { err: replyError, userId },
          "Failed to send error reply for command handler failure.",
        );
      }
    }
  } else {
    log.warn({ command, userRole, userId }, `No handler found for command.`);
    await ctx.reply(`Unknown command: /${command}. Try /help.`);
  }
  // Decide if we should call next() after handling a command or stop processing
  // For now, assume command handling is terminal for this update
  // return next();
}

module.exports = {
  initialize,
  handleCommand,
};
