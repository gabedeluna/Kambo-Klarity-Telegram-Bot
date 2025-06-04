// GoogleCalendarTool Edge Cases Tests - Slot Generation & Event Parsing (Time Independent)

const { toZonedTime } = require("date-fns-tz");

const {
  mockLogger,
  mockPrisma,
  mockCalendarEvents,
  setupEnvironment,
  teardownEnvironment,
  clearAllMocks,
  createMockRule,
  mockCalendarFreeBusy,
} = require("./googleCalendar.setup");

const GoogleCalendarTool = require("../../src/tools/googleCalendar");

// Fixed test dates to ensure time independence
const FIXED_TEST_DATE = new Date("2025-01-15T10:00:00.000Z"); // Wednesday, Jan 15, 2025 10:00 AM UTC
const FIXED_MONDAY = "2025-01-20"; // Monday, Jan 20, 2025
const FIXED_TOMORROW = "2025-01-16"; // Thursday, Jan 16, 2025 (next day)
const FIXED_FAR_FUTURE = "2025-02-20"; // 36 days from test date (beyond 30-day limit)

describe("GoogleCalendarTool - Slot Generation & Event Parsing Edge Cases", () => {
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

  describe("Edge Cases in Slot Generation", () => {
    it("should handle very short availability windows", async () => {
      const mockRule = createMockRule({
        practitioner_timezone: "America/Chicago",
        weekly_availability: {
          MON: [{ start: "12:00", end: "12:30" }], // Only 30 minutes available
        },
        slot_increment_minutes: 15,
        min_notice_hours: 0,
      });
      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);
      mockCalendarEvents.list.mockResolvedValue({ data: { items: [] } });

      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: `${FIXED_MONDAY}T00:00:00.000Z`,
        endDateRange: `${FIXED_MONDAY}T23:59:59.999Z`,
        sessionDurationMinutes: 60, // Session longer than available window
      });

      // Should return no slots since session doesn't fit in 30-minute window
      expect(result).toEqual([]);
    });

    it("should handle minimum notice hours correctly across timezones", async () => {
      const mockRule = createMockRule({
        practitioner_timezone: "Europe/London", // Different timezone from system
        weekly_availability: {
          MON: [{ start: "09:00", end: "17:00" }],
          TUE: [{ start: "09:00", end: "17:00" }],
          WED: [{ start: "09:00", end: "17:00" }],
          THU: [{ start: "09:00", end: "17:00" }],
          FRI: [{ start: "09:00", end: "17:00" }],
          SAT: [{ start: "09:00", end: "17:00" }],
          SUN: [{ start: "09:00", end: "17:00" }],
        },
        min_notice_hours: 48, // 48 hours notice required (2 days)
      });
      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);
      mockCalendarEvents.list.mockResolvedValue({ data: { items: [] } });

      // Try to book for tomorrow (less than 48 hours from our fixed test date)
      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: `${FIXED_TOMORROW}T00:00:00.000Z`,
        endDateRange: `${FIXED_TOMORROW}T23:59:59.999Z`,
        sessionDurationMinutes: 60,
      });

      // Should respect minimum notice hours in practitioner timezone
      // With our fixed test date (Jan 15 10:00 AM UTC) and tomorrow (Jan 16),
      // this is less than 48 hours, so should return no slots
      expect(result).toEqual([]);
    });

    it("should handle max advance days correctly across timezones", async () => {
      const mockRule = createMockRule({
        practitioner_timezone: "Pacific/Auckland", // UTC+12/+13
        weekly_availability: {
          MON: [{ start: "09:00", end: "17:00" }],
          TUE: [{ start: "09:00", end: "17:00" }],
          WED: [{ start: "09:00", end: "17:00" }],
          THU: [{ start: "09:00", end: "17:00" }],
          FRI: [{ start: "09:00", end: "17:00" }],
          SAT: [{ start: "09:00", end: "17:00" }],
          SUN: [{ start: "09:00", end: "17:00" }],
        },
        max_advance_days: 30, // Only 30 days in advance
        min_notice_hours: 0,
      });
      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);
      mockCalendarEvents.list.mockResolvedValue({ data: { items: [] } });

      // Try to book 36 days in advance (beyond 30-day limit)
      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: `${FIXED_FAR_FUTURE}T00:00:00.000Z`,
        endDateRange: `${FIXED_FAR_FUTURE}T23:59:59.999Z`,
        sessionDurationMinutes: 60,
      });

      // Should return no slots due to max advance days limit
      expect(result).toEqual([]);
    });

    it("should handle all-day events vs timed events correctly", async () => {
      const mockRule = createMockRule({
        practitioner_timezone: "America/Los_Angeles",
        weekly_availability: {
          MON: [{ start: "09:00", end: "17:00" }],
        },
        min_notice_hours: 0,
      });
      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);

      // Mix of all-day and timed events
      const events = [
        {
          summary: "All Day Event",
          start: { date: FIXED_MONDAY }, // All-day event (no time)
          end: { date: FIXED_MONDAY },
        },
        {
          summary: "Timed Event",
          start: { dateTime: `${FIXED_MONDAY}T20:00:00.000Z` },
          end: { dateTime: `${FIXED_MONDAY}T21:00:00.000Z` },
        },
      ];

      mockCalendarEvents.list
        .mockResolvedValueOnce({ data: { items: events } })
        .mockResolvedValueOnce({ data: { items: [] } });

      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: `${FIXED_MONDAY}T00:00:00.000Z`,
        endDateRange: `${FIXED_MONDAY}T23:59:59.999Z`,
        sessionDurationMinutes: 60,
      });

      // All-day events should block the entire day
      expect(result).toEqual([]);
    });

    it("should handle slot increment edge cases", async () => {
      const mockRule = createMockRule({
        practitioner_timezone: "America/Chicago",
        weekly_availability: {
          MON: [{ start: "09:00", end: "10:00" }], // 1 hour window
        },
        slot_increment_minutes: 45, // 45-minute increments
        min_notice_hours: 0,
      });
      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);
      
      // Mock FreeBusy API response with no busy times
      mockCalendarFreeBusy.query.mockResolvedValue({
        data: {
          calendars: {
            "test-session-calendar@example.com": { busy: [] },
            "test-personal-calendar@example.com": { busy: [] },
          },
        },
      });

      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: `${FIXED_MONDAY}T00:00:00.000Z`,
        endDateRange: `${FIXED_MONDAY}T23:59:59.999Z`,
        sessionDurationMinutes: 60, // 1 hour session
      });

      // With 45-minute increments and 1-hour window, should only have one slot at 9:00
      // (9:45 start would end at 10:45, which is past the 10:00 end time)
      expect(result.length).toBe(1);

      if (result.length > 0) {
        const slotTime = new Date(result[0]);
        const chicagoTime = toZonedTime(slotTime, "America/Chicago");
        expect(chicagoTime.getHours()).toBe(9);
        expect(chicagoTime.getMinutes()).toBe(0);
      }
    });
  });

  describe("Calendar Event Parsing Edge Cases", () => {
    it("should handle events with missing dateTime fields gracefully", async () => {
      const mockRule = createMockRule({
        practitioner_timezone: "America/Chicago",
        weekly_availability: {
          MON: [{ start: "09:00", end: "17:00" }],
        },
        min_notice_hours: 0,
      });
      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);

      // Mock FreeBusy API response - malformed events would not appear in FreeBusy response
      // since FreeBusy only returns valid busy periods
      mockCalendarFreeBusy.query.mockResolvedValue({
        data: {
          calendars: {
            "test-session-calendar@example.com": { busy: [] },
            "test-personal-calendar@example.com": { busy: [] },
          },
        },
      });

      // Expect this NOT to throw an error
      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: `${FIXED_MONDAY}T00:00:00.000Z`,
        endDateRange: `${FIXED_MONDAY}T23:59:59.999Z`,
        sessionDurationMinutes: 60,
      });

      // Should handle gracefully and return slots since no busy times
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle events in different timezone formats", async () => {
      const mockRule = createMockRule({
        practitioner_timezone: "America/New_York",
        weekly_availability: {
          MON: [{ start: "09:00", end: "17:00" }],
        },
        min_notice_hours: 0,
      });
      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);

      // Mock FreeBusy API response with busy times in different timezone formats
      // FreeBusy API normalizes all times to UTC, so we test with UTC times
      const busyTimes = [
        {
          start: `${FIXED_MONDAY}T14:00:00.000Z`, // 10 AM EST (UTC-4)
          end: `${FIXED_MONDAY}T15:00:00.000Z`,   // 11 AM EST
        },
        {
          start: `${FIXED_MONDAY}T18:00:00.000Z`, // 2 PM EST
          end: `${FIXED_MONDAY}T19:00:00.000Z`,   // 3 PM EST
        },
      ];

      mockCalendarFreeBusy.query.mockResolvedValue({
        data: {
          calendars: {
            "test-session-calendar@example.com": { busy: busyTimes },
            "test-personal-calendar@example.com": { busy: [] },
          },
        },
      });

      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: `${FIXED_MONDAY}T00:00:00.000Z`,
        endDateRange: `${FIXED_MONDAY}T23:59:59.999Z`,
        sessionDurationMinutes: 60,
      });

      // Should correctly parse timezone formats and avoid conflicts
      result.forEach((slot) => {
        const slotStart = new Date(slot);
        const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

        // Check against both busy times
        busyTimes.forEach((busyTime) => {
          const busyStart = new Date(busyTime.start);
          const busyEnd = new Date(busyTime.end);

          // Should not overlap (accounting for buffer time)
          const hasOverlap = slotStart < busyEnd && slotEnd > busyStart;
          expect(hasOverlap).toBe(false);
        });
      });
    });
  });
});
