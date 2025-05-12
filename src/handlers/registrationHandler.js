// src/handlers/registrationHandler.js
let prisma;
let telegramNotifier;
let logger;

/**
 * Initializes the registration handler with dependencies.
 * @param {object} deps - Dependencies object.
 * @param {object} deps.prisma - Prisma client instance.
 * @param {object} deps.telegramNotifier - TelegramNotifier instance.
 * @param {object} deps.logger - Logger instance.
 */
function initialize(deps) {
  if (!deps.prisma) {
    throw new Error(
      "Prisma client dependency is missing for registrationHandler",
    );
  }
  if (!deps.telegramNotifier) {
    throw new Error(
      "TelegramNotifier dependency is missing for registrationHandler",
    );
  }
  if (!deps.logger) {
    throw new Error("Logger dependency is missing for registrationHandler");
  }
  prisma = deps.prisma;
  telegramNotifier = deps.telegramNotifier;
  logger = deps.logger;
  logger.info("registrationHandler initialized successfully.");
}

/**
 * Handles the submission of the registration form.
 * Saves user data to the database, notifies admin, and sends a welcome message to the client.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
async function handleRegistrationSubmit(req, res) {
  logger.info({ body: req.body }, "Processing /submit-registration");

  const {
    telegramId: telegramIdString, // From form's hidden input
    // NO messageId expected or handled here
    firstName,
    lastName,
    email,
    phoneNumber,
    dateOfBirth,
    reasonForSeeking,
    is_veteran_or_responder, // string 'true' or undefined
  } = req.body;

  // Basic validation
  if (
    !telegramIdString ||
    !firstName ||
    !lastName ||
    !email ||
    !phoneNumber ||
    !dateOfBirth ||
    !reasonForSeeking
  ) {
    logger.warn("Missing required registration fields.", { body: req.body });
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields." });
  }

  let telegramId; // This will be BigInt
  try {
    telegramId = BigInt(telegramIdString);
  } catch (e) {
    logger.warn(
      { telegramIdString, error: e.message },
      "Invalid Telegram ID format received.",
    );
    return res
      .status(400)
      .json({ success: false, message: "Invalid Telegram ID format." });
  }

  const isVeteranOrResponderBool = !!is_veteran_or_responder; // Correctly use the boolean value

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
      is_veteran_or_responder: isVeteranOrResponderBool,
      role: "client",
      state: "NONE", // Set initial state
      active_session_id: null, // As per new requirement
      // edit_msg_id is no longer relevant here
    };

    logger.debug(
      { telegramId, userData },
      "Data being sent to Prisma for upsert",
    );
    savedUser = await prisma.users.upsert({
      where: { telegram_id: telegramId },
      update: { ...userData, updated_at: new Date() },
      create: userData,
    });
    logger.info(
      { userId: savedUser.client_id, telegramId },
      "User successfully registered/updated in DB.",
    );
  } catch (err) {
    logger.error(
      { err, telegramId, queryBody: req.body },
      "Error saving user registration data to DB.",
    );
    // Log the full error for more details, especially for Prisma errors
    console.error("Full Prisma error object:", err);
    return res
      .status(500)
      .json({ success: false, message: "Database error during registration." });
  }

  // --- Send Notifications ---
  try {
    // 1. Admin notification (Detailed)
    const adminMsg = `📢 New User Registered:\nName: ${firstName} ${lastName}\nTG ID: ${telegramIdString}\nEmail: ${email}\nPhone: ${phoneNumber}\nDOB: ${dateOfBirth}\nVeteran/Responder: ${isVeteranOrResponderBool ? "Yes" : "No"}\nReason: ${reasonForSeeking}`;
    await telegramNotifier.sendAdminNotification({ text: adminMsg });

    // 2. Send NEW Welcome Message to Client
    const welcomeMsg = `🎉 Welcome to the Kambo Klarity tribe, ${firstName}! You are now registered.\n\nYou can use /book to schedule a session or /help for commands.`;
    // Ensure telegramNotifier.sendTextMessage can handle telegramId as a string
    await telegramNotifier.sendTextMessage({
      telegramId: telegramIdString,
      text: welcomeMsg,
    });
    logger.info(
      { telegramId: telegramIdString },
      "Sent new welcome message to client.",
    );
  } catch (notifyErr) {
    logger.error(
      { err: notifyErr, telegramId: telegramIdString },
      "Error sending notifications after registration.",
    );
    // Continue, as the main database operation succeeded. The user is registered.
  }

  // Send Success Response
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
