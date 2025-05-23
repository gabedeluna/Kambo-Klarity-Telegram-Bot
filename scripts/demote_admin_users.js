// Load environment variables first
require("../src/core/env"); // Assuming this file loads dotenv and sets up process.env

const prisma = require("../src/core/prisma");
const bot = require("../src/core/bot");
// const { getCommandsForScope } = require('./src/commands/registry'); // No longer needed
const logger = require("../src/core/logger"); // Assuming a logger exists

/**
 * @async
 * @function demoteAdminUsers
 * @description Finds all users with the 'admin' role, changes their role to 'client',
 * and resets their Telegram command scope to inherit the existing global default commands.
 */
async function demoteAdminUsers() {
  logger.info("Starting admin demotion script...");

  try {
    // 1. Initialization is done by the require statements above.

    // 2. Process Admin Users
    logger.info("Querying database for users with 'admin' role...");
    const adminUsers = await prisma.users.findMany({
      // Changed from prisma.user
      where: {
        role: "admin", // lowercase
      },
    });

    if (!adminUsers || adminUsers.length === 0) {
      logger.info("No users with 'admin' role found. Exiting.");
      return;
    }

    logger.info(`Found ${adminUsers.length} admin users to process.`);

    for (const user of adminUsers) {
      // Assuming client_id is the primary DB identifier and telegram_id is used for Telegram ops
      logger.info(
        `Processing user with Client ID: ${user.client_id}, Telegram ID: ${user.telegram_id}`,
      );

      try {
        // Update user's role to 'client' using telegram_id as the unique identifier
        if (!user.telegram_id) {
          logger.warn(
            `User with Client ID: ${user.client_id} does not have a telegram_id. Skipping role update and command reset.`,
          );
          continue;
        }

        await prisma.users.update({
          where: { telegram_id: user.telegram_id }, // Use telegram_id
          data: { role: "client" }, // lowercase
        });
        logger.info(
          `Successfully updated role to 'client' for user with Telegram ID: ${user.telegram_id}`,
        );

        // Reset user's specific command scope to make them inherit the global default
        // Ensure user.telegram_id is valid (BigInt or Number, depending on schema and Telegraf expectation)
        const telegramIdForApi =
          typeof user.telegram_id === "bigint"
            ? Number(user.telegram_id)
            : user.telegram_id;

        if (telegramIdForApi) {
          await bot.telegram.deleteMyCommands({
            scope: { type: "chat", chat_id: telegramIdForApi }, // Use telegram_id
          });
          logger.info(
            `Successfully reset command scope for Telegram ID: ${telegramIdForApi}. User will now inherit existing default commands.`,
          );
        } else {
          // This case should be caught by the check for user.telegram_id above, but as a safeguard:
          logger.warn(
            `User with Client ID: ${user.client_id} does not have a valid telegram_id for API call. Cannot reset command scope.`,
          );
        }
        logger.info(
          `Successfully updated role and reset commands for user with Telegram ID: ${user.telegram_id}`,
        );
      } catch (error) {
        logger.error(
          `Error processing user with Telegram ID: ${user.telegram_id || "N/A"}: ${error.message}`,
          { stack: error.stack },
        );
        // Continue to the next user even if one fails
      }
    }

    logger.info("Admin demotion script completed successfully.");
  } catch (error) {
    logger.error(
      `An error occurred during the demotion script: ${error.message}`,
      { stack: error.stack },
    );
  } finally {
    // 3. Cleanup
    logger.info("Disconnecting Prisma client...");
    await prisma.$disconnect();
    logger.info("Prisma client disconnected.");
  }
}

// 4. Execution
if (require.main === module) {
  demoteAdminUsers().catch((error) => {
    console.error("Unhandled error in demoteAdminUsers:", error);
    process.exit(1);
  });
}

module.exports = demoteAdminUsers; // Export for potential testing or programmatic use
