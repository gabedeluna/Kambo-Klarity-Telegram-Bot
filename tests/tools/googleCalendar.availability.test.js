// GoogleCalendarTool Availability Rules Tests

const {
  mockLogger,
  mockPrisma,
  setupEnvironment,
  teardownEnvironment,
  clearAllMocks,
} = require("./googleCalendar.setup");

const GoogleCalendarTool = require("../../src/tools/googleCalendar");

describe("GoogleCalendarTool - Availability Rules", () => {
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
  });

  describe("getAvailabilityRule", () => {
    it("should return availability rule from database", async () => {
      const mockRule = {
        id: 1,
        is_default: true,
        weekly_availability: {
          MON: [{ start: "09:00", end: "17:00" }],
          TUE: [{ start: "09:00", end: "17:00" }],
        },
        practitioner_timezone: "America/Chicago",
        max_advance_days: 60,
        min_notice_hours: 24,
        buffer_time_minutes: 30,
        max_bookings_per_day: 4,
        slot_increment_minutes: 15,
      };

      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);

      const result = await googleCalendarTool.getAvailabilityRule();

      expect(mockPrisma.availabilityRule.findFirst).toHaveBeenCalledWith({
        where: { is_default: true },
      });
      expect(result).toEqual(mockRule);
    });

    it("should parse JSON string weekly_availability from database", async () => {
      const mockRule = {
        id: 1,
        is_default: true,
        weekly_availability: JSON.stringify({
          MON: [{ start: "09:00", end: "17:00" }],
        }),
        practitioner_timezone: "America/Chicago",
        max_advance_days: 60,
        min_notice_hours: 24,
        buffer_time_minutes: 30,
        max_bookings_per_day: 4,
      };

      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);

      const result = await googleCalendarTool.getAvailabilityRule();

      expect(result.weekly_availability).toEqual({
        MON: [{ start: "09:00", end: "17:00" }],
      });
    });

    it("should handle invalid JSON in weekly_availability", async () => {
      const mockRule = {
        id: 1,
        is_default: true,
        weekly_availability: "invalid json",
        practitioner_timezone: "America/Chicago",
        max_advance_days: 60,
        min_notice_hours: 24,
        buffer_time_minutes: 30,
        max_bookings_per_day: 4,
      };

      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);

      const result = await googleCalendarTool.getAvailabilityRule();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleId: 1,
        }),
        "Failed to parse weekly_availability JSON from DB.",
      );
      expect(result.weekly_availability).toEqual({});
    });

    it("should return default rule when no database rule found", async () => {
      mockPrisma.availabilityRule.findFirst.mockResolvedValue(null);

      const result = await googleCalendarTool.getAvailabilityRule();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[getAvailabilityRule] Prisma access not implemented in tool or no rule found. Using placeholder rules.",
      );
      expect(result).toEqual({
        weekly_availability: {
          MON: [{ start: "09:00", end: "17:00" }],
          TUE: [{ start: "09:00", end: "17:00" }],
          WED: [{ start: "09:00", end: "17:00" }],
          THU: [{ start: "09:00", end: "17:00" }],
          FRI: [{ start: "09:00", end: "17:00" }],
        },
        practitioner_timezone: "America/Chicago",
        max_advance_days: 60,
        min_notice_hours: 24,
        buffer_time_minutes: 30,
        max_bookings_per_day: 4,
      });
    });

    it("should handle database errors", async () => {
      const dbError = new Error("Database connection failed");
      mockPrisma.availabilityRule.findFirst.mockRejectedValue(dbError);

      await expect(googleCalendarTool.getAvailabilityRule()).rejects.toThrow(
        "Database connection failed",
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: dbError },
        "[getAvailabilityRule] Error fetching availability rule",
      );
    });
  });
});
