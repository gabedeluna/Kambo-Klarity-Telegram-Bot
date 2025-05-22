const pino = require("pino"); // Keep for fallback possibility if needed
const { google } = require("googleapis");
const { JWT } = require("google-auth-library"); // For service account auth
const {
  parseISO,
  addMinutes,
  isBefore,
  isEqual,
  addDays,
  format,
  set, // Added 'set'
  startOfDay,
  endOfDay,
  getDay, // 0 for Sunday, 1 for Monday, etc.
  areIntervalsOverlapping,
  isAfter, // Added missing function
} = require("date-fns");
const { toZonedTime, fromZonedTime } = require("date-fns-tz"); // Use older API for consistency with test env

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
    // Helper to fetch the single AvailabilityRule record
    try {
      if (this.prisma) {
        const rule = await this.prisma.availabilityRule.findFirst({
          where: { is_default: true },
        });

        if (rule) {
          // Parse JSON if weekly_availability is stored as JSON string
          if (typeof rule.weekly_availability === "string") {
            try {
              rule.weekly_availability = JSON.parse(rule.weekly_availability);
            } catch (e) {
              this.logger.error(
                { err: e, ruleId: rule.id },
                "Failed to parse weekly_availability JSON from DB.",
              );
              rule.weekly_availability = {}; // Fallback to empty
            }
          }
          return rule;
        }
      }

      // If prisma is not available or no rule was found, use default values
      this.logger.warn(
        "[getAvailabilityRule] Prisma access not implemented in tool or no rule found. Using placeholder rules.",
      );
      return {
        // Placeholder
        weekly_availability: JSON.parse(
          process.env.TEMP_WEEKLY_AVAILABILITY_JSON || "{}",
        ), // Store example in .env
        practitioner_timezone:
          process.env.PRACTITIONER_TIMEZONE || "America/Chicago",
        max_advance_days: parseInt(process.env.TEMP_MAX_ADVANCE_DAYS || "60"),
        min_notice_hours: parseInt(process.env.TEMP_MIN_NOTICE_HOURS || "24"),
        buffer_time_minutes: parseInt(
          process.env.TEMP_BUFFER_TIME_MINUTES || "30",
        ),
        max_bookings_per_day: parseInt(
          process.env.TEMP_MAX_BOOKINGS_PER_DAY || "4",
        ),
      };
    } catch (error) {
      this.logger.error(
        { error },
        "[getAvailabilityRule] Error fetching availability rule",
      );
      throw error;
    }
  }

  generateAvailableSlots(
    startDate,
    endDate,
    durationMinutes,
    busyTimes,
    availabilityRule,
  ) {
    const availableSlots = [];
    const currentDate = new Date(startDate);
    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const bufferMinutes = availabilityRule.buffer_time_minutes || 0;

    // Loop through each day in the date range
    while (currentDate <= endDate) {
      const dayOfWeek = dayNames[currentDate.getDay()];
      const dayAvailability =
        availabilityRule.weekly_availability[dayOfWeek] || [];

      // Process each availability block for the day
      for (const block of dayAvailability) {
        // Parse the start and end times for this availability block
        const [startHour, startMinute] = block.start.split(":").map(Number);
        const [endHour, endMinute] = block.end.split(":").map(Number);

        // Create Date objects for the start and end of this block
        const blockStart = new Date(currentDate);
        blockStart.setHours(startHour, startMinute, 0, 0);

        const blockEnd = new Date(currentDate);
        blockEnd.setHours(endHour, endMinute, 0, 0);

        // Generate potential slots within this block
        const slotDuration = durationMinutes * 60 * 1000; // Convert to milliseconds
        const bufferTime = bufferMinutes * 60 * 1000; // Convert to milliseconds

        let slotStart = new Date(blockStart);
        while (slotStart.getTime() + slotDuration <= blockEnd.getTime()) {
          const slotEnd = new Date(slotStart.getTime() + slotDuration);

          // Check if this slot overlaps with any busy times
          const isAvailable = !busyTimes.some((busySlot) => {
            const busyStart = new Date(busySlot.start);
            const busyEnd = new Date(busySlot.end);

            // Check for overlap
            return (
              (slotStart < busyEnd && slotEnd > busyStart) ||
              // Also check buffer times
              (new Date(slotStart.getTime() - bufferTime) < busyEnd &&
                new Date(slotEnd.getTime() + bufferTime) > busyStart)
            );
          });

          if (isAvailable) {
            availableSlots.push({
              start: slotStart.toISOString(),
              end: slotEnd.toISOString(),
            });
          }

          // Move to the next potential slot (30-minute increments is common for appointments)
          slotStart = new Date(slotStart.getTime() + 30 * 60 * 1000);
        }
        this.logger.debug(
          `Finished slot generation for rule ${dayOfWeek} ${block.start}-${block.end}. Total generated for this block: ${availableSlots.length}`,
        );
      }

      // Move to the next day
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0); // Reset to beginning of day
    }

    return availableSlots;
  }

  /**
   * Finds available slots respecting DB rules and GCal events.
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
    this.logger.info(
      { startDateRange, endDateRange, sessionDurationMinutes },
      "Finding free slots (LIVE with dual calendar check)",
    );
    this.logger.info(
      `[SlotGenDebug] Service Calendar ID: ${this.sessionCalendarId}, Personal Calendar ID: ${this.personalCalendarId}`,
    );

    try {
      const rules = await this.getAvailabilityRule();
      if (!rules || !rules.weekly_availability || !this.sessionCalendarId) {
        this.logger.error(
          "Availability rules or Session Calendar ID missing. Cannot find slots.",
        );
        return [];
      }
      this.logger.info(
        `[SlotGenDebug] Rules loaded: min_notice_hours=${rules.min_notice_hours}, max_advance_days=${rules.max_advance_days}, max_bookings_per_day=${rules.max_bookings_per_day}, slot_increment_minutes=${rules.slot_increment_minutes}, buffer_time_minutes=${rules.buffer_time_minutes}`,
      );

      const practitionerTz = rules.practitioner_timezone;
      const nowInPractitionerTz = toZonedTime(new Date(), practitionerTz);
      const earliestBookingTime = addMinutes(
        nowInPractitionerTz,
        rules.min_notice_hours * 60,
      );
      const maxBookingDatePractitionerTz = addDays(
        startOfDay(nowInPractitionerTz),
        rules.max_advance_days,
      );
      this.logger.info(
        `[SlotGenDebug] Now (PTZ): ${format(nowInPractitionerTz, "yyyy-MM-dd HH:mm:ss zzzz")}`,
      );
      this.logger.info(
        `[SlotGenDebug] Earliest booking time (PTZ): ${format(earliestBookingTime, "yyyy-MM-dd HH:mm:ss zzzz")}`,
      );
      this.logger.info(
        `[SlotGenDebug] Max booking date (PTZ): ${format(maxBookingDatePractitionerTz, "yyyy-MM-dd HH:mm:ss zzzz")}`,
      );

      let currentDayUTC = startOfDay(parseISO(startDateRange));
      const lastDayUTC = startOfDay(parseISO(endDateRange));
      const allAvailableSlotsUTC = [];

      while (
        isBefore(currentDayUTC, lastDayUTC) ||
        isEqual(currentDayUTC, lastDayUTC)
      ) {
        const currentDayInPractitionerTz = toZonedTime(
          currentDayUTC,
          practitionerTz,
        );
        this.logger.info(
          `[SlotGenDebug] Processing Day (PTZ): ${format(currentDayInPractitionerTz, "yyyy-MM-dd EEEE")}`,
        );

        if (
          isBefore(currentDayInPractitionerTz, startOfDay(earliestBookingTime))
        ) {
          this.logger.info(
            `[SlotGenDebug] Day ${format(currentDayInPractitionerTz, "yyyy-MM-dd")} is before earliest booking start day ${format(startOfDay(earliestBookingTime), "yyyy-MM-dd")}. Skipping.`,
          );
          currentDayUTC = addDays(currentDayUTC, 1);
          continue;
        }
        if (isAfter(currentDayInPractitionerTz, maxBookingDatePractitionerTz)) {
          this.logger.info(
            `[SlotGenDebug] Day ${format(currentDayInPractitionerTz, "yyyy-MM-dd")} is after max advance booking day ${format(maxBookingDatePractitionerTz, "yyyy-MM-dd")}. Skipping.`,
          );
          currentDayUTC = addDays(currentDayUTC, 1);
          continue;
        }

        const dayOfWeek = getDay(currentDayInPractitionerTz);
        const dayKey = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][
          dayOfWeek
        ];
        const dailyRulesForDay = rules.weekly_availability[dayKey] || [];
        this.logger.info(
          `[SlotGenDebug] Day key: ${dayKey}, Found ${dailyRulesForDay.length} rule blocks for this day.`,
        );

        if (dailyRulesForDay.length === 0) {
          this.logger.info(
            `[SlotGenDebug] No availability rules defined for ${dayKey}. Skipping day.`,
          );
          currentDayUTC = addDays(currentDayUTC, 1);
          continue;
        }

        const timeMinUTC = fromZonedTime(
          startOfDay(currentDayInPractitionerTz),
          practitionerTz,
        ).toISOString();
        const timeMaxUTC = fromZonedTime(
          endOfDay(currentDayInPractitionerTz),
          practitionerTz,
        ).toISOString();

        let allBusyGCalEvents = [];
        let kamboSessionEventsOnGCal = [];

        try {
          if (this.sessionCalendarId) {
            const sessionCalResponse = await this.calendar.events.list({
              calendarId: this.sessionCalendarId,
              timeMin: timeMinUTC,
              timeMax: timeMaxUTC,
              singleEvents: true,
              orderBy: "startTime",
            });
            kamboSessionEventsOnGCal = sessionCalResponse.data.items || [];
            allBusyGCalEvents.push(...kamboSessionEventsOnGCal);
            this.logger.info(
              `[SlotGenDebug] Fetched ${kamboSessionEventsOnGCal.length} events from Kambo Session Calendar for ${format(currentDayInPractitionerTz, "yyyy-MM-dd")}.`,
            );
          }
          if (this.personalCalendarId) {
            const personalCalResponse = await this.calendar.events.list({
              calendarId: this.personalCalendarId,
              timeMin: timeMinUTC,
              timeMax: timeMaxUTC,
              singleEvents: true,
              orderBy: "startTime",
            });
            const personalEvents = personalCalResponse.data.items || [];
            allBusyGCalEvents.push(...personalEvents);
            this.logger.info(
              `[SlotGenDebug] Fetched ${personalEvents.length} events from Personal Calendar for ${format(currentDayInPractitionerTz, "yyyy-MM-dd")}.`,
            );
          }
        } catch (err) {
          this.logger.error(
            {
              errObj: err,
              message: err.message,
              stack: err.stack,
              details: `Failed to fetch GCal events for ${format(currentDayInPractitionerTz, "yyyy-MM-dd")}`,
            },
            `[SlotGenDebug] GCal Fetch Error`,
          );
          currentDayUTC = addDays(currentDayUTC, 1);
          continue;
        }

        const gCalKamboBookedCount = kamboSessionEventsOnGCal.length;
        this.logger.info(
          `[SlotGenDebug] Kambo sessions already booked on GCal for ${dayKey}: ${gCalKamboBookedCount}. Max allowed by rule: ${rules.max_bookings_per_day}.`,
        );

        if (gCalKamboBookedCount >= rules.max_bookings_per_day) {
          this.logger.info(
            `[SlotGenDebug] Max Kambo bookings (${rules.max_bookings_per_day}) reached for ${dayKey}. Skipping slot generation for this day.`,
          );
          currentDayUTC = addDays(currentDayUTC, 1);
          continue;
        }

        const dailyCandidateSlotsInPractitionerTz = [];
        const stepMinutes = rules.slot_increment_minutes || 15;
        this.logger.info(
          `[SlotGenDebug] Slot increment for ${dayKey} is ${stepMinutes} minutes.`,
        );

        for (const ruleBlock of dailyRulesForDay) {
          const [startH, startM] = ruleBlock.start.split(":").map(Number);
          const [endH, endM] = ruleBlock.end.split(":").map(Number);

          let potentialSlotStartInPractitionerTz = set(
            currentDayInPractitionerTz,
            { hours: startH, minutes: startM, seconds: 0, milliseconds: 0 },
          );
          const dailyRuleBlockEndInPractitionerTz = set(
            currentDayInPractitionerTz,
            { hours: endH, minutes: endM, seconds: 0, milliseconds: 0 },
          );
          this.logger.info(
            `[SlotGenDebug]  Processing rule block: ${ruleBlock.start}-${ruleBlock.end}. Loop from ${format(potentialSlotStartInPractitionerTz, "HH:mm")} to ${format(dailyRuleBlockEndInPractitionerTz, "HH:mm")} (PTZ)`,
          );

          while (
            isBefore(
              potentialSlotStartInPractitionerTz,
              dailyRuleBlockEndInPractitionerTz,
            )
          ) {
            this.logger.info(
              `[SlotGenDebug]    Considering potential slot start (PTZ): ${format(potentialSlotStartInPractitionerTz, "yyyy-MM-dd HH:mm:ss")}`,
            );

            if (
              isBefore(potentialSlotStartInPractitionerTz, earliestBookingTime)
            ) {
              this.logger.info(
                `[SlotGenDebug]      Slot ${format(potentialSlotStartInPractitionerTz, "HH:mm")} is before earliest booking time ${format(earliestBookingTime, "HH:mm")}. Advancing by ${stepMinutes} min.`,
              );
              potentialSlotStartInPractitionerTz = addMinutes(
                potentialSlotStartInPractitionerTz,
                stepMinutes,
              );
              continue;
            }

            const potentialSlotEndInPractitionerTz = addMinutes(
              potentialSlotStartInPractitionerTz,
              sessionDurationMinutes,
            );
            if (
              isAfter(
                potentialSlotEndInPractitionerTz,
                dailyRuleBlockEndInPractitionerTz,
              )
            ) {
              this.logger.info(
                `[SlotGenDebug]      Slot ${format(potentialSlotStartInPractitionerTz, "HH:mm")}-${format(potentialSlotEndInPractitionerTz, "HH:mm")} ends after rule block end ${format(dailyRuleBlockEndInPractitionerTz, "HH:mm")}. Breaking from this rule block.`,
              );
              break;
            }

            let conflict = false;
            const slotStartUTC = fromZonedTime(
              potentialSlotStartInPractitionerTz,
              practitionerTz,
            );
            const slotEndUTC = fromZonedTime(
              potentialSlotEndInPractitionerTz,
              practitionerTz,
            );

            for (const gcalEvent of allBusyGCalEvents) {
              const eventStartUTC = parseISO(
                gcalEvent.start.dateTime || gcalEvent.start.date,
              );
              const eventEndUTC = parseISO(
                gcalEvent.end.dateTime || gcalEvent.end.date,
              );

              const bufferedEventStart = addMinutes(
                eventStartUTC,
                -rules.buffer_time_minutes,
              );
              const bufferedEventEnd = addMinutes(
                eventEndUTC,
                rules.buffer_time_minutes,
              );

              if (
                areIntervalsOverlapping(
                  { start: slotStartUTC, end: slotEndUTC },
                  { start: bufferedEventStart, end: bufferedEventEnd },
                )
              ) {
                this.logger.info(
                  `[SlotGenDebug]      Conflict! Slot ${format(potentialSlotStartInPractitionerTz, "HH:mm")}-${format(potentialSlotEndInPractitionerTz, "HH:mm")} (UTC: ${slotStartUTC.toISOString()}-${slotEndUTC.toISOString()}) overlaps with GCal event: "${gcalEvent.summary}" (${format(toZonedTime(eventStartUTC, practitionerTz), "HH:mm")}-${format(toZonedTime(eventEndUTC, practitionerTz), "HH:mm")}) with buffer ${rules.buffer_time_minutes}min.`,
                );
                conflict = true;
                break;
              }
            }

            if (!conflict) {
              this.logger.info(
                `[SlotGenDebug]      ++ Adding VALID slot (PTZ): ${format(potentialSlotStartInPractitionerTz, "yyyy-MM-dd HH:mm:ss")}`,
              );
              dailyCandidateSlotsInPractitionerTz.push(
                potentialSlotStartInPractitionerTz,
              );
            }
            potentialSlotStartInPractitionerTz = addMinutes(
              potentialSlotStartInPractitionerTz,
              stepMinutes,
            );
          }
          this.logger.info(
            `[SlotGenDebug]  Finished processing rule block ${ruleBlock.start}-${ruleBlock.end}. Candidates found in this block: ${dailyCandidateSlotsInPractitionerTz.length > 0 ? dailyCandidateSlotsInPractitionerTz.map((s) => format(s, "HH:mm")).join(", ") : "None"}.`,
          );
        }

        // All daily candidate slots are considered, as the check for gCalKamboBookedCount >= rules.max_bookings_per_day (which would skip the day) has already passed.
        const slotsToAddForTheDay = dailyCandidateSlotsInPractitionerTz;

        slotsToAddForTheDay.forEach((slotInPractitionerTz) => {
          allAvailableSlotsUTC.push(
            fromZonedTime(slotInPractitionerTz, practitionerTz).toISOString(),
          );
        });

        this.logger.info(
          `[SlotGenDebug] Finished day ${format(currentDayInPractitionerTz, "yyyy-MM-dd")}. Total slots added this day: ${slotsToAddForTheDay.length}. Cumulative slots so far: ${allAvailableSlotsUTC.length}`,
        );

        currentDayUTC = addDays(currentDayUTC, 1);
      }
      this.logger.info(
        `Found ${allAvailableSlotsUTC.length} total available slots after all checks.`,
      );
      return allAvailableSlotsUTC;
    } catch (mainError) {
      this.logger.error(
        {
          errObj: mainError,
          message: mainError.message,
          stack: mainError.stack,
          method: "findFreeSlots",
        },
        "Critical error in findFreeSlots method",
      );
      return []; // Return empty array on critical error
    }
  }
}

// Export the class itself, allowing consumers to instantiate it.
module.exports = GoogleCalendarTool;
