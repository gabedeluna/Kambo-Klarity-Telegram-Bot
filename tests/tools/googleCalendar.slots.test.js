// GoogleCalendarTool Slot Finding Tests

const { addDays } = require("date-fns");
const {
  mockLogger,
  mockPrisma,
  mockCalendarEvents,
  mockCalendarFreeBusy,
  setupEnvironment,
  teardownEnvironment,
  clearAllMocks,
  createMockRule,
  getNextMonday,
} = require("./googleCalendar.setup");

const GoogleCalendarTool = require("../../src/tools/googleCalendar");

describe("GoogleCalendarTool - Slot Finding", () => {
  let googleCalendarTool;

  beforeAll(() => {
    setupEnvironment();
  });

  afterAll(() => {
    teardownEnvironment();
  });

  beforeEach(() => {
    clearAllMocks();

    const dependencies = {
      logger: mockLogger,
      prisma: mockPrisma,
    };
    googleCalendarTool = new GoogleCalendarTool(dependencies);

    // Mock availability rule with short notice for easier testing
    const mockRule = createMockRule();
    mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);
  });

  describe("findFreeSlots", () => {
    it("should return empty array when no availability rules", async () => {
      // Mock getAvailabilityRule to return a rule with no weekly_availability
      jest.spyOn(googleCalendarTool, "getAvailabilityRule").mockResolvedValue({
        weekly_availability: null, // This will trigger the error condition
        practitioner_timezone: "America/Chicago",
        max_advance_days: 60,
        min_notice_hours: 24,
        buffer_time_minutes: 30,
        max_bookings_per_day: 4,
      });

      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: "2024-01-15T00:00:00.000Z",
        endDateRange: "2024-01-15T23:59:59.999Z", // Single day
        sessionDurationMinutes: 60,
      });

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Availability rules or Session Calendar ID missing. Cannot find slots.",
      );
    });

    it("should return empty array when session calendar ID is missing", async () => {
      googleCalendarTool.sessionCalendarId = null;

      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: "2024-01-15T00:00:00.000Z",
        endDateRange: "2024-01-15T23:59:59.999Z", // Single day
        sessionDurationMinutes: 60,
      });

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Availability rules or Session Calendar ID missing. Cannot find slots.",
      );
    });

    it("should find available slots when no conflicts exist", async () => {
      // Mock empty FreeBusy response (no busy times)
      mockCalendarFreeBusy.query.mockResolvedValue({
        data: {
          calendars: {
            "test-session-calendar@example.com": { busy: [] },
            "test-personal-calendar@example.com": { busy: [] },
          },
        },
      });

      // Use a future Monday to ensure it has availability rules
      const futureMondayStr = getNextMonday();

      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: `${futureMondayStr}T00:00:00.000Z`,
        endDateRange: `${futureMondayStr}T23:59:59.999Z`, // Single day
        sessionDurationMinutes: 60,
      });

      expect(result.length).toBeGreaterThan(0);
      // The method makes 1 FreeBusy call for all calendars
      expect(mockCalendarFreeBusy.query).toHaveBeenCalledTimes(1);

      // Verify FreeBusy API call
      expect(mockCalendarFreeBusy.query).toHaveBeenCalledWith({
        resource: {
          timeMin: expect.any(String),
          timeMax: expect.any(String),
          items: [
            { id: "test-session-calendar@example.com" },
            { id: "test-personal-calendar@example.com" },
          ],
        },
      });
    });

    it("should exclude slots that conflict with existing events", async () => {
      // Use a future Monday
      const futureMondayStr = getNextMonday();

      // Create a mock busy time that would be in Chicago time zone during business hours
      const busyTime = {
        start: `${futureMondayStr}T20:00:00.000Z`, // 3 PM Chicago time (UTC-5/6)
        end: `${futureMondayStr}T21:00:00.000Z`, // 4 PM Chicago time
      };

      mockCalendarFreeBusy.query.mockResolvedValue({
        data: {
          calendars: {
            "test-session-calendar@example.com": { busy: [] },
            "test-personal-calendar@example.com": { busy: [busyTime] },
          },
        },
      });

      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: `${futureMondayStr}T00:00:00.000Z`,
        endDateRange: `${futureMondayStr}T23:59:59.999Z`,
        sessionDurationMinutes: 60,
      });

      // Should have slots, but exclude the conflicting time
      expect(result.length).toBeGreaterThan(0);

      // Check that no slot directly conflicts with the busy time
      const directConflicts = result.filter((slot) => {
        const slotStart = new Date(slot);
        const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
        const busyStart = new Date(busyTime.start);
        const busyEnd = new Date(busyTime.end);

        return slotStart < busyEnd && slotEnd > busyStart;
      });

      expect(directConflicts).toHaveLength(0);
    });

    it("should respect max bookings per day limit", async () => {
      // Use a future Monday
      const futureMondayStr = getNextMonday();

      // Mock FreeBusy response with max bookings already reached (4 Kambo sessions)
      const busyTimes = Array.from({ length: 4 }, (_, i) => ({
        start: `${futureMondayStr}T${String(15 + i * 2).padStart(2, "0")}:00:00.000Z`,
        end: `${futureMondayStr}T${String(16 + i * 2).padStart(2, "0")}:00:00.000Z`,
      }));

      mockCalendarFreeBusy.query.mockResolvedValue({
        data: {
          calendars: {
            "test-session-calendar@example.com": { busy: busyTimes },
            "test-personal-calendar@example.com": { busy: [] },
          },
        },
      });

      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: `${futureMondayStr}T00:00:00.000Z`,
        endDateRange: `${futureMondayStr}T23:59:59.999Z`,
        sessionDurationMinutes: 60,
      });

      expect(result).toEqual([]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Max Kambo bookings (4) reached"),
      );
    });

    it("should skip days with no availability rules", async () => {
      // Mock rule with no Saturday availability
      const mockRule = createMockRule({
        weekly_availability: {
          MON: [{ start: "09:00", end: "17:00" }],
          // No SAT defined
        },
      });
      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);

      // Mock empty FreeBusy response
      mockCalendarFreeBusy.query.mockResolvedValue({
        data: {
          calendars: {
            "test-session-calendar@example.com": { busy: [] },
            "test-personal-calendar@example.com": { busy: [] },
          },
        },
      });

      // Find next Saturday
      const today = new Date();
      const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7;
      const nextSaturday = addDays(today, daysUntilSaturday);
      const saturdayStr = nextSaturday.toISOString().split("T")[0];

      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: `${saturdayStr}T00:00:00.000Z`,
        endDateRange: `${saturdayStr}T23:59:59.999Z`,
        sessionDurationMinutes: 60,
      });

      expect(result).toEqual([]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("No availability rules defined for SAT"),
      );
    });

    it("should handle calendar API errors gracefully", async () => {
      const calendarError = new Error("Calendar API Error");
      mockCalendarFreeBusy.query.mockRejectedValue(calendarError);

      // Use a future Monday
      const futureMondayStr = getNextMonday();

      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: `${futureMondayStr}T00:00:00.000Z`,
        endDateRange: `${futureMondayStr}T23:59:59.999Z`,
        sessionDurationMinutes: 60,
      });

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          errObj: calendarError,
          message: "Calendar API Error",
        }),
        "Critical error in findFreeSlots method",
      );
    });

    it("should handle critical errors and return empty array", async () => {
      const criticalError = new Error("Critical system error");
      mockPrisma.availabilityRule.findFirst.mockRejectedValue(criticalError);

      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: "2024-01-15T00:00:00.000Z",
        endDateRange: "2024-01-15T23:59:59.999Z",
        sessionDurationMinutes: 60,
      });

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          errObj: criticalError,
          method: "findFreeSlots",
        }),
        "Critical error in findFreeSlots method",
      );
    });

    it("should respect minimum notice hours", async () => {
      // Mock rule with 48 hours notice required
      const mockRule = createMockRule({
        weekly_availability: {
          MON: [{ start: "09:00", end: "17:00" }],
          TUE: [{ start: "09:00", end: "17:00" }],
          WED: [{ start: "09:00", end: "17:00" }],
          THU: [{ start: "09:00", end: "17:00" }],
          FRI: [{ start: "09:00", end: "17:00" }],
          SAT: [{ start: "09:00", end: "17:00" }],
          SUN: [{ start: "09:00", end: "17:00" }],
        },
        min_notice_hours: 48, // 48 hours notice required
      });
      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);

      // Mock empty FreeBusy response
      mockCalendarFreeBusy.query.mockResolvedValue({
        data: {
          calendars: {
            "test-session-calendar@example.com": { busy: [] },
            "test-personal-calendar@example.com": { busy: [] },
          },
        },
      });

      // Try to book for tomorrow (less than 48 hours)
      const tomorrow = addDays(new Date(), 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      const result = await googleCalendarTool.findFreeSlots({
        startDateRange: `${tomorrowStr}T00:00:00.000Z`,
        endDateRange: `${tomorrowStr}T23:59:59.999Z`,
        sessionDurationMinutes: 60,
      });

      // Should have no slots due to minimum notice requirement
      expect(result).toEqual([]);
    });
  });
});
