const { Markup } = require("telegraf");
const commandRegistry = require("../commands/registry"); // Added registry require
// Schema validation removed as toolSchemas is no longer used

/**
 * Factory function to create a telegramNotifier instance.
 * @param {object} dependencies - The dependencies needed by the tool.
 * @param {import('telegraf').Telegraf} dependencies.bot - The Telegraf bot instance.
 * @param {import('@prisma/client').PrismaClient} dependencies.prisma - The Prisma client instance.
 * @param {object} dependencies.logger - The Pino logger instance.
 * @param {object} dependencies.config - The environment config object (needs formUrl).
 * @param {object} dependencies.sessionTypes - Session types helper.
 * @param {object} dependencies.stateManager - The state manager instance.
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
    !dependencies.sessionTypes ||
    !dependencies.stateManager // Added stateManager check
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
      if (!dependencies.stateManager) missing.push("stateManager"); // Added stateManager to missing check
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
  const stateManager = dependencies.stateManager; // Assign stateManager

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
      // logger.info(
      //   { telegramId, messageId: result.message_id },
      //   "Text message sent successfully.",
      // );
      return { success: true, messageId: result.message_id };
    } catch (error) {
      logger.error({ err: error, telegramId }, `Failed to send text message`);
      // Add specific error handling based on Telegram API error codes
      let userMessage = "Failed to send Telegram message"; // Default message
      if (error.response && error.response.error_code === 400) {
        userMessage = "Invalid request (e.g., bad chat ID).";
      } else if (error.response && error.response.error_code === 403) {
        userMessage = "Bot was blocked by the user.";
      } else if (error.message) {
        // Use error.message if available and no specific code matched
        userMessage = error.message;
      }
      return { success: false, error: userMessage };
    }
  }

  /**
   * Sends a message to the user allowing them to select a session type.
   * Fetches session types from the database via `core/sessionTypes.js`.
   * Displays an inline keyboard with buttons for each available session type.
   * Stores the `message_id` of the sent selector message in `user.edit_msg_id` using `stateManager`.
   *
   * @param {object} params - The parameters for sending the session type selector.
   * @param {string|number} params.telegramId - The Telegram User ID to send the message to.
   * @returns {Promise<{success: boolean, messageId?: number, error?: string, warning?: string}>}
   *          - success: true if the operation was successful.
   *          - messageId: The ID of the sent message, or null if it couldn't be retrieved/stored.
   *          - error: Description of the error if success is false.
   *          - warning: Additional information if the message was sent but message_id wasn't stored or an issue occurred.
   */
  async function sendSessionTypeSelector({ telegramId }) {
    if (!telegramId) {
      logger.error(
        { telegramId },
        "[sendSessionTypeSelector] Failed: Missing telegramId.",
      );
      return { success: false, error: "Missing telegramId" };
    }

    const telegramIdStr = String(telegramId);
    logger.info(
      { userId: telegramIdStr },
      "[sendSessionTypeSelector] Request received.",
    );

    // Fetch user profile data to check can_book_3x3 permission
    const userProfileResult = await stateManager.getUserProfileData({
      telegramId: telegramIdStr,
    });
    if (!userProfileResult.success || !userProfileResult.data) {
      logger.error(
        { telegramId: telegramIdStr },
        "[sendSessionTypeSelector] Failed to fetch user profile.",
      );
      await bot.telegram.sendMessage(
        telegramIdStr,
        "Sorry, we encountered an issue retrieving your profile. Please try again shortly.",
      );
      return { success: false, error: "Could not retrieve user information." };
    }

    const userCanBook3x3 = userProfileResult.data.can_book_3x3 || false; // Default to false if undefined
    // We retrieve edit_msg_id but don't need to use it directly as we'll set a new one after sending the message
    // const currentEditMsgId = userProfileResult.data.edit_msg_id;

    logger.info(
      { userId: telegramIdStr, canBook3x3: userCanBook3x3 },
      "[sendSessionTypeSelector] User permissions retrieved.",
    );

    // Fetch all active session types
    let allActiveSessionTypes;
    try {
      allActiveSessionTypes = await sessionTypes.getAll({ active: true }); // Fetch active session types
      if (!allActiveSessionTypes || allActiveSessionTypes.length === 0) {
        logger.warn(
          { userId: telegramIdStr },
          "[sendSessionTypeSelector] No active session types found.",
        );
        await bot.telegram.sendMessage(
          telegramIdStr,
          "Sorry, there are currently no session types available for booking. Please check back later or contact an admin.",
        );
        return { success: false, error: "No active session types available" };
      }
      logger.info(
        { userId: telegramIdStr, count: allActiveSessionTypes.length },
        "[sendSessionTypeSelector] Fetched active session types.",
      );
    } catch (dbErr) {
      logger.error(
        { err: dbErr, userId: telegramIdStr },
        "[sendSessionTypeSelector] Error fetching session types from DB.",
      );
      await bot.telegram.sendMessage(
        telegramIdStr,
        "Sorry, we encountered an issue retrieving session types. Please try again shortly.",
      );
      return { success: false, error: "Database error fetching session types" };
    }

    // Filter session types based on can_book_3x3 permission
    const threeByThreeId = "3hr-kambo"; // ID of the 3x3 Kambo session type
    let displayableSessionTypes = allActiveSessionTypes;

    if (!userCanBook3x3) {
      displayableSessionTypes = displayableSessionTypes.filter(
        (type) => type.id !== threeByThreeId,
      );
      logger.info(
        {
          userId: telegramIdStr,
          filteredCount: displayableSessionTypes.length,
        },
        "[sendSessionTypeSelector] Filtered out 3x3 session type.",
      );
    }

    if (displayableSessionTypes.length === 0) {
      logger.info(
        { telegramId: telegramIdStr },
        "[sendSessionTypeSelector] No displayable session types for this user after filtering.",
      );
      await bot.telegram.sendMessage(
        telegramIdStr,
        "Sorry, there are currently no session types available for you to book.",
      );
      return { success: true, messageId: null };
    }

    let messageText = "Please choose your desired session type:\n";
    displayableSessionTypes.forEach((type) => {
      const label = type.label || "Unnamed Session";
      const duration = type.durationMinutes
        ? `(${type.durationMinutes} minutes)`
        : "(Duration not specified)";
      const description = type.description || "No description available.";
      messageText += `\n\n*${label}* ${duration}\n_${description}_`; // Using Markdown
    });

    const buttons = displayableSessionTypes
      .map((type) => {
        if (!type.id || !type.label) {
          logger.warn(
            { userId: telegramIdStr, typeId: type.id },
            "[sendSessionTypeSelector] Session type missing id or label.",
          );
          return null;
        }

        // Use the original label format
        const buttonLabel = type.label;

        // Create a web app URL using config.formUrl
        const calendarAppUrl = `${config.formUrl}/calendar-app.html?telegramId=${telegramIdStr}&sessionTypeId=${type.id}`;
        return Markup.button.webApp(buttonLabel, calendarAppUrl);
      })
      .filter((button) => button !== null);

    if (buttons.length === 0) {
      logger.warn(
        { userId: telegramIdStr },
        "[sendSessionTypeSelector] No valid buttons could be created.",
      );
      await bot.telegram.sendMessage(
        telegramIdStr,
        "Sorry, we encountered an issue with the available session types. Please try again later.",
      );
      return { success: false, error: "No valid buttons could be created" };
    }

    const keyboard = Markup.inlineKeyboard(buttons.map((btn) => [btn]));

    let sentMessage;
    try {
      sentMessage = await bot.telegram.sendMessage(telegramIdStr, messageText, {
        ...keyboard,
        parse_mode: "Markdown",
      });
      logger.info(
        { userId: telegramIdStr, messageId: sentMessage?.message_id },
        "[sendSessionTypeSelector] Session type selector sent.",
      );
    } catch (sendErr) {
      logger.error(
        { err: sendErr, userId: telegramIdStr },
        "[sendSessionTypeSelector] Error sending session type selector message.",
      );
      // Don't send another message here, as the primary send failed.
      return { success: false, error: "Telegram API error sending selector" };
    }

    if (sentMessage && sentMessage.message_id) {
      try {
        const updateResult = await stateManager.updateUserState(
          telegramIdStr, // Pass telegramIdStr directly as the first argument
          { edit_msg_id: sentMessage.message_id }, // Pass the updates object as the second argument
        );
        if (!updateResult.success) {
          logger.warn(
            {
              userId: telegramIdStr,
              messageId: sentMessage.message_id,
              error: updateResult.error,
            },
            "[sendSessionTypeSelector] stateManager failed to store edit_msg_id, but message was sent.",
          );
          return {
            success: true,
            messageId: sentMessage.message_id,
            warning:
              "Message sent, but failed to store edit_msg_id via stateManager.",
          };
        }
        logger.info(
          { userId: telegramIdStr, messageId: sentMessage.message_id },
          "[sendSessionTypeSelector] Stored edit_msg_id using stateManager.",
        );
        return { success: true, messageId: sentMessage.message_id };
      } catch (smErr) {
        logger.error(
          {
            err: smErr,
            userId: telegramIdStr,
            messageId: sentMessage.message_id,
          },
          "[sendSessionTypeSelector] Exception calling stateManager to store edit_msg_id.",
        );
        return {
          success: true,
          messageId: sentMessage.message_id,
          warning:
            "Message sent, but exception during stateManager call for edit_msg_id.",
        };
      }
    } else {
      logger.warn(
        { userId: telegramIdStr },
        "[sendSessionTypeSelector] Message sent, but message_id was missing in Telegram response.",
      );
      return {
        success: true,
        messageId: null,
        warning: "Message sent but message_id missing from Telegram response",
      };
    }
  }

  /**
   * Sends a notification message to all registered administrators.
   * Finds users with the 'admin' role via Prisma and sends them the provided text message.
   * Use this for system alerts, new user registrations, or other events requiring admin attention.
   *
   * @param {object} params - The parameters for the notification.
   * @param {string} params.text - The text message content to send to admins.
   * @returns {Promise<{success: boolean, errors: Array<{adminId: number, error: string}>}>}
   *          - success: true if notifications were attempted for all found admins (even if some failed).
   *          - errors: An array of objects detailing any failures for specific admins.
   */
  async function sendAdminNotification({ text }) {
    const errors = [];
    if (!text) {
      logger.error("sendAdminNotification: Missing required 'text' parameter.");
      return {
        success: false,
        errors: [{ adminId: -1, error: "Missing text parameter" }],
      };
    }

    let adminUsers;
    try {
      adminUsers = await prisma.users.findMany({
        where: { role: "admin" },
        select: { telegram_id: true, first_name: true, last_name: true }, // Fetch names
      });
      logger.info(`Found ${adminUsers.length} admin users to notify.`);
    } catch (dbError) {
      logger.error(
        { err: dbError },
        "Error fetching admin users from database.",
      );
      return {
        success: false,
        errors: [{ adminId: -1, error: "Database error fetching admins" }],
      };
    }

    // Use Promise.allSettled to send messages concurrently and collect results
    const notificationPromises = adminUsers.map((admin) => {
      const telegramIdString = String(admin.telegram_id);
      const adminName =
        `${admin.first_name || ""} ${admin.last_name || ""}`.trim() ||
        "Unknown Admin";
      logger.debug(
        `Attempting to send admin notification to ${adminName} (ID: ${telegramIdString})`,
      );
      // Call the existing sendTextMessage function
      return sendTextMessage({ telegramId: telegramIdString, text })
        .then((result) => ({ ...result, adminId: telegramIdString, adminName })) // Add adminId and adminName for tracking
        .catch((err) => ({
          success: false,
          error: err.message || "Unknown send error",
          adminId: telegramIdString,
          adminName,
        })); // Catch errors in sendTextMessage itself
    });

    const results = await Promise.allSettled(notificationPromises);

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        const {
          success,
          error,
          adminId,
          adminName: currentAdminName,
        } = result.value;
        if (!success) {
          logger.warn(
            { adminId, adminName: currentAdminName, error },
            `Failed to send notification to admin.`,
          );
          errors.push({
            adminId: adminId,
            adminName: currentAdminName, // Include name in error object
            error: error || "Failed via sendTextMessage",
          });
        } else {
          logger.info(
            `Admin notification sent successfully to: ${currentAdminName} (ID: ${adminId})`,
          );
        }
      } else {
        // This usually indicates an error *before* sendTextMessage finished (e.g., within the .then/.catch)
        logger.error(
          { reason: result.reason },
          `Unexpected error processing admin notification promise.`,
        );
        // We might not have adminId reliably here depending on where the error occurred
        errors.push({
          adminId: result.reason?.adminId || "unknown",
          adminName: result.reason?.adminName || "unknown",
          error: result.reason?.message || "Promise rejected unexpectedly",
        });
      }
    });

    if (errors.length > 0) {
      logger.warn(
        `sendAdminNotification completed with ${errors.length} failures.`,
      );
    }

    // Return success true even if individual sends failed, as the overall operation was attempted
    // The 'errors' array provides details on specific failures.
    return { success: true, errors };
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
    sendSessionTypeSelector, // Export the new function
    sendAdminNotification, // Keep existing exports
    setRoleSpecificCommands,
  };
}

// Ensure only the factory function is exported
module.exports = {
  createTelegramNotifier,
};
