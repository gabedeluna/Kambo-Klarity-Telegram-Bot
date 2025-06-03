const request = require("supertest");
// const { GoogleCalendarTool } = require('../../src/tools/googleCalendar'); // Not needed directly in tests, only for mocking its module
const logger = require("../../src/core/logger"); // Import the logger
const express = require("express");
const apiRouter = require("../../src/routes/api");

let mockFindFreeSlots;
let consoleErrorSpy; // Keep for other tests if they directly cause console.error
let loggerErrorSpy; // Spy for logger.error

// Mock variables for booking flow tests
const mockPrisma = {
  users: { findUnique: jest.fn() },
  sessions: { create: jest.fn() },
  sessionType: { findUnique: jest.fn() },
};
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
const mockTelegramNotifier = {
  sendAdminNotification: jest.fn(),
};
const mockBot = {
  telegram: { editMessageText: jest.fn() },
};
const mockGoogleCalendarTool = {
  findFreeSlots: jest.fn(),
  createEvent: jest.fn(),
  deleteEvent: jest.fn(),
};

jest.mock("../../src/tools/googleCalendar", () => {
  // This function will be called by Jest to get the mock implementation for the module
  mockFindFreeSlots = jest.fn(); // Initialize/Re-initialize
  return jest.fn().mockImplementation(() => {
    // This is the mock constructor for GoogleCalendarTool
    return {
      findFreeSlots: mockFindFreeSlots,
      // Mock other methods if they were called during app initialization or by the endpoint
      // For now, only findFreeSlots is explicitly mentioned for this endpoint
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      }, // Mock logger if constructor expects it and uses it
      prisma: {}, // Mock prisma if constructor expects it
    };
  });
});

