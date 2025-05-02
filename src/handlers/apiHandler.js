const { format, toDate } = require("date-fns");
const { formatInTimeZone } = require("date-fns-tz");

let prisma, logger;

/**
 * Initializes the API handler module with required dependencies.
 *
 * @param {object} deps - The dependencies object.
 * @param {object} deps.prisma - The Prisma client instance.
 * @param {object} deps.logger - The logger instance.
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
  prisma = deps.prisma;
  logger = deps.logger;
  logger.info("API Handler initialized successfully.");
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
    return res
      .status(400)
      .json({
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

    let formattedDob = "";
    if (user.date_of_birth) {
      try {
        // Prisma often returns Date objects, but handle strings just in case
        const dobDate =
          typeof user.date_of_birth === "string"
            ? new Date(user.date_of_birth)
            : user.date_of_birth;
        if (!isNaN(dobDate.getTime())) {
          // Check if it's a valid date
          // Ensure it's treated as UTC date part only for formatting
          const utcDate = new Date(
            Date.UTC(
              dobDate.getFullYear(),
              dobDate.getMonth(),
              dobDate.getDate(),
            ),
          );
          formattedDob = format(utcDate, "yyyy-MM-dd");
        } else {
          logger.warn(
            { dobRaw: user.date_of_birth, telegramId },
            "Invalid date_of_birth format received from DB.",
          );
        }
      } catch (dateParseError) {
        logger.error(
          { err: dateParseError, dobRaw: user.date_of_birth, telegramId },
          "Error parsing date_of_birth.",
        );
        // Keep formattedDob as empty string
      }
    }

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
            "EEEE, MMMM d, yyyy - h:mm aaaa zzzz",
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
      dob: formattedDob, // YYYY-MM-DD
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

module.exports = { initialize, getUserDataApi };
