/**
 * @fileoverview Friend Response API Handler
 * Handles accept/decline responses for session invites
 */

// Remove unused import
// const config = require("../../core/env");

let prisma, logger, telegramNotifier;

/**
 * Initializes the friend response handler with required dependencies
 * @param {object} deps - Dependencies object
 * @param {object} deps.prisma - Prisma client instance
 * @param {object} deps.logger - Logger instance
 * @param {object} deps.telegramNotifier - Telegram notifier instance
 */
function initialize(deps) {
  if (!deps.prisma || !deps.logger || !deps.telegramNotifier) {
    throw new Error("Missing required dependencies for friendResponseHandler");
  }

  prisma = deps.prisma;
  logger = deps.logger;
  telegramNotifier = deps.telegramNotifier;

  logger.info("[friendResponseHandler] Initialized successfully.");
}

/**
 * Handles friend responses to session invites (accept/decline)
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function handleFriendResponse(req, res) {
  const { token } = req.params;
  const { response, friendTelegramId } = req.body;

  logger.info(
    { token, response, friendTelegramId },
    "[friendResponse] Processing friend response.",
  );

  try {
    // Validate request body
    if (!response) {
      return res.status(400).json({
        error: "Response field is required",
      });
    }

    if (response !== "accepted" && response !== "declined") {
      return res.status(400).json({
        error: 'Invalid response. Must be "accepted" or "declined"',
      });
    }

    // Find the session invite
    const sessionInvite = await prisma.sessionInvite.findFirst({
      where: {
        inviteToken: token,
      },
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
      logger.warn({ token }, "[friendResponse] Session invite not found.");
      return res.status(404).json({
        error: "Invitation not found or expired",
      });
    }

    // Check if already responded
    if (sessionInvite.status !== "pending") {
      logger.warn(
        { token, currentStatus: sessionInvite.status },
        "[friendResponse] Invite already responded to.",
      );
      return res.status(409).json({
        error: "Invitation has already been responded to",
      });
    }

    // Update the session invite
    const updateData = {
      status: response,
      respondedAt: new Date(),
    };

    // Add friend telegram ID if accepting
    if (response === "accepted" && friendTelegramId) {
      updateData.friendTelegramId = friendTelegramId;
    }

    await prisma.sessionInvite.update({
      where: { id: sessionInvite.id },
      data: updateData,
    });

    logger.info(
      { token, response, inviteId: sessionInvite.id },
      "[friendResponse] Session invite updated successfully.",
    );

    // Send notifications
    await sendNotifications(sessionInvite, response, friendTelegramId);

    // Return success response
    const successMessage =
      response === "accepted"
        ? "Invitation accepted successfully"
        : "Invitation declined";

    res.status(200).json({
      success: true,
      message: successMessage,
    });
  } catch (error) {
    logger.error(
      { err: error, token, response },
      "[friendResponse] Error processing friend response.",
    );

    res.status(500).json({
      error: "Internal server error",
    });
  }
}

/**
 * Sends appropriate notifications based on the response
 * @param {object} sessionInvite - The session invite object
 * @param {string} response - 'accepted' or 'declined'
 * @param {string} friendTelegramId - Friend's telegram ID (for accepted invites)
 */
async function sendNotifications(sessionInvite, response, friendTelegramId) {
  const { parentSession } = sessionInvite;
  const primaryBookerTelegramId = parentSession.user.telegramId;
  const sessionType = parentSession.sessionType.name;

  try {
    if (response === "accepted") {
      // Get friend's information
      let friendName = "Friend";
      if (friendTelegramId) {
        try {
          const friend = await prisma.user.findUnique({
            where: { telegramId: friendTelegramId },
          });
          if (friend && friend.firstName) {
            friendName = friend.firstName;
          }
        } catch (err) {
          logger.warn(
            { err, friendTelegramId },
            "[friendResponse] Could not fetch friend info for notification.",
          );
        }
      }

      // Notify the friend
      if (friendTelegramId) {
        await telegramNotifier.sendMessage({
          telegramId: friendTelegramId,
          text:
            `✅ You've successfully accepted the invitation for ${sessionType}!\n\n` +
            `Your spot is now reserved. You'll receive further details as the session approaches.`,
        });
      }

      // Notify the primary booker
      await telegramNotifier.sendMessage({
        telegramId: primaryBookerTelegramId,
        text:
          `🎉 Great news! ${friendName} has accepted your invitation to join the ${sessionType}.\n\n` +
          `Your group session is now confirmed with ${friendName}.`,
      });

      // Notify admin
      await telegramNotifier.sendAdminNotification(
        `📋 Session Invite Accepted:\n` +
          `• Session: ${sessionType}\n` +
          `• Primary Booker: ${parentSession.user.firstName || "Unknown"} (${primaryBookerTelegramId})\n` +
          `• Friend: ${friendName} (${friendTelegramId || "Unknown"})\n` +
          `• Session Date: ${parentSession.appointmentDateTime?.toISOString() || "TBD"}`,
      );
    } else if (response === "declined") {
      // Notify the primary booker
      await telegramNotifier.sendMessage({
        telegramId: primaryBookerTelegramId,
        text:
          `😔 Unfortunately, your friend has declined the invitation to join the ${sessionType}.\n\n` +
          `Your individual session is still confirmed. You can always invite someone else if you'd like.`,
      });
    }
  } catch (notificationError) {
    // Log notification failures but don't fail the whole request
    logger.warn(
      { err: notificationError, response, sessionInviteId: sessionInvite.id },
      "[friendResponse] Failed to send some notifications, but response was processed successfully.",
    );
  }
}

module.exports = {
  initialize,
  handleFriendResponse,
};
