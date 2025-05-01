const express = require("express");
const botInstance = require("./core/bot");
const logger = require("./core/logger");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Configure Middleware
app.use(express.json());

// Mount Telegraf Webhook
// Note: Telegraf v4 uses bot.secretPathComponent() for webhook path security
const secretPathComponent = botInstance.secretPathComponent();
const secretPath = `/telegraf/${secretPathComponent}`;

// Mount the webhook handler
app.use(botInstance.webhookCallback(secretPath));

logger.info(`[app] Bot webhook configured at path: ${secretPath}`);

// Add Health Check Route
app.get("/health", (req, res) => {
  res.set("Content-Type", "text/plain"); // Explicitly set Content-Type
  res.status(200).send("OK");
});

// Register error handling middleware as the last middleware
app.use(errorHandler);

/**
 * The main Express application instance.
 * Configured with essential middleware (JSON parsing),
 * the Telegraf bot webhook handler, and basic routes like /health.
 * Exported for use in server startup (bin/server.js) and integration tests.
 * @type {import('express').Express}
 */
module.exports = app;
