// workflows/adminWorkflow.js
// ======================================================================
// WORKFLOW: Admin Workflow
// ======================================================================
// Purpose: Handle Telegram commands/messages from admin users
// Input: Telegram text updates for users with role 'admin'
// Output: Telegram replies acknowledging admin actions and performing admin tasks



module.exports = {
  name: 'admin',
  enabled: true,
  async trigger(ctx) {
    const wf = this.name; // Workflow name for logging scope
    
    // ======================================================================
    // NODE: entry
    // ======================================================================
    // Purpose: Skip workflow if not an admin user
    // Input: ctx.state.user.role
    // Output: Continue or exit
    if (ctx.state.user?.role !== 'admin') {
      console.log(`⏭ [${wf}/entry] Skipped (role is not admin or user data missing)`);
      return;
    }
    console.log(`🔄 [${wf}/entry] Handling admin command from user ${ctx.state.user.client_id}`);

    // ======================================================================
    // NODE: processCommand
    // ======================================================================
    // Purpose: Log and execute admin commands
    // Input: ctx.message.text
    // Output: Telegram reply
    const commandText = ctx.message?.text || '(No text content)';
    console.log(`🔄 [${wf}/processCommand] Input command: "${commandText}"`);
    // --- Your admin-specific logic here ---
    // Example: Handle admin commands
    await ctx.reply(`Acknowledged, Admin ${ctx.state.user.first_name || ''}! (Admin Workflow)`);
    console.log(`✅ [${wf}/processCommand] Processed admin command.`);
  }
};
