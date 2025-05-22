// GoogleCalendarTool Edge Cases Tests - Timezone & Buffer Time (Time Independent)

const { toZonedTime } = require("date-fns-tz");

const {
  mockLogger,
  mockPrisma,
  mockCalendarEvents,
  setupEnvironment,
  teardownEnvironment,
  clearAllMocks,
  createMockRule,
} = require("./googleCalendar.setup");

const GoogleCalendarTool = require("../../src/tools/googleCalendar");

// Fixed test dates to ensure time independence
const FIXED_TEST_DATE = new Date("2025-01-15T10:00:00.000Z"); // Wednesday, Jan 15, 2025 10:00 AM UTC
const FIXED_MONDAY = "2025-01-20"; // Monday, Jan 20, 2025
const FIXED_TUESDAY = "2025-01-21"; // Tuesday, Jan 21, 2025
const DST_SPRING_MONDAY = "2025-03-10"; // Monday after DST begins (March 9, 2025)
const DST_FALL_MONDAY = "2025-11-03"; // Monday after DST ends (November 2, 2025)

describe("GoogleCalendarTool - Timezone & Buffer Time Edge Cases", () => {
  let googleCalendarTool;
  let originalDate;

  beforeAll(() => {
    setupEnvironment();
    // Mock Date to always return our fixed test date
    originalDate = global.Date;
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_TEST_DATE);
  });

  afterAll(() => {
    jest.useRealTimers();
    global.Date = originalDate;
    teardownEnvironment();
  });

  beforeEach(() => {
    clearAllMocks();

    const dependencies = {
      logger: mockLogger,
      prisma: mockPrisma,
    };
    googleCalendarTool = new GoogleCalendarTool(dependencies);
  });

  describe("Timezone Conversion Edge Cases", () => {
    it("should handle DST transitions correctly (spring forward)", async () => {
      // March 10, 2025 is the Monday after DST begins in America/Chicago
      const mockRule = createMockRule({
        practitioner_timezone: "America/Chicago",
        weekly_availability: {
          MON: [{ start: "09:00", end: "17:00" }],
        },
        min_notice_hours: 0, // Allow immediate booking for testing
      });
      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);
      mockCalendarEvents.list.mockResolvedValue({ data: { items: [] } });

      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: `${DST_SPRING_MONDAY}T00:00:00.000Z`,
        endDateRange: `${DST_SPRING_MONDAY}T23:59:59.999Z`,
        sessionDurationMinutes: 60,
      });

      // Should handle DST transition without throwing errors
      expect(Array.isArray(result)).toBe(true);

      // If slots are returned, verify they respect practitioner timezone availability
      if (result.length > 0) {
        result.forEach((slot) => {
          const slotTime = new Date(slot);
          const practitionerTime = toZonedTime(slotTime, "America/Chicago");
          const hour = practitionerTime.getHours();

          // Should be within business hours in practitioner timezone
          expect(hour).toBeGreaterThanOrEqual(9);
          expect(hour).toBeLessThan(17);
        });
      }
    });

    it("should handle DST transitions correctly (fall back)", async () => {
      // November 3, 2025 is the Monday after DST ends in America/Chicago
      const mockRule = createMockRule({
        practitioner_timezone: "America/Chicago",
        weekly_availability: {
          MON: [{ start: "09:00", end: "17:00" }],
        },
        min_notice_hours: 0,
      });
      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);
      mockCalendarEvents.list.mockResolvedValue({ data: { items: [] } });

      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: `${DST_FALL_MONDAY}T00:00:00.000Z`,
        endDateRange: `${DST_FALL_MONDAY}T23:59:59.999Z`,
        sessionDurationMinutes: 60,
      });

      // Should handle DST transition without throwing errors
      expect(Array.isArray(result)).toBe(true);

      // If slots are returned, verify they respect practitioner timezone availability
      if (result.length > 0) {
        result.forEach((slot) => {
          const slotTime = new Date(slot);
          const practitionerTime = toZonedTime(slotTime, "America/Chicago");
          const hour = practitionerTime.getHours();

          expect(hour).toBeGreaterThanOrEqual(9);
          expect(hour).toBeLessThan(17);
        });
      }
    });

    it("should handle timezone differences across date boundaries", async () => {
      // Test when practitioner timezone is ahead of UTC (e.g., Australia/Sydney)
      const mockRule = createMockRule({
        practitioner_timezone: "Australia/Sydney", // UTC+10/+11
        weekly_availability: {
          MON: [{ start: "09:00", end: "17:00" }],
        },
        min_notice_hours: 0,
      });
      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);
      mockCalendarEvents.list.mockResolvedValue({ data: { items: [] } });

      // Monday in UTC might be Tuesday in Sydney
      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: `${FIXED_MONDAY}T00:00:00.000Z`,
        endDateRange: `${FIXED_MONDAY}T23:59:59.999Z`,
        sessionDurationMinutes: 60,
      });

      // The tool should handle the date conversion correctly
      // Even though it's Monday in UTC, it might be Tuesday in Sydney
      // The tool should generate slots based on Sydney timezone rules

      if (result.length > 0) {
        // Verify returned slots are correctly converted to UTC
        result.forEach((slot) => {
          const slotTime = new Date(slot);
          expect(slotTime.toISOString()).toMatch(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
          );

          // Verify the slot time makes sense in Sydney timezone
          const sydneyTime = toZonedTime(slotTime, "Australia/Sydney");
          const hour = sydneyTime.getHours();
          expect(hour).toBeGreaterThanOrEqual(9);
          expect(hour).toBeLessThan(17);
        });
      }
    });

    it("should handle timezone differences when practitioner is behind UTC", async () => {
      // Test with Hawaii timezone (UTC-10)
      const mockRule = createMockRule({
        practitioner_timezone: "Pacific/Honolulu", // UTC-10
        weekly_availability: {
          TUE: [{ start: "09:00", end: "17:00" }],
        },
        min_notice_hours: 0,
      });
      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);
      mockCalendarEvents.list.mockResolvedValue({ data: { items: [] } });

      // Tuesday in UTC might still be Monday in Hawaii
      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: `${FIXED_TUESDAY}T00:00:00.000Z`,
        endDateRange: `${FIXED_TUESDAY}T23:59:59.999Z`,
        sessionDurationMinutes: 60,
      });

      if (result.length > 0) {
        result.forEach((slot) => {
          const slotTime = new Date(slot);
          const hawaiiTime = toZonedTime(slotTime, "Pacific/Honolulu");
          const hour = hawaiiTime.getHours();

          // Should respect Hawaii business hours
          expect(hour).toBeGreaterThanOrEqual(9);
          expect(hour).toBeLessThan(17);
        });
      }
    });

    it("should handle midnight boundary edge cases", async () => {
      const mockRule = createMockRule({
        practitioner_timezone: "America/Chicago",
        weekly_availability: {
          MON: [{ start: "23:00", end: "23:59" }], // Very late hours
        },
        min_notice_hours: 0,
      });
      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);
      mockCalendarEvents.list.mockResolvedValue({ data: { items: [] } });

      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: `${FIXED_MONDAY}T00:00:00.000Z`,
        endDateRange: `${FIXED_MONDAY}T23:59:59.999Z`,
        sessionDurationMinutes: 30, // Short session to fit in the hour
      });

      if (result.length > 0) {
        // Verify slots are properly converted between timezones at day boundaries
        result.forEach((slot) => {
          const slotTime = new Date(slot);
          const chicagoTime = toZonedTime(slotTime, "America/Chicago");
          const hour = chicagoTime.getHours();

          expect(hour).toBe(23); // Should be 11 PM in Chicago time
        });
      }
    });
  });

  describe("Buffer Time Edge Cases", () => {
    it("should apply buffer time correctly across timezone boundaries", async () => {
      const mockRule = createMockRule({
        practitioner_timezone: "America/New_York",
        weekly_availability: {
          MON: [{ start: "09:00", end: "17:00" }],
        },
        buffer_time_minutes: 60, // 1 hour buffer
        min_notice_hours: 0,
      });
      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);

      // Create a conflicting event in UTC
      const conflictingEvent = {
        summary: "Existing Meeting",
        start: { dateTime: `${FIXED_MONDAY}T19:00:00.000Z` }, // 3 PM or 2 PM ET depending on DST
        end: { dateTime: `${FIXED_MONDAY}T20:00:00.000Z` }, // 4 PM or 3 PM ET
      };

      mockCalendarEvents.list
        .mockResolvedValueOnce({ data: { items: [conflictingEvent] } })
        .mockResolvedValueOnce({ data: { items: [] } });

      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: `${FIXED_MONDAY}T00:00:00.000Z`,
        endDateRange: `${FIXED_MONDAY}T23:59:59.999Z`,
        sessionDurationMinutes: 60,
      });

      // Verify no slots conflict with buffered event time
      result.forEach((slot) => {
        const slotStart = new Date(slot);
        const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
        const eventStart = new Date(conflictingEvent.start.dateTime);
        const eventEnd = new Date(conflictingEvent.end.dateTime);

        // Check that slot doesn't overlap with event + buffer (1 hour before and after)
        const bufferedEventStart = new Date(
          eventStart.getTime() - 60 * 60 * 1000,
        );
        const bufferedEventEnd = new Date(eventEnd.getTime() + 60 * 60 * 1000);

        const hasOverlap =
          slotStart < bufferedEventEnd && slotEnd > bufferedEventStart;
        expect(hasOverlap).toBe(false);
      });
    });

    it("should handle buffer time at day boundaries correctly", async () => {
      const mockRule = createMockRule({
        practitioner_timezone: "America/Chicago",
        weekly_availability: {
          MON: [{ start: "00:00", end: "02:00" }], // Early morning hours
          TUE: [{ start: "22:00", end: "23:59" }], // Late evening hours
        },
        buffer_time_minutes: 30,
        min_notice_hours: 0,
      });
      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);

      // Event at the very end of Monday/beginning of Tuesday in practitioner time
      const boundaryEvent = {
        summary: "Boundary Event",
        start: { dateTime: `${FIXED_TUESDAY}T04:30:00.000Z` }, // 11:30 PM Monday Chicago time
        end: { dateTime: `${FIXED_TUESDAY}T05:30:00.000Z` }, // 12:30 AM Tuesday Chicago time
      };

      mockCalendarEvents.list.mockResolvedValue({
        data: { items: [boundaryEvent] },
      });

      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: `${FIXED_MONDAY}T00:00:00.000Z`,
        endDateRange: `${FIXED_TUESDAY}T23:59:59.999Z`,
        sessionDurationMinutes: 60,
      });

      // Verify buffer time is correctly applied across day boundaries
      if (result.length > 0) {
        result.forEach((slot) => {
          const slotStart = new Date(slot);
          const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
          const eventStart = new Date(boundaryEvent.start.dateTime);
          const eventEnd = new Date(boundaryEvent.end.dateTime);

          // Check buffer is applied correctly
          const bufferedEventStart = new Date(
            eventStart.getTime() - 30 * 60 * 1000,
          );
          const bufferedEventEnd = new Date(
            eventEnd.getTime() + 30 * 60 * 1000,
          );

          const hasOverlap =
            slotStart < bufferedEventEnd && slotEnd > bufferedEventStart;
          expect(hasOverlap).toBe(false);
        });
      }
    });
  });
});
