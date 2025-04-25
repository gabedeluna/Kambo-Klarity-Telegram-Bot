/**
 * @fileoverview Tool for sending notifications via Telegram.
 */

let bot = null;
let logger = null;

/**
 * Initializes the Telegram Notifier tool.
 * @param {object} dependencies - The dependencies object.
 * @param {object} dependencies.botInstance - The Telegraf bot instance.
 * @param {object} dependencies.loggerInstance - The Pino logger instance.
 */
function initialize({ botInstance, loggerInstance }) {
  if (!botInstance || !loggerInstance) {
    throw new Error('Telegram Notifier requires botInstance and loggerInstance for initialization.');
  }
  bot = botInstance;
  logger = loggerInstance;
  logger.info('Telegram Notifier tool initialized.');
}

/**
 * Placeholder for sendWaiverLink function.
 * @returns {Promise<object>} Result object.
 */
async function sendWaiverLink() {
  // TODO: Implement sendWaiverLink
  logger.warn('sendWaiverLink is not yet implemented');
  return { success: false, error: 'Not implemented' };
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
    console.error('Telegram Notifier tool not initialized before calling sendTextMessage.'); // Log to console as fallback
    return { success: false, error: 'Tool not initialized' };
  }

  // Now perform parameter validation
  if (!telegramId || typeof text !== 'string' || text.trim() === '') {
    logger.error({ telegramId, text }, 'Missing or invalid parameters for sendTextMessage');
    return { success: false, error: 'Missing or invalid parameters' };
  }

  try {
    logger.debug({ telegramId, text }, 'Attempting to send text message...');
    const result = await bot.telegram.sendMessage(telegramId, text);
    logger.info({ telegramId, messageId: result.message_id }, 'Text message sent successfully.');
    return { success: true, messageId: result.message_id };
  } catch (error) {
    // TODO: Consider adding specific error handling (e.g., for 403 Forbidden, 400 Bad Request)
    logger.error('Error sending Telegram message:', error);
    return { success: false, error: 'Failed to send Telegram message' };
  }
}

// Export internal state for testing purposes only
const testExports = process.env.NODE_ENV === 'test'
  ? { 
      _getBot: () => bot, 
      _getLogger: () => logger,
      _resetForTest: () => {
        bot = null;
        logger = null;
      }
    }
  : {};

module.exports = {
  initialize,
  sendWaiverLink, // Placeholder
  sendTextMessage,
  ...testExports, // Spread test-only exports
};
