const { parseISO, startOfDay, endOfDay } = require("date-fns");
const { fromZonedTime } = require("date-fns-tz");

/**
 * FreeBusy API utilities for Google Calendar operations
 */
class FreeBusyUtils {
  constructor(calendar, sessionCalendarId, personalCalendarId, logger) {
    this.calendar = calendar;
    this.sessionCalendarId = sessionCalendarId;
    this.personalCalendarId = personalCalendarId;
    this.logger = logger;
  }

  /**
   * Efficiently fetch busy times for multiple calendars using FreeBusy API
   * @param {string} timeMin - Start time in ISO format (UTC)
   * @param {string} timeMax - End time in ISO format (UTC)
   * @returns {Promise<Array>} Array of busy time objects with start/end times
   */
  async fetchBusyTimes(timeMin, timeMax) {
    this.logger.info(
      { timeMin, timeMax },
      "[FreeBusy] Fetching busy times for date range",
    );

    try {
      const calendarsToCheck = [];

      // Add session calendar if configured
      if (this.sessionCalendarId) {
        calendarsToCheck.push({ id: this.sessionCalendarId });
      }

      // Add personal calendar if configured
      if (this.personalCalendarId) {
        calendarsToCheck.push({ id: this.personalCalendarId });
      }

      if (calendarsToCheck.length === 0) {
        this.logger.warn(
          "[FreeBusy] No calendars configured for busy time check",
        );
        return [];
      }

      // Make single FreeBusy API call for all calendars
      const freeBusyResponse = await this.calendar.freebusy.query({
        resource: {
          timeMin,
          timeMax,
          items: calendarsToCheck,
        },
      });

      const allBusyTimes = [];
      const calendars = freeBusyResponse.data.calendars || {};

      // Process busy times from all calendars
      Object.entries(calendars).forEach(([calendarId, calendarData]) => {
        const busyPeriods = calendarData.busy || [];
        this.logger.info(
          `[FreeBusy] Calendar ${calendarId}: ${busyPeriods.length} busy periods found`,
        );

        busyPeriods.forEach((busyPeriod) => {
          allBusyTimes.push({
            start: busyPeriod.start,
            end: busyPeriod.end,
            calendarId,
          });
        });
      });

      this.logger.info(
        `[FreeBusy] Total busy periods found: ${allBusyTimes.length}`,
      );

      return allBusyTimes;
    } catch (error) {
      this.logger.error({ error }, "[FreeBusy] Error fetching busy times");
      throw error;
    }
  }

  /**
   * Count existing Kambo sessions for a specific day using FreeBusy data
   * @param {Array} busyTimes - Array of busy time objects from fetchBusyTimes
   * @param {Date} dayInPractitionerTz - The day to check (in practitioner timezone)
   * @param {string} practitionerTz - Practitioner timezone
   * @returns {number} Number of Kambo sessions already booked for this day
   */
  countKamboSessionsForDay(busyTimes, dayInPractitionerTz, practitionerTz) {
    const dayStartUTC = fromZonedTime(
      startOfDay(dayInPractitionerTz),
      practitionerTz,
    );
    const dayEndUTC = fromZonedTime(
      endOfDay(dayInPractitionerTz),
      practitionerTz,
    );

    // Count busy periods from session calendar that fall within this day
    const kamboSessionCount = busyTimes.filter((busyTime) => {
      // Only count events from the session calendar
      if (busyTime.calendarId !== this.sessionCalendarId) {
        return false;
      }

      const busyStart = parseISO(busyTime.start);
      const busyEnd = parseISO(busyTime.end);

      // Check if the busy time overlaps with this day
      return busyStart < dayEndUTC && busyEnd > dayStartUTC;
    }).length;

    return kamboSessionCount;
  }
}

module.exports = FreeBusyUtils;
