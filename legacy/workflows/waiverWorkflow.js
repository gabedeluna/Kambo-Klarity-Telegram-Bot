// ======================================================================
// WORKFLOW: Waiver Workflow
// ======================================================================
// Purpose: Handle waiver form submissions and update booking status
// Input: Telegram callback_query from waiver form submissions
// Output: Confirmation messages and updated session records

// Set default workflow name for logging
const WORKFLOW_NAME = 'WAIVER_WORKFLOW';

const { Markup } = require('telegraf');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
  name: WORKFLOW_NAME,
  enabled: true,

  // ======================================================================
  // [NODE_TYPE: ENTRY_POINT]
  // ======================================================================
  // Purpose: Detect waiver callback and route submission
  // Input: ctx (Telegraf context)
  // Output: Invokes handleWaiverSubmission or exits
  async trigger(ctx) {
    const wf = this.name;
    console.log(`🔄 [${wf}/entry] Checking callback data`);
    const data = ctx.update?.callback_query?.data;
    if (!data?.startsWith('waiver:')) {
      console.log(`⚪️ [${wf}/entry] Not a waiver callback. Exiting.`);
      return;
    }
    await ctx.answerCbQuery().catch(() => {});
    const sessionId = data.split(':')[1];
    if (!sessionId) {
      console.error(`❌ [${wf}/entry] Missing sessionId in callback.`);
      return;
    }
    console.log(`🔄 [${wf}/entry] Routing session ${sessionId}`);
    await this.handleWaiverSubmission(ctx, sessionId, wf);
  },

  // ======================================================================
  // [NODE_TYPE: PROCESS_WAIVER_SUBMISSION]
  // ======================================================================
  // Purpose: Core business logic for waiver form submissions
  // Input: formData (from POST /api/submit-waiver)
  // Output: { success, sessionId, message }
  async processWaiverSubmission(formData) {
    // Use the workflow name constant if this.name is undefined
    const wf = this.name || WORKFLOW_NAME;
    console.log(`🔄 [${wf}/process] Input:`, formData);

    try {
      // ======================================================================
      // [NODE_TYPE: VALIDATION_NODE]
      // ======================================================================
      // Purpose: Validate required form fields
      // Input: Form data
      // Output: Validation result
      console.log(`🔄 [${wf}/process/validation] Validating required fields`);
      const telegramId = formData.telegramId;
      const signature = formData.signature;
      
      if (!telegramId || !signature) {
        console.error(`❌ [${wf}/process/validation] Missing required fields`);
        return { success: false, message: 'Missing required fields' };
      }
      
      // ======================================================================
      // [NODE_TYPE: USER_LOOKUP_NODE]
      // ======================================================================
      // Purpose: Find user in database
      // Input: Telegram ID
      // Output: User record or error
      console.log(`🔄 [${wf}/process/user-lookup] Looking up user with telegram_id: ${telegramId}`);
      const user = await prisma.users.findUnique({ where: { telegram_id: BigInt(telegramId) } });
      if (!user) {
        console.error(`❌ [${wf}/process/user-lookup] User not found: ${telegramId}`);
        return { success: false, message: 'User not found' };
      }
      console.log(`✅ [${wf}/process/user-lookup] Found user: ${user.first_name} ${user.last_name}`);
      
      // ======================================================================
      // [NODE_TYPE: SESSION_CREATION_NODE]
      // ======================================================================
      // Purpose: Create session record in database
      // Input: User data and form data
      // Output: Session record
      console.log(`🔄 [${wf}/process/session-creation] Creating session record`);
      
      // Extract form fields safely
      const firstName = formData.firstName || user.first_name;
      const lastName = formData.lastName || user.last_name;
      const email = formData.email || user.email;
      const phone = formData.phone || user.phone_number;
      const dob = formData.dob;
      const emergencyFirstName = formData.emergencyFirstName;
      const emergencyLastName = formData.emergencyLastName;
      const emergencyPhone = formData.emergencyPhone;
      const appointmentDateTime = formData.appointmentDateTime;
      
      // Format appointment datetime
      let appointmentDate = null;
      if (appointmentDateTime) {
        appointmentDate = new Date(appointmentDateTime);
      } else if (user.booking_slot) {
        appointmentDate = new Date(user.booking_slot);
      }
      
      // Create session with proper data mapping
      const session = await prisma.sessions.create({
        data: {
          first_name: firstName,
          last_name: lastName,
          telegram_id: user.telegram_id,
          appointment_datetime: appointmentDate,
          liability_form_data: formData, // Store complete form data as JSON
          session_status: 'SCHEDULED',
          created_at: new Date(),
        },
      });
      console.log(`✅ [${wf}/process/session-creation] Created session with ID: ${session.id}`);
      
      // ======================================================================
      // [NODE_TYPE: USER_UPDATE_NODE]
      // ======================================================================
      // Purpose: Update user record with all form data to keep profile current
      // Input: User telegram ID, form data
      // Output: Updated user record
      console.log(`🔄 [${wf}/process/user-update] Updating user record for: ${telegramId}`);
      
      // Log changes for tracking
      if (firstName !== user.first_name || lastName !== user.last_name) {
        console.log(`🔄 [${wf}/process/user-update] Updating name from "${user.first_name} ${user.last_name}" to "${firstName} ${lastName}"`);
      }
      if (email !== user.email) {
        console.log(`🔄 [${wf}/process/user-update] Updating email from "${user.email}" to "${email}"`);
      }
      if (phone !== user.phone_number) {
        console.log(`🔄 [${wf}/process/user-update] Updating phone from "${user.phone_number}" to "${phone}"`);
      }
      
      // Update all user information
      await prisma.users.update({ 
        where: { telegram_id: BigInt(telegramId) }, 
        data: { 
          // Clear booking slot after session creation
          booking_slot: null,
          
          // Update basic user information
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone_number: phone,
          date_of_birth: dob ? new Date(dob) : user.date_of_birth,
          
          // Store emergency contact information
          em_first_name: emergencyFirstName,
          em_last_name: emergencyLastName,
          em_phone_number: emergencyPhone,
          
          // Update last form submission timestamp
          updated_at: new Date()
        } 
      });
      
      console.log(`✅ [${wf}/process/user-update] Updated user profile with all form data`);
      console.log(`✅ [${wf}/process] Waiver submission processed successfully`);
      
      return { 
        success: true, 
        sessionId: session.id, 
        message: 'Waiver submitted successfully' 
      };
    } catch (error) {
      console.error(`❌ [${wf}/process] Error:`, error);
      return { success: false, message: 'Internal server error: ' + error.message };
    }
  },

  // ======================================================================
  // [NODE_TYPE: HANDLE_WAIVER_SUBMISSION]
  // ======================================================================
  // Purpose: Confirm booking and edit original message
  // Input: ctx (Telegraf context), sessionId, workflow name
  // Output: Updated message without inline keyboard
  async handleWaiverSubmission(ctx, sessionId, workflowName) {
    const wf = workflowName || WORKFLOW_NAME;
    console.log(`🔄 [${wf}/handle] Start for session ${sessionId}`);
    try {
      await ctx.answerCbQuery().catch(() => {});
      
      // ======================================================================
      // [NODE_TYPE: SESSION_LOOKUP_NODE]
      // ======================================================================
      // Purpose: Find session by ID
      // Input: Session ID
      // Output: Session record or error
      console.log(`🔄 [${wf}/handle/session-lookup] Looking up session with ID: ${sessionId}`);
      const session = await prisma.sessions.findUnique({ 
        where: { id: parseInt(sessionId) } 
      });
      if (!session) {
        console.error(`❌ [${wf}/handle] Session not found: ${sessionId}`);
        await ctx.editMessageText("❌ Session not found. Please contact support.", { parse_mode: 'HTML' });
        return;
      }
      // ======================================================================
      // [NODE_TYPE: SESSION_UPDATE_NODE]
      // ======================================================================
      // Purpose: Update session status to CONFIRMED
      // Input: Session ID
      // Output: Updated session record
      console.log(`🔄 [${wf}/handle/session-update] Updating session status to CONFIRMED`);
      await prisma.sessions.update({ 
        where: { id: parseInt(sessionId) }, 
        data: { session_status: 'CONFIRMED' } 
      });
      const appointmentDate = new Date(session.appointment_datetime);
      const formattedDate = appointmentDate.toLocaleString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
        year: 'numeric', hour: 'numeric', minute: '2-digit',
        timeZone: 'America/Chicago',
      });
      await ctx.editMessageText(
        `✅ <b>Booking Confirmed!</b>\n\n` +
        `Your Kambo session is scheduled for:\n` +
        `<b>${formattedDate} Central Time</b>\n\n` +
        `You will receive reminder messages 48 hours and 12 hours before your appointment.\n\n` +
        `If you need to reschedule, please use the /reschedule command.`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } }
      );
      console.log(`✅ [${wf}/handle] Done for session ${sessionId}`);
    } catch (error) {
      console.error(`❌ [${wf}/handle] Error:`, error);
      await ctx.editMessageText("❌ There was an error processing your booking. Please contact support.", { parse_mode: 'HTML' });
    }
  }
};