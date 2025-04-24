/**
 * Singleton Pino logger instance configured for development (pretty-print) and production (JSON).
 * 
 * This module exports a configured Pino logger that automatically adjusts its
 * output format based on the NODE_ENV environment variable. In development,
 * it uses pino-pretty for human-readable logs, while in production it outputs
 * structured JSON logs suitable for log aggregation systems.
 * 
 * @module core/logger
 */

const pino = require("pino");

// Determine log level from environment or use default
const logLevel = process.env.LOG_LEVEL || "info";

// Detect if we're running in a test environment
const isTest = process.env.NODE_ENV === "test" || process.argv.includes("--allow-empty");

// Configure Pino with appropriate transport based on environment
const logger = pino({
  level: isTest ? "silent" : logLevel, // Disable logging during tests
  transport: !isTest && process.env.NODE_ENV !== "production" 
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
          ignore: "pid,hostname", // Hide less useful fields in development
        }
      } 
    : undefined, // Use default JSON transport in production
});

/**
 * The singleton Pino logger instance for the application.
 * Configured based on NODE_ENV and LOG_LEVEL environment variables.
 * Automatically silenced during test runs to avoid cluttering test output.
 * @type {import('pino').Logger}
 */
module.exports = logger;
