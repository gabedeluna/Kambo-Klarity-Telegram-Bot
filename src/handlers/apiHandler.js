const { toDate } = require("date-fns");
const { formatInTimeZone } = require("date-fns-tz");

let prisma, logger, telegramNotifier, bot, googleCalendarTool;

/**
 * Initializes the API handler module with required dependencies.
 *
 * @param {object} deps - The dependencies object.
 * @param {object} deps.prisma - The Prisma client instance.
 * @param {object} deps.logger - The logger instance.
 * @param {object} deps.telegramNotifier - The Telegram Notifier instance.
 * @param {object} deps.bot - The Telegram Bot instance.
 * @param {object} deps.googleCalendarTool - The GoogleCalendarTool instance.
 * @throws {Error} If required dependencies are missing.
 */
function initialize(deps) {
  if (!deps.prisma) {
    throw new Error(
      "Dependency Error: prisma client is required for apiHandler.",
    );
  }
  if (!deps.logger) {
    throw new Error("Dependency Error: logger is required for apiHandler.");
  }
  if (!deps.telegramNotifier) {
    throw new Error(
      "Dependency Error: telegramNotifier is required for apiHandler.",
    );
  }
  if (!deps.bot) {
    throw new Error("Dependency Error: bot is required for apiHandler.");
  }
  if (!deps.googleCalendarTool) {
    // logger.error("Dependency: googleCalendarTool is required for apiHandler."); // Optional: log if logger is available
    throw new Error(
      "Dependency: googleCalendarTool is required for apiHandler.",
    );
  }
  prisma = deps.prisma;
  logger = deps.logger;
  telegramNotifier = deps.telegramNotifier;
  bot = deps.bot;
  googleCalendarTool = deps.googleCalendarTool;
  logger.info(
    "API Handler initialized successfully with Prisma, Logger, TelegramNotifier, Bot, and GoogleCalendarTool.",
  );
}

/**
 * Handles GET /api/user-data requests.
 * Fetches user data based on the telegramId query parameter and formats it for form pre-filling.
 *
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @returns {Promise<void>} Sends a JSON response.
 * @response {200} {object} User data found and formatted successfully.
 * @response {400} {object} Missing or invalid telegramId.
 * @response {404} {object} User not found.
 * @response {500} {object} Internal server error or data formatting error.
 *
 * @example Response Body (Success)
 * {
 *   "success": true,
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "email": "john.doe@example.com",
 *   "phone": "+1234567890",
 *   "dob": "1990-05-15", // YYYY-MM-DD
 *   "appointmentDateTime": "Tuesday, May 20, 2025 - 10:00 AM Central Daylight Time", // User-friendly display
 *   "rawAppointmentDateTime": "2025-05-20T15:00:00.000Z", // ISO string
 *   "emergencyFirstName": "Jane",
 *   "emergencyLastName": "Doe",
 *   "emergencyPhone": "+1987654321"
 * }
 */
