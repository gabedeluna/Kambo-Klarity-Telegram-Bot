const {
  parseISO,
  addMinutes,
  isBefore,
  isEqual,
  addDays,
  format,
  set,
  startOfDay,
  endOfDay,
  getDay,
  areIntervalsOverlapping,
  isAfter,
} = require("date-fns");
const { toZonedTime, fromZonedTime } = require("date-fns-tz");

/**
 * Slot generation utilities for calendar booking
 */
class SlotGenerator {
  constructor(freeBusyUtils, configUtils, logger) {
    this.freeBusyUtils = freeBusyUtils;
    this.configUtils = configUtils;
    this.logger = logger;
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
    this.logger.info(
      { startDateRange, endDateRange, sessionDurationMinutes },
      "Finding free slots (LIVE with FreeBusy API optimization)",
    );

    try {
      const rules = await this.configUtils.getAvailabilityRule();
      if (!rules || !rules.weekly_availability) {
        this.logger.error("Availability rules missing. Cannot find slots.");
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

      // Fetch all busy times for the entire date range in one API call
      const timeMinUTC = fromZonedTime(
        startOfDay(parseISO(startDateRange)),
        practitionerTz,
      ).toISOString();
      const timeMaxUTC = fromZonedTime(
        endOfDay(parseISO(endDateRange)),
        practitionerTz,
      ).toISOString();

      this.logger.info(
        `[FreeBusy] Fetching busy times for entire range: ${timeMinUTC} to ${timeMaxUTC}`,
      );

      const allBusyTimes = await this.freeBusyUtils.fetchBusyTimes(
        timeMinUTC,
        timeMaxUTC,
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

        // Check max bookings per day using FreeBusy data
        const kamboSessionCount = this.freeBusyUtils.countKamboSessionsForDay(
          allBusyTimes,
          currentDayInPractitionerTz,
          practitionerTz,
        );

        this.logger.info(
          `[SlotGenDebug] Kambo sessions already booked for ${dayKey}: ${kamboSessionCount}. Max allowed by rule: ${rules.max_bookings_per_day}.`,
        );

        if (kamboSessionCount >= rules.max_bookings_per_day) {
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

            // Check conflicts against all busy times from FreeBusy API
            for (const busyTime of allBusyTimes) {
              const busyStartUTC = parseISO(busyTime.start);
              const busyEndUTC = parseISO(busyTime.end);

              const bufferedBusyStart = addMinutes(
                busyStartUTC,
                -rules.buffer_time_minutes,
              );
              const bufferedBusyEnd = addMinutes(
                busyEndUTC,
                rules.buffer_time_minutes,
              );

              if (
                areIntervalsOverlapping(
                  { start: slotStartUTC, end: slotEndUTC },
                  { start: bufferedBusyStart, end: bufferedBusyEnd },
                )
              ) {
                this.logger.info(
                  `[SlotGenDebug]      Conflict! Slot ${format(potentialSlotStartInPractitionerTz, "HH:mm")}-${format(potentialSlotEndInPractitionerTz, "HH:mm")} (UTC: ${slotStartUTC.toISOString()}-${slotEndUTC.toISOString()}) overlaps with busy time from ${busyTime.calendarId}: (${format(toZonedTime(busyStartUTC, practitionerTz), "HH:mm")}-${format(toZonedTime(busyEndUTC, practitionerTz), "HH:mm")}) with buffer ${rules.buffer_time_minutes}min.`,
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

        // All daily candidate slots are considered, as the check for kamboSessionCount >= rules.max_bookings_per_day (which would skip the day) has already passed.
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

module.exports = SlotGenerator;