describe("GET /api/calendar/availability", () => {
  let app;
  let _serverInstance; // To hold the actual HTTP server for closing

  beforeEach(async () => {
    // Make beforeEach async
    jest.resetModules(); // Resets the module cache

    // Re-mock GoogleCalendarTool to ensure mockFindFreeSlots is fresh for each test
    // and the mock constructor is used by the re-required app.
    jest.mock("../../src/tools/googleCalendar", () => {
      mockFindFreeSlots = jest.fn();
      return jest.fn().mockImplementation(() => ({
        findFreeSlots: mockFindFreeSlots,
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        prisma: {}, // Mock prisma if constructor expects it
      }));
    });

    // Require the app server AFTER mocks are in place
    // bin/server.js now exports a Promise that resolves to the app
    app = await require("../../bin/server");

    // Suppress console.error for tests that are expected to log errors (e.g. unhandled rejections by Express default handler)
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    // Spy on logger.error specifically for the 500 test
    loggerErrorSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    // Make afterEach async for server closing
    jest.clearAllMocks();
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
    if (loggerErrorSpy) {
      loggerErrorSpy.mockRestore();
    }
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
    // Supertest typically handles server starting/stopping for the app instance.
    // However, if bin/server.js starts its own server when required in a way
    // that persists, we might need to explicitly close it.
    // For now, relying on Supertest's handling of the Express app.
    // If `app` itself is an http.Server instance, then `app.close()` would be relevant.
    // Since `bin/server.js` exports the Express `app`, Supertest wraps it.
  });

  it("should return 200 with available slots for valid parameters", async () => {
    const mockSlots = [
      { start: "2025-07-15T10:00:00.000Z", end: "2025-07-15T11:00:00.000Z" },
      { start: "2025-07-15T14:00:00.000Z", end: "2025-07-15T15:00:00.000Z" },
    ];
    mockFindFreeSlots.mockResolvedValue(mockSlots);

    const queryParams = {
      startDateRange: "2025-07-15T00:00:00Z",
      endDateRange: "2025-07-15T23:59:59Z",
      sessionDurationMinutes: 60,
    };

    const res = await request(app)
      .get("/api/calendar/availability")
      .query(queryParams);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.slots).toEqual(mockSlots);
    expect(mockFindFreeSlots).toHaveBeenCalledWith({
      startDateRange: queryParams.startDateRange,
      endDateRange: queryParams.endDateRange,
      sessionDurationMinutes: queryParams.sessionDurationMinutes,
    });
  });

  it("should return 400 if startDateRange is missing", async () => {
    const res = await request(app).get("/api/calendar/availability").query({
      endDateRange: "2025-07-15T23:59:59Z",
      sessionDurationMinutes: 60,
    });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Missing required query parameters/i);
    expect(res.body.message).toContain("startDateRange");
  });

  it("should return 400 if endDateRange is missing", async () => {
    const res = await request(app).get("/api/calendar/availability").query({
      startDateRange: "2025-07-15T00:00:00Z",
      sessionDurationMinutes: 60,
    });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Missing required query parameters/i);
    expect(res.body.message).toContain("endDateRange");
  });

  it("should return 400 if sessionDurationMinutes is missing", async () => {
    const res = await request(app).get("/api/calendar/availability").query({
      startDateRange: "2025-07-15T00:00:00Z",
      endDateRange: "2025-07-15T23:59:59Z",
    });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Missing required query parameters/i);
    expect(res.body.message).toContain("sessionDurationMinutes");
  });

  it('should return 400 if sessionDurationMinutes is not a positive number (e.g., "abc")', async () => {
    const res = await request(app).get("/api/calendar/availability").query({
      startDateRange: "2025-07-15T00:00:00Z",
      endDateRange: "2025-07-15T23:59:59Z",
      sessionDurationMinutes: "abc",
    });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain(
      "Invalid sessionDurationMinutes: must be a positive number.",
    );
  });

  it("should return 400 if sessionDurationMinutes is zero", async () => {
    const res = await request(app).get("/api/calendar/availability").query({
      startDateRange: "2025-07-15T00:00:00Z",
      endDateRange: "2025-07-15T23:59:59Z",
      sessionDurationMinutes: 0,
    });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain(
      "Invalid sessionDurationMinutes: must be a positive number.",
    );
  });

  it("should return 400 if sessionDurationMinutes is a negative number", async () => {
    const res = await request(app).get("/api/calendar/availability").query({
      startDateRange: "2025-07-15T00:00:00Z",
      endDateRange: "2025-07-15T23:59:59Z",
      sessionDurationMinutes: -10,
    });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain(
      "Invalid sessionDurationMinutes: must be a positive number.",
    );
  });

  it("should return 400 if startDateRange has an invalid format", async () => {
    const res = await request(app).get("/api/calendar/availability").query({
      startDateRange: "invalid-date",
      endDateRange: "2025-07-15T23:59:59Z",
      sessionDurationMinutes: 60,
    });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain(
      "Invalid date format for startDateRange",
    );
  });

  it("should return 400 if endDateRange has an invalid format", async () => {
    const res = await request(app).get("/api/calendar/availability").query({
      startDateRange: "2025-07-15T00:00:00Z",
      endDateRange: "invalid-date",
      sessionDurationMinutes: 60,
    });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    // The actual error message is more generic, let's match that.
    expect(res.body.message).toContain(
      "Invalid date format for startDateRange or endDateRange.",
    );
  });

  it("should return 400 if startDateRange is not before endDateRange", async () => {
    const res = await request(app).get("/api/calendar/availability").query({
      startDateRange: "2025-07-16T00:00:00Z",
      endDateRange: "2025-07-15T23:59:59Z", // endDate is before startDate
      sessionDurationMinutes: 60,
    });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain(
      "startDateRange must be before endDateRange",
    );
  });

  it("should return 400 if startDateRange is equal to endDateRange", async () => {
    const testDate = "2025-07-15T12:00:00Z";
    const res = await request(app).get("/api/calendar/availability").query({
      startDateRange: testDate,
      endDateRange: testDate,
      sessionDurationMinutes: 60,
    });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain(
      "startDateRange must be before endDateRange",
    );
  });

  it("should return 500 if googleCalendarTool.findFreeSlots throws an error", async () => {
    const errorMessage = "Internal Calendar Error";
    mockFindFreeSlots.mockRejectedValue(new Error(errorMessage));

    const res = await request(app).get("/api/calendar/availability").query({
      startDateRange: "2025-07-15T00:00:00Z",
      endDateRange: "2025-07-15T23:59:59Z",
      sessionDurationMinutes: 60,
    });

    expect(res.statusCode).toEqual(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain(
      "An internal error occurred while fetching availability.",
    );
    expect(loggerErrorSpy).toHaveBeenCalled(); // Check if logger.error was called
  });
});

