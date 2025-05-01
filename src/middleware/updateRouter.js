const logger = require('../utils/logger')('updateRouter');

// Module dependencies
let dependencies; // Dependencies (messageHandler, callbackQueryHandler) injected via initialize

/**
 * Checks if the update context represents a standard text message.
 * @param {object} ctx - Telegraf context object.
 * @returns {boolean} True if it's a text message, false otherwise.
 */
const isTextMessage = (ctx) => !!ctx.message?.text;

/**
 * Checks if the update context represents a callback query (inline button press).
 * @param {object} ctx - Telegraf context object.
 * @returns {boolean} True if it's a callback query, false otherwise.
 */
const isCallbackQuery = (ctx) => !!ctx.callbackQuery?.data;

/**
 * Initializes the update router middleware with necessary dependencies.
 * @param {object} deps - Dependency object containing handlers.
 * @throws {Error} If dependencies are missing.
 */
function initialize(deps) {
    // Validate and assign injected deps
    if (!deps.messageHandler || !deps.callbackQueryHandler) {
        throw new Error('UpdateRouterMiddleware requires messageHandler and callbackQueryHandler dependencies.');
    }
    dependencies = deps;
    logger.info('Update router initialized.');
}

/**
 * Middleware function to route incoming Telegraf updates based on type.
 * @param {object} ctx - Telegraf context object.
 */
async function updateRouterMiddleware(ctx) {
    const updateType = ctx.updateType;
    const userId = ctx.from?.id || 'unknown';

    logger.debug({ userId, updateType, updateId: ctx.update.update_id }, 'Routing update...');

    if (isTextMessage(ctx)) {
        logger.info({ userId, text: ctx.message.text }, 'Routing to messageHandler.');
        try {
            // Correctly use the injected dependency
            await dependencies.messageHandler.handleTextMessage(ctx);
        } catch (err) {
            logger.error({ err, userId }, 'Unhandled error in messageHandler');
            // Consider sending a generic error message to the user
            // await ctx.reply("Sorry, something went wrong processing your message.");
        }
        return; // Stop processing this update further down the middleware chain
    } else if (isCallbackQuery(ctx)) {
        logger.info({ userId, callbackData: ctx.callbackQuery.data }, 'Routing to callbackQueryHandler.');
        try {
             // Correctly use the injected dependency
             await dependencies.callbackQueryHandler.handleCallbackQuery(ctx);
        } catch (err) {
             logger.error({ err, userId: userId, callbackData: ctx.callbackQuery.data }, 'Unhandled error in callbackQueryHandler');
             // Attempt to answer query anyway to prevent infinite loading on client
             try { await ctx.answerCbQuery("Error processing selection."); } catch (e) {
                logger.warn({ err: e, userId }, 'Failed to answer callback query after handler error.');
             }
        }
        return; // Stop processing
    } else {
        // Handle other update types or ignore
        logger.warn({ userId, updateType }, 'Received unhandled update type.');
    }

    // If the update wasn't handled by the specific routes above, proceed
    // logger.debug({ userId, updateType }, 'Update not handled by router, passing to next middleware.');
    // return next(); // Usually, we want specific handlers to terminate the flow
}

module.exports = {
    initialize,
    updateRouterMiddleware
};
