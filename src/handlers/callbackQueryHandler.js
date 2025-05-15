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
  if (!ctx.callbackQuery?.data) {
    // If it's not a callback query we're interested in, or no data, just return.
    // Consider calling next() if there could be other callback handlers in the middleware chain.
    // For now, assuming this handler is specific or will explicitly ignore unknown callbacks.
    return;
  }

  const telegramId = ctx.from.id.toString();
  const chatId = ctx.chat.id; // For editing the message
  const callbackData = ctx.callbackQuery.data;

  // Check if it's a session booking callback
  if (!callbackData.startsWith("book_session:")) {
    logger.debug(
      { callbackData, userId: telegramId },
      "Callback data does not match book_session prefix, ignoring.",
    );
    try {
      await ctx.answerCbQuery(); // Acknowledge other callbacks silently
    } catch (err) {
      logger.warn(
        { err, userId: telegramId },
        "Failed to answer non-matching callback query.",
      );
    }
    return; // Or call next() if other handlers might exist
  }

  const selectedSessionTypeId = callbackData.split(":")[1];
  logger.info(
    { userId: telegramId, selectedSessionTypeId },
    "Processing 'book_session' callback.",
  );

  // 1. Acknowledge the button press immediately
  try {
    await ctx.answerCbQuery();
  } catch (err) {
    logger.warn(
      { err, userId: telegramId },
      "Failed to answer 'book_session' callback query (possibly already answered or expired).",
    );
    // Continue processing even if ack fails, as user interaction occurred.
  }

  // 2. Fetch user profile to get edit_msg_id
  let userProfile;
  let originalMessageId;
  try {
    const profileResult = await stateManager.getUserProfileData({ telegramId });
    if (!profileResult.success || !profileResult.data) {
      throw new Error(
        `User profile fetch failed or profile not found for ${telegramId}.`,
      );
    }
    userProfile = profileResult.data;
    originalMessageId = userProfile.edit_msg_id; // This field is on the User model

    if (!originalMessageId) {
      // This can happen if the user clicks an old button after edit_msg_id was cleared,
      // or if there was an issue storing it.
      logger.warn(
        { userId: telegramId },
        "Original message ID (edit_msg_id) not found for user. Cannot edit message. User might be clicking an old button.",
      );
      await telegramNotifier.sendTextMessage({
        telegramId, // Send to user's direct chat
        text: "It seems you clicked an outdated button. Please try starting the booking process again with /book if you wish to proceed.",
      });
      return; // Stop processing
    }
    logger.debug(
      { userId: telegramId, originalMessageId },
      "Retrieved original message ID for editing.",
    );
  } catch (err) {
    logger.error(
      { err, userId: telegramId },
      "Error fetching profile or edit_msg_id for callback.",
    );
    await telegramNotifier.sendTextMessage({
      telegramId,
      text: "Sorry, I couldn't retrieve necessary information to proceed. Please try /book again.",
    });
    return;
  }

  // 3. Generate new unique sessionId
  const sessionId = uuidv4();

  // 4. Update User State
  try {
    await stateManager.setActiveSessionId({ telegramId, sessionId });
    await stateManager.updateUserState(telegramId, {
      state: "BOOKING",
      session_type: selectedSessionTypeId,
      edit_msg_id: null, // Clear it now that we've used it and are editing the message
    });
    logger.info(
      { userId: telegramId, sessionId, sessionType: selectedSessionTypeId },
      "User state updated to BOOKING, session ID assigned, edit_msg_id cleared.",
    );
  } catch (err) {
    logger.error(
      { err, userId: telegramId, sessionId },
      "Error updating user state for booking.",
    );
    await stateManager.clearActiveSessionId({ telegramId }); // Attempt to clear session ID on failure
    await telegramNotifier.sendTextMessage({
      telegramId,
      text: "Sorry, there was an error setting up your booking session. Please try /book again.",
    });
    return;
  }

  // 5. Invoke Booking Agent
  let agentResponse;
  const initialAgentInput = `I'd like to book the "${selectedSessionTypeId}" session.`; // Simplified user input
  try {
    agentResponse = await bookingAgent.runBookingAgent({
      userInput: initialAgentInput,
      telegramId,
      // sessionId is now implicitly handled by bookingAgent through stateManager or memory keying
      // but ensure bookingAgent.runBookingAgent internally uses/retrieves the active_session_id for memory.
      // Let's assume for now runBookingAgent uses the active_session_id stored in the user's profile for memory.
    });

    if (!agentResponse || !agentResponse.success || !agentResponse.output) {
      throw new Error(
        agentResponse?.error || "Agent did not return a valid output.",
      );
    }
    logger.info(
      { userId: telegramId, sessionId },
      "Booking agent invoked successfully for the first turn.",
    );
    // LangSmith Checkpoint: Go to LangSmith UI and verify this interaction is traced.
  } catch (err) {
    logger.error(
      { err, userId: telegramId, sessionId },
      "Error invoking booking agent on first turn.",
    );
    await telegramNotifier.sendTextMessage({
      telegramId,
      text: "Sorry, I encountered an issue initiating our conversation. Please try /book again.",
    });
    await stateManager.resetUserState(telegramId); // Reset state on agent failure
    return;
  }

  // 6. Edit Original Message with Agent's Response
  try {
    await ctx.telegram.editMessageText(
      chatId, // Chat ID where the original message is
      originalMessageId, // Message ID to edit
      undefined, // inline_message_id (not used here)
      agentResponse.output, // New text content
      { parse_mode: "Markdown" }, // Or 'HTML', ensure agent output matches
    );
    logger.info(
      { userId: telegramId, originalMessageId },
      "Successfully edited original selector message with agent's first response.",
    );
  } catch (editErr) {
    logger.error(
      {
        err: editErr,
        userId: telegramId,
        originalMessageId,
        agentOutput: agentResponse.output,
      },
      "Error editing original message text.",
    );
    // Fallback: Send agent's response as a new message if editing fails
    await telegramNotifier.sendTextMessage({
      telegramId,
      text:
        "It seems I couldn't update our previous message, but here's what I have:\n\n" +
        agentResponse.output,
    });
    logger.warn(
      { userId: telegramId },
      "Sent agent response as a new message due to edit failure.",
    );
  }
}

module.exports = { initialize, handleCallbackQuery };
