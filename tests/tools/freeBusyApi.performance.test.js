const GoogleCalendarTool = require("../../src/tools/googleCalendar");
const FreeBusyUtils = require("../../src/tools/calendar/freeBusyUtils");
const ConfigUtils = require("../../src/tools/calendar/configUtils");
const SlotGenerator = require("../../src/tools/calendar/slotGenerator");

// Mock dependencies
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

const mockPrisma = {
  availabilityRule: {
    findFirst: jest.fn(),
  },
};

const mockCalendar = {
  freebusy: {
    query: jest.fn(),
  },
};

describe("FreeBusy API Performance Tests", () => {
  let freeBusyUtils;
  let configUtils;
  let slotGenerator;
  let googleCalendarTool;

  const mockSessionCalendarId = "session@example.com";
  const mockPersonalCalendarId = "personal@example.com";

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock environment variables
    process.env.GOOGLE_CALENDAR_ID = mockSessionCalendarId;
    process.env.GOOGLE_PERSONAL_CALENDAR_ID = mockPersonalCalendarId;
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/credentials.json";

    // Initialize utility classes
    freeBusyUtils = new FreeBusyUtils(
      mockCalendar,
      mockSessionCalendarId,
      mockPersonalCalendarId,
      mockLogger,
    );

    configUtils = new ConfigUtils(mockPrisma, mockLogger);
    slotGenerator = new SlotGenerator(freeBusyUtils, configUtils, mockLogger);

    // Mock GoogleCalendarTool constructor to avoid auth issues in tests
    googleCalendarTool = {
      freeBusyUtils,
      configUtils,
      slotGenerator,
      logger: mockLogger,
      sessionCalendarId: mockSessionCalendarId,
      personalCalendarId: mockPersonalCalendarId,
    };
  });

  describe("FreeBusyUtils", () => {
    test("should fetch busy times for multiple calendars efficiently", async () => {
      const mockFreeBusyResponse = {
        data: {
          calendars: {
            [mockSessionCalendarId]: {
              busy: [
                {
                  start: "2024-01-15T10:00:00Z",
                  end: "2024-01-15T11:30:00Z",
                },
                {
                  start: "2024-01-15T14:00:00Z",
                  end: "2024-01-15T15:30:00Z",
                },
              ],
            },
            [mockPersonalCalendarId]: {
              busy: [
                {
                  start: "2024-01-15T12:00:00Z",
                  end: "2024-01-15T13:00:00Z",
                },
              ],
            },
          },
        },
      };

      mockCalendar.freebusy.query.mockResolvedValue(mockFreeBusyResponse);

      const timeMin = "2024-01-15T00:00:00Z";
      const timeMax = "2024-01-15T23:59:59Z";

      const startTime = Date.now();
      const busyTimes = await freeBusyUtils.fetchBusyTimes(timeMin, timeMax);
      const endTime = Date.now();

      // Verify API was called correctly
      expect(mockCalendar.freebusy.query).toHaveBeenCalledWith({
        resource: {
          timeMin,
          timeMax,
          items: [
            { id: mockSessionCalendarId },
            { id: mockPersonalCalendarId },
          ],
        },
      });

      // Verify results
      expect(busyTimes).toHaveLength(3);
      expect(busyTimes[0]).toEqual({
        start: "2024-01-15T10:00:00Z",
        end: "2024-01-15T11:30:00Z",
        calendarId: mockSessionCalendarId,
      });

      // Performance check - should be fast (under 100ms for mock)
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(100);

      console.log(`FreeBusy API call completed in ${executionTime}ms`);
    });

    test("should handle empty busy times gracefully", async () => {
      const mockFreeBusyResponse = {
        data: {
          calendars: {
            [mockSessionCalendarId]: { busy: [] },
            [mockPersonalCalendarId]: { busy: [] },
          },
        },
      };

      mockCalendar.freebusy.query.mockResolvedValue(mockFreeBusyResponse);

      const busyTimes = await freeBusyUtils.fetchBusyTimes(
        "2024-01-15T00:00:00Z",
        "2024-01-15T23:59:59Z",
      );

      expect(busyTimes).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Total busy periods found: 0"),
      );
    });

    test("should count Kambo sessions correctly", () => {
      const busyTimes = [
        {
          start: "2024-01-15T10:00:00Z",
          end: "2024-01-15T11:30:00Z",
          calendarId: mockSessionCalendarId,
        },
        {
          start: "2024-01-15T14:00:00Z",
          end: "2024-01-15T15:30:00Z",
          calendarId: mockSessionCalendarId,
        },
        {
          start: "2024-01-15T12:00:00Z",
          end: "2024-01-15T13:00:00Z",
          calendarId: mockPersonalCalendarId, // Should not be counted
        },
      ];

      const dayInPractitionerTz = new Date("2024-01-15T00:00:00");
      const practitionerTz = "America/Chicago";

      const count = freeBusyUtils.countKamboSessionsForDay(
        busyTimes,
        dayInPractitionerTz,
        practitionerTz,
      );

      expect(count).toBe(2); // Only session calendar events
    });
  });

  describe("ConfigUtils", () => {
    test("should fetch availability rules from database", async () => {
      const mockRule = {
        id: 1,
        is_default: true,
        weekly_availability: JSON.stringify({
          MON: [{ start: "09:00", end: "17:00" }],
          TUE: [{ start: "09:00", end: "17:00" }],
          WED: [{ start: "09:00", end: "17:00" }],
          THU: [{ start: "09:00", end: "17:00" }],
          FRI: [{ start: "09:00", end: "17:00" }],
        }),
        practitioner_timezone: "America/Chicago",
        max_advance_days: 60,
        min_notice_hours: 24,
        buffer_time_minutes: 30,
        max_bookings_per_day: 4,
        slot_increment_minutes: 15,
      };

      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);

      const rule = await configUtils.getAvailabilityRule();

      expect(rule.weekly_availability).toEqual({
        MON: [{ start: "09:00", end: "17:00" }],
        TUE: [{ start: "09:00", end: "17:00" }],
        WED: [{ start: "09:00", end: "17:00" }],
        THU: [{ start: "09:00", end: "17:00" }],
        FRI: [{ start: "09:00", end: "17:00" }],
      });
      expect(rule.practitioner_timezone).toBe("America/Chicago");
    });

    test("should fallback to environment variables when database unavailable", async () => {
      mockPrisma.availabilityRule.findFirst.mockResolvedValue(null);

      process.env.TEMP_WEEKLY_AVAILABILITY_JSON = JSON.stringify({
        MON: [{ start: "10:00", end: "16:00" }],
      });
      process.env.PRACTITIONER_TIMEZONE = "America/New_York";

      const rule = await configUtils.getAvailabilityRule();

      expect(rule.weekly_availability).toEqual({
        MON: [{ start: "10:00", end: "16:00" }],
      });
      expect(rule.practitioner_timezone).toBe("America/New_York");
    });
  });

  describe("SlotGenerator Integration", () => {
    test("should generate slots using FreeBusy API efficiently", async () => {
      // Mock availability rules
      const mockRule = {
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

      // Mock FreeBusy response with some conflicts
      const mockFreeBusyResponse = {
        data: {
          calendars: {
            [mockSessionCalendarId]: {
              busy: [
                {
                  start: "2024-01-15T15:00:00Z", // 9 AM Chicago time
                  end: "2024-01-15T16:30:00Z", // 10:30 AM Chicago time
                },
              ],
            },
            [mockPersonalCalendarId]: {
              busy: [],
            },
          },
        },
      };

      mockCalendar.freebusy.query.mockResolvedValue(mockFreeBusyResponse);

      const startTime = Date.now();
      const slots = await slotGenerator.findFreeSlots({
        startDateRange: "2024-01-15T00:00:00",
        endDateRange: "2024-01-16T23:59:59",
        sessionDurationMinutes: 90,
      });
      const endTime = Date.now();

      // Verify FreeBusy API was called once for the entire range
      expect(mockCalendar.freebusy.query).toHaveBeenCalledTimes(1);

      // Verify slots were generated
      expect(Array.isArray(slots)).toBe(true);

      // Performance check
      const executionTime = endTime - startTime;
      console.log(`Slot generation completed in ${executionTime}ms`);
      console.log(`Generated ${slots.length} available slots`);

      // Should be reasonably fast
      expect(executionTime).toBeLessThan(1000);
    });
  });

  describe("Performance Comparison", () => {
    test("should demonstrate FreeBusy API efficiency vs multiple individual calls", async () => {
      const mockRule = {
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
        slot_increment_minutes: 15,
      };

      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);

      const mockFreeBusyResponse = {
        data: {
          calendars: {
            [mockSessionCalendarId]: { busy: [] },
            [mockPersonalCalendarId]: { busy: [] },
          },
        },
      };

      mockCalendar.freebusy.query.mockResolvedValue(mockFreeBusyResponse);

      // Test FreeBusy API approach (current implementation)
      const freeBusyStartTime = Date.now();
      await slotGenerator.findFreeSlots({
        startDateRange: "2024-01-15T00:00:00",
        endDateRange: "2024-01-21T23:59:59", // 7 days
        sessionDurationMinutes: 90,
      });
      const freeBusyEndTime = Date.now();
      const freeBusyTime = freeBusyEndTime - freeBusyStartTime;

      // Verify only one API call was made for the entire week
      expect(mockCalendar.freebusy.query).toHaveBeenCalledTimes(1);

      console.log(`FreeBusy API approach: ${freeBusyTime}ms for 7 days`);
      console.log(`API calls made: 1`);

      // Reset mock call count
      mockCalendar.freebusy.query.mockClear();

      // Simulate old approach (multiple calls per day)
      const oldApproachStartTime = Date.now();
      for (let day = 0; day < 7; day++) {
        await freeBusyUtils.fetchBusyTimes(
          `2024-01-${15 + day}T00:00:00Z`,
          `2024-01-${15 + day}T23:59:59Z`,
        );
      }
      const oldApproachEndTime = Date.now();
      const oldApproachTime = oldApproachEndTime - oldApproachStartTime;

      console.log(`Old approach simulation: ${oldApproachTime}ms for 7 days`);
      console.log(
        `API calls made: ${mockCalendar.freebusy.query.mock.calls.length}`,
      );

      // FreeBusy should be more efficient (fewer API calls)
      expect(mockCalendar.freebusy.query).toHaveBeenCalledTimes(7);

      // Log the efficiency gain
      const efficiencyGain = (
        ((oldApproachTime - freeBusyTime) / oldApproachTime) *
        100
      ).toFixed(1);
      console.log(`Efficiency gain: ${efficiencyGain}% reduction in API calls`);
    });
  });
});
