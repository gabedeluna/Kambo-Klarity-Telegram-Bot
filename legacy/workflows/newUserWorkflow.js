// ======================================================================
// WORKFLOW: New User Registration
// ======================================================================
// Purpose: Detect new Telegram users and send them a registration form link via web_app button
// Input: Telegram update indicating new user context (ctx.state.isNewUser)
// Output: Telegram inline button message with registration form URL

module.exports = {
  name: "newUser",
  enabled: true,
  async trigger(ctx) {
    const wf = this.name; // Workflow name for logging scope

    // ======================================================================
    // NODE: entry
    // ======================================================================
    // Purpose: Skip workflow if not a new user, log entry
    // Input: ctx.state.isNewUser
    // Output: Continue or exit
    if (!ctx.state.isNewUser) {
      console.log(`⏭ [${wf}/entry] Skipped (not a new user)`);
      return;
    }
    console.log(`🔄 [${wf}/entry] Handling new user: ${ctx.from.id}`);

    // ======================================================================
    // NODE: generateUrl
    // ======================================================================
    // Purpose: Build registration form URL with telegramId and bot server URL
    // Input: ctx.from.id, FORM_SERVER_URL, NGROK_URL
    // Output: formUrl string
    const firstName = ctx.from?.first_name || "there";
    const formUrl = `${process.env.FORM_SERVER_URL}/registration-form.html?telegramId=${ctx.from.id}&botServerUrl=${encodeURIComponent(process.env.NGROK_URL)}`;
    console.log(`🔄 [${wf}/generateUrl] Form URL: ${formUrl}`);

    // ======================================================================
    // NODE: sendMessage
    // ======================================================================
    // Purpose: Send registration invite to new user via Telegram
    // Input: firstName, formUrl
    // Output: Inline web_app button message
    try {
      await ctx.reply(
        `Welcome to the Kambo Klarity Bot, ${firstName}! 🐸 It looks like you are new here.\n\nPlease complete the registration form to get started. Click the button below 👇`,
        Markup.inlineKeyboard([
          Markup.button.webApp("📝 Register Here", formUrl),
        ]),
      );
      console.log(`✅ [${wf}/sendMessage] Registration message sent.`);
    } catch (error) {
      console.error(
        `❌ [${wf}/sendMessage] Error sending registration message:`,
        error,
      );
    }
  },
};
