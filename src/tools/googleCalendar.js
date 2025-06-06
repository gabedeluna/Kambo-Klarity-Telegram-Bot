const pino = require("pino"); // Keep for fallback possibility if needed
const { google } = require("googleapis");
const { JWT } = require("google-auth-library"); // For service account auth

// Import the new modular utilities
const FreeBusyUtils = require("./googleCalendar/freeBusyUtils");
const ConfigUtils = require("./googleCalendar/configUtils");
const SlotGenerator = require("./googleCalendar/slotGenerator");
const GoogleCalendarEventsTool = require("./googleCalendar/googleCalendarEvents");

// These should now be fetched from process.env inside the constructor or methods
// const PRACTITIONER_SESSION_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
// const PRACTITIONER_PERSONAL_CALENDAR_ID = process.env.GOOGLE_PERSONAL_CALENDAR_ID;

class GoogleCalendarTool {
  /**
   * Creates an instance of the GoogleCalendarTool.
   * @param {object} dependencies - The dependencies needed by the tool.
   * @param {object} dependencies.logger - The Pino logger instance.
   * @param {object} dependencies.prisma - The Prisma client instance.
   */
  constructor(dependencies) {
    if (!dependencies || !dependencies.logger) {
      console.error(
        "FATAL: GoogleCalendarTool construction failed. Missing logger dependency. Using console.",
      );
      // Create a basic fallback logger for the instance if absolutely necessary,
      // but ideally, the caller ensures a logger is provided.
      this.logger = pino({ level: "info" }, pino.destination(process.stdout));
      // Or throw an error: throw new Error('Logger dependency is required for GoogleCalendarTool.');
    } else {
      this.logger = dependencies.logger;
    }

    this.prisma = dependencies.prisma;
    if (!this.prisma) {
      this.logger.error(
        "[GoogleCalendarTool] Prisma client was not provided during instantiation!",
      );
    }

    try {
      this.auth = new JWT({
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS, // Path to key file
        scopes: ["https://www.googleapis.com/auth/calendar"], // Full read/write scope
      });
      this.calendar = google.calendar({ version: "v3", auth: this.auth });

      // Fetch calendar IDs from env, with fallbacks or errors if not set
      this.sessionCalendarId = process.env.GOOGLE_CALENDAR_ID;
      this.personalCalendarId = process.env.GOOGLE_PERSONAL_CALENDAR_ID;

      if (!this.sessionCalendarId) {
        this.logger.error("CRITICAL: GOOGLE_CALENDAR_ID is not set in .env!");
        // Potentially throw an error to prevent tool from being used misconfigured
      }
      if (!this.personalCalendarId) {
        this.logger.warn(
          "GOOGLE_PERSONAL_CALENDAR_ID is not set in .env. Personal availability won't be checked.",
        );
        // Tool can still function but might overbook if personal events exist
      }

      // Initialize utility modules
      this.freeBusyUtils = new FreeBusyUtils(
        this.calendar,
        this.sessionCalendarId,
        this.personalCalendarId,
        this.logger,
      );

      this.configUtils = new ConfigUtils(this.prisma, this.logger);

      this.slotGenerator = new SlotGenerator(
        this.freeBusyUtils,
        this.configUtils,
        this.logger,
      );

      // Initialize the events tool for event creation/deletion operations
      this.eventsTool = new GoogleCalendarEventsTool({
        logger: this.logger,
        prisma: this.prisma,
      });

      this.logger.info(
        "[GoogleCalendarTool] Live instance created. Session Calendar ID: " +
          this.sessionCalendarId +
          ", Personal Calendar ID: " +
          this.personalCalendarId,
      );
    } catch (error) {
      this.logger.error(
        { error },
        "[GoogleCalendarTool] Failed to initialize Google Calendar API client",
      );
      // Still create the instance, but it will be in a non-functional state
      // Callers should check for errors when using methods
    }
  }

  /**
   * Helper method to fetch the availability rule from the database
   * @returns {Promise<object>} The availability rule from the database or a default rule
   */
  async getAvailabilityRule() {
    return this.configUtils.getAvailabilityRule();
  }

