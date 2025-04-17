// Loads variables from your .env file into process.env (keeps secrets out of code)
require('dotenv').config();
// Imports the Telegraf SDK’s main Telegraf class
const { Telegraf } = require('telegraf');
// Instantiates the bot with the token from your .env file
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
// Registers a handler for incoming text messages — echoes back the user’s message
const prisma = require('@prisma/client').PrismaClient ?
               new (require('@prisma/client').PrismaClient)() : null;

bot.command('rememberme', async ctx => {
  await prisma.test_user.upsert({
    where: { id: BigInt(ctx.from.id) },
    create: { id: BigInt(ctx.from.id), firstName: ctx.from.first_name },
    update: {}
  });
  ctx.reply('Got it – I will remember you.');
});
bot.on('text', ctx => ctx.reply(`You said: ${ctx.message.text}`));

// Starts the bot via long-polling (no webhook needed)
bot.launch();  // long‑polling – works even offline
// Logs confirmation that the bot started successfully
console.log('Bot is running...');
