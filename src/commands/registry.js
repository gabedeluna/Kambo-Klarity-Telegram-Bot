/**
 * @fileoverview Central registry for Telegram bot command handlers.
 * Organizes commands by user role (client, admin) and provides
 * descriptions and handler functions for each command.
 */

const {
  handleClientHelpStub,
  handleAdminHelpStub,
  startBookingStub,
  handleCancelStub,
  handleProfileStub,
  handleContactAdminStub,
  handleReferralStub,
  listSessionsStub,
  listClientsStub,
  addSessionTypeStub,
  removeSessionTypeStub,
  blockTimeStub,
  unblockTimeStub,
  broadcastStub,
  packageAddStub,
  packageListStub,
  voucherAddStub,
  voucherListStub,
  analyzeStub,
} = require("./handlers");

// --- Command Registry ---

const commandRegistry = {
  client: {
    help: {
      descr: "Show commands available to you.",
      handler: handleClientHelpStub,
    },
    book: {
      descr: "Start the session booking process.",
      handler: startBookingStub,
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
    clients: { descr: "List registered clients.", handler: listClientsStub },
    session_add: {
      descr: "Add a new session type offering.",
      handler: addSessionTypeStub,
    },
    session_del: {
      descr: "Remove an existing session type offering.",
      handler: removeSessionTypeStub,
    },
    block_time: {
      descr: "Block out time slots as unavailable.",
      handler: blockTimeStub,
    },
    unblock_time: {
      descr: "Make previously blocked time slots available.",
      handler: unblockTimeStub,
    },
    broadcast: {
      descr: "Send a message to all or a subset of clients.",
      handler: broadcastStub,
    },
    package_add: {
      descr: "Add a new session package.",
      handler: packageAddStub,
    },
    package_list: {
      descr: "List existing session packages.",
      handler: packageListStub,
    },
    voucher_add: {
      descr: "Create a new discount voucher.",
      handler: voucherAddStub,
    },
    voucher_list: {
      descr: "List existing vouchers.",
      handler: voucherListStub,
    },
    analyze: { descr: "Get analytics or reports.", handler: analyzeStub },
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
