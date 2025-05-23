// Load environment variables
require("dotenv").config();

// Import necessary modules
const { Telegraf } = require("telegraf");
const { PrismaClient } = require("@prisma/client");
const readline = require("node:readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});
const commandRegistry = require("../src/commands/registry"); // Assumes script is in root

// Initialize Telegraf bot and Prisma client
const bot = new Telegraf(process.env.TG_TOKEN);
const prisma = new PrismaClient();

/**
 * Formats command objects from the registry into the structure required by Telegraf API.
 * @param {object} roleSpecificCommands - The command object for a specific role (e.g., commandRegistry.client).
 * @returns {Array<{command: string, description: string}>} Array of command objects.
 */
function formatCommandsForTelegram(roleSpecificCommands) {
  if (!roleSpecificCommands) return [];
  return Object.entries(roleSpecificCommands).map(([command, details]) => ({
    command: command,
    description: details.descr, // 'descr' from your registry structure
  }));
}

/**
 * Main function to set/update Telegram commands.
 */
async function main() {
  try {
    console.log("🚀 Starting command update script...");

    // 1. Set/Update default client commands for all users
    console.log("🔄 Updating default client commands...");
    const clientCommands = formatCommandsForTelegram(commandRegistry.client);
    if (clientCommands.length > 0) {
      await bot.telegram.setMyCommands(clientCommands, {
        scope: { type: "default" },
      });
      console.log("✅ Default client commands updated successfully.");
    } else {
      await bot.telegram.setMyCommands([], { scope: { type: "default" } });
      console.log(
        "ℹ️ No client commands found in registry. Default commands have been cleared.",
      );
    }

    // 2. Find an existing admin user
    console.log("🔍 Searching for an existing admin user...");
    let adminUser = await prisma.users.findFirst({
      where: { role: "admin" },
    });

    const adminCommandsPayload = formatCommandsForTelegram(
      commandRegistry.admin,
    );

    if (adminUser) {
      console.log(
        `👤 Admin found: ${adminUser.first_name || "N/A"} (ID: ${adminUser.telegram_id}). Updating their commands.`,
      );
      if (adminCommandsPayload.length > 0) {
        await bot.telegram.setMyCommands(adminCommandsPayload, {
          scope: { type: "chat", chat_id: Number(adminUser.telegram_id) },
        });
        console.log(
          `✅ Admin commands updated for user ID ${adminUser.telegram_id}.`,
        );
      } else {
        // Clear specific commands for the admin if no admin commands are in the registry
        await bot.telegram.deleteMyCommands({
          scope: { type: "chat", chat_id: Number(adminUser.telegram_id) },
        });
        console.log(
          `ℹ️ No admin commands in registry. Specific commands cleared for admin ID ${adminUser.telegram_id}. They will see default commands.`,
        );
      }
    } else {
      console.log("🚫 No admin user found in the database.");
      const telegramIdToPromoteStr = await new Promise((resolve) => {
        readline.question(
          "❓ Enter the Telegram ID of the user to promote to admin: ",
          (id) => {
            resolve(id);
          },
        );
      });

      if (!telegramIdToPromoteStr || !/^[0-9]+$/.test(telegramIdToPromoteStr)) {
        console.error(
          "❌ Invalid Telegram ID entered (must be numeric). Exiting.",
        );
        return; // Exit main, finally block will still execute
      }

      const userIdToPromote = BigInt(telegramIdToPromoteStr);
      const userToPromote = await prisma.users.findUnique({
        where: { telegram_id: userIdToPromote },
      });

      if (!userToPromote) {
        console.error(
          `❌ User with Telegram ID ${userIdToPromote} not found in the database. Cannot promote.`,
        );
      } else {
        await prisma.users.update({
          where: { telegram_id: userIdToPromote },
          data: { role: "admin" },
        });
        console.log(
          `✅ User ${userToPromote.first_name || userIdToPromote} (ID: ${userIdToPromote}) promoted to admin.`,
        );

        if (adminCommandsPayload.length > 0) {
          await bot.telegram.setMyCommands(adminCommandsPayload, {
            scope: { type: "chat", chat_id: Number(userIdToPromote) },
          });
          console.log(
            `✅ Admin commands set for new admin ID ${userIdToPromote}.`,
          );
        } else {
          console.log(
            "ℹ️ No admin commands in registry. New admin will see default commands.",
          );
        }
      }
    }
  } catch (error) {
    console.error("❌ An error occurred during the script execution:", error);
    if (error.message.includes("401: Unauthorized")) {
      console.error(
        "🔑 Please ensure your TELEGRAM_BOT_TOKEN is correct in the .env file.",
      );
    }
  } finally {
    await prisma.$disconnect();
    readline.close();
    console.log("🏁 Script finished.");
  }
}

// Run the main function
main().catch((err) => {
  console.error("Unhandled error in main execution:", err);
  process.exit(1);
});
