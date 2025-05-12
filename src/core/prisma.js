/**
 * Singleton Prisma Client instance with graceful shutdown handling.
 * @module core/prisma
 */
const { PrismaClient } = require("@prisma/client");

// Import the main application logger
const appLogger = require("./logger");
// Create a child logger specifically for prisma messages
const logger = appLogger.child({ component: "prisma" });

let prismaInstance;

// Define valid Prisma log levels
const VALID_PRISMA_LOG_LEVELS = ["query", "info", "warn", "error"];

if (!prismaInstance) {
  // Determine Prisma log configuration from environment variable
  let prismaLogLevels = [];
  if (process.env.PRISMA_LOGGING) {
    const levels = process.env.PRISMA_LOGGING.split(",").map((level) =>
      level.trim(),
    );
    prismaLogLevels = levels.filter((level) =>
      VALID_PRISMA_LOG_LEVELS.includes(level),
    );
  }

  prismaInstance = new PrismaClient({
    log: prismaLogLevels.length > 0 ? prismaLogLevels : undefined,
  });
  logger.info("Prisma Client instantiated.");

  let isDisconnecting = false;
  let isDisconnected = false;

  function setupPrismaShutdownHandlers() {
    const disconnectFn = async (signalOrEvent) => {
      if (!prismaInstance) {
        logger.warn(
          `Prisma instance not available for disconnection (triggered by ${signalOrEvent}).`,
        );
        return;
      }
      if (isDisconnected) {
        logger.debug(
          `Prisma Client already disconnected (triggered by ${signalOrEvent}).`,
        );
        return;
      }
      if (isDisconnecting) {
        logger.debug(
          `Prisma Client disconnection already in progress (triggered by ${signalOrEvent}).`,
        );
        return;
      }

      isDisconnecting = true;
      logger.info(`Received ${signalOrEvent}. Disconnecting Prisma Client...`);
      try {
        await prismaInstance.$disconnect();
        logger.info("Prisma Client disconnected successfully.");
        isDisconnected = true;
      } catch (error) {
        logger.error(
          { err: error },
          "Error disconnecting Prisma Client during shutdown.",
        );
      } finally {
        isDisconnecting = false;
      }
    };

    process.on("SIGINT", async () => {
      await disconnectFn("SIGINT");
      process.exit(0);
    });
    process.on("SIGTERM", async () => {
      await disconnectFn("SIGTERM");
      process.exit(0);
    });

    process.on("beforeExit", async () => {
      logger.debug(
        "beforeExit event triggered. Ensuring Prisma client is disconnected.",
      );
      await disconnectFn("beforeExit");
    });

    process.on("uncaughtException", async (error) => {
      logger.fatal({ err: error }, "Uncaught Exception. Shutting down...");
      await disconnectFn("uncaughtException");
      process.exit(1);
    });

    process.on("unhandledRejection", async (reason, promise) => {
      logger.fatal(
        { reason, promise },
        "Unhandled Rejection. Shutting down...",
      );
      await disconnectFn("unhandledRejection");
      process.exit(1);
    });
  }

  setupPrismaShutdownHandlers();
}

/**
 * The singleton PrismaClient instance.
 * @type {PrismaClient}
 */
module.exports = prismaInstance;
