/**
 * @fileoverview Central registry for Telegram bot command handlers.
 * Organizes commands by user role (client, admin) and provides
 * descriptions and handler functions for each command.
 */

const {
  handleClientHelpStub,
  handleAdminHelpStub,
  handleCancelStub,
  handleProfileStub,
  handleContactAdminStub,
  handleReferralStub,
  listSessionsStub,
  dashboardStub,
  broadcastStub,
} = require("./handlers");

const { handleBookCommand } = require('./client/book');

// --- Command Registry ---

const commandRegistry = {
  client: {
    help: {
      descr: "Show commands available to you.",
      handler: handleClientHelpStub,
    },
    book: {
      descr: "Start the session booking process.",
      handler: handleBookCommand,
    },
    cancel: {
      descr: "Cancel a confirmed, scheduled session.",
      handler: handleCancelStub,
    },
    profile: {
      descr: "View or manage your profile.",
      handler: handleProfileStub,
    },
    contact_admin: {
      descr: "Send a message to the admin.",
      handler: handleContactAdminStub,
    },
    referral: {
      descr: "Get your referral code or information.",
      handler: handleReferralStub,
    },
  },
  admin: {
    help: {
      descr: "Show admin commands available to you.",
      handler: handleAdminHelpStub,
    },
    sessions: {
      descr: "List upcoming or recent sessions.",
      handler: listSessionsStub,
    },
    dashboard: {
      descr: "Access the web admin dashboard.",
      handler: dashboardStub,
    },
    broadcast: {
      descr: "Send a message to all or a subset of clients.",
      handler: broadcastStub,
    },
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
