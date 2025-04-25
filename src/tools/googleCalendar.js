const pino = require("pino"); // Keep for fallback possibility if needed

class GoogleCalendarTool {
  /**
   * Creates an instance of the GoogleCalendarTool.
   * @param {object} dependencies - The dependencies needed by the tool.
   * @param {object} dependencies.logger - The Pino logger instance.
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
    this.logger.info(
      "[GoogleCalendarTool] Instance created successfully (with stubs).",
    );
  }

  /**
   * STUB FUNCTION: Finds free time slots in a Google Calendar.
   * This is a stub and returns hardcoded fake data.
   *
   * @param {object} [options={}] - Options for finding slots (ignored by stub).
   * @param {string} [options.startDate] - ISO 8601 start date/time.
   * @param {string} [options.endDate] - ISO 8601 end date/time.
   * @param {number} [options.durationMinutes] - Desired slot duration.
   * @returns {Promise<Array<{start: string, end: string}>>} A promise resolving to available slots.
   */
  async findFreeSlots(options = {}) {
    // Logger is now guaranteed to exist if constructor succeeded without throwing
    this.logger.info({ options }, "STUB: findFreeSlots called on instance");

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(today.getDate() + 2);
    const formatDate = (date, hour) => {
      const d = new Date(date);
      d.setUTCHours(hour, 0, 0, 0);
      return d.toISOString();
    };
    const fakeSlots = [
      { start: formatDate(tomorrow, 10), end: formatDate(tomorrow, 11) },
      { start: formatDate(tomorrow, 14), end: formatDate(tomorrow, 15) },
      { start: formatDate(dayAfter, 11), end: formatDate(dayAfter, 12) },
    ];
    return Promise.resolve(fakeSlots);
  }

  /**
   * STUB FUNCTION: Creates a calendar event.
   * Logs the input and returns a hardcoded success response.
   *
   * @param {object} eventDetails - Details of the event to create.
   * @param {string} eventDetails.start - Start time (ISO 8601 format).
   * @param {string} eventDetails.end - End time (ISO 8601 format).
   * @param {string} eventDetails.summary - Event title/summary.
   * @param {string} [eventDetails.description] - Optional event description.
   * @param {string} [eventDetails.attendeeEmail] - Optional attendee email.
   * @returns {Promise<{success: boolean, eventId: string}>} A promise resolving to a fake success object.
   */
  async createCalendarEvent(eventDetails = {}) {
    this.logger.info({ eventDetails }, "STUB: createCalendarEvent called");
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    const fakeResponse = { success: true, eventId: `fake-event-${Date.now()}` };
    return Promise.resolve(fakeResponse);
  }
}

// Export the class itself, allowing consumers to instantiate it.
module.exports = GoogleCalendarTool;
