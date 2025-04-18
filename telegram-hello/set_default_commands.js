// set_default_commands.js
require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

(async () => {
  try {
    // Define your default commands here
    const defaultCommands = [
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'Get help' },
      { command: 'info', description: 'Bot info' }
    ];

    await bot.telegram.setMyCommands(defaultCommands, { scope: { type: 'default' } });
    console.log('Default commands set successfully:', defaultCommands);
    process.exit(0);
  } catch (error) {
    console.error('Failed to set default commands:', error);
    process.exit(1);
  }
})();
