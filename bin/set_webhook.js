// bin/set_webhook.js
require("dotenv").config({ path: require("path").join(__dirname, "../.env") }); // Ensure .env in root is loaded

// We don't need to import Telegraf directly as we're using the bot instance
// const { Telegraf } = require('telegraf');
const bot = require("../src/core/bot"); // Assuming this exports the initialized Telegraf instance
const logger = require("../src/core/logger"); // For consistent logging
const config = require("../src/core/env"); // To access NGROK_URL as a default

async function setWebhookManually() {
  let targetWebhookBaseUrl = process.argv[2]; // Get URL from command line argument

  if (!bot || !bot.secretPathComponent) {
    logger.error(
      "Failed to load bot instance or secretPathComponent is missing.",
    );
    process.exit(1);
  }

  if (!targetWebhookBaseUrl) {
    if (config.ngrokUrl) {
      logger.warn(
        `No webhook URL provided as argument. Found NGROK_URL in .env: ${config.ngrokUrl}`,
      );
      const readline = require("node:readline").createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const answer = await new Promise((resolve) => {
        readline.question(
          `Do you want to use ${config.ngrokUrl} as the base URL? (yes/no): `,
          resolve,
        );
      });
      readline.close();
      if (answer.toLowerCase() === "yes" || answer.toLowerCase() === "y") {
        targetWebhookBaseUrl = config.ngrokUrl;
      } else {
        logger.error(
          "Aborted. Please provide the target base webhook URL as a command-line argument.",
        );
        logger.info(
          "Example: node bin/set_webhook.js https://your-ngrok-url.io",
        );
        process.exit(1);
      }
    } else {
      logger.error(
        "No webhook URL provided. Please provide the target base webhook URL as a command-line argument.",
      );
      logger.info("Example: node bin/set_webhook.js https://your-ngrok-url.io");
      process.exit(1);
    }
  }

  if (!targetWebhookBaseUrl.startsWith("https://")) {
    logger.error("Invalid URL provided. Webhook URL must start with https://");
    process.exit(1);
  }

  const secretPath = bot.secretPathComponent();
  const fullWebhookUrl = `${targetWebhookBaseUrl.replace(/\/$/, "")}/telegraf/${secretPath}`; // Remove trailing slash if present

  logger.info(`Attempting to set webhook to: ${fullWebhookUrl}`);

  try {
    const success = await bot.telegram.setWebhook(fullWebhookUrl);
    if (success) {
      logger.info("✅ Webhook set successfully!");
      const webhookInfo = await bot.telegram.getWebhookInfo();
      logger.info("Current webhook info:");
      console.dir(webhookInfo, { depth: null }); // Log the full info object
    } else {
      // This case might not be hit if Telegraf throws on failure, but good for robustness
      logger.error(
        "❌ Telegram API returned non-true result for setWebhook. Webhook might not be set.",
      );
    }
  } catch (error) {
    logger.error("❌ Error setting webhook:");
    // Log detailed error information
    if (error.response && error.on) {
      logger.error(`TelegramError: ${error.message}`);
      logger.error(`Description: ${error.response.description}`);
      logger.error(`Error Code: ${error.response.error_code}`);
      if (error.response.parameters) {
        logger.error(
          `Parameters: ${JSON.stringify(error.response.parameters)}`,
        );
      }
      logger.error(`Method: ${error.on.method}`);
      logger.error(`Payload: ${JSON.stringify(error.on.payload)}`);
    } else {
      logger.error(error); // Log the whole error object if it's not a standard TelegramError
    }
    process.exit(1);
  }
}

setWebhookManually().catch((err) => {
  logger.error("Unhandled error in setWebhookManually:", err);
  process.exit(1);
});
