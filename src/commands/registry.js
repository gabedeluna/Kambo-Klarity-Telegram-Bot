/**
 * @fileoverview Central registry for Telegram bot command handlers.
 * Organizes commands by user role (client, admin) and provides
 * descriptions and handler functions for each command.
 */

// --- Stub Handlers ---
// These are placeholders until actual command logic is implemented.

const handleHelpStub = (ctx) => ctx.reply("stub: /help command");
const handleBookStub = (ctx) => ctx.reply("stub: /book command");
const handleCancelStub = (ctx) => ctx.reply("stub: /cancel command");
const handleSessionsStub = (ctx) => ctx.reply("stub: /sessions command");
const handleClientsStub = (ctx) => ctx.reply("stub: /clients command");
const handleSessionAddStub = (ctx) => ctx.reply("stub: /session_add command");
const handleSessionDelStub = (ctx) => ctx.reply("stub: /session_del command");

// --- Command Registry ---

const commandRegistry = {
  client: {
    help: {
      descr: "Show available commands",
      handler: handleHelpStub,
    },
    book: {
      descr: "Start the session booking process",
      handler: handleBookStub,
    },
    cancel: {
      descr: "Cancel an ongoing booking or a scheduled session",
      handler: handleCancelStub,
    },
    // Add other client commands here if needed based on future requirements
  },
  admin: {
    sessions: {
      descr: "List upcoming or recent sessions",
      handler: handleSessionsStub,
    },
    clients: {
      descr: "List registered clients",
      handler: handleClientsStub,
    },
    session_add: {
      descr: "Add a new type of session offering",
      handler: handleSessionAddStub,
    },
    session_del: {
      descr: "Remove an existing session type offering",
      handler: handleSessionDelStub,
    },
    // Add other admin commands here if needed based on future requirements
  },
};

/**
 * Central registry for bot commands.
 *
 * Organised into 'client' and 'admin' categories.
 * Each command entry contains:
 *  - `descr`: A string describing the command's purpose.
 *  - `handler`: The function to execute when the command is invoked.
 */
module.exports = commandRegistry;
