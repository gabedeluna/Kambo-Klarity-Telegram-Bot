// src/core/prisma.js

// Import PrismaClient
const { PrismaClient } = require("@prisma/client");

let prismaInstance;

if (!prismaInstance) {
  prismaInstance = new PrismaClient();
  console.log("✅ [core/prisma] Prisma Client instantiated.");

  process.on("beforeExit", async () => {
    console.log(
      "🔄 [core/prisma] Disconnecting Prisma Client due to application exit...",
    );
    try {
      await prismaInstance.$disconnect();
      console.log("✅ [core/prisma] Prisma Client disconnected successfully.");
    } catch (error) {
      console.error(
        "❌ [core/prisma] Error disconnecting Prisma Client:",
        error,
      );
    }
  });
}

/**
 * The singleton Prisma Client instance for the application.
 * @type {import('@prisma/client').PrismaClient}
 */
module.exports = prismaInstance;
