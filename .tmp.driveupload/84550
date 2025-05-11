/**
 * @fileoverview Telegraf middleware for looking up users in the database.
 *
 * This module follows the dependency injection pattern to allow for easier testing.
 * It requires a Prisma client and a logger to be initialized before use.
 */

// PrismaClient might be needed for future type hints or specific imports
// eslint-disable-next-line no-unused-vars
const { PrismaClient } = require("@prisma/client");

// Module-level variables for dependencies
// These are intentionally not exported to prevent direct manipulation
let prisma = null;
let logger = null;
let isInitialized = false;

/**
 * Initializes the userLookup middleware with required dependencies.
 * Checks for mandatory dependencies and exits if they are missing.
 *
 * @param {object} deps - Dependencies object.
 * @param {PrismaClient} deps.prisma - The Prisma client instance.
 * @param {object} deps.logger - The Pino logger instance.
 */
function initialize(deps) {
  if (!deps.prisma || !deps.logger) {
    // Use console.error for critical init failures before logger might be available
    console.error(
      "FATAL: userLookupMiddleware initialization failed. Missing dependencies (prisma, logger).",
    );
    process.exit(1); // Exit the process for critical initialization failure
  }

  // Set module-level variables
  prisma = deps.prisma;
  logger = deps.logger;
  isInitialized = true;

  // Avoid trying to log if logger is not properly initialized
  if (logger && typeof logger.info === "function") {
    logger.info("[userLookupMiddleware] Initialized successfully.");
  }
}

/**
 * Telegraf middleware to look up a user based on their Telegram ID.
 * Attaches user information or a flag indicating a new user to `ctx.state`.
 *
 * If a user is found, `ctx.state.user` will contain the user object and `ctx.state.isNewUser` will be false.
 * If a user is not found, `ctx.state.user` will be null and `ctx.state.isNewUser` will be true.
 * If an error occurs during lookup (missing ID, DB error), `ctx.state.user` and `ctx.state.isNewUser` will be undefined.
 *
 * @param {object} ctx - The Telegraf context object.
 * @param {Function} next - The next middleware function in the chain.
 * @returns {Promise<void>}
 */
async function userLookupMiddleware(ctx, next) {
  // Check if middleware is initialized
  if (!isInitialized) {
    console.error("FATAL: userLookupMiddleware used before initialization.");
    // Continue to next middleware instead of crashing in production
    await next();
    return;
  }

  ctx.state = ctx.state || {}; // Ensure ctx.state exists

  const telegramIdSource = ctx.from?.id;

  if (!telegramIdSource) {
    logger.warn("User lookup skipped: ctx.from.id is missing.");
    // Can't look up user, but continue processing the update
    await next();
    return;
  }

  let telegramId;
  try {
    telegramId = BigInt(telegramIdSource);
  } catch (error) {
    // Log if the ID is not a valid number format for BigInt
    // Note: BigInt() throws SyntaxError for invalid strings
    logger.error(
      { err: error, telegramIdSource },
      "Failed to convert telegramIdSource to BigInt.",
    );
    // Mark lookup as failed and continue processing
    ctx.state.user = undefined;
    ctx.state.isNewUser = undefined;
    await next();
    return;
  }

  try {
    const user = await prisma.users.findUnique({
      where: { telegram_id: telegramId },
      select: {
        // Select only the fields needed downstream
        client_id: true, // Primary Key
        telegram_id: true,
        role: true,
        state: true,
        first_name: true,
        active_session_id: true,
        // Add other fields if directly needed later
      },
    });

    if (user) {
      ctx.state.user = user;
      ctx.state.isNewUser = false;
      logger.debug(
        { telegramId: user.telegram_id.toString(), role: user.role },
        "User found.",
      );
    } else {
      ctx.state.user = null;
      ctx.state.isNewUser = true;
      logger.info({ telegramId: telegramId.toString() }, "New user detected.");
    }
  } catch (dbError) {
    logger.error(
      { err: dbError, telegramId: telegramId.toString() },
      "Database error during user lookup.",
    );
    // Mark lookup as failed due to DB error
    ctx.state.user = undefined;
    ctx.state.isNewUser = undefined;
    // Continue processing the update despite DB error, downstream logic must handle undefined user state
  }

  // Always call next() to pass control to the next middleware
  await next();
}

module.exports = {
  initialize,
  userLookupMiddleware,
};
