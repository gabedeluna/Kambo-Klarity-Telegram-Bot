/**
 * @fileoverview Inline Query Handler
 * Handles inline bot queries for sharing session invitations
 */

const config = require("../core/env");

let logger, prisma;

/**
 * Initializes the inline query handler with required dependencies
 * @param {object} deps - Dependencies object
 * @param {object} deps.logger - Logger instance
 * @param {object} deps.prisma - Prisma client instance
 */
function initializeInlineQueryHandler(deps) {
  if (!deps || !deps.logger || !deps.prisma) {
    const log = deps && deps.logger ? deps.logger : console;
    log.error(
      "[inlineQueryHandler] Initialization failed: Missing prisma or logger dependency.",
    );
    return;
  }
  logger = deps.logger;
  prisma = deps.prisma;
  logger.info("[inlineQueryHandler] Initialized successfully.");
}

/**
 * Handles inline queries from users
 * @param {object} ctx - Telegraf context object
 */
async function handleInlineQuery(ctx) {
  const fallbackLogger = logger || console;

  // Extract user information safely
  const telegramId = ctx.from?.id?.toString();
  const query = ctx.inlineQuery?.query?.trim() || "";

  if (!telegramId) {
    fallbackLogger.warn(
      "[inline] Inline query received without user information.",
    );
    try {
      await ctx.answerInlineQuery([]);
    } catch (err) {
      fallbackLogger.error(
        { err },
        "[inline] Failed to answer inline query for missing user ID.",
      );
    }
    return;
  }

  if (!prisma) {
    fallbackLogger.error(
      "[inlineQueryHandler] Handler called but dependencies are not available.",
    );
    try {
      await ctx.answerInlineQuery([]);
    } catch (err) {
      fallbackLogger.error(
        { err, userId: telegramId },
        "[inline] Failed to answer inline query for missing dependencies.",
      );
    }
    return;
  }

  try {
    let results = [];

    if (!query) {
      // Empty query - return empty results
      fallbackLogger.debug(
        { userId: telegramId },
        "[inline] Empty query, returning no results.",
      );
      results = [];
    } else if (query.toLowerCase().includes("share")) {
      // User wants to share invitations
      results = await getShareableInvitations(telegramId);
    } else {
      // Unknown query - provide help
      results = [getHelpResult()];
    }

    await ctx.answerInlineQuery(results);

    fallbackLogger.info(
      { userId: telegramId, query, resultCount: results.length },
      "[inline] Inline query processed successfully.",
    );
  } catch (err) {
    fallbackLogger.error(
      { err, userId: telegramId, query },
      "[inline] Error processing inline query.",
    );

    try {
      await ctx.answerInlineQuery([getErrorResult()]);
    } catch (answerErr) {
      fallbackLogger.error(
        { err: answerErr, userId: telegramId },
        "[inline] Failed to answer inline query.",
      );
    }
  }
}

/**
 * Gets shareable session invitations for a user
 * @param {string} telegramId - User's telegram ID
 * @returns {Array} Array of inline query results
 */
async function getShareableInvitations(telegramId) {
  try {
    const sessionInvites = await prisma.sessionInvite.findMany({
      where: {
        parentSession: {
          userId: telegramId,
        },
        status: "pending",
      },
      include: {
        parentSession: {
          include: {
            user: true,
            sessionType: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10, // Limit to 10 most recent
    });

    if (sessionInvites.length === 0) {
      return [getNoInvitesResult()];
    }

    return sessionInvites.map((invite) => {
      const session = invite.parentSession;
      const sessionType = session.sessionType.name;
      const dateTime = new Date(session.appointmentDateTime);
      const formattedDate = dateTime.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const formattedTime = dateTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });

      const inviteUrl = `https://t.me/${config.botUsername || "YourBotUsername"}?start=invite_${invite.inviteToken}`;

      const messageText =
        `🌿 You've been invited to join a Kambo healing session!\\n\\n` +
        `📅 **${sessionType}**\\n` +
        `🗓️ ${formattedDate} at ${formattedTime}\\n` +
        `👤 Hosted by ${session.user.firstName || "A friend"}\\n\\n` +
        `Tap the link below to view details and respond:\\n` +
        `${inviteUrl}\\n\\n` +
        `_This is a personalized invitation link just for you._`;

      return {
        type: "article",
        id: invite.id,
        title: `Share ${sessionType} Invitation`,
        description: `${formattedDate} at ${formattedTime}`,
        input_message_content: {
          message_text: messageText,
          parse_mode: "Markdown",
        },
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🔗 Open Invitation",
                url: inviteUrl,
              },
            ],
          ],
        },
      };
    });
  } catch (err) {
    logger.error(
      { err, telegramId },
      "[inline] Error fetching shareable invitations.",
    );
    throw err;
  }
}

/**
 * Returns help result for unknown queries
 * @returns {object} Inline query result
 */
function getHelpResult() {
  return {
    type: "article",
    id: "help",
    title: "How to use inline mode",
    description: 'Type "share" to find your session invitations.',
    input_message_content: {
      message_text:
        "🤖 I can help you share session invitations!\\n\\n" +
        "💡 **How to use:**\\n" +
        "• Type `@" +
        (config.botUsername || "kambo_bot") +
        " share` to see your pending invitations\\n" +
        "• Select an invitation to share it with friends\\n\\n" +
        "✨ This makes it easy to invite friends to join your Kambo sessions!",
      parse_mode: "Markdown",
    },
  };
}

/**
 * Returns no invitations available result
 * @returns {object} Inline query result
 */
function getNoInvitesResult() {
  return {
    type: "article",
    id: "no-invites",
    title: "No Active Invitations",
    description: "You don't have any pending invitations to share.",
    input_message_content: {
      message_text:
        "I don't have any active session invitations to share right now.\\n\\nYou can create invitations when booking group sessions through /book.",
    },
  };
}

/**
 * Returns error result for failed queries
 * @returns {object} Inline query result
 */
function getErrorResult() {
  return {
    type: "article",
    id: "error",
    title: "Error",
    description: "Unable to load invitations at this time.",
    input_message_content: {
      message_text:
        "Sorry, I couldn't load your invitations right now. Please try again later.",
    },
  };
}

module.exports = {
  initializeInlineQueryHandler,
  handleInlineQuery,
};
