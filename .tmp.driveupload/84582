// src/core/prisma.js

// Import PrismaClient
const { PrismaClient } = require("@prisma/client");

// Import the default logger but allow it to be overridden for testing
let logger = require("./logger");

let prismaInstance;

// Define valid Prisma log levels
const VALID_PRISMA_LOG_LEVELS = ["query", "info", "warn", "error"];

if (!prismaInstance) {
  // Determine Prisma log configuration from environment variable
  let prismaLogLevels = [];
  if (process.env.PRISMA_LOG_LEVEL) {
    const levels = process.env.PRISMA_LOG_LEVEL.split(",").map((level) =>
      level.trim(),
    );
    const invalidLevels = levels.filter(
      (level) => !VALID_PRISMA_LOG_LEVELS.includes(level),
    );

    if (invalidLevels.length > 0) {
      logger.error(
        `Invalid PRISMA_LOG_LEVEL detected: [${invalidLevels.join(", ")}]. Using default logging. Valid levels are: [${VALID_PRISMA_LOG_LEVELS.join(", ")}]`,
      );
      // Optionally, you might want to throw an error or use defaults
      // For now, just log and use default (empty array)
    } else {
      prismaLogLevels = levels;
    }
  }

  // Instantiate Prisma Client with determined logging config
  prismaInstance = new PrismaClient({
    log: prismaLogLevels.length > 0 ? prismaLogLevels : undefined, // Pass undefined if no valid levels specified
  });
  logger.info("[core/prisma] Prisma Client instantiated.");

  process.on("beforeExit", async () => {
    logger.info(
      "[core/prisma] Disconnecting Prisma Client due to application exit...",
    );
    try {
      await prismaInstance.$disconnect();
      logger.info("[core/prisma] Prisma Client disconnected successfully.");
    } catch (error) {
      logger.error(error, "[core/prisma] Error disconnecting Prisma Client");
    }
  });
}

/**
 * The singleton Prisma Client instance for the application.
 * @type {import('@prisma/client').PrismaClient}
 */
const prismaExport = prismaInstance;

/**
 * Set a custom logger for testing purposes
 * @param {Object} customLogger - A logger object with standard methods
 * @returns {import('@prisma/client').PrismaClient} - The prisma instance
 */
prismaExport.setLogger = function (customLogger) {
  logger = customLogger;
  return prismaExport;
};

module.exports = prismaExport;