  /**
   * Efficiently fetch busy times for multiple calendars using FreeBusy API
   * @param {string} timeMin - Start time in ISO format (UTC)
   * @param {string} timeMax - End time in ISO format (UTC)
   * @returns {Promise<Array>} Array of busy time objects with start/end times
   */
  async fetchBusyTimes(timeMin, timeMax) {
    return this.freeBusyUtils.fetchBusyTimes(timeMin, timeMax);
  }

  /**
   * Count existing Kambo sessions for a specific day using FreeBusy data
   * @param {Array} busyTimes - Array of busy time objects from fetchBusyTimes
   * @param {Date} dayInPractitionerTz - The day to check (in practitioner timezone)
   * @param {string} practitionerTz - Practitioner timezone
   * @returns {number} Number of Kambo sessions already booked for this day
   */
  countKamboSessionsForDay(busyTimes, dayInPractitionerTz, practitionerTz) {
    return this.freeBusyUtils.countKamboSessionsForDay(
      busyTimes,
      dayInPractitionerTz,
      practitionerTz,
    );
  }

  /**
   * Generate available slots (legacy method - kept for compatibility)
   * @param {Date} startDate - Start date for slot generation
   * @param {Date} endDate - End date for slot generation
   * @param {number} durationMinutes - Duration of each slot in minutes
   * @param {Array} busyTimes - Array of busy time objects
   * @param {object} availabilityRule - Availability rules from database
   * @returns {Array} Array of available slot objects
   */
  generateAvailableSlots(
    startDate,
    endDate,
    durationMinutes,
    busyTimes,
    availabilityRule,
  ) {
    return this.slotGenerator.generateAvailableSlots(
      startDate,
      endDate,
      durationMinutes,
      busyTimes,
      availabilityRule,
    );
  }

  /**
   * Finds available slots respecting DB rules and GCal events using efficient FreeBusy API.
   * @param {object} options
   * @param {string} options.startDateRange - ISO string for start of search window (client's local time, will be converted)
   * @param {string} options.endDateRange - ISO string for end of search window (client's local time, will be converted)
   * @param {number} options.sessionDurationMinutes - Duration of the session to book.
   * @returns {Promise<Array<string>>} Array of available slot start times (ISO strings in UTC).
   */
  async findFreeSlots({
    startDateRange,
    endDateRange,
    sessionDurationMinutes,
  }) {
    return this.slotGenerator.findFreeSlots({
      startDateRange,
      endDateRange,
      sessionDurationMinutes,
    });
  }

  /**
   * Creates a calendar event (wrapper for backward compatibility)
   * @param {object} eventDetails - Event details object
   * @param {string} eventDetails.summary - Event title
   * @param {string} eventDetails.description - Event description
   * @param {object} eventDetails.start - Start time object with dateTime property
   * @param {object} eventDetails.end - End time object with dateTime property
   * @returns {Promise<object>} Created event object with id property
   */
  async createEvent(eventDetails) {
    if (!this.eventsTool) {
      throw new Error("Events tool not initialized");
    }

    // Convert the format expected by placeholderApiHandler to the format expected by GoogleCalendarEventsTool
    const convertedEventDetails = {
      summary: eventDetails.summary,
      description: eventDetails.description,
      start: eventDetails.start.dateTime,
      end: eventDetails.end.dateTime,
    };

    const result = await this.eventsTool.createCalendarEvent(
      convertedEventDetails,
    );

    if (!result.success) {
      throw new Error(result.error || "Failed to create calendar event");
    }

    // Return in the format expected by the placeholder handler
    return {
      id: result.eventId,
      htmlLink: result.eventLink,
    };
  }

  /**
   * Deletes a calendar event (wrapper for backward compatibility)
   * @param {string} eventId - The ID of the event to delete
   * @returns {Promise<void>}
   */
  async deleteEvent(eventId) {
    if (!this.eventsTool) {
      throw new Error("Events tool not initialized");
    }

    const result = await this.eventsTool.deleteCalendarEvent({ eventId });

    if (!result.success) {
      throw new Error(result.error || "Failed to delete calendar event");
    }
  }
}

// Export the class itself, allowing consumers to instantiate it.
module.exports = GoogleCalendarTool;
