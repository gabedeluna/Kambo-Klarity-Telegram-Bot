// tests/tools/googleCalendar.test.js

// Mock dependencies
const mockAuthInstance = { client: "mockJWTClient" };
jest.mock("google-auth-library", () => ({
  JWT: jest.fn(() => mockAuthInstance),
}));

const mockGoogleCalendarEventsList = jest.fn();
jest.mock("googleapis", () => ({
  google: {
    calendar: jest.fn(() => ({
      events: {
        list: mockGoogleCalendarEventsList,
      },
    })),
  },
}));

jest.mock("pino", () => {
  const pinoInstanceMock = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => pinoInstanceMock),
  };
  const pinoModuleFn = jest.fn(() => pinoInstanceMock);
  pinoModuleFn.destination = jest.fn(() => ({ write: jest.fn() }));
  return pinoModuleFn;
});

const mockActualDateFnsTz = jest.requireActual("date-fns-tz");
jest.mock("date-fns-tz", () => ({
  ...mockActualDateFnsTz,
  toZonedTime: jest.fn((date, tz) => mockActualDateFnsTz.toZonedTime(date, tz)),
  fromZonedTime: jest.fn((date, tz) =>
    mockActualDateFnsTz.fromZonedTime(date, tz),
  ),
}));

// Import SUT and other dependencies AFTER mocks are set up at the top
let GoogleCalendarTool;
// These will be the mocked versions due to jest.mock calls at the top
const { google: _google } = require("googleapis");
const { JWT: _JWT } = require("google-auth-library");
const _pino = require("pino");
const { toZonedTime, fromZonedTime } = require("date-fns-tz");
const { parseISO, addMinutes, format, set } = require("date-fns");

const mockPrismaClient = {
  availabilityRule: {
    findFirst: jest.fn(),
  },
};

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});
let mockLogger; // Will be assigned in beforeEach

