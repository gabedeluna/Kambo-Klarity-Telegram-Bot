// src/core/prisma.js

// Import PrismaClient
const { PrismaClient } = require("@prisma/client");

// Instantiate Singleton
const prismaInstance = new PrismaClient();
console.log("✅ [core/prisma] Prisma Client instantiated.");

// Implement Graceful Shutdown
process.on("beforeExit", async () => {
  console.log(
    "🔄 [core/prisma] Disconnecting Prisma Client due to application exit...",
  );
  try {
    await prismaInstance.$disconnect();
    console.log("✅ [core/prisma] Prisma Client disconnected successfully.");
  } catch (error) {
    console.error("❌ [core/prisma] Error disconnecting Prisma Client:", error);
  }
});

/**
 * The singleton Prisma Client instance for the application.
 * Ensures a single connection pool is used and handles graceful disconnection.
 */
module.exports = prismaInstance;
