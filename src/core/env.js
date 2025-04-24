/**
 * Runtime configuration — validated at startup.
 *
 * Throws if any required env var is missing.
 */
const dotenv = require("dotenv");

// Note: We can't use our logger here since it might depend on env vars
// that we're validating in this module (to avoid circular dependencies)
dotenv.config();

const REQUIRED = ["TG_TOKEN", "DATABASE_URL", "FORM_URL"];
const missing = REQUIRED.filter((k) => !process.env[k]);

if (missing.length) {
  throw new Error(`Missing required env vars: ${missing.join(", ")}`);
}

const config = Object.freeze({
  tgToken: process.env.TG_TOKEN,
  databaseUrl: process.env.DATABASE_URL,
  formUrl: process.env.FORM_URL,
  port: process.env.PORT || 3000,
});

module.exports = config;
