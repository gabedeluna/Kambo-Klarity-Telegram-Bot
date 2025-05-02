// src/handlers/registrationHandler.js
let prisma, logger, telegramNotifier, bot;

/**
 * Initializes the registration handler with dependencies.
 * @param {object} deps - Dependencies object.
 * @param {import('@prisma/client').PrismaClient} deps.prisma - Prisma client instance.
 * @param {object} deps.logger - Logger instance.
 * @param {object} deps.telegramNotifier - Initialized telegramNotifier tool module.
 * @param {import('telegraf').Telegraf} deps.bot - Telegraf bot instance.
 */
function initialize(deps) {
  if (!deps.prisma || !deps.logger || !deps.telegramNotifier || !deps.bot) {
    console.error(
      "FATAL: registrationHandler initialization failed. Missing dependencies.",
    );
    process.exit(1);
  }
  prisma = deps.prisma;
  logger = deps.logger;
  telegramNotifier = deps.telegramNotifier;
  bot = deps.bot; // Store bot instance
  logger.info("[registrationHandler] Initialized successfully.");
}

/**
 * Handles POST requests to /submit-registration.
 * Processes form data, saves user, notifies admin, edits original message.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 */
async function handleRegistrationSubmit(req, res) {
  logger.info({ body: req.body }, "Processing /submit-registration");

  // --- Extract & Validate Data ---
  const {
    telegramId: telegramIdString,
    messageId: messageIdString, // Expect messageId from form
    firstName,
    lastName,
    email,
    phoneNumber,
    dateOfBirth,
    reasonForSeeking,
    is_veteran_or_responder, // Checkbox value ('true' or undefined)
  } = req.body;

  // Basic validation (add more specific checks if needed)
  if (
    !telegramIdString ||
    !messageIdString ||
    !/^\d+$/.test(messageIdString) ||
    !firstName ||
    !lastName ||
    !email ||
    !phoneNumber ||
    !dateOfBirth ||
    !reasonForSeeking
  ) {
    logger.warn(
      "Missing or invalid required registration fields (incl. messageId).",
    );
    // Return early before parsing IDs
    return res
      .status(400)
      .json({ success: false, message: "Missing or invalid required fields." });
  }

  let telegramId;
  const messageId = parseInt(messageIdString, 10); // Parse messageId to integer

  try {
    telegramId = BigInt(telegramIdString);
  } catch (_e) {
    logger.error(
      { err: _e, telegramIdString },
      "Invalid Telegram ID format received.",
    );
    return res
      .status(400)
      .json({ success: false, message: "Invalid Telegram ID format." });
  }

  // --- Save to DB ---
  let savedUser;
  try {
    const userData = {
      telegram_id: telegramId,
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone_number: phoneNumber,
      date_of_birth: dateOfBirth ? new Date(dateOfBirth) : null,
      reason_for_seeking: reasonForSeeking,
      is_veteran_or_responder: is_veteran_or_responder === "true", // Convert checkbox value
      role: "client", // Assign role on registration
      // Ensure other relevant fields have defaults or are handled
      state: "NONE", // Set initial state
      active_session_id: null, // Ensure this is null initially
    };
    logger.debug({ telegramId }, "Attempting user upsert...");

    savedUser = await prisma.users.upsert({
      where: { telegram_id: telegramId },
      update: { ...userData, updated_at: new Date() }, // Update if somehow exists partially
      create: userData, // Create includes fields above
    });
    logger.info(
      { userId: savedUser.client_id, telegramId },
      "User successfully registered/updated in DB.",
    );
  } catch (err) {
    logger.error(
      { err, telegramId },
      "Error saving user registration data to DB.",
    );
    return res
      .status(500)
      .json({ success: false, message: "Database error during registration." });
  }

  // --- Send Notifications & Edit Message (only if DB save succeeded) ---
  try {
    // 1. Admin notification (Detailed)
    const adminMsg = `📢 New User Registered:
Name: ${firstName} ${lastName}
TG ID: ${telegramIdString}
Email: ${email}
Phone: ${phoneNumber}
DOB: ${dateOfBirth}
Veteran/Responder: ${is_veteran_or_responder === "true" ? "Yes" : "No"}
Reason: ${reasonForSeeking}`;

    // Requires PH5-07b: sendAdminNotification in telegramNotifier
    await telegramNotifier.sendAdminNotification({ text: adminMsg });
    logger.info({ telegramId: telegramIdString }, "Sent admin notification.");

    // 2. Edit Original Message (Replaces separate client welcome)
    const successMessage = `✅ Registration Complete! Welcome aboard, ${firstName}! You can now use /book to schedule.`;
    const chatId = telegramIdString; // Use string ID for chatId
    await bot.telegram.editMessageText(
      chatId,
      messageId,
      undefined,
      successMessage,
    );
    logger.info(
      { telegramId: telegramIdString, messageId },
      "Successfully edited original registration message as welcome.",
    );
  } catch (notifyOrEditErr) {
    // Log the detailed error internally
    logger.error(
      { err: notifyOrEditErr, telegramId: telegramIdString },
      "Unexpected error during registration submission",
    );
    // Return a generic error message to the frontend
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred during registration submission.",
    });
  }

  // --- Send Success Response to Form ---
  // Send 201 Created status
  res.status(201).json({
    success: true,
    message: "Registration successful!",
    userId: savedUser.client_id,
  });
}

module.exports = {
  initialize,
  handleRegistrationSubmit,
};