async function getUserDataApi(req, res) {
  logger.info({ query: req.query }, "Processing GET /api/user-data");

  const { telegramId: telegramIdString } = req.query;
  if (!telegramIdString || !/^\d+$/.test(telegramIdString)) {
    logger.warn(
      { query: req.query },
      "Missing or invalid telegramId query parameter.",
    );
    return res.status(400).json({
      success: false,
      message: "Missing or invalid telegramId query parameter.",
    });
  }
  const telegramId = BigInt(telegramIdString);

  let user;
  try {
    user = await prisma.users.findUnique({
      where: { telegram_id: telegramId },
      select: {
        first_name: true,
        last_name: true,
        email: true,
        phone_number: true,
        date_of_birth: true,
        booking_slot: true, // The temp slot
        em_first_name: true,
        em_last_name: true,
        em_phone_number: true,
      },
    });

    if (!user) {
      logger.warn({ telegramId }, "User not found for /api/user-data");
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }
    logger.info({ telegramId }, "User data found.");
  } catch (err) {
    logger.error(
      { err, telegramId },
      "Database error fetching user data for API.",
    );
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }

  try {
    const centralTimeZone = "America/Chicago"; // TODO: Move to config?

    // Safely format date of birth, handling null
    // Format the Date object directly in UTC to avoid timezone shifts
    const dobFormatted = user.date_of_birth
      ? formatInTimeZone(user.date_of_birth, "UTC", "yyyy-MM-dd")
      : "";

    // Safely format booking slot, handling null
    let formattedAppointment = "Not Scheduled";
    let rawAppointment = user.booking_slot
      ? user.booking_slot.toISOString()
      : null; // Keep raw ISO string

    if (rawAppointment) {
      try {
        // Parse the ISO string (assumed UTC from DB) and format in Central Time
        const appointmentDate = toDate(rawAppointment);
        if (!isNaN(appointmentDate.getTime())) {
          // Check if it's a valid date
          formattedAppointment = formatInTimeZone(
            appointmentDate,
            centralTimeZone,
            "EEEE, MMMM d, yyyy - h:mm aa zzzz",
          );
        } else {
          logger.warn(
            { bookingSlotRaw: user.booking_slot, telegramId },
            "Invalid booking_slot format received from DB.",
          );
          rawAppointment = null; // Invalidate raw appointment if parsing failed
        }
      } catch (dateParseError) {
        logger.error(
          {
            err: dateParseError,
            bookingSlotRaw: user.booking_slot,
            telegramId,
          },
          "Error parsing booking_slot.",
        );
        rawAppointment = null; // Invalidate raw appointment if parsing failed
        // Keep formattedAppointment as 'Not Scheduled'
      }
    }

    const responseData = {
      success: true,
      firstName: user.first_name || "",
      lastName: user.last_name || "",
      email: user.email || "",
      phone: user.phone_number || "",
      dob: dobFormatted, // YYYY-MM-DD
      appointmentDateTime: formattedAppointment, // User-friendly display string
      rawAppointmentDateTime: rawAppointment, // ISO string for form submission if needed
      emergencyFirstName: user.em_first_name || "",
      emergencyLastName: user.em_last_name || "",
      emergencyPhone: user.em_phone_number || "",
    };

    res.status(200).json(responseData);
  } catch (formatErr) {
    logger.error(
      { err: formatErr, telegramId, userRawData: user },
      "Error formatting user data for API.",
    );
    // Send potentially unformatted or default data, or an error?
    // Let's send 500 for now if formatting fails unexpectedly.
    res
      .status(500)
      .json({ success: false, message: "Error processing user data." });
  }
}

/**
 * Handles POST /api/submit-waiver requests.
 * Processes waiver form data, creates a Session record, updates User record, and notifies admin.
 *
 * @param {object} req - The Express request object.
 * @param {object} req.body - The parsed form data.
 * @param {string} req.body.telegramId - User's Telegram ID (as string).
 * @param {string} req.body.signature - User's signature data.
 * @param {string} [req.body.firstName] - User's first name (optional update).
 * @param {string} [req.body.lastName] - User's last name (optional update).
 * @param {string} [req.body.email] - User's email (optional update).
 * @param {string} [req.body.phone] - User's phone number (optional update).
 * @param {string} [req.body.dob] - User's date of birth (optional update, YYYY-MM-DD).
 * @param {string} req.body.emergencyFirstName - Emergency contact first name.
 * @param {string} req.body.emergencyLastName - Emergency contact last name.
 * @param {string} req.body.emergencyPhone - Emergency contact phone number.
 * @param {string} req.body.sessionType - The type of session being booked.
 * @param {string} req.body.appointmentDateTime - Raw ISO string of the appointment time.
 * @param {object} res - The Express response object.
 * @returns {Promise<void>} Sends a JSON response.
 * @response {200} {object} Waiver submitted successfully. { success: true, sessionId: number, message: string }
 * @response {400} {object} Missing required fields or invalid Telegram ID format. { success: false, message: string }
 * @response {404} {object} User not found. { success: false, message: string }
 * @response {500} {object} Internal server error during processing. { success: false, message: string }
 */
