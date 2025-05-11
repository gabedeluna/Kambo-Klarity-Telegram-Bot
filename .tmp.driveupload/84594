const { v4: uuidv4 } = require("uuid");

let logger, stateManager, bookingAgent, telegramNotifier;

/**
 * Initializes the callback query handler module with required dependencies.
 *
 * @param {object} deps - The dependencies object.
 * @param {object} deps.logger - The logger instance.
 * @param {object} deps.stateManager - The state manager instance.
 * @param {object} deps.bookingAgent - The booking agent instance.
 * @param {object} deps.telegramNotifier - The telegram notifier instance.
 * @throws {Error} If any required dependency is missing.
 */
function initialize(deps) {
  if (
    !deps.logger ||
    !deps.stateManager ||
    !deps.bookingAgent ||
    !deps.telegramNotifier
  ) {
    throw new Error("Missing required dependencies for callbackQueryHandler");
  }
  logger = deps.logger;
  stateManager = deps.stateManager;
  bookingAgent = deps.bookingAgent;
  telegramNotifier = deps.telegramNotifier;
  logger.info("callbackQueryHandler initialized successfully.");
}

/**
 * Handles incoming callback queries, specifically for booking session type selection.
 * Extracts session type, updates user state, invokes the booking agent, and edits the original message.
 *
 * @param {object} ctx - The Telegraf context object.
 */
async function handleCallbackQuery(ctx) {
  if (!ctx.callbackQuery?.data) return;

  const telegramId = ctx.from.id.toString();
  const chatId = ctx.chat.id;
  const callbackData = ctx.callbackQuery.data;

  logger.debug({ callbackData, userId: telegramId }, "Handling callback query");

  if (!callbackData.startsWith("book_session:")) {
    logger.debug("Callback data does not match book_session prefix, ignoring.");
    // Acknowledge non-matching callbacks silently?
    try {
      await ctx.answerCbQuery();
    } catch (err) {
      logger.warn(
        { err, userId: telegramId },
        "Failed to answer non-matching callback query",
      );
    }
    return;
  }

  const selectedSessionTypeId = callbackData.split(":")[1];

  // Acknowledge the button press immediately
  try {
    await ctx.answerCbQuery();
  } catch (err) {
    logger.warn(
      { err, userId: telegramId },
      "Failed to answer callback query (likely already answered or expired)",
    );
    // Continue processing even if acknowledgement fails, as the user interaction happened.
  }

  let userProfile, originalMessageId;
  try {
    const profileResult = await stateManager.getUserProfileData({ telegramId });
    if (!profileResult.success || !profileResult.data) {
      throw new Error(
        `User profile fetch failed or profile not found. Success: ${profileResult.success}`,
      );
    }
    userProfile = profileResult.data;
    originalMessageId = userProfile.edit_msg_id;
    if (!originalMessageId) {
      throw new Error("Original message ID (edit_msg_id) not found for user.");
    }
    logger.debug(
      { userId: telegramId, messageId: originalMessageId },
      "Retrieved original message ID.",
    );
  } catch (err) {
    logger.error(
      { err, userId: telegramId },
      "Error fetching profile or edit_msg_id for callback",
    );
    // Notify user about the issue
    await telegramNotifier.sendTextMessage({
      chatId,
      text: "Sorry, I couldn't find the necessary information to proceed with your booking selection. Please try starting the booking again.",
      telegramId: telegramId,
    });
    return; // Stop processing
  }

  const sessionId = uuidv4();

  try {
    // Set active session FIRST
    await stateManager.setActiveSessionId({ telegramId, sessionId });
    // Update state and CLEAR edit_msg_id
    await stateManager.updateUserState({
      telegramId,
      updates: {
        state: "BOOKING",
        session_type: selectedSessionTypeId,
        edit_msg_id: null,
      },
    });
    logger.info(
      { userId: telegramId, sessionId, sessionType: selectedSessionTypeId },
      "User state set to BOOKING, session ID assigned.",
    );
  } catch (err) {
    logger.error(
      { err, userId: telegramId },
      "Error updating user state for callback",
    );
    // Attempt to clear session ID if set?
    await stateManager.setActiveSessionId({ telegramId, sessionId: null }); // Attempt to reset session
    await telegramNotifier.sendTextMessage({
      chatId,
      text: "Sorry, there was an error setting up your booking state. Please try again.",
      telegramId: telegramId,
    });
    return; // Stop processing
  }

  let agentResponse;
  try {
    const initialInput = `User selected session type: ${selectedSessionTypeId}. Start booking conversation.`;
    agentResponse = await bookingAgent.runBookingAgent({
      userInput: initialInput,
      telegramId,
      sessionId,
    }); // Pass sessionId
    if (!agentResponse || !agentResponse.success || !agentResponse.output) {
      throw new Error(
        agentResponse?.error || "Agent did not return a valid response.",
      );
    }
    logger.info(
      { userId: telegramId, sessionId },
      "Agent invoked successfully for first turn.",
    );
  } catch (err) {
    logger.error(
      { err, userId: telegramId, sessionId },
      "Error invoking booking agent on first turn",
    );
    await telegramNotifier.sendTextMessage({
      chatId,
      text: "Sorry, I encountered an error starting the booking process. Please try selecting the session type again later.",
      telegramId: telegramId,
    });
    // Consider resetting state here?
    await stateManager.resetUserState({ telegramId }); // Reset state on agent failure
    return; // Stop processing
  }

  try {
    // Use the retrieved originalMessageId
    await ctx.telegram.editMessageText(
      chatId,
      originalMessageId,
      undefined,
      agentResponse.output,
    );
    logger.info(
      { userId: telegramId, messageId: originalMessageId },
      "Successfully edited original message.",
    );
  } catch (err) {
    logger.error(
      { err, userId: telegramId, messageId: originalMessageId, chatId },
      "Error editing original message text.",
    );
    // Cannot edit message, maybe send agent response as new message?
    await ctx.reply(agentResponse.output); // Send as new if edit fails
    logger.warn(
      { userId: telegramId, messageId: originalMessageId },
      "Sent agent response as a new message due to edit failure.",
    );
  }
}

module.exports = { initialize, handleCallbackQuery };
