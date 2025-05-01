// src/core/prisma.js

// Import PrismaClient
const { PrismaClient } = require("@prisma/client");

// Import the default logger but allow it to be overridden for testing
let logger = require("./logger");

let prismaInstance;

if (!prismaInstance) {
  prismaInstance = new PrismaClient();
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
