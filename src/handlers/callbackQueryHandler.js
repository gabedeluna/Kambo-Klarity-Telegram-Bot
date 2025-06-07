const { v4: uuidv4 } = require("uuid");

let logger, stateManager, telegramNotifier, prisma;

/**
 * Initializes the callback query handler module with required dependencies.
 *
 * @param {object} deps - The dependencies object.
 * @param {object} deps.logger - The logger instance.
 * @param {object} deps.stateManager - The state manager instance.
 * @param {object} deps.telegramNotifier - The telegram notifier instance.
 * @param {object} deps.prisma - The prisma client instance.
 * @throws {Error} If any required dependency is missing.
 */
function initialize(deps) {
  if (
    !deps.logger ||
    !deps.stateManager ||
    !deps.telegramNotifier ||
    !deps.prisma
  ) {
    throw new Error("Missing required dependencies for callbackQueryHandler");
  }
  logger = deps.logger;
  stateManager = deps.stateManager;
  telegramNotifier = deps.telegramNotifier;
  prisma = deps.prisma;
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
 * Handles decline_invite callback queries using direct database access
 */
async function handleDeclineInviteCallback(ctx, telegramId, callbackData) {
  const inviteToken = callbackData.replace("decline_invite_", "");
  const friendTelegramId = telegramId;

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
    { callbackData, userId: telegramId },
    "Processing decline_invite callback.",
  );

  // Acknowledge the button press immediately with proper message
  try {
    await ctx.answerCbQuery("Your decline has been recorded. Thank you.");
  } catch (err) {
    logger.warn(
      { err, userId: telegramId },
      "[callback] Failed to answer decline invite callback query.",
    );
    // Continue processing even if ack fails
  }

  try {
    // Fetch the SessionInvite with all required relations
    const sessionInvite = await prisma.sessionInvite.findFirst({
      where: { inviteToken },
      include: {
        parentSession: {
          include: {
            user: true,
            sessionType: true,
          },
        },
      },
    });

    if (!sessionInvite) {
      logger.warn(
        { token: inviteToken },
        "[decline] Session invite not found.",
      );
      try {
        await ctx.editMessageText("This invitation is no longer valid.", {
          reply_markup: { inline_keyboard: [] },
        });
      } catch (editErr) {
        logger.debug(
          { err: editErr, userId: telegramId },
          "[decline] Could not edit message for invalid invite.",
        );
      }
      return;
    }

    // Check if already responded (handles multiple rapid clicks)
    if (sessionInvite.status !== "pending") {
      const isRapidClick =
        sessionInvite.status === "declined_by_friend" &&
        sessionInvite.friendTelegramId === friendTelegramId;

      logger.warn(
        {
          token: inviteToken,
          currentStatus: sessionInvite.status,
          friendTelegramId,
          isRapidClick,
        },
        isRapidClick
          ? "[decline] Multiple rapid clicks detected - invite already declined by same user."
          : "[decline] Invite already responded to.",
      );

      try {
        const message = isRapidClick
          ? "You have already declined this invitation."
          : "This invitation has already been processed.";

        await ctx.editMessageText(message, {
          reply_markup: { inline_keyboard: [] },
        });
      } catch (editErr) {
        logger.debug(
          { err: editErr, userId: telegramId },
          "[decline] Could not edit message for already processed invite.",
        );
      }

      // Still answer callback query for rapid clicks to provide feedback
      try {
        const callbackMessage = isRapidClick
          ? "You already declined this invitation."
          : "This invitation was already processed.";
        await ctx.answerCbQuery(callbackMessage);
      } catch (cbErr) {
        logger.debug(
          { err: cbErr, userId: telegramId },
          "[decline] Could not answer callback query for already processed invite.",
        );
      }

      return;
    }

    // Update the SessionInvite status to declined_by_friend
    await prisma.sessionInvite.update({
      where: { id: sessionInvite.id },
      data: {
        status: "declined_by_friend",
        friendTelegramId: friendTelegramId,
      },
    });

    logger.info(
      { inviteToken, friendTelegramId },
      "SessionInvite status updated to declined_by_friend.",
    );

    // Edit the friend's message with proper decline confirmation
    const sessionTypeLabel = sessionInvite.parentSession.sessionType.label;
    const primaryBookerName =
      sessionInvite.parentSession.user.firstName || "the primary booker";

    try {
      await ctx.editMessageText(
        `You have declined the invitation to the ${sessionTypeLabel} session with ${primaryBookerName}. Thanks for letting us know!`,
        { reply_markup: { inline_keyboard: [] } },
      );
    } catch (editErr) {
      logger.debug(
        { err: editErr, userId: telegramId },
        "[decline] Could not edit message after decline.",
      );
    }

    // Send notification to primary booker
    try {
      const primaryBookerTelegramId =
        sessionInvite.parentSession.user.telegramId;

      // Handle missing primary booker Telegram ID (data integrity issue)
      if (!primaryBookerTelegramId) {
        logger.error(
          {
            inviteToken,
            friendTelegramId,
            sessionId: sessionInvite.parentSession.id,
          },
          "[decline] Primary booker Telegram ID not found - data integrity issue.",
        );
        // Continue processing - the core decline action is still completed
        return;
      }

      const friendName = ctx.from.first_name || "A friend";
      const appointmentDate = sessionInvite.parentSession.appointmentDateTime;

      let formattedDate = "TBD";
      let formattedTime = "TBD";

      if (appointmentDate) {
        formattedDate = appointmentDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        formattedTime = appointmentDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      }

      const notificationMessage = `😔 ${friendName} has declined your invitation to the ${sessionTypeLabel} session on ${formattedDate} at ${formattedTime}.`;

      await telegramNotifier.sendUserNotification(
        primaryBookerTelegramId,
        notificationMessage,
      );

      logger.info(
        { inviteToken, primaryBookerTelegramId, friendTelegramId },
        "[decline] Primary booker notified of decline.",
      );
    } catch (notificationErr) {
      logger.warn(
        { err: notificationErr, inviteToken, friendTelegramId },
        "[decline] Failed to send notification to primary booker, but decline was processed successfully.",
      );
    }
  } catch (err) {
    logger.error(
      { err, inviteToken, userId: telegramId },
      "[decline] Error processing decline invite callback.",
    );

    try {
      await ctx.answerCbQuery(
        "Sorry, there was an issue processing your response. Please try again.",
      );
    } catch (cbErr) {
      logger.warn(
        { err: cbErr, userId: telegramId },
        "Failed to send error callback response.",
      );
    }
  }
}

module.exports = { initialize, handleCallbackQuery };
