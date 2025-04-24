const { Telegraf } = require("telegraf");
const config = require("./env");

const BOT_TOKEN = config.tgToken;

if (!BOT_TOKEN) {
  console.error("FATAL ERROR: TG_TOKEN environment variable is not set.");
  process.exit(1); // Exit if the token is missing
}

const botInstance = new Telegraf(BOT_TOKEN);

console.log("✅ [core/bot] Telegraf bot instance initialized.");

/**
 * The singleton Telegraf bot instance for the application.
 * Initialized with the bot token from the environment configuration.
 * Webhook setup and launching are handled elsewhere (e.g., server.js or app.js).
 * @type {import('telegraf').Telegraf}
 */
module.exports = botInstance;
