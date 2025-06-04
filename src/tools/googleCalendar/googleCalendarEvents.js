const pino = require("pino"); // Keep for fallback possibility if needed
const { google } = require("googleapis");
const { JWT } = require("google-auth-library"); // For service account auth

/**
 * @class GoogleCalendarEventsTool
 * @description Handles creation and deletion of Google Calendar events.
 */
class GoogleCalendarEventsTool {
  /**
   * Creates an instance of the GoogleCalendarEventsTool.
   * @param {object} dependencies - The dependencies needed by the tool.
   * @param {object} dependencies.logger - The Pino logger instance.
   * @param {object} [dependencies.prisma] - The Prisma client instance (optional for this tool).
   */
  constructor(dependencies) {
    if (!dependencies || !dependencies.logger) {
      console.error(
        "FATAL: GoogleCalendarEventsTool construction failed. Missing logger dependency. Using console.",
      );
      this.logger = pino({ level: "info" }, pino.destination(process.stdout));
    } else {
      this.logger = dependencies.logger;
    }

    this.prisma = dependencies.prisma; // Store prisma if provided
    if (this.prisma) {
      this.logger.debug("[GoogleCalendarEventsTool] Prisma client provided.");
    } else {
      this.logger.warn(
        "[GoogleCalendarEventsTool] Prisma client was not provided during instantiation. This may be acceptable if not directly used by event methods.",
      );
    }

    try {
      this.auth = new JWT({
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS, // Path to key file
        scopes: ["https://www.googleapis.com/auth/calendar"], // Full read/write scope
      });
      this.calendar = google.calendar({ version: "v3", auth: this.auth });

      this.sessionCalendarId = process.env.GOOGLE_CALENDAR_ID;

      if (!this.sessionCalendarId) {
        this.logger.error(
          "CRITICAL: GOOGLE_CALENDAR_ID is not set in .env! Event operations will fail.",
        );
      }
      this.logger.info(
        "[GoogleCalendarEventsTool] Live instance created. Session Calendar ID: " +
          this.sessionCalendarId,
      );
    } catch (error) {
      this.logger.error(
        { error },
        "[GoogleCalendarEventsTool] Failed to initialize Google Calendar API client",
      );
    }
  }

  /**
   * Creates a calendar event in the practitioner's Google Calendar.
   * Call this ONLY after a user has confirmed their booking slot AND completed any prerequisite steps (like waiver submission).
   *
   * @param {object} eventDetails - Details of the event to create.
   * @param {string} eventDetails.start - Start time of the event in ISO 8601 format (e.g., '2024-05-21T10:00:00Z').
   * @param {string} eventDetails.end - End time of the event in ISO 8601 format (e.g., '2024-05-21T11:00:00Z').
   * @param {string} eventDetails.summary - Event title/summary (e.g., 'Kambo Session - John Doe').
   * @param {string} [eventDetails.description] - Optional event description (e.g., 'Session Type: 1hr-kambo, Contact: @johndoe_tg').
   * @param {string} [eventDetails.attendeeEmail] - Optional attendee email address to invite them to the event.
   * @returns {Promise<{success: boolean, eventId?: string, eventLink?: string, error?: string}>} A promise resolving to an object indicating success (with the created event's ID) or failure (with an error message).
   */
  async createCalendarEvent(eventDetails) {
    if (!this.sessionCalendarId) {
      this.logger.error(
        "Session Calendar ID not configured. Cannot create event.",
      );
      return { success: false, error: "Session Calendar ID not configured." };
    }
    this.logger.info(
      { eventDetails, calendarId: this.sessionCalendarId },
      "createCalendarEvent called",
    );

    try {
      // Get availability rules to check buffer time
      const ConfigUtils = require("./configUtils");
      const configUtils = new ConfigUtils(this.prisma, this.logger);
      const rules = await configUtils.getAvailabilityRule();

      let eventStart = eventDetails.start;
      let eventEnd = eventDetails.end;

      // If buffer time is 0, reduce event end time by 1 minute to prevent FreeBusy merging
      if (rules.buffer_time_minutes === 0) {
        const endDate = new Date(eventDetails.end);
        endDate.setMinutes(endDate.getMinutes() - 1);
        eventEnd = endDate.toISOString();

        this.logger.info(
          `[ZeroBuffer] Reduced event end time by 1 minute: ${eventDetails.end} -> ${eventEnd}`,
        );
      }

      const event = {
        summary: eventDetails.summary,
        description: eventDetails.description,
        start: { dateTime: eventStart, timeZone: "UTC" },
        end: { dateTime: eventEnd, timeZone: "UTC" },
      };

      const response = await this.calendar.events.insert({
        calendarId: this.sessionCalendarId,
        resource: event,
      });
      this.logger.info(`Event created: ${response.data.htmlLink}`);
      return {
        success: true,
        eventId: response.data.id,
        eventLink: response.data.htmlLink,
      };
    } catch (err) {
      this.logger.error(
        { err, eventDetails },
        "Failed to create Google Calendar event",
      );
      return {
        success: false,
        error: err.message || "Failed to create GCal event",
      };
    }
  }

  /**
   * Deletes a calendar event from the practitioner's Google Calendar.
   * @param {object} options - Options for deleting the event.
   * @param {string} options.eventId - The ID of the event to delete.
   * @returns {Promise<{success: boolean, warning?: string, error?: string}>} A promise resolving to an object indicating success or failure.
   */
  async deleteCalendarEvent({ eventId }) {
    if (!this.sessionCalendarId) {
      this.logger.error(
        "Session Calendar ID not configured. Cannot delete event.",
      );
      return { success: false, error: "Session Calendar ID not configured." };
    }
    if (!eventId) {
      this.logger.error("eventId is required to delete a calendar event.");
      return { success: false, error: "Missing eventId." };
    }
    this.logger.info(
      { eventId, calendarId: this.sessionCalendarId },
      "deleteCalendarEvent called",
    );
    try {
      await this.calendar.events.delete({
        calendarId: this.sessionCalendarId,
        eventId: eventId,
      });
      this.logger.info(`Event ${eventId} deleted successfully.`);
      return { success: true };
    } catch (err) {
      this.logger.error(
        { err, eventId },
        "Failed to delete Google Calendar event",
      );
      if (err.code === 404 || err.code === 410) {
        this.logger.warn(
          `Event ${eventId} not found or already gone. Considering deletion successful.`,
        );
        return { success: true, warning: "Event not found or already gone." };
      }
      return {
        success: false,
        error: err.message || "Failed to delete GCal event",
      };
    }
  }
}

module.exports = GoogleCalendarEventsTool;
