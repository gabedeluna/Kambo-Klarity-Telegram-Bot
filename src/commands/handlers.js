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

// Stub for /dashboard command (admin)
async function dashboardStub(ctx) {
  await ctx.reply(
    "Admin dashboard command placeholder. This will link to the web admin interface.",
  );
}

// Stub for /broadcast command (admin)
async function broadcastStub(ctx) {
  await ctx.reply("Broadcast command placeholder.");
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
  dashboardStub,
  broadcastStub,
};
