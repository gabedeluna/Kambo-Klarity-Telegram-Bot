const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const config = require("../core/env");

let logger, stateManager, telegramNotifier;

/**
 * Initializes the callback query handler module with required dependencies.
 *
 * @param {object} deps - The dependencies object.
 * @param {object} deps.logger - The logger instance.
 * @param {object} deps.stateManager - The state manager instance.
 * @param {object} deps.telegramNotifier - The telegram notifier instance.
 * @throws {Error} If any required dependency is missing.
 */
function initialize(deps) {
  if (!deps.logger || !deps.stateManager || !deps.telegramNotifier) {
    throw new Error("Missing required dependencies for callbackQueryHandler");
  }
  logger = deps.logger;
  stateManager = deps.stateManager;
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
  const _chatId = ctx.chat.id; // For editing the message
  const callbackData = ctx.callbackQuery.data;

  // Check if it's a session booking callback
  if (callbackData.startsWith("book_session:")) {
    await handleBookSessionCallback(ctx, telegramId, callbackData);
    return;
  }

  // Check if it's a decline invite callback
  if (callbackData.startsWith("decline_invite_")) {
    await handleDeclineInviteCallback(ctx, telegramId, callbackData);
    return;
  }

  // Unknown callback pattern
  logger.debug(
    { callbackData, userId: telegramId },
    "Callback data does not match known patterns, ignoring.",
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

/**
 * Handles book_session callback queries
 */
async function handleBookSessionCallback(ctx, telegramId, callbackData) {
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

  // Agent invocation and subsequent message editing removed.
  // The user's state is updated, but no further agent interaction occurs here.
  // The original message with the inline keyboard will remain as is.
  // A new flow would be needed to guide the user after this point.
  logger.info(
    { userId: telegramId, sessionId },
    "User selected session type. Agent interaction has been removed from this handler.",
  );
  // Optionally, edit the message to remove the keyboard or provide a static message.
  // For now, per plan, only removing agent-specific logic.
  // Example:
  // try {
  //   await ctx.telegram.editMessageText(
  //     chatId,
  //     originalMessageId,
  //     undefined,
  //     `You selected: ${selectedSessionTypeId}. Further booking steps are TBD.`,
  //     { reply_markup: { remove_keyboard: true } } // Or remove inline keyboard
  //   );
  // } catch (editErr) {
  //    logger.error({ err: editErr, userId: telegramId }, "Failed to edit message after agent removal.");
  // }
}

/**
 * Handles decline_invite callback queries
 */
async function handleDeclineInviteCallback(ctx, telegramId, callbackData) {
  const inviteToken = callbackData.replace("decline_invite_", "");

  // Validate token format
  if (!inviteToken || inviteToken.length === 0) {
    logger.warn(
      { userId: telegramId, callbackData },
      "[callback] Malformed decline invite token.",
    );
    try {
      await ctx.answerCbQuery("Invalid invitation link.");
    } catch (err) {
      logger.warn(
        { err, userId: telegramId },
        "Failed to answer callback query for malformed token.",
      );
    }
    return;
  }

  logger.info(
    { userId: telegramId, inviteToken },
    "[callback] Processing decline invite callback.",
  );

  // Acknowledge the button press immediately
  try {
    await ctx.answerCbQuery();
  } catch (err) {
    logger.warn(
      { err, userId: telegramId },
      "[callback] Failed to answer decline invite callback query.",
    );
    // Continue processing even if ack fails
  }

  // Call the friend response API
  try {
    const apiUrl = `${config.ngrokUrl}/api/session-invites/${inviteToken}/respond`;

    logger.debug(
      { userId: telegramId, apiUrl },
      "[callback] Calling decline invite API.",
    );

    await axios.post(
      apiUrl,
      { response: "declined" },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    // const responseData = response.data;

    logger.info(
      { userId: telegramId, inviteToken },
      "[callback] Friend declined invite successfully.",
    );

    // Optionally edit the original message to show declined status
    try {
      await ctx.editMessageText(
        "You have declined this invitation.",
        { reply_markup: { inline_keyboard: [] } }, // Remove buttons
      );
    } catch (editErr) {
      logger.debug(
        { err: editErr, userId: telegramId },
        "[callback] Could not edit message after decline (may be old message).",
      );
    }
  } catch (err) {
    // Handle axios errors specifically
    if (err.response) {
      const status = err.response.status;
      const errorData = err.response.data || {};

      logger.warn(
        { userId: telegramId, status, error: errorData },
        "[callback] API error declining invite.",
      );

      let errorMessage = "Sorry, there was an issue processing your response.";
      if (status === 404) {
        errorMessage = "Sorry, this invitation is no longer valid.";
      } else if (status === 409) {
        errorMessage = "This invitation has already been responded to.";
      }

      try {
        await ctx.answerCbQuery(errorMessage);
      } catch (cbErr) {
        logger.warn(
          { err: cbErr, userId: telegramId },
          "Failed to send error callback response.",
        );
      }
    } else {
      // Network error or other issue
      logger.error(
        { err, userId: telegramId, inviteToken },
        "[callback] Error calling decline invite API.",
      );

      try {
        await ctx.answerCbQuery(
          "Sorry, there was an issue processing your response. Please try again.",
        );
      } catch (cbErr) {
        logger.warn(
          { err: cbErr, userId: telegramId },
          "Failed to send network error callback response.",
        );
      }
    }
  }
}

module.exports = { initialize, handleCallbackQuery };
