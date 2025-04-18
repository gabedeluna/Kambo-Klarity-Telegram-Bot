// Loads variables from your .env file into process.env (keeps secrets out of code)
require('dotenv').config();
// Imports the Telegraf SDK's main Telegraf class
const { Telegraf, Markup } = require('telegraf');
// Instantiates the bot with the token from your .env file
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
// For webhook verification
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
// Create Express app for webhook handling
const express = require('express');
const app = express();

// Prisma client for database operations
const prisma = require('@prisma/client').PrismaClient ?
               new (require('@prisma/client').PrismaClient)() : null;

// Configure middleware to parse JSON
app.use(express.json());

// Webhook endpoint
app.post(`/webhook/${WEBHOOK_SECRET}`, (req, res) => {
  bot.handleUpdate(req.body);
  res.status(200).send('OK');
});

// Webhook GET endpoint for testing
app.get(`/webhook/${WEBHOOK_SECRET}`, (req, res) => {
  res.status(200).send('Webhook endpoint is up!');
});

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).send('Kambo Klarity Telegram Bot is running!');
});

// Middleware to check user existence and role
bot.use(async (ctx, next) => {
  if (!ctx.from) return next();
  
  try {
    const telegramId = BigInt(ctx.from.id);
    const user = await prisma.users.findUnique({
      where: { telegram_id: telegramId }
    });
    
    // Attach user to context for later use
    ctx.user = user;
    
    return next();
  } catch (error) {
    console.error('Error checking user:', error);
    return next();
  }
});

// Handle routing based on user role
bot.on('message', async (ctx) => {
  console.log('Received message:', ctx.message);
  // Skip if not a text message
  if (!ctx.message.text) return;
  
  // Handle commands separately
  if (ctx.message.text.startsWith('/')) {
    return; // Let command handlers take care of this
  }
  
  const telegramId = BigInt(ctx.from.id);
  
  // Check if user exists
  if (!ctx.user) {
    // New user flow
    await handleNewUser(ctx, telegramId);
  } else if (ctx.user.role === 'admin') {
    // Admin flow
    await handleAdminMessage(ctx);
  } else if (ctx.user.role === 'client') {
    // Client flow
    await handleClientMessage(ctx);
  } else {
    // Default flow for unknown roles
    await ctx.reply('Hello! I\'m not sure how to help you. Please use /help for available commands.');
  }
});

// Handle new user registration
async function handleNewUser(ctx, telegramId) {
  const firstName = ctx.from.first_name || '';
  
  // Send welcome message with mini app button
  await ctx.reply(
    `Welcome to the Kambo Klarity Bot, ${firstName}! 🐸\n\nTo get started, please tell us a bit about yourself by filling out this secure form.`,
    Markup.inlineKeyboard([
      Markup.button.webApp('Fill Registration Form', `${process.env.FORM_SERVER_URL || 'http://localhost:3001'}/registration`)
    ])
  );
}

// Handle messages from admin users
async function handleAdminMessage(ctx) {
  await ctx.reply('Admin message received. What would you like to do?');
}

// Handle messages from client users
async function handleClientMessage(ctx) {
  await ctx.reply('Thank you for your message. How can I assist you today?');
}

// Handle web app data (form submission)
bot.on('web_app_data', async (ctx) => {
  try {
    console.log('Received web_app_data.raw:', ctx.webAppData.data);
    const formData = JSON.parse(ctx.webAppData.data);
    console.log('Parsed formData:', formData);
    const telegramId = BigInt(ctx.from.id);
    console.log('Upserting user for Telegram ID:', telegramId);

    // Update or create user with form data
    const upsertedUser = await prisma.users.upsert({
      where: { telegram_id: telegramId },
      update: {
        first_name: formData.firstName || ctx.from.first_name,
        last_name: formData.lastName || ctx.from.last_name,
        phone_number: formData.phoneNumber,
        email: formData.email,
        date_of_birth: formData.dateOfBirth ? new Date(formData.dateOfBirth) : null,
        reason_for_seeking: formData.reasonForSeeking,
        role: 'client',
        state: 'REGISTERED'
      },
      create: {
        telegram_id: telegramId,
        first_name: formData.firstName || ctx.from.first_name,
        last_name: formData.lastName || ctx.from.last_name,
        phone_number: formData.phoneNumber,
        email: formData.email,
        date_of_birth: formData.dateOfBirth ? new Date(formData.dateOfBirth) : null,
        reason_for_seeking: formData.reasonForSeeking,
        role: 'client',
        state: 'REGISTERED'
      }
    });
    console.log('Prisma upsert result:', upsertedUser);

    // Send confirmation message
    await ctx.reply(
      "Thank you! Your information has been received. Welcome to the Kambo Klarity tribe! 🐸\n\nYou can now use commands like `/book` to schedule a session or `/help` for assistance."
    );
    
  } catch (error) {
    console.error('Error processing form data:', error);
    await ctx.reply('Sorry, there was an error processing your information. Please try again or contact support.');
  }
});

// Command handlers
bot.command('start', async (ctx) => {
  const telegramId = BigInt(ctx.from.id);
  console.log('Received /start command');
  
  // Check if user exists
  if (!ctx.user) {
    // New user flow
    await handleNewUser(ctx, telegramId);
  } else {
    await ctx.reply(`Welcome back to Kambo Klarity, ${ctx.user.first_name || 'friend'}! 🐸\nHow can I assist you today?`);
  }
});

bot.command('help', async (ctx) => {
  let helpMessage = 'Here are the available commands:\n\n';
  
  if (!ctx.user || ctx.user.role === 'client') {
    helpMessage += '/book - Schedule a Kambo session\n';
    helpMessage += '/info - Learn more about Kambo\n';
    helpMessage += '/profile - View your profile information\n';
    helpMessage += '/help - Show this help message';
  } else if (ctx.user.role === 'admin') {
    helpMessage += '/book - Schedule a Kambo session\n';
    helpMessage += '/info - Learn more about Kambo\n';
    helpMessage += '/profile - View your profile information\n';
    helpMessage += '/clients - View all clients\n';
    helpMessage += '/sessions - View all sessions\n';
    helpMessage += '/help - Show this help message';
  }
  
  await ctx.reply(helpMessage);
});

bot.command('book', async (ctx) => {
  // Check if user exists and is registered
  if (!ctx.user) {
    await ctx.reply('Please register first to book a session.');
    await handleNewUser(ctx, BigInt(ctx.from.id));
    return;
  }
  
  await ctx.reply('Booking functionality coming soon!');
});

// Start the server
const PORT = process.env.PORT || 3000;
const NGROK_URL = process.env.NGROK_URL;
app.listen(PORT, () => {
  console.log(`Bot server is running on port ${PORT}`);
  console.log(`Webhook URL: ${NGROK_URL}/webhook/${WEBHOOK_SECRET}`);
});

// Enable graceful stop
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  if (prisma) prisma.$disconnect();
});

process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  if (prisma) prisma.$disconnect();
});