// src/commands/client/start.js
const { Markup } = require("telegraf");
const axios = require("axios");
const config = require("../../core/env");

let localNotifierInstance = undefined;
let localLogger = undefined;

/**
 * Initializes the start command handler with necessary dependencies.
 * @param {object} deps - Dependencies object.
 * @param {object} deps.notifier - The initialized telegramNotifier instance.
 * @param {object} deps.logger - The logger instance.
 */
function initializeStartCommandHandler(deps) {
  if (!deps || !deps.notifier || !deps.logger) {
    const log = deps && deps.logger ? deps.logger : console;
    log.error(
      "[startCommandHandler] Initialization failed: Missing notifier or logger dependency.",
    );
    return;
  }
  localNotifierInstance = deps.notifier;
  localLogger = deps.logger;
  localLogger.info("[startCommandHandler] Initialized successfully.");
}

/**
 * Handles the /start command for clients, including deep link processing.
 * @param {object} ctx - Telegraf context object.
 */
async function handleStartCommand(ctx) {
  const logger = localLogger || console;
  const notifier = localNotifierInstance;

  // Extract user information safely
  const telegramId = ctx.from?.id?.toString();
  const userName = ctx.from?.first_name || "there";

  if (!telegramId) {
    logger.warn("[/start] Command received without user information.");
    try {
      await ctx.reply("Sorry, I couldn't identify you. Please try again.");
    } catch (err) {
      logger.error(
        { err },
        "[/start] Failed to send error reply for missing user ID.",
      );
    }
    return;
  }

  if (!notifier) {
    logger.error(
      "[startCommandHandler] Command handler called but notifier instance is not available.",
    );
    try {
      await ctx.reply(
        "Sorry, the service is currently unavailable. Please try again later.",
      );
    } catch (err) {
      logger.error(
        { err, userId: telegramId },
        "[/start] Failed to send unavailable service reply.",
      );
    }
    return;
  }

  try {
    // Check if this is an invite deep link
    const startPayload = ctx.startPayload;

    if (startPayload && startPayload.startsWith("invite_")) {
      const inviteToken = startPayload.replace("invite_", "");

      if (!inviteToken || inviteToken.length === 0) {
        logger.warn(
          { userId: telegramId, startPayload },
          "[/start] Malformed invite token received.",
        );
        await ctx.reply("Sorry, this invite link appears to be invalid.");
        return;
      }

      logger.info(
        { userId: telegramId, inviteToken },
        "[/start] Invite token detected, processing friend flow.",
      );

      // Call BookingFlowManager API to validate invite and get details
      try {
        const apiUrl = `${config.ngrokUrl}/api/booking-flow/start-invite/${inviteToken}?friend_tg_id=${telegramId}`;

        logger.debug(
          { userId: telegramId, apiUrl },
          "[/start] Calling BookingFlowManager API for invite validation.",
        );

        const response = await axios.get(apiUrl, {
          headers: {
            "Content-Type": "application/json",
          },
        });

        const inviteData = response.data;

        // Validate response structure
        if (!inviteData.success || !inviteData.sessionDetails) {
          logger.error(
            { userId: telegramId, inviteData },
            "[/start] API returned malformed response for invite token.",
          );
          await ctx.reply(
            "Sorry, I received an unexpected response. Please try again or contact support.",
          );
          return;
        }

        const { sessionDetails } = inviteData;
        const { sessionType, date, time, primaryBookerName } = sessionDetails;

        // Format the invite details message
        const inviteMessage =
          `👋 Hi ${userName}! You've been invited to join a Kambo session.\n\n` +
          `📅 **Session Details:**\n` +
          `🔹 Type: ${sessionType}\n` +
          `🔹 Date: ${date}\n` +
          `🔹 Time: ${time}\n` +
          `🔹 Hosted by: ${primaryBookerName}\n\n` +
          `Would you like to join this healing journey?`;

        // Create inline keyboard with accept and decline options
        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.webApp(
              "View Invite & Accept ✨",
              `${config.ngrokUrl}/form-handler.html?flowToken=${inviteData.flowToken || ""}&formType=KAMBO_WAIVER_FRIEND_V1&telegramId=${telegramId}`,
            ),
          ],
          [
            Markup.button.callback(
              "Decline Invite 😔",
              `decline_invite_${inviteToken}`,
            ),
          ],
        ]);

        await ctx.reply(inviteMessage, keyboard);

        logger.info(
          { userId: telegramId, inviteToken, sessionType, primaryBookerName },
          "[/start] Successfully displayed invite details to friend.",
        );
      } catch (err) {
        // Handle axios errors specifically
        if (err.response) {
          const status = err.response.status;
          const errorData = err.response.data || {};

          if (status === 404) {
            await ctx.reply(
              "Sorry, this invitation has expired or is no longer valid.",
            );
            return;
          } else if (status === 400 && errorData.error?.includes("yourself")) {
            await ctx.reply(
              "You cannot accept your own invitation. This invite is for friends to join your session.",
            );
            return;
          } else if (status === 409) {
            await ctx.reply("This invitation has already been accepted.");
            return;
          } else {
            logger.warn(
              { userId: telegramId, status, error: errorData },
              "[/start] API returned error for invite token.",
            );
            await ctx.reply(
              "Sorry, there was an issue processing your invitation. Please try again or contact support.",
            );
            return;
          }
        } else {
          // Network error or other issue
          logger.error(
            { err, userId: telegramId, inviteToken },
            "[/start] Error calling BookingFlowManager API for invite token.",
          );

          await ctx.reply(
            "Sorry, I'm having trouble processing your invitation right now. Please try again later.",
          );
        }
      }

      return;
    }

    // Handle non-invite startPayload
    if (startPayload) {
      logger.debug(
        { userId: telegramId, startPayload },
        "[/start] Non-invite start payload received, treating as basic start.",
      );
    }

    // Basic /start command response
    logger.info(
      { userId: telegramId },
      "[/start] Basic start command received.",
    );

    await ctx.reply(
      `👋 Welcome ${userName}!\n\n` +
        "I'm your Kambo session booking assistant. Here's what I can help you with:\n\n" +
        "📅 /book - Start booking a Kambo session\n" +
        "👤 /profile - Manage your profile\n" +
        "ℹ️ /help - Get help with commands\n" +
        "📞 /contact_admin - Contact our team\n\n" +
        "Ready to begin your healing journey? Use /book to get started!",
    );
  } catch (err) {
    logger.error(
      { err, userId: telegramId },
      "[/start] Exception during reply.",
    );

    try {
      await ctx.reply(
        "Sorry, an unexpected error occurred. Please try again or contact support if the problem persists.",
      );
    } catch (replyErr) {
      logger.error(
        { err: replyErr, originalError: err, userId: telegramId },
        "[/start] Failed to send error reply.",
      );
    }
  }
}

module.exports = {
  initializeStartCommandHandler,
  handleStartCommand,
};