describe("GoogleCalendarTool", () => {
  let consoleErrorSpy;
  let originalEnv;
  let originalGetTimezoneOffset;

  beforeEach(() => {
    // No jest.resetModules() here by default; apply it selectively in tests if needed.

    originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
    Date.prototype.getTimezoneOffset = jest.fn().mockReturnValue(0);

    // Clear mocks. Since jest.mock is at the top, require() gives the mocked versions.
    const authLib = require("google-auth-library");
    authLib.JWT.mockClear();
    authLib.JWT.mockImplementation(() => mockAuthInstance);

    const gApis = require("googleapis");
    mockGoogleCalendarEventsList.mockClear();
    const calendarInstance = gApis.google.calendar();
    if (calendarInstance && calendarInstance.events) {
      calendarInstance.events.list = mockGoogleCalendarEventsList;
    }

    const pinoModule = require("pino");
    pinoModule.mockClear();
    if (pinoModule.destination) {
      pinoModule.destination.mockClear();
    }
    const pinoInstance = pinoModule();
    pinoInstance.info.mockClear();
    pinoInstance.warn.mockClear();
    pinoInstance.error.mockClear();
    pinoInstance.debug.mockClear();
    pinoInstance.child.mockClear().mockImplementation(() => pinoInstance);

    if (mockPrismaClient.availabilityRule) {
      mockPrismaClient.availabilityRule.findFirst.mockReset(); // .mockReset() clears impl and calls
    }

    const dateFnsTz = require("date-fns-tz");
    dateFnsTz.toZonedTime.mockImplementation((date, tz) =>
      mockActualDateFnsTz.toZonedTime(date, tz),
    );
    dateFnsTz.fromZonedTime.mockImplementation((date, tz) =>
      mockActualDateFnsTz.fromZonedTime(date, tz),
    );

    originalEnv = { ...process.env };
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "fake/path/to/creds.json";
    process.env.GOOGLE_CALENDAR_ID =
      "session_calendar_id@group.calendar.google.com";
    process.env.GOOGLE_PERSONAL_CALENDAR_ID = "personal_calendar_id@gmail.com";
    process.env.PRACTITIONER_TIMEZONE = "America/New_York";
    process.env.TEMP_WEEKLY_AVAILABILITY_JSON = JSON.stringify({
      MON: [{ start: "09:00", end: "17:00" }],
    });
    process.env.TEMP_MAX_ADVANCE_DAYS = "60";
    process.env.TEMP_MIN_NOTICE_HOURS = "24";
    process.env.TEMP_BUFFER_TIME_MINUTES = "30";
    process.env.TEMP_MAX_BOOKINGS_PER_DAY = "4";

    // Load SUT here, it will pick up the currently configured mocks
    GoogleCalendarTool = require("../../src/tools/googleCalendar");
    mockLogger = createMockLogger();

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.useFakeTimers();
  });

  afterEach(() => {
    process.env = originalEnv;
    if (consoleErrorSpy) consoleErrorSpy.mockRestore();
    Date.prototype.getTimezoneOffset = originalGetTimezoneOffset;
    jest.useRealTimers();
    jest.clearAllMocks(); // Clears all .mock property of all mocks
  });

  describe("constructor", () => {
    it("should instantiate successfully with all dependencies and env vars", () => {
      const tool = new GoogleCalendarTool({
        logger: mockLogger,
        prisma: mockPrismaClient,
      });
      expect(tool).toBeInstanceOf(GoogleCalendarTool);
      const { JWT: CurrentJWT } = require("google-auth-library"); // Get current mock
      expect(CurrentJWT).toHaveBeenCalledWith({
        keyFile: "fake/path/to/creds.json",
        scopes: ["https://www.googleapis.com/auth/calendar"],
      });
      const { google: CurrentGoogle } = require("googleapis");
      expect(CurrentGoogle.calendar).toHaveBeenCalledWith({
        version: "v3",
        auth: mockAuthInstance,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("[GoogleCalendarTool] Live instance created."),
      );
    });

    it("should use fallback pino logger if logger dependency is missing", () => {
      // --- Test-specific isolation ---
      jest.resetModules();
      const originalGetTimezoneOffsetForTest = Date.prototype.getTimezoneOffset;
      Date.prototype.getTimezoneOffset = jest.fn().mockReturnValue(0); // Re-apply for isolated scope

      // Reload and re-clear pino mock for this isolated test
      const pinoModuleIsolated = require("pino");
      // Get the instance for setting up its method mocks
      const pinoInstanceIsolated = pinoModuleIsolated();
      // Now clear the factory mock itself before SUT instantiation
      pinoModuleIsolated.mockClear();
      if (pinoModuleIsolated.destination) {
        pinoModuleIsolated.destination.mockClear();
      }
      // Clear methods on the instance if needed, though for this test, factory call count is key
      pinoInstanceIsolated.info.mockClear();
      pinoInstanceIsolated.warn.mockClear();
      pinoInstanceIsolated.error.mockClear();
      pinoInstanceIsolated.debug.mockClear();
      pinoInstanceIsolated.child
        .mockClear()
        .mockImplementation(() => pinoInstanceIsolated);

      // Set up env for this specific constructor scenario
      process.env.GOOGLE_APPLICATION_CREDENTIALS = "fake/path/to/creds.json";
      process.env.GOOGLE_CALENDAR_ID =
        "session_calendar_id@group.calendar.google.com";
      // Other env vars as needed by constructor if not using full originalEnv restoration for this isolated test

      const IsolatedGoogleCalendarTool = require("../../src/tools/googleCalendar");
      const consoleErrorSpyForTest = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      // --- End Test-specific isolation ---

      const tool = new IsolatedGoogleCalendarTool({ prisma: mockPrismaClient });

      expect(tool.logger).toBeDefined();
      expect(pinoModuleIsolated).toHaveBeenCalledTimes(1);
      expect(pinoModuleIsolated.destination).toHaveBeenCalledWith(
        process.stdout,
      );
      expect(consoleErrorSpyForTest).toHaveBeenCalledWith(
        "FATAL: GoogleCalendarTool construction failed. Missing logger dependency. Using console.",
      );

      // --- Cleanup for isolated test ---
      consoleErrorSpyForTest.mockRestore();
      Date.prototype.getTimezoneOffset = originalGetTimezoneOffsetForTest;
      // process.env will be restored by global afterEach
    });

    it("should log an error if Prisma client is not provided", () => {
      new GoogleCalendarTool({ logger: mockLogger });
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[GoogleCalendarTool] Prisma client was not provided during instantiation!",
      );
    });

    it("should log an error if GOOGLE_CALENDAR_ID is not set", () => {
      delete process.env.GOOGLE_CALENDAR_ID;
      GoogleCalendarTool = require("../../src/tools/googleCalendar");
      new GoogleCalendarTool({ logger: mockLogger, prisma: mockPrismaClient });
      expect(mockLogger.error).toHaveBeenCalledWith(
        "CRITICAL: GOOGLE_CALENDAR_ID is not set in .env!",
      );
    });

    it("should log a warning if GOOGLE_PERSONAL_CALENDAR_ID is not set", () => {
      delete process.env.GOOGLE_PERSONAL_CALENDAR_ID;
      GoogleCalendarTool = require("../../src/tools/googleCalendar");
      new GoogleCalendarTool({ logger: mockLogger, prisma: mockPrismaClient });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "GOOGLE_PERSONAL_CALENDAR_ID is not set in .env. Personal availability won't be checked.",
      );
    });

    it("should log an error if Google API client initialization fails", () => {
      // --- Test-specific isolation ---
      jest.resetModules();
      const originalGetTimezoneOffsetForTest = Date.prototype.getTimezoneOffset;
      Date.prototype.getTimezoneOffset = jest.fn().mockReturnValue(0);
      process.env.GOOGLE_APPLICATION_CREDENTIALS = "fake/path/to/creds.json";
      process.env.GOOGLE_CALENDAR_ID =
        "session_calendar_id@group.calendar.google.com";

      const { JWT: FailingJWT } = require("google-auth-library");
      FailingJWT.mockImplementationOnce(() => {
        throw new Error("Auth failed");
      }); // Apply specific mock behavior

      const IsolatedFailingTool = require("../../src/tools/googleCalendar");
      const currentMockLoggerForTest = createMockLogger();
      const consoleErrorSpyForTest = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      // --- End Test-specific isolation ---

      const tool = new IsolatedFailingTool({
        logger: currentMockLoggerForTest,
        prisma: mockPrismaClient,
      });

      expect(currentMockLoggerForTest.error).toHaveBeenCalledWith(
        { error: expect.objectContaining({ message: "Auth failed" }) },
        "[GoogleCalendarTool] Failed to initialize Google Calendar API client",
      );
      expect(tool.calendar).toBeUndefined();

      // --- Cleanup for isolated test ---
      consoleErrorSpyForTest.mockRestore();
      Date.prototype.getTimezoneOffset = originalGetTimezoneOffsetForTest;
    });
  });

  describe("getAvailabilityRule", () => {
    const mockDbRule = {
      id: "rule1",
      is_default: true,
      weekly_availability: { MON: [{ start: "10:00", end: "18:00" }] },
      practitioner_timezone: "America/Los_Angeles",
      max_advance_days: 30,
      min_notice_hours: 12,
      buffer_time_minutes: 15,
      max_bookings_per_day: 3,
      slot_increment_minutes: 15,
    };

    it("should fetch and return the rule from Prisma", async () => {
      mockPrismaClient.availabilityRule.findFirst.mockResolvedValue(mockDbRule);
      const tool = new GoogleCalendarTool({
        logger: mockLogger,
        prisma: mockPrismaClient,
      });
      const rule = await tool.getAvailabilityRule();
      expect(rule).toEqual(mockDbRule);
    });

    it("should parse weekly_availability if JSON string from Prisma", async () => {
      const ruleWithString = {
        ...mockDbRule,
        weekly_availability: JSON.stringify(mockDbRule.weekly_availability),
      };
      mockPrismaClient.availabilityRule.findFirst.mockResolvedValue(
        ruleWithString,
      );
      const tool = new GoogleCalendarTool({
        logger: mockLogger,
        prisma: mockPrismaClient,
      });
      const rule = await tool.getAvailabilityRule();
      expect(rule.weekly_availability).toEqual(mockDbRule.weekly_availability);
    });

    it("should handle error parsing weekly_availability JSON", async () => {
      const ruleWithInvalidJson = {
        ...mockDbRule,
        weekly_availability: "{invalid_json",
      };
      mockPrismaClient.availabilityRule.findFirst.mockResolvedValue(
        ruleWithInvalidJson,
      );
      const tool = new GoogleCalendarTool({
        logger: mockLogger,
        prisma: mockPrismaClient,
      });
      const rule = await tool.getAvailabilityRule();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(SyntaxError) }),
        "Failed to parse weekly_availability JSON from DB.",
      );
      expect(rule.weekly_availability).toEqual({});
    });

    it("should use env placeholders if Prisma unavailable", async () => {
      const tool = new GoogleCalendarTool({ logger: mockLogger }); // No prisma
      const rule = await tool.getAvailabilityRule();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Prisma access not implemented"),
      );
      expect(rule.weekly_availability).toEqual(
        JSON.parse(process.env.TEMP_WEEKLY_AVAILABILITY_JSON),
      );
    });

    it("should use env placeholders if Prisma returns no rule", async () => {
      mockPrismaClient.availabilityRule.findFirst.mockResolvedValue(null);
      const tool = new GoogleCalendarTool({
        logger: mockLogger,
        prisma: mockPrismaClient,
      });
      const rule = await tool.getAvailabilityRule();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("no rule found"),
      );
      expect(rule.weekly_availability).toEqual(
        JSON.parse(process.env.TEMP_WEEKLY_AVAILABILITY_JSON),
      );
    });

    it("should throw and log error if Prisma call fails", async () => {
      const dbError = new Error("DB fail");
      mockPrismaClient.availabilityRule.findFirst.mockRejectedValue(dbError);
      const tool = new GoogleCalendarTool({
        logger: mockLogger,
        prisma: mockPrismaClient,
      });
      await expect(tool.getAvailabilityRule()).rejects.toThrow("DB fail");
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: dbError },
        "[getAvailabilityRule] Error fetching availability rule",
      );
    });
  });

  describe("generateAvailableSlots", () => {
    let tool;
    const baseAvailabilityRule = {
      weekly_availability: {
        MON: [
          { start: "09:00", end: "12:00" },
          { start: "13:00", end: "17:00" },
        ],
        TUE: [{ start: "10:00", end: "14:00" }],
      },
      buffer_time_minutes: 0,
    };

    beforeEach(() => {
      tool = new GoogleCalendarTool({
        logger: mockLogger,
        prisma: mockPrismaClient,
      });
    });

    it("should generate slots across multiple days (UTC context)", () => {
      const startDate = new Date("2024-01-01T00:00:00.000Z");
      const endDate = new Date("2024-01-02T23:59:59.000Z");
      const slots = tool.generateAvailableSlots(
        startDate,
        endDate,
        60,
        [],
        baseAvailabilityRule,
      );
      expect(slots.length).toBe(19);
    });
  });

  describe("findFreeSlots", () => {
    let toolInstance;
    const practitionerTz = "America/New_York";
    const mockAvailabilityRule = {
      weekly_availability: {
        MON: [{ start: "09:00", end: "17:00" }],
        TUE: [{ start: "10:00", end: "14:00" }],
      },
      practitioner_timezone: practitionerTz,
      max_advance_days: 60,
      min_notice_hours: 24,
      buffer_time_minutes: 15,
      max_bookings_per_day: 4,
      slot_increment_minutes: 30,
    };

    beforeEach(async () => {
      jest.setSystemTime(new Date("2024-07-15T04:00:00.000Z"));
      toolInstance = new GoogleCalendarTool({
        logger: mockLogger,
        prisma: mockPrismaClient,
      });
      jest
        .spyOn(toolInstance, "getAvailabilityRule")
        .mockResolvedValue(mockAvailabilityRule);
      mockGoogleCalendarEventsList.mockResolvedValue({ data: { items: [] } });
      toolInstance.sessionCalendarId = "session_cal_id";
      toolInstance.personalCalendarId = "personal_cal_id";
    });

    it("should find available slots correctly with no GCal conflicts", async () => {
      const slots = await toolInstance.findFreeSlots({
        startDateRange: "2024-07-16T00:00:00Z",
        endDateRange: "2024-07-16T23:59:59Z",
        sessionDurationMinutes: 60,
      });
      expect(slots.length).toBe(7);
      expect(
        format(
          toZonedTime(parseISO(slots[0]), practitionerTz),
          "yyyy-MM-dd HH:mm",
        ),
      ).toBe("2024-07-16 10:00");
    });

    it("should filter slots based on min_notice_hours", async () => {
      jest.setSystemTime(new Date("2024-07-15T14:00:00.000Z"));
      const slots = await toolInstance.findFreeSlots({
        startDateRange: "2024-07-15T00:00:00Z",
        endDateRange: "2024-07-16T23:59:59Z",
        sessionDurationMinutes: 60,
      });
      expect(slots.length).toBe(7);
      expect(
        format(toZonedTime(parseISO(slots[0]), practitionerTz), "yyyy-MM-dd"),
      ).toBe("2024-07-16");
    });

    it("should filter by max_bookings_per_day", async () => {
      jest
        .spyOn(toolInstance, "getAvailabilityRule")
        .mockResolvedValue({
          ...mockAvailabilityRule,
          max_bookings_per_day: 1,
        });
      const eventStartNYT = set(
        toZonedTime(new Date("2024-07-16T00:00:00Z"), practitionerTz),
        { hours: 10 },
      );
      const eventEndNYT = addMinutes(eventStartNYT, 60);
      mockGoogleCalendarEventsList
        .mockResolvedValueOnce({
          data: {
            items: [
              {
                start: {
                  dateTime: fromZonedTime(
                    eventStartNYT,
                    practitionerTz,
                  ).toISOString(),
                },
                end: {
                  dateTime: fromZonedTime(
                    eventEndNYT,
                    practitionerTz,
                  ).toISOString(),
                },
              },
            ],
          },
        })
        .mockResolvedValueOnce({ data: { items: [] } });
      const slots = await toolInstance.findFreeSlots({
        startDateRange: "2024-07-16T00:00:00Z",
        endDateRange: "2024-07-16T23:59:59Z",
        sessionDurationMinutes: 60,
      });
      expect(slots.length).toBe(0);
    });

    it("should handle GCal API errors gracefully", async () => {
      mockGoogleCalendarEventsList.mockRejectedValueOnce(
        new Error("GCal API Error"),
      );
      const slots = await toolInstance.findFreeSlots({
        startDateRange: "2024-07-16T00:00:00Z",
        endDateRange: "2024-07-16T23:59:59Z",
        sessionDurationMinutes: 60,
      });
      expect(slots.length).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: "GCal API Error" }),
        expect.stringContaining("GCal Fetch Error"),
      );
    });

    it("should return empty if rules or sessionCalendarId missing", async () => {
      jest.spyOn(toolInstance, "getAvailabilityRule").mockResolvedValue(null);
      let s = await toolInstance.findFreeSlots({
        startDateRange: "2024-07-16T00:00:00Z",
        endDateRange: "2024-07-16T23:59:59Z",
        sessionDurationMinutes: 60,
      });
      expect(s.length).toBe(0);

      jest
        .spyOn(toolInstance, "getAvailabilityRule")
        .mockResolvedValue(mockAvailabilityRule);
      toolInstance.sessionCalendarId = undefined;
      s = await toolInstance.findFreeSlots({
        startDateRange: "2024-07-16T00:00:00Z",
        endDateRange: "2024-07-16T23:59:59Z",
        sessionDurationMinutes: 60,
      });
      expect(s.length).toBe(0);
    });
  });
});