async function submitWaiverApi(req, res) {
  logger.info({ body: req.body }, "Processing POST /api/submit-waiver");

  const formData = req.body;
  const {
    telegramId: telegramIdString,
    signature, // Crucial for waiver validity
    // Basic user fields (might have been updated on form)
    firstName,
    lastName,
    email,
    phone,
    dob,
    // Emergency contact fields
    emergencyFirstName,
    emergencyLastName,
    emergencyPhone,
    // Booking context
    sessionType,
    appointmentDateTime, // Raw ISO string from form (e.g., from rawAppointmentDateTime hidden input)
  } = formData;

  // --- Basic Validation ---
  if (
    !telegramIdString ||
    !signature ||
    !emergencyFirstName ||
    !emergencyLastName ||
    !emergencyPhone ||
    !sessionType ||
    !appointmentDateTime
  ) {
    logger.warn(
      { telegramIdString, signatureProvided: !!signature },
      "Missing required waiver submission fields.",
    );
    return res.status(400).json({
      success: false,
      message:
        "Missing required fields (e.g., signature, emergency contact, booking info).",
    });
  }
  // Add more validation as needed (e.g., checkbox agreements)

  let telegramId;
  try {
    telegramId = BigInt(telegramIdString);
  } catch (e) {
    logger.warn(
      { telegramIdString, error: e.message },
      "Invalid Telegram ID format in waiver submission.",
    );
    return res
      .status(400)
      .json({ success: false, message: "Invalid Telegram ID format." });
  }

  // Process Submission (try...catch block wrapping DB operations)
  try {
    // 1. Find User to get internal ID and verify existence
    const user = await prisma.users.findUnique({
      where: { telegram_id: telegramId },
      select: { client_id: true }, // Select primary key
    });

    if (!user) {
      logger.error({ telegramId }, "User not found during waiver submission.");
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    // 2. Create Session Record
    logger.debug({ telegramId }, "Creating session record...");
    const newSession = await prisma.sessions.create({
      data: {
        user_id: user.client_id, // Link to User PK
        telegram_id: telegramId, // Store TG ID as well for convenience
        session_type: sessionType,
        appointment_datetime: new Date(appointmentDateTime), // Parse ISO string to Date
        liability_form_data: formData, // Store the entire form data as JSON
        session_status: "WAIVER_SUBMITTED", // Initial status after form submit
        // created_at: default(), updated_at: default() handled by Prisma usually
      },
    });
    logger.info(
      { telegramId, sessionId: newSession.id },
      "Session record created.",
    );

    // 3. Update User Record (Emergency Contact, Clear Slot, etc.)
    logger.debug({ telegramId }, "Updating user record...");
    await prisma.users.update({
      where: { telegram_id: telegramId },
      data: {
        // Update user details potentially modified on form
        first_name: firstName || undefined, // Use form value or keep existing if empty
        last_name: lastName || undefined,
        email: email || undefined,
        phone_number: phone || undefined,
        date_of_birth: dob ? new Date(dob) : undefined, // Use form value if provided
        // Update emergency contacts
        em_first_name: emergencyFirstName,
        em_last_name: emergencyLastName,
        em_phone_number: emergencyPhone,
        // Clear the temporary booking slot
        booking_slot: null,
        updated_at: new Date(),
      },
    });
    logger.info({ telegramId }, "User record updated with waiver data.");

    // 4. Notify Admin
    try {
      const adminMsg = ` Waiver Submitted:\nClient: ${firstName || "N/A"} ${lastName || "N/A"} (TG ID: ${telegramIdString})\nSession: ${sessionType}\nTime: ${new Date(appointmentDateTime).toLocaleString("en-US", { timeZone: "America/Chicago" })}`; // Format for readability, handle missing names
      await telegramNotifier.sendAdminNotification({ text: adminMsg });
      logger.info(
        { telegramId },
        "Sent admin notification for waiver submission.",
      );
    } catch (notifyErr) {
      logger.error(
        { err: notifyErr, telegramId },
        "Failed to send admin notification for waiver submission.",
      );
      // Continue, main operation succeeded
    }

    // 5. Send Success Response to Form
    res.status(200).json({
      success: true,
      sessionId: newSession.id,
      message: "Waiver submitted successfully.",
    });
  } catch (err) {
    logger.error(
      { err, telegramId },
      "Error processing waiver submission (DB operations).",
    );
    // Check for specific Prisma errors if needed (e.g., unique constraint)
    res.status(500).json({
      success: false,
      message: "Internal server error processing waiver.",
    });
  }
}

/**
 * Handles the POST /waiver-completed webhook.
 * Updates the session status to CONFIRMED in the database,
 * clears the edit_msg_id for the user, and edits the original
 * Telegram message to show the confirmation.
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
async function waiverCompletedWebhook(req, res) {
  logger.info({ body: req.body }, "Processing POST /waiver-completed");

  const { telegramId: telegramIdString, sessionId } = req.body;

  if (
    !telegramIdString ||
    !sessionId ||
    !/^\d+$/.test(telegramIdString) ||
    typeof sessionId !== "number"
  ) {
    logger.warn(
      { body: req.body },
      "Missing or invalid telegramId/sessionId in /waiver-completed request.",
    );
    return res.status(400).json({
      success: false,
      message: "Missing or invalid telegramId or sessionId.",
    });
  }

  const telegramId = BigInt(telegramIdString);
  const chatId = telegramIdString; // Assuming private chat ID is same as user ID

  try {
    // 1. Find User for message editing info
    const user = await prisma.users.findUnique({
      where: { telegram_id: telegramId },
      select: { edit_msg_id: true },
    });

    if (!user) {
      logger.error(
        { telegramId },
        "User not found processing waiver completion.",
      );
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const originalMessageId = user.edit_msg_id; // May be null

    // 2. Find Session for confirmation message details
    const session = await prisma.sessions.findUnique({
      where: { id: sessionId },
      select: { appointment_datetime: true },
    });

    if (!session) {
      logger.error(
        { telegramId, sessionId },
        "Session not found processing waiver completion.",
      );
      return res
        .status(404)
        .json({ success: false, message: "Session not found." });
    }

    // 3. Update Session Status
    await prisma.sessions.update({
      where: { id: sessionId },
      data: { session_status: "CONFIRMED" },
    });
    logger.info(
      { telegramId, sessionId },
      "Session status updated to CONFIRMED.",
    );

    // 4. Clear edit_msg_id from User (regardless of whether we use it)
    if (originalMessageId) {
      // Only update if it was set
      await prisma.users.update({
        where: { telegram_id: telegramId },
        data: { edit_msg_id: null },
      });
      logger.info({ telegramId }, "Cleared edit_msg_id for user.");
    }

    // 5. Edit Telegram Message (if originalMessageId exists)
    if (originalMessageId) {
      try {
        // const { formatInTimeZone, toDate } = require('date-fns-tz'); // Already required at top
        const centralTimeZone = "America/Chicago"; // TODO: Move to config
        const appointmentDate = toDate(session.appointment_datetime);
        const formattedDate = formatInTimeZone(
          appointmentDate,
          centralTimeZone,
          "EEEE, MMMM d, yyyy - h:mm aaaa zzzz",
        );

        const confirmationMessage = `✅ <b>Booking Confirmed!</b>\n\nYour Kambo session is scheduled for:\n<b>${formattedDate}</b>\n\nYou will receive reminders before your appointment.\nUse /cancel to manage this booking.`;

        await bot.telegram.editMessageText(
          chatId,
          originalMessageId,
          undefined,
          confirmationMessage,
          {
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [] }, // Remove original buttons
          },
        );
        logger.info(
          { telegramId, messageId: originalMessageId },
          "Successfully edited original booking message to confirmed.",
        );
      } catch (editErr) {
        // Log specific Telegram API errors if possible
        const errorMessage = editErr.response?.description || editErr.message;
        logger.error(
          {
            err: { message: errorMessage, code: editErr.code },
            telegramId,
            messageId: originalMessageId,
          },
          "Failed to edit original booking message.",
        );
        // Log error, but don't fail the overall webhook response
      }
    } else {
      logger.warn(
        { telegramId, sessionId },
        "No original message ID (edit_msg_id) found for user, cannot edit Telegram message.",
      );
    }

    // 6. Send Success Response
    res
      .status(200)
      .json({ success: true, message: "Waiver completion processed." });
  } catch (err) {
    logger.error(
      { err, telegramId, sessionId },
      "Error processing waiver completion webhook.",
    );
    // Avoid sending detailed internal errors to the client
    res.status(500).json({
      success: false,
      message: "Internal server error processing waiver completion.",
    });
  }
}

// const logger = require('../core/logger'); // Ensure logger is available - logger is module-scoped via initialize

/**
 * Handles GET /api/calendar/availability requests.
 * Finds available time slots based on query parameters using GoogleCalendarTool.
 *
 * @param {object} req - The Express request object.
 * @param {object} req.query - Query parameters.
 * @param {string} req.query.startDateRange - Start of the date range (UTC ISO string, e.g., "YYYY-MM-DDTHH:MM:SSZ").
 * @param {string} req.query.endDateRange - End of the date range (UTC ISO string, e.g., "YYYY-MM-DDTHH:MM:SSZ").
 * @param {string} req.query.sessionDurationMinutes - Desired session duration in minutes.
 * @param {object} res - The Express response object.
 * @param {Function} next - The Express next middleware function.
 * @returns {Promise<void>} Sends a JSON response with available slots or an error.
 * @response {200} {object} Successfully fetched slots. { success: true, slots: Array<object> }
 * @response {400} {object} Invalid or missing query parameters. { success: false, message: string }
 * @response {500} {object} Internal server error. { success: false, message: string }
 */
async function getAvailability(req, res, _next) {
  // Ensure logger is accessible here (it's module-scoped from initialize)
  // const { logger } = require('../core/logger'); // Direct require if not already module-scoped from initialize - Not needed

  logger.info({ query: req.query }, "GET /api/calendar/availability called");

  const { startDateRange, endDateRange, sessionDurationMinutes } = req.query;

  // --- Input Validation ---
  if (!startDateRange || !endDateRange || !sessionDurationMinutes) {
    return res.status(400).json({
      success: false,
      message:
        "Missing required query parameters: startDateRange, endDateRange, sessionDurationMinutes.",
    });
  }

  const duration = parseInt(sessionDurationMinutes, 10);
  if (isNaN(duration) || duration <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid sessionDurationMinutes: must be a positive number.",
    });
  }

  // Regex for YYYY-MM-DDTHH:MM:SS.sssZ or YYYY-MM-DDTHH:MM:SSZ
  const isoUtcRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
  if (!isoUtcRegex.test(startDateRange) || !isoUtcRegex.test(endDateRange)) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid date format for startDateRange or endDateRange. Expected UTC ISO string ending with 'Z'.",
    });
  }

  try {
    if (new Date(startDateRange) >= new Date(endDateRange)) {
      return res.status(400).json({
        success: false,
        message: "startDateRange must be before endDateRange.",
      });
    }
  } catch {
    return res.status(400).json({
      success: false,
      message: "Invalid date string(s) provided for date ranges.",
    });
  }

  // --- Call Core Logic ---
  try {
    if (
      !googleCalendarTool ||
      typeof googleCalendarTool.findFreeSlots !== "function"
    ) {
      logger.error(
        "FATAL: googleCalendarTool or findFreeSlots method not available in getAvailability handler.",
      );
      return res.status(500).json({
        success: false,
        message: "Internal server configuration error [GCT].",
      });
    }

    const availableSlots = await googleCalendarTool.findFreeSlots({
      startDateRange,
      endDateRange,
      sessionDurationMinutes: duration,
    });

    logger.info(
      `Successfully fetched ${availableSlots.length} slots for range ${startDateRange} to ${endDateRange}, duration ${duration}min.`,
    );
    res.status(200).json({ success: true, slots: availableSlots });
  } catch (error) {
    logger.error(
      { err: error, query: req.query },
      "Error calling findFreeSlots from /api/calendar/availability",
    );
    res.status(500).json({
      success: false,
      message: "An internal error occurred while fetching availability.",
    });
  }
}

module.exports = {
  initialize,
  getUserDataApi,
  submitWaiverApi,
  waiverCompletedWebhook,
  getAvailability, // Add new handler
};
