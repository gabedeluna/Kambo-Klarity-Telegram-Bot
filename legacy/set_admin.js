// Load environment variables
require("dotenv").config();

// Import Telegraf and Prisma
const { Telegraf } = require("telegraf");
const { PrismaClient } = require("@prisma/client");

// Initialize bot and database client
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const prisma = new PrismaClient();

console.log("Admin registration script started...");
console.log("Waiting for a user to message the bot...");
console.log("The first user to send a message will be registered as an admin.");
console.log("Press Ctrl+C to exit.");

// Listen for any message from a user
bot.on("message", async (ctx) => {
  try {
    const userId = BigInt(ctx.from.id);
    const firstName = ctx.from.first_name || "";
    const lastName = ctx.from.last_name || "";

    console.log(
      `Received message from: ${firstName} ${lastName} (ID: ${userId})`,
    );

    // Check if user exists and their role
    const existingUser = await prisma.users.findUnique({
      where: { telegram_id: userId },
    });
    if (existingUser && existingUser.role === "admin") {
      // Demote admin to client
      await prisma.users.update({
        where: { telegram_id: userId },
        data: { role: "client" },
      });
      // Remove custom commands for this user so they see the default commands
      await bot.telegram.deleteMyCommands({
        scope: { type: "chat", chat_id: Number(userId) },
      });
      await ctx.reply(
        "🟢 You were admin and have been demoted to client. Your commands are now default.",
      );
      console.log(
        "User was admin and has been demoted to client. Commands reset. Exiting...",
      );
      process.exit(0);
    }

    // Otherwise, assign admin role and admin commands
    const user = await prisma.users.upsert({
      where: { telegram_id: userId },
      update: { first_name: firstName, last_name: lastName, role: "admin" },
      create: {
        telegram_id: userId,
        first_name: firstName,
        last_name: lastName,
        role: "admin",
      },
    });

    console.log("User registered as admin:", user);
    await ctx.reply(
      `✅ You (${firstName} ${lastName}) have been registered as an admin!`,
    );

    // Set admin-only commands for this user
    await bot.telegram.setMyCommands(
      [
        { command: "admincmd1", description: "Admin Command 1" },
        { command: "admincmd2", description: "Admin Command 2" },
      ],
      {
        scope: { type: "chat", chat_id: Number(userId) },
      },
    );
    await ctx.reply("✅ Admin commands set successfully!");

    console.log("Admin commands set for Telegram ID:", userId.toString());

    console.log("Admin registration complete. Exiting...");
    process.exit(0);
  } catch (error) {
    console.error("Error registering admin:", error);
    if (
      error.message.includes('relation "users" does not exist') ||
      error.message.includes("does not exist")
    ) {
      console.error(
        "Users table not found. Please create the users table manually in your database.",
      );
    }
    await ctx.reply(
      "❌ Error registering you as admin. Please check the logs.",
    );
  }
});

// Handle errors
bot.catch((err, ctx) => {
  console.error("Bot error:", err);
  ctx.reply("An error occurred. Please try again later.");
});

// Start the bot with long polling and drop pending updates
bot.launch({ dropPendingUpdates: true });

// Enable graceful stop
process.once("SIGINT", () => {
  bot.stop("SIGINT");
  prisma.$disconnect();
});

process.once("SIGTERM", () => {
  bot.stop("SIGTERM");
  prisma.$disconnect();
});
