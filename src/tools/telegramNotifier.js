const { Markup } = require("telegraf");
const commandRegistry = require("../commands/registry"); // Added registry require
const { toolSchemas } = require("./toolSchemas"); // Import toolSchemas for validation

/**
 * Factory function to create a telegramNotifier instance.
 * @param {object} dependencies - The dependencies needed by the tool.
 * @param {import('telegraf').Telegraf} dependencies.bot - The Telegraf bot instance.
 * @param {import('@prisma/client').PrismaClient} dependencies.prisma - The Prisma client instance.
 * @param {object} dependencies.logger - The Pino logger instance.
 * @param {object} dependencies.config - The environment config object (needs formUrl).
 * @param {object} dependencies.sessionTypes - Session types helper.
 * @returns {object} An object with the notifier functions.
 * @throws {Error} If dependencies or config.formUrl are missing.
 */
function createTelegramNotifier(dependencies) {
  // Check for all required dependencies, including config.formUrl
  if (
    !dependencies ||
    !dependencies.bot ||
    !dependencies.prisma ||
    !dependencies.logger ||
    !dependencies.config ||
    !dependencies.config.formUrl ||
    !dependencies.sessionTypes
  ) {
    const missing = [];
    if (!dependencies) missing.push("dependencies object");
    else {
      if (!dependencies.bot) missing.push("bot");
      if (!dependencies.prisma) missing.push("prisma");
      if (!dependencies.logger) missing.push("logger");
      if (!dependencies.config) missing.push("config");
      // Only check for formUrl if config itself exists
      if (dependencies.config && !dependencies.config.formUrl)
        missing.push("config.formUrl");
      if (!dependencies.sessionTypes) missing.push("sessionTypes");
    }
    const errorMsg = `FATAL: telegramNotifier initialization failed. Missing: ${missing.join(", ")}.`;
    // Use console.error as logger might not be initialized
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Assign dependencies to local constants within the factory scope
  const bot = dependencies.bot;
  const prisma = dependencies.prisma;
  const logger = dependencies.logger;
  const config = dependencies.config;
  const sessionTypes = dependencies.sessionTypes;

  logger.info("[telegramNotifier] Instance created successfully.");

  /**
   * Sends a message containing a button linking to the waiver web app form.
   * Also stores the sent message's ID in the database for potential future edits (e.g., adding confirmation).
   * Call this when the user needs to fill out the waiver form before confirming their booking.
   *
   * @param {object} params - The parameters for sending the waiver link.
   * @param {string|number} params.telegramId - The Telegram User ID to send the message to.
   * @param {string} params.sessionType - The type of session being booked (e.g., '1hr-kambo'). This is included in the waiver link URL parameters.
   * @param {string} [params.messageText] - Optional custom text to display above the waiver button.
   * @returns {Promise<{success: boolean, error?: string, messageId?: number|null, warning?: string}>}
   *          - success: true if the operation was successful (even with warnings).
   *          - error: Description of the error if success is false.
   *          - messageId: The ID of the sent message, or null if it couldn't be retrieved.
   *          - warning: Additional information if the message was sent but message_id wasn't stored/retrieved.
   */
  async function sendWaiverLink({ telegramId, sessionType, messageText }) {
    // Input Validation: Dependencies are guaranteed by factory function scope
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
      `Great! Let's get you scheduled for your ${sessionType} session `;
    // Construct URL
    // Ensure telegramId is a string for the URL and API calls
    const telegramIdStr = String(telegramId);
    const waiverUrl = `${config.formUrl}?telegramId=${telegramIdStr}&sessionType=${encodeURIComponent(sessionType)}`;
    logger.debug(
      { telegramId: telegramIdStr, waiverUrl },
      "[sendWaiverLink] Constructed waiver URL.",
    );

    let sentMessage;
    try {
      // Send Message using Telegraf
      sentMessage = await bot.telegram.sendMessage(
        telegramIdStr, // Use string ID for Telegram API
        message,
        Markup.inlineKeyboard([
          Markup.button.webApp(" Complete Waiver & Book", waiverUrl),
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
   * Use this for general communication, providing information, asking clarifying questions, or sending confirmations that don't require special formatting or buttons.
   *
   * @param {object} params - The function parameters.
   * @param {string|number} params.telegramId - The Telegram chat ID to send the message to.
   * @param {string} params.text - The plain text content of the message.
   * @returns {Promise<{success: boolean, error?: string, messageId?: number}>} A promise that resolves to an object indicating success or failure.
   *   On success: { success: true, messageId: number }
   *   On failure: { success: false, error: string }
   */
  async function sendTextMessage({ telegramId, text }) {
    // First, check if the tool is initialized
    // Dependencies are guaranteed by factory function scope

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
   * Sends a message with session type selection buttons to a Telegram user.
   *
   * @param {object} params - The parameters for sending the selector.
   * @param {string} params.telegramId - The Telegram ID of the recipient.
   * @returns {Promise<object>} An object indicating success, failure, and messageId if successful.
   */
  async function sendSessionTypeSelector({ telegramId }) {
    // Validate input using Zod schema (defined in toolSchemas.js)
    try {
      toolSchemas.sendSessionTypeSelectorSchema.parse({ telegramId });
    } catch (error) {
      logger.error(
        { error: error.errors, telegramId },
        "Invalid input for sendSessionTypeSelector",
      );
      return { success: false, error: "Invalid input", details: error.errors };
    }

    logger.info({ telegramId }, `Attempting to send session type selector...`);

    let types;
    try {
      types = sessionTypes.getAll();
      if (!types || types.length === 0) {
        logger.error("No session types found/configured.");
        return {
          success: false,
          error: "Internal configuration error: No session types available.",
        };
      }
    } catch (error) {
      logger.error({ err: error }, "Error retrieving session types.");
      return {
        success: false,
        error: "Internal error retrieving session types.",
      };
    }

    const buttons = types.map(
      (type) => Markup.button.callback(type.label, `book_session:${type.id}`), // Use type.id
    );
    // Arrange buttons (one per row for clarity)
    const keyboard = Markup.inlineKeyboard(buttons.map((btn) => [btn]));

    const messageText = "Please choose your desired session type:";
    let sentMessage;

    try {
      sentMessage = await bot.telegram.sendMessage(
        telegramId,
        messageText,
        keyboard,
      );
      logger.info(
        { telegramId, messageId: sentMessage?.message_id },
        `Session type selector sent successfully.`,
      );

      if (sentMessage && sentMessage.message_id) {
        // Store the message ID for potential future edits (e.g., after selection)
        try {
          await prisma.users.update({
            where: { telegram_id: BigInt(telegramId) },
            data: { edit_msg_id: sentMessage.message_id },
          });
          logger.debug(
            { telegramId, messageId: sentMessage.message_id },
            "Stored message_id for edits.",
          );
          return { success: true, messageId: sentMessage.message_id };
        } catch (dbError) {
          logger.error(
            { err: dbError, telegramId, messageId: sentMessage.message_id },
            "Database error storing message_id",
          );
          // Return success true because the message was sent, but warn about DB issue
          return {
            success: true,
            messageId: sentMessage.message_id,
            warning: "Database error storing message_id",
          };
        }
      } else {
        logger.warn(
          { telegramId },
          "Telegram did not return a message_id after sending selector.",
        );
        return {
          success: true,
          messageId: null,
          warning: "Message sent, but no message_id received.",
        };
      }
    } catch (error) {
      logger.error(
        { err: error, telegramId },
        `Failed to send session type selector`,
      );
      let userMessage = "Telegram API error";
      if (error.response && error.response.error_code === 400) {
        userMessage =
          "Failed to send selector: Invalid request (e.g., bad chat ID).";
      } else if (error.response && error.response.error_code === 403) {
        userMessage = "Failed to send selector: Bot was blocked by the user.";
      }
      return { success: false, error: userMessage };
    }
  }

  /**
   * Sets the appropriate Telegram command menu (/command) for a specific user based on their role ('client' or 'admin').
   * This ensures users see only the commands relevant to them.
   * Call this after identifying or updating a user's role (e.g., upon first interaction or role change).
   *
   * @param {object} params - The function parameters.
   * @param {string|number} params.telegramId - The user's Telegram ID.
   * @param {'client'|'admin'|string} params.role - The user's role. Currently supports 'client' and 'admin'.
   * @returns {Promise<{success: boolean, error?: string}>} - Object indicating success or failure.
   */
  async function setRoleSpecificCommands({ telegramId, role }) {
    // Dependencies are guaranteed by factory function scope
    if (!telegramId || !role) {
      logger.error("setRoleSpecificCommands: Missing or invalid parameters", {
        telegramId,
        role,
      });
      return { success: false, error: "Missing or invalid parameters" };
    }

    let commandsApiList = [];
    let roleCommands = {};

    switch (role) {
      case "admin":
        roleCommands = { ...commandRegistry.client, ...commandRegistry.admin };
        break;
      case "client":
        roleCommands = commandRegistry.client;
        break;
      default:
        logger.warn(
          `setRoleSpecificCommands: Unknown role '${role}' provided for telegramId ${telegramId}. Setting empty command list.`,
        );
        roleCommands = {}; // Set empty list for unknown roles
        break;
    }

    try {
      // Format for the Telegram Bot API
      commandsApiList = Object.entries(roleCommands).map(
        ([command, details]) => ({
          command: command,
          description: details.descr || "No description available",
        }),
      );

      // Scope commands to the specific user's chat
      const scope = { type: "chat", chat_id: Number(telegramId) };

      logger.info(
        `Setting ${commandsApiList.length} commands for role '${role}' for telegramId ${telegramId}...`,
      );
      const result = await bot.telegram.setMyCommands(commandsApiList, {
        scope,
      });

      if (result) {
        logger.info(
          `Successfully set commands for role '${role}' for telegramId ${telegramId}.`,
        );
        return { success: true };
      } else {
        // This case might not be reachable if the API throws an error on failure, but included for robustness.
        logger.error(
          `Telegram API returned falsy result for setMyCommands for telegramId ${telegramId}.`,
          { result },
        );
        return {
          success: false,
          error: "Telegram API returned non-true result",
        };
      }
    } catch (error) {
      logger.error(
        `Error setting Telegram commands for telegramId ${telegramId}: ${error.message}`,
        { error },
      );
      return { success: false, error: "Telegram API error setting commands" };
    }
  }

  // Return the functions bound to the dependencies from the factory scope
  return {
    sendWaiverLink,
    sendTextMessage,
    sendSessionTypeSelector,
    setRoleSpecificCommands,
  };
}

// Ensure only the factory function is exported
module.exports = {
  createTelegramNotifier,
};
