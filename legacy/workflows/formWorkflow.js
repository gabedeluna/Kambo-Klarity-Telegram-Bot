// ======================================================================
// WORKFLOW: Form Registration
// ======================================================================
// Purpose: Handle HTTP registration form submissions; save user data to DB and notify admin via Telegram
// Input: HTTP POST to /submit-registration with form data
// Output: HTTP JSON response and admin/client Telegram messages
// NOTE: This is triggered by the Express /submit-registration route, NOT the dispatcher.

// We need access to prisma and bot/telegraf API instance.
// These will be passed in from bot.js when calling the handler.

module.exports = {
  name: 'form',
  // No 'enabled' or 'trigger' needed as it's not loaded by the dispatcher

  // Handler function to be called by the Express route
  async handleSubmission(req, res, { prisma, bot }) {
    const wf = this.name;

    // ======================================================================
    // NODE: entry
    // ======================================================================
    // Purpose: Entry point for HTTP POST registration form submission
    // Input: req.body (form data)
    // Output: Initiates workflow for registration logic
    console.log(`🔄 [${wf}/entry] Received form submission via HTTP POST`);
    console.log(`🔄 [${wf}/parseData] Request Body:`, req.body);

    // ======================================================================
    // NODE: parseData
    // ======================================================================
    // Purpose: Extract fields from form submission
    // Input: req.body
    // Output: Variables for user info
    const { telegramId: telegramIdString, firstName, lastName, email, dateOfBirth, reasonForSeeking, phoneNumber } = req.body;

    // ======================================================================
    // NODE: validateData
    // ======================================================================
    // Purpose: Ensure all required fields are present and valid
    // Input: Extracted form fields
    // Output: 400 error if invalid, else continue
    console.log(`🔄 [${wf}/validateData] Raw form data:`, req.body);
    if (!telegramIdString || !firstName || !lastName || !phoneNumber) {
      console.error(`❌ [${wf}/validateData] Validation failed: Missing required fields.`);
      return res.status(400).json({ error: 'Missing required form fields.' });
    }

    let telegramId;
    try {
      telegramId = BigInt(telegramIdString);
      console.log(`✅ [${wf}/validateData] Form data validated. Parsed Telegram ID: ${telegramId}`);
    } catch (error) {
      console.error(`❌ [${wf}/validateData] Invalid Telegram ID format: ${telegramIdString}`, error);
      return res.status(400).json({ error: 'Invalid Telegram ID format.' });
    }

    // ======================================================================
    // NODE: saveToDb
    // ======================================================================
    // Purpose: Upsert user record in database (create if new, update if exists)
    // Input: Validated user fields
    // Output: User record in DB, or error

    let newUser;
    try {
      console.log(`🔄 [${wf}/saveToDb] Attempting to create/update user with Telegram ID: ${telegramId}`);
      console.log(`🔄 [${wf}/saveToDb] User fields:`, {
        firstName, lastName, phoneNumber, email, dateOfBirth, reasonForSeeking
      });
      console.log(`🔄 [${wf}/saveToDb] Additional fields:`, {
        email, phoneNumber, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null, reasonForSeeking
      });
      // Using upsert to handle potential re-submissions or race conditions
      newUser = await prisma.users.upsert({
        where: { telegram_id: telegramId },
        update: {
          first_name: firstName,
          last_name: lastName,
          phone_number: phoneNumber,
          email: email,
          date_of_birth: dateOfBirth ? new Date(dateOfBirth) : null,
          reason_for_seeking: reasonForSeeking,
          role: 'client', // Assign role upon registration
        },
        create: {
          telegram_id: telegramId,
          first_name: firstName,
          last_name: lastName,
          phone_number: phoneNumber,
          email: email,
          date_of_birth: dateOfBirth ? new Date(dateOfBirth) : null,
          reason_for_seeking: reasonForSeeking,
          role: 'client',
        },
      });
      console.log(`✅ [${wf}/saveToDb] User data saved to DB:`, newUser);

    } catch (error) {
      console.error(`❌ [${wf}/saveToDb] Error saving user data:`, error);
      // Consider sending an error message back to the user via Telegram?
      return res.status(500).json({ error: 'Database error during registration.' });
    }

    // ======================================================================
    // NODE: findAdmin
    // ======================================================================
    // Purpose: Find an admin user in the database to notify about new registration
    // Input: Database connection
    // Output: adminUser object or null
    let adminUser;
    try {
      adminUser = await prisma.users.findFirst({
        where: { role: 'admin' }, // Simple lookup, adjust if you have multiple admins
      });
      if (adminUser) {
        console.log(`🔄 [${wf}/findAdmin] Found admin user: ${adminUser.telegram_id}`);
      } else {
        console.warn(`⚠️ [${wf}/findAdmin] No admin user found in the database.`);
      }
    } catch (error) {
      console.error(`❌ [${wf}/findAdmin] Error looking up admin user:`, error);
      // Continue without admin notification if lookup fails
    }

    // ======================================================================
    // NODE: notifyAdmin
    // ======================================================================
    // Purpose: Notify admin via Telegram about new user registration
    // Input: adminUser, user registration details
    // Output: Telegram message to admin
    if (adminUser && adminUser.telegram_id) {
      try {
        const adminMessage = `📢 New user registered!
Name: ${firstName} ${lastName}
Telegram ID: ${telegramIdString}`;
        await bot.telegram.sendMessage(String(adminUser.telegram_id), adminMessage);
        console.log(`✅ [${wf}/notifyAdmin] Admin notified.`);
      } catch (error) {
        console.error(`❌ [${wf}/notifyAdmin] Failed to send notification to admin:`, error);
      }
    }

    // ======================================================================
    // NODE: welcomeClient
    // ======================================================================
    // Purpose: Send a welcome message to the new user via Telegram
    // Input: telegramIdString, firstName
    // Output: Telegram message to client
    try {
      const welcomeMessage = `🎉 Welcome to the Kambo Klarity tribe, ${firstName}! 🎉\n\nYou are now registered.\n\nHere are some things you can do:\n- Type /help to see available commands.\n- Ask questions about Kambo.\n- Schedule a session (coming soon!).\n\nWe're glad to have you!`;
      await bot.telegram.sendMessage(telegramIdString, welcomeMessage);
      console.log(`✅ [${wf}/welcomeClient] Welcome message sent to new user ${telegramIdString}.`);
    } catch (error) {
      console.error(`❌ [${wf}/welcomeClient] Failed to send welcome message to ${telegramIdString}:`, error);
    }

    // ======================================================================
    // NODE: exit
    // ======================================================================
    // Purpose: Respond to HTTP request indicating successful registration
    // Input: None
    // Output: HTTP 200 JSON response
    console.log(`✅ [${wf}/exit] Form processing complete. Responding 200 OK to the web app.`);
    res.status(200).json({ message: 'Registration successful!' });
  }
};
