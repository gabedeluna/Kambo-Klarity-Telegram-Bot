const GoogleCalendarEventsTool = require("../../src/tools/googleCalendarEvents");

// Mock dependencies
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
};

const mockPrisma = {
  availabilityRule: {
    findFirst: jest.fn(),
  },
};

// Mock Google Calendar API
const mockCalendarEvents = {
  insert: jest.fn(),
  delete: jest.fn(),
};

const mockCalendar = {
  events: mockCalendarEvents,
};

jest.mock("googleapis", () => ({
  google: {
    calendar: jest.fn(() => mockCalendar),
  },
}));

jest.mock("google-auth-library", () => ({
  JWT: jest.fn().mockImplementation(() => ({})),
}));

describe("GoogleCalendarEventsTool", () => {
  let googleCalendarEventsTool;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up environment variables
    process.env.GOOGLE_CALENDAR_ID = "test-calendar@example.com";
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/credentials.json";

    const dependencies = {
      logger: mockLogger,
      prisma: mockPrisma,
    };

    googleCalendarEventsTool = new GoogleCalendarEventsTool(dependencies);
  });

  describe("createCalendarEvent", () => {
    const mockEventDetails = {
      start: "2024-05-21T10:00:00.000Z",
      end: "2024-05-21T11:00:00.000Z",
      summary: "Test Kambo Session",
      description: "Test session description",
    };

    it("should create event normally when buffer_time_minutes > 0", async () => {
      // Mock availability rule with buffer time
      const mockRule = {
        buffer_time_minutes: 30,
        practitioner_timezone: "America/Chicago",
      };
      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);

      // Mock successful calendar event creation
      mockCalendarEvents.insert.mockResolvedValue({
        data: {
          id: "test-event-id",
          htmlLink: "https://calendar.google.com/event/test-event-id",
        },
      });

      const result =
        await googleCalendarEventsTool.createCalendarEvent(mockEventDetails);

      expect(result.success).toBe(true);
      expect(result.eventId).toBe("test-event-id");

      // Verify the event was created with original times (no reduction)
      expect(mockCalendarEvents.insert).toHaveBeenCalledWith({
        calendarId: "test-calendar@example.com",
        resource: {
          summary: "Test Kambo Session",
          description: "Test session description",
          start: { dateTime: "2024-05-21T10:00:00.000Z", timeZone: "UTC" },
          end: { dateTime: "2024-05-21T11:00:00.000Z", timeZone: "UTC" },
        },
      });

      // Should not log the zero buffer message
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining("[ZeroBuffer]"),
      );
    });

    it("should reduce event end time by 1 minute when buffer_time_minutes = 0", async () => {
      // Mock availability rule with zero buffer time
      const mockRule = {
        buffer_time_minutes: 0,
        practitioner_timezone: "America/Chicago",
      };
      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);

      // Mock successful calendar event creation
      mockCalendarEvents.insert.mockResolvedValue({
        data: {
          id: "test-event-id",
          htmlLink: "https://calendar.google.com/event/test-event-id",
        },
      });

      const result =
        await googleCalendarEventsTool.createCalendarEvent(mockEventDetails);

      expect(result.success).toBe(true);
      expect(result.eventId).toBe("test-event-id");

      // Verify the event was created with reduced end time (1 minute less)
      expect(mockCalendarEvents.insert).toHaveBeenCalledWith({
        calendarId: "test-calendar@example.com",
        resource: {
          summary: "Test Kambo Session",
          description: "Test session description",
          start: { dateTime: "2024-05-21T10:00:00.000Z", timeZone: "UTC" },
          end: { dateTime: "2024-05-21T10:59:00.000Z", timeZone: "UTC" }, // 1 minute reduced
        },
      });

      // Should log the zero buffer message
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[ZeroBuffer] Reduced event end time by 1 minute: 2024-05-21T11:00:00.000Z -> 2024-05-21T10:59:00.000Z",
      );
    });

    it("should handle errors when fetching availability rules", async () => {
      // Mock database error
      mockPrisma.availabilityRule.findFirst.mockRejectedValue(
        new Error("Database error"),
      );

      const result =
        await googleCalendarEventsTool.createCalendarEvent(mockEventDetails);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Database error");
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should handle Google Calendar API errors", async () => {
      // Mock availability rule
      const mockRule = {
        buffer_time_minutes: 0,
        practitioner_timezone: "America/Chicago",
      };
      mockPrisma.availabilityRule.findFirst.mockResolvedValue(mockRule);

      // Mock calendar API error
      mockCalendarEvents.insert.mockRejectedValue(
        new Error("Calendar API error"),
      );

      const result =
        await googleCalendarEventsTool.createCalendarEvent(mockEventDetails);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Calendar API error");
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
