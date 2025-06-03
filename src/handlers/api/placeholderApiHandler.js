/**
 * @fileoverview API handler for Google Calendar placeholder booking endpoints
 * Handles temporary placeholder creation and deletion for Feature 4
 */

let prisma, logger, googleCalendarTool;

/**
 * Initializes the placeholder API handler with required dependencies
 * @param {object} deps - Dependencies object
 * @param {object} deps.prisma - Prisma client instance
 * @param {object} deps.logger - Logger instance
 * @param {object} deps.googleCalendarTool - Google Calendar tool instance
 * @throws {Error} If required dependencies are missing
 */
function initialize(deps) {
  if (!deps.prisma || !deps.logger || !deps.googleCalendarTool) {
    throw new Error(
      "Dependency Error: prisma, logger, and googleCalendarTool are required for placeholderApiHandler.",
    );
  }

  prisma = deps.prisma;
  logger = deps.logger;
  googleCalendarTool = deps.googleCalendarTool;

  logger.info("Placeholder API Handler initialized successfully.");
}

/**
 * Validates if a string represents a valid number
 * @param {string} value - Value to validate
 * @returns {boolean} True if valid number
 */
function isValidNumber(value) {
  return value && !isNaN(value) && !isNaN(parseInt(value));
}

/**
 * Validates if a string is a valid ISO date
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if valid ISO date
 */
function isValidISODate(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  return (
    date instanceof Date && !isNaN(date) && dateString === date.toISOString()
  );
}

/**
 * Handles POST /api/gcal-placeholder-bookings requests.
 * Creates a temporary placeholder event in Google Calendar and returns session type details.
 * Feature 4: Part of the two-step booking process.
 *
 * @param {object} req - The Express request object.
 * @param {object} req.body - Request body.
 * @param {string} req.body.telegramId - Telegram user ID.
 * @param {string} req.body.sessionTypeId - Session type ID.
 * @param {string} req.body.appointmentDateTimeISO - Appointment date/time in ISO format.
 * @param {object} res - The Express response object.
 * @returns {Promise<void>} Sends a JSON response with placeholder details and session type info.
 * @response {200} {object} Successfully created placeholder. { success: true, placeholderId: string, expiresAt: string, sessionTypeDetails: object }
 * @response {400} {object} Invalid input parameters. { success: false, message: string }
 * @response {404} {object} Session type not found. { success: false, message: string }
 * @response {409} {object} Slot conflict. { success: false, message: string }
 * @response {500} {object} Internal server error. { success: false, message: string }
 */
