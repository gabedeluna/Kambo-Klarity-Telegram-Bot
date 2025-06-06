/**
 * Runtime configuration — validated at startup.
 *
 * Throws if any required env var is missing.
 */
const dotenv = require("dotenv");
const logger = require("./logger");

dotenv.config();

// Always required
const ALWAYS_REQUIRED = ["TG_TOKEN", "DATABASE_URL", "FORM_URL", "NGROK_URL"];

// Optional configuration for invite-friends functionality (for future validation if needed)
// const OPTIONAL_CONFIG = ["BOT_USERNAME", "WEBAPP_NAME"];

// Conditionally required based on AI provider
const provider = process.env.AI_PROVIDER || "openai"; // Default to openai if not set
let providerRequired = [];
if (provider === "openai") {
  providerRequired = ["OPENAI_API_KEY"];
} else if (provider === "gemini") {
  providerRequired = ["GOOGLE_API_KEY"];
} else {
  // Log error and exit if provider is unsupported, but allow startup for now
  // Consider throwing an error in future if strict validation is needed before agent init
  logger.error(
    `Unsupported AI_PROVIDER: ${provider}. Must be 'openai' or 'gemini'.`,
  );
  // throw new Error(`Unsupported AI_PROVIDER: ${provider}. Must be 'openai' or 'gemini'.`);
}

const allRequired = [...ALWAYS_REQUIRED, ...providerRequired];
const missing = allRequired.filter((k) => !process.env[k]);

if (missing.length) {
  const errorMsg = `Missing required env vars for provider '${provider}': ${missing.join(", ")}`;
  logger.error(errorMsg);
  throw new Error(errorMsg);
}

// Log the provider being used
logger.info(`Using AI Provider: ${provider}`);

const config = Object.freeze({
  tgToken: process.env.TG_TOKEN,
  databaseUrl: process.env.DATABASE_URL,
  formUrl: process.env.FORM_URL,
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  openaiApiKey: process.env.OPENAI_API_KEY, // Include even if not selected, might be used elsewhere
  googleApiKey: process.env.GOOGLE_API_KEY, // Include even if not selected
  aiProvider: provider,
  nodeEnv: process.env.NODE_ENV || "development", // Default to development
  ngrokUrl: process.env.NGROK_URL, // For dev webhook
  appUrl: process.env.APP_URL, // For prod webhook
  // Optional configuration for invite-friends functionality
  botUsername: process.env.BOT_USERNAME || null, // For startapp links
  webAppName: process.env.WEBAPP_NAME || "kambo", // Default webapp name
});

module.exports = config;
