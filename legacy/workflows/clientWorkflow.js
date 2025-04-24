// workflows/clientWorkflow.js
// ======================================================================
// WORKFLOW: Client Workflow
// ======================================================================
// Purpose: Handle Telegram text messages from existing clients; respond to inputs
// Input: Telegram text updates for users with role 'client'
// Output: Telegram replies confirming receipt and any relevant info

// ======================================================================
// WORKFLOW NODE: client
// ======================================================================
// Purpose: Handle messages from existing client users
// Input: ctx with state.user.role 'client' and message content
// Output: Telegram reply to client

module.exports = {
  name: 'client',
  enabled: true,
  async trigger(ctx) {
    const wf = this.name; // Workflow name for logging scope

    // ======================================================================
    // NODE: entry
    // ======================================================================
    // Purpose: Skip workflow if not a client user
    // Input: ctx.state.user.role
    // Output: Continue or exit

    if (ctx.state.user?.role !== 'client') {
      console.log(`⏭ [${wf}/entry] Skipped (role is not client or user data missing)`);
      return;
    }
    console.log(`🔄 [${wf}/entry] Handling client message from user ${ctx.state.user.client_id}`);

    // ======================================================================
    // NODE: processMessage
    // ======================================================================
    // Purpose: Log and reply to client messages
    // Input: ctx.message.text
    // Output: Telegram reply

    const messageText = ctx.message?.text || '(No text content)';
    console.log(`🔄 [${wf}/processMessage] Input text: "${messageText}"`);
    // --- Your client-specific logic here ---
    // Example: Handle commands or provide info
    await ctx.reply(`Hello ${ctx.state.user.first_name || 'client'}, I received your message! (Client Workflow)`);
    console.log(`✅ [${wf}/processMessage] Processed client message.`);
  }
};
