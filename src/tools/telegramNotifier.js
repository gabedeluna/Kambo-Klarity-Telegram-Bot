/**
 * @fileoverview Tool for sending notifications via Telegram.
 */

const { Markup } = require("telegraf");
const commandRegistry = require('../commands/registry'); // Added registry require

// Module-level variables for dependencies
let bot;
let prisma;
let logger;
let config;

/**
 * Initializes the telegramNotifier tool with required dependencies.
 * @param {object} dependencies - The dependencies needed by the tool.
 * @param {import('telegraf').Telegraf} dependencies.bot - The Telegraf bot instance.
 * @param {import('@prisma/client').PrismaClient} dependencies.prisma - The Prisma client instance.
 * @param {object} dependencies.logger - The Pino logger instance.
 * @param {object} dependencies.config - The environment config object (needs FORM_URL).
 * @throws {Error} If dependencies or config.FORM_URL are missing.
 */
function initialize(dependencies) {
  // Check for all required dependencies, including config.FORM_URL
  if (
    !dependencies ||
    !dependencies.bot ||
    !dependencies.prisma ||
    !dependencies.logger ||
    !dependencies.config ||
    !dependencies.config.FORM_URL
  ) {
    const missing = [];
    if (!dependencies) missing.push("dependencies object");
    else {
      if (!dependencies.bot) missing.push("bot");
      if (!dependencies.prisma) missing.push("prisma");
      if (!dependencies.logger) missing.push("logger");
      if (!dependencies.config) missing.push("config");
      // Only check for FORM_URL if config itself exists
      if (dependencies.config && !dependencies.config.FORM_URL)
        missing.push("config.FORM_URL");
    }
    const errorMsg = `FATAL: telegramNotifier initialization failed. Missing: ${missing.join(", ")}.`;
    // Use console.error as logger might not be initialized
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Assign dependencies to module-level variables
  bot = dependencies.bot;
  prisma = dependencies.prisma;
  logger = dependencies.logger;
  config = dependencies.config;
  logger.info("[telegramNotifier] Initialized successfully.");
}

/**
 * Sends a message containing the waiver web app link to the specified user
 * and stores the sent message's ID for potential future edits (e.g., confirmation).
 *
 * @param {object} params - The parameters for sending the waiver link.
 * @param {string|number} params.telegramId - The Telegram User ID to send the message to.
 * @param {string} params.sessionType - The type of session being booked (e.g., '1hr-kambo').
 * @param {string} [params.messageText] - Optional custom text to precede the button.
 * @returns {Promise<{success: boolean, error?: string, messageId?: number|null, warning?: string}>}
 *          - success: true if the operation was successful (even with warnings).
 *          - error: Description of the error if success is false.
 *          - messageId: The ID of the sent message, or null if it couldn't be retrieved.
 *          - warning: Additional information if the message was sent but message_id wasn't stored/retrieved.
 */
async function sendWaiverLink({ telegramId, sessionType, messageText }) {
  // Input Validation: Check dependencies are initialized
  if (!bot || !prisma || !logger || !config) {
    // Use console.error as logger might not be available
    console.error(
      "[sendWaiverLink] FATAL: Notifier not initialized. Call initialize() first.",
    );
    return {
      success: false,
      error: "Internal server error: Notifier not initialized",
    };
  }

  // Input Validation: Check specific parameters for this function
  if (!telegramId || !sessionType) {
    logger.error(
      { telegramId, sessionType },
      "[sendWaiverLink] Failed: Missing required parameters.",
    );
    return { success: false, error: "Missing parameters" };
  }

  // Construct Message
  const message =
    messageText ||
    `Great! Let's get you scheduled for your ${sessionType} session 🐸`;

  // Construct URL
  // Ensure telegramId is a string for the URL and API calls
  const telegramIdStr = String(telegramId);
  const formUrl = `${config.FORM_URL}/booking-form.html?telegramId=${telegramIdStr}&sessionType=${encodeURIComponent(sessionType)}`;
  logger.debug(
    { telegramId: telegramIdStr, formUrl },
    "[sendWaiverLink] Constructed form URL.",
  );

  let sentMessage;
  try {
    // Send Message using Telegraf
    sentMessage = await bot.telegram.sendMessage(
      telegramIdStr, // Use string ID for Telegram API
      message,
      Markup.inlineKeyboard([
        Markup.button.webApp("📝 Complete Waiver & Book", formUrl),
      ]),
    );
    logger.info(
      { telegramId: telegramIdStr, messageId: sentMessage?.message_id },
      "[sendWaiverLink] Waiver link message sent successfully.",
    );
  } catch (err) {
    // Log the error appropriately
    const logDetails = { telegramId: telegramIdStr };
    if (err.response && err.description) {
      // Telegraf API error structure
      logDetails.errorCode = err.code;
      logDetails.errorDescription = err.description;
    } else {
      // General error
      logDetails.error = err.message;
      logDetails.stack = err.stack; // Include stack for debugging
    }
    logger.error(
      logDetails,
      "[sendWaiverLink] Failed to send waiver link message via Telegram API.",
    );
    return { success: false, error: "Telegram API error" };
  }

  // Store Message ID using Prisma
  if (sentMessage && sentMessage.message_id) {
    try {
      // Ensure telegramId is BigInt for Prisma schema
      const telegramIdBigInt = BigInt(telegramIdStr);
      await prisma.users.update({
        where: { telegram_id: telegramIdBigInt },
        data: { edit_msg_id: sentMessage.message_id },
      });
      logger.info(
        { telegramId: telegramIdStr, messageId: sentMessage.message_id },
        "[sendWaiverLink] Stored edit_msg_id successfully.",
      );
      return { success: true, messageId: sentMessage.message_id };
    } catch (dbErr) {
      logger.error(
        {
          err: dbErr,
          telegramId: telegramIdStr,
          messageId: sentMessage.message_id,
        },
        "[sendWaiverLink] Failed to store edit_msg_id in database.",
      );
      // Return success:true because message was sent, but include a warning.
      return {
        success: true,
        messageId: sentMessage.message_id,
        warning: "Message sent but failed to store message_id in DB",
      };
    }
  } else {
    // Message sent but no message_id received from Telegram
    logger.warn(
      { telegramId: telegramIdStr, sentMessageDetails: !!sentMessage },
      "[sendWaiverLink] Message sent, but message_id was missing in the Telegram response.",
    );
    return {
      success: true,
      messageId: null,
      warning: "Message sent but message_id missing",
    };
  }
}

/**
 * Sends a simple text message to a given Telegram user ID.
 *
 * @param {object} params - The function parameters.
 * @param {string|number} params.telegramId - The Telegram chat ID to send the message to.
 * @param {string} params.text - The text content of the message.
 * @returns {Promise<object>} A promise that resolves to an object indicating success or failure.
 *   On success: { success: true, messageId: number }
 *   On failure: { success: false, error: string }
 */
async function sendTextMessage({ telegramId, text }) {
  // First, check if the tool is initialized
  if (!bot || !logger) {
    // Cannot use logger here as it might be null
    console.error(
      "Telegram Notifier tool not initialized before calling sendTextMessage.",
    ); // Log to console as fallback
    return { success: false, error: "Tool not initialized" };
  }

  // Now perform parameter validation
  if (!telegramId || typeof text !== "string" || text.trim() === "") {
    logger.error(
      { telegramId, text },
      "Missing or invalid parameters for sendTextMessage",
    );
    return { success: false, error: "Missing or invalid parameters" };
  }

  try {
    logger.debug({ telegramId, text }, "Attempting to send text message...");
    const result = await bot.telegram.sendMessage(telegramId, text);
    logger.info(
      { telegramId, messageId: result.message_id },
      "Text message sent successfully.",
    );
    return { success: true, messageId: result.message_id };
  } catch (error) {
    // TODO: Consider adding specific error handling (e.g., for 403 Forbidden, 400 Bad Request)
    logger.error("Error sending Telegram message:", error);
    return { success: false, error: "Failed to send Telegram message" };
  }
}

/**
 * Sets the appropriate command list for a specific user in Telegram based on their role.
 * Uses the command registry to fetch commands for 'client' and 'admin' roles.
 *
 * @param {object} params - The function parameters.
 * @param {string|number} params.telegramId - The user's Telegram ID.
 * @param {'client'|'admin'|string} params.role - The user's role.
 * @returns {Promise<{success: boolean, error?: string}>} - Object indicating success or failure.
 */
async function setRoleSpecificCommands({ telegramId, role }) {
  if (!bot || !logger || !commandRegistry) {
    logger.error('setRoleSpecificCommands: Missing or invalid dependencies', { telegramId, role });
    return { success: false, error: 'Missing or invalid dependencies' };
  }

  if (!telegramId || !role) {
    logger.error('setRoleSpecificCommands: Missing or invalid parameters', { telegramId, role });
    return { success: false, error: 'Missing or invalid parameters' };
  }

  let commandsApiList = [];
  let roleCommands = {};

  switch (role) {
    case 'admin':
      roleCommands = { ...commandRegistry.client, ...commandRegistry.admin };
      break;
    case 'client':
      roleCommands = commandRegistry.client;
      break;
    default:
      logger.warn(`setRoleSpecificCommands: Unknown role '${role}' provided for telegramId ${telegramId}. Setting empty command list.`);
      roleCommands = {}; // Set empty list for unknown roles
      break;
  }

  try {
    // Format for the Telegram Bot API
    commandsApiList = Object.entries(roleCommands).map(([command, details]) => ({
      command: command,
      description: details.descr || 'No description available',
    }));

    // Scope commands to the specific user's chat
    const scope = { type: 'chat', chat_id: Number(telegramId) };

    logger.info(`Setting ${commandsApiList.length} commands for role '${role}' for telegramId ${telegramId}...`);
    const result = await bot.telegram.setMyCommands(commandsApiList, { scope });

    if (result) {
      logger.info(`Successfully set commands for role '${role}' for telegramId ${telegramId}.`);
      return { success: true };
    } else {
      // This case might not be reachable if the API throws an error on failure, but included for robustness.
      logger.error(`Telegram API returned falsy result for setMyCommands for telegramId ${telegramId}.`, { result });
      return { success: false, error: 'Telegram API returned non-true result' };
    }
  } catch (error) {
    logger.error(`Error setting Telegram commands for telegramId ${telegramId}: ${error.message}`, { error });
    return { success: false, error: 'Telegram API error setting commands' };
  }
}

// Ensure only the intended functions are exported
module.exports = {
  initialize,
  sendWaiverLink,
  sendTextMessage,
  setRoleSpecificCommands,
};
