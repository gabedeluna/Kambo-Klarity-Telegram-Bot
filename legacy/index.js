// Loads variables from your .env file into process.env (keeps secrets out of code)
require('dotenv').config();
// Imports the Telegraf SDK's main Telegraf class
const { Telegraf } = require('telegraf');
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

// Bot commands
bot.command('rememberme', async ctx => {
  await prisma.test_user.upsert({
    where: { id: BigInt(ctx.from.id) },
    create: { id: BigInt(ctx.from.id), firstName: ctx.from.first_name },
    update: {}
  });
  ctx.reply('Got it – I will remember you.');
});

bot.on('text', ctx => ctx.reply(`You said: ${ctx.message.text}`));

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot server is running on port ${PORT}`);
  console.log(`Webhook URL: ${process.env.NGROK_URL}/webhook/${WEBHOOK_SECRET}`);
});
