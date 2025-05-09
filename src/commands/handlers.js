// src/commands/handlers.js
// Placeholder stub functions

async function handleClientHelpStub(ctx) {
  // In future, this will build a help message from commandRegistry.client
  await ctx.reply("Stub: Client Help - List of your available commands.");
  // logger.info({ userId: ctx.from?.id }, "Client help stub executed."); // Add if logger is injected
}

async function handleAdminHelpStub(ctx) {
  // In future, this will build a help message from commandRegistry.admin
  await ctx.reply("Stub: Admin Help - List of your admin commands.");
  // logger.info({ userId: ctx.from?.id }, "Admin help stub executed."); // Add if logger is injected
}

// Client command stubs
async function startBookingStub(ctx) {
  await ctx.reply("Stub: /book command");
}
async function handleCancelStub(ctx) {
  await ctx.reply("Stub: /cancel command");
}
async function handleProfileStub(ctx) {
  await ctx.reply("Stub: /profile command");
}
async function handleContactAdminStub(ctx) {
  await ctx.reply("Stub: /contact_admin command");
}
async function handleReferralStub(ctx) {
  await ctx.reply("Stub: /referral command");
}

// Admin command stubs
async function listSessionsStub(ctx) {
  await ctx.reply("Stub: /sessions command (admin)");
}
async function listClientsStub(ctx) {
  await ctx.reply("Stub: /clients command (admin)");
}
async function addSessionTypeStub(ctx) {
  await ctx.reply("Stub: /session_add command (admin)");
}
async function removeSessionTypeStub(ctx) {
  await ctx.reply("Stub: /session_del command (admin)");
}
async function blockTimeStub(ctx) {
  await ctx.reply("Stub: /block_time command (admin)");
}
async function unblockTimeStub(ctx) {
  await ctx.reply("Stub: /unblock_time command (admin)");
}
async function broadcastStub(ctx) {
  await ctx.reply("Stub: /broadcast command (admin)");
}
async function packageAddStub(ctx) {
  await ctx.reply("Stub: /package_add command (admin)");
}
async function packageListStub(ctx) {
  await ctx.reply("Stub: /package_list command (admin)");
}
async function voucherAddStub(ctx) {
  await ctx.reply("Stub: /voucher_add command (admin)");
}
async function voucherListStub(ctx) {
  await ctx.reply("Stub: /voucher_list command (admin)");
}
async function analyzeStub(ctx) {
  await ctx.reply("Stub: /analyze command (admin)");
}

module.exports = {
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
};
