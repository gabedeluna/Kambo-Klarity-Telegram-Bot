// GoogleCalendarTool Constructor Tests

const {
  mockLogger,
  mockPrisma,
  mockJWT,
  setupEnvironment,
  teardownEnvironment,
  clearAllMocks,
} = require("./googleCalendar.setup");

const GoogleCalendarTool = require("../../src/tools/googleCalendar");

describe("GoogleCalendarTool - Constructor", () => {
  let googleCalendarTool;

  beforeAll(() => {
    setupEnvironment();
  });

  afterAll(() => {
    teardownEnvironment();
  });

  beforeEach(() => {
    clearAllMocks();
  });

  describe("Initialization", () => {
    it("should initialize with valid dependencies", () => {
      const dependencies = {
        logger: mockLogger,
        prisma: mockPrisma,
      };

      googleCalendarTool = new GoogleCalendarTool(dependencies);

      expect(googleCalendarTool.logger).toBe(mockLogger);
      expect(googleCalendarTool.prisma).toBe(mockPrisma);
      expect(googleCalendarTool.sessionCalendarId).toBe(
        "test-session-calendar@example.com",
      );
      expect(googleCalendarTool.personalCalendarId).toBe(
        "test-personal-calendar@example.com",
      );
      expect(mockJWT).toHaveBeenCalledWith({
        keyFile: "/path/to/test/credentials.json",
        scopes: ["https://www.googleapis.com/auth/calendar"],
      });
    });

    it("should handle missing logger dependency gracefully", () => {
      // Capture console.error calls since the fallback uses console
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const dependencies = {
        prisma: mockPrisma,
      };

      googleCalendarTool = new GoogleCalendarTool(dependencies);

      expect(consoleSpy).toHaveBeenCalledWith(
        "FATAL: GoogleCalendarTool construction failed. Missing logger dependency. Using console.",
      );
      expect(googleCalendarTool.prisma).toBe(mockPrisma);

      consoleSpy.mockRestore();
    });

    it("should log error when prisma is missing", () => {
      const dependencies = {
        logger: mockLogger,
      };

      googleCalendarTool = new GoogleCalendarTool(dependencies);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "[GoogleCalendarTool] Prisma client was not provided during instantiation!",
      );
    });
  });

  describe("Environment Configuration", () => {
    it("should log error when GOOGLE_CALENDAR_ID is not set", () => {
      const originalCalendarId = process.env.GOOGLE_CALENDAR_ID;
      delete process.env.GOOGLE_CALENDAR_ID;

      const dependencies = {
        logger: mockLogger,
        prisma: mockPrisma,
      };

      googleCalendarTool = new GoogleCalendarTool(dependencies);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "CRITICAL: GOOGLE_CALENDAR_ID is not set in .env!",
      );

      process.env.GOOGLE_CALENDAR_ID = originalCalendarId;
    });

    it("should log warning when GOOGLE_PERSONAL_CALENDAR_ID is not set", () => {
      const originalPersonalCalendarId =
        process.env.GOOGLE_PERSONAL_CALENDAR_ID;
      delete process.env.GOOGLE_PERSONAL_CALENDAR_ID;

      const dependencies = {
        logger: mockLogger,
        prisma: mockPrisma,
      };

      googleCalendarTool = new GoogleCalendarTool(dependencies);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "GOOGLE_PERSONAL_CALENDAR_ID is not set in .env. Personal availability won't be checked.",
      );

      process.env.GOOGLE_PERSONAL_CALENDAR_ID = originalPersonalCalendarId;
    });
  });
});