async function createGCalPlaceholder(req, res) {
  logger.info(
    { body: req.body },
    "[PlaceholderApiHandler] Processing create placeholder request",
  );

  try {
    const { telegramId, sessionTypeId, appointmentDateTimeISO } = req.body;

    // Validate required fields
    if (!telegramId || !sessionTypeId || !appointmentDateTimeISO) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid input: telegramId, sessionTypeId, and appointmentDateTimeISO are required.",
      });
    }

    // Validate telegramId format
    if (!isValidNumber(telegramId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid input: telegramId must be a valid number.",
      });
    }

    // Validate appointmentDateTimeISO format
    if (!isValidISODate(appointmentDateTimeISO)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid input: appointmentDateTimeISO must be a valid ISO date string.",
      });
    }

    // Fetch session type details
    const sessionType = await prisma.sessionType.findUnique({
      where: { id: sessionTypeId },
    });

    if (!sessionType) {
      return res.status(404).json({
        success: false,
        message: "Session type not found.",
      });
    }

    // Calculate end time based on session duration
    const startTime = new Date(appointmentDateTimeISO);
    const endTime = new Date(
      startTime.getTime() + sessionType.durationMinutes * 60 * 1000,
    );

    // Create placeholder event in Google Calendar
    const placeholderEvent = {
      summary: `PLACEHOLDER: ${sessionType.label}`,
      description:
        "Temporary placeholder for booking process. Will be updated or deleted.",
      start: { dateTime: appointmentDateTimeISO },
      end: { dateTime: endTime.toISOString() },
      status: "tentative",
    };

    try {
      const createdEvent =
        await googleCalendarTool.createEvent(placeholderEvent);

      // Calculate expiration time (15 minutes from now)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      // Prepare session type details for the client
      const sessionTypeDetails = {
        waiverType: sessionType.waiverType,
        allowsGroupInvites: sessionType.allowsGroupInvites,
        maxGroupSize: sessionType.maxGroupSize,
        sessionTypeId: sessionType.id,
        appointmentDateTimeISO: appointmentDateTimeISO,
      };

      logger.info(
        {
          placeholderId: createdEvent.id,
          sessionTypeId,
          telegramId,
        },
        "[PlaceholderApiHandler] Placeholder created successfully",
      );

      return res.status(200).json({
        success: true,
        placeholderId: createdEvent.id,
        expiresAt: expiresAt,
        sessionTypeDetails: sessionTypeDetails,
      });
    } catch (calendarError) {
      logger.error(
        {
          error: calendarError.message,
          sessionTypeId,
          appointmentDateTimeISO,
        },
        "[PlaceholderApiHandler] Google Calendar error creating placeholder",
      );

      // Check if it's a slot conflict
      if (
        calendarError.message.includes("conflict") ||
        calendarError.message.includes("busy")
      ) {
        return res.status(409).json({
          success: false,
          message:
            "The selected time slot is no longer available. Please choose another time.",
        });
      }

      return res.status(500).json({
        success: false,
        message: "An error occurred while creating the placeholder.",
      });
    }
  } catch (error) {
    logger.error(
      { error: error.message, body: req.body },
      "[PlaceholderApiHandler] Error in createGCalPlaceholder",
    );

    return res.status(500).json({
      success: false,
      message: "An internal error occurred while processing the request.",
    });
  }
}

/**
 * Handles DELETE /api/gcal-placeholder-bookings/:placeholderId requests.
 * Deletes a placeholder event from Google Calendar.
 * Feature 4: Used for cleanup when booking flow fails.
 *
 * @param {object} req - The Express request object.
 * @param {object} req.params - Request parameters.
 * @param {string} req.params.placeholderId - Google Calendar event ID to delete.
 * @param {object} res - The Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming deletion.
 * @response {200} {object} Successfully deleted placeholder. { success: true, message: string }
 * @response {400} {object} Invalid input parameters. { success: false, message: string }
 * @response {404} {object} Placeholder not found. { success: false, message: string }
 * @response {500} {object} Internal server error. { success: false, message: string }
 */
async function deleteGCalPlaceholder(req, res) {
  logger.info(
    { params: req.params },
    "[PlaceholderApiHandler] Processing delete placeholder request",
  );

  try {
    const { placeholderId } = req.params;

    // Validate required parameter
    if (!placeholderId) {
      return res.status(400).json({
        success: false,
        message: "Invalid input: placeholderId is required.",
      });
    }

    try {
      await googleCalendarTool.deleteEvent(placeholderId);

      logger.info(
        { placeholderId },
        "[PlaceholderApiHandler] Placeholder deleted successfully",
      );

      return res.status(200).json({
        success: true,
        message: "Placeholder deleted successfully.",
      });
    } catch (calendarError) {
      logger.error(
        {
          error: calendarError.message,
          placeholderId,
        },
        "[PlaceholderApiHandler] Google Calendar error deleting placeholder",
      );

      // Check if it's a not found error
      if (
        calendarError.message.includes("not found") ||
        calendarError.message.includes("404")
      ) {
        return res.status(404).json({
          success: false,
          message: "Placeholder not found or already deleted.",
        });
      }

      return res.status(500).json({
        success: false,
        message: "An error occurred while deleting the placeholder.",
      });
    }
  } catch (error) {
    logger.error(
      { error: error.message, params: req.params },
      "[PlaceholderApiHandler] Error in deleteGCalPlaceholder",
    );

    return res.status(500).json({
      success: false,
      message: "An internal error occurred while processing the request.",
    });
  }
}

module.exports = {
  initialize,
  createGCalPlaceholder,
  deleteGCalPlaceholder,
};