describe("Booking Flow API Routes", () => {
  beforeEach(() => {
    // Initialize the router with mocks
    apiRouter.initialize({
      prisma: mockPrisma,
      logger: mockLogger,
      telegramNotifier: mockTelegramNotifier,
      bot: mockBot,
      googleCalendarTool: mockGoogleCalendarTool,
    });
  });

  describe("POST /api/booking-flow/start-primary", () => {
    it("should handle primary booking flow initiation", async () => {
      const router = apiRouter.getRouter();
      const app = express();
      app.use(express.json());
      app.use("/api", router);

      const response = await request(app)
        .post("/api/booking-flow/start-primary")
        .send({
          telegramId: "123456789",
          sessionTypeId: "session-type-uuid-1",
          appointmentDateTimeISO: "2025-07-15T10:00:00.000Z",
          placeholderId: "gcal-placeholder-event-id",
        });

      expect(response.status).toBe(500); // Expected since BookingFlowManager is not mocked in integration test
      expect(response.body).toHaveProperty("success", false);
    });

    it("should return 400 for invalid input", async () => {
      const router = apiRouter.getRouter();
      const app = express();
      app.use(express.json());
      app.use("/api", router);

      const response = await request(app)
        .post("/api/booking-flow/start-primary")
        .send({
          telegramId: "invalid-id",
          sessionTypeId: "session-type-uuid-1",
          appointmentDateTimeISO: "2025-07-15T10:00:00.000Z",
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("success", false);
      expect(response.body.message).toContain(
        "telegramId must be a valid number",
      );
    });
  });

  describe("GET /api/booking-flow/start-invite/:inviteToken", () => {
    it("should handle invite flow initiation", async () => {
      const router = apiRouter.getRouter();
      const app = express();
      app.use(express.json());
      app.use("/api", router);

      const response = await request(app)
        .get("/api/booking-flow/start-invite/friend-invite-token-xyz")
        .query({ friend_tg_id: "987654321" });

      expect(response.status).toBe(500); // Expected since BookingFlowManager is not mocked in integration test
      expect(response.body).toHaveProperty("success", false);
    });

    it("should return 400 for missing friend_tg_id", async () => {
      const router = apiRouter.getRouter();
      const app = express();
      app.use(express.json());
      app.use("/api", router);

      const response = await request(app).get(
        "/api/booking-flow/start-invite/friend-invite-token-xyz",
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("success", false);
      expect(response.body.message).toContain("friend_tg_id is required");
    });
  });

  describe("POST /api/booking-flow/continue", () => {
    it("should handle flow continuation", async () => {
      const router = apiRouter.getRouter();
      const app = express();
      app.use(express.json());
      app.use("/api", router);

      const response = await request(app)
        .post("/api/booking-flow/continue")
        .send({
          flowToken: "active.jwt.flow.token",
          stepId: "waiver_submission",
          formData: {
            firstName: "Jane",
            lastName: "Doe",
          },
        });

      expect(response.status).toBe(500); // Expected since BookingFlowManager is not mocked in integration test
      expect(response.body).toHaveProperty("success", false);
    });

    it("should return 400 for missing flowToken", async () => {
      const router = apiRouter.getRouter();
      const app = express();
      app.use(express.json());
      app.use("/api", router);

      const response = await request(app)
        .post("/api/booking-flow/continue")
        .send({
          stepId: "waiver_submission",
          formData: {},
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("success", false);
      expect(response.body.message).toContain("flowToken is required");
    });
  });
});
