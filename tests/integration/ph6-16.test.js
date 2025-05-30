/**
 * @fileoverview Integration test for PH6-16: Waiver Form: Adapt to Receive & Use Calendar Data
 */

const request = require("supertest");
const express = require("express");
const apiHandler = require("../../src/handlers/apiHandler");
const sessionTypesApiHandler = require("../../src/handlers/api/sessionTypesApiHandler");

// Mock dependencies
jest.mock("../../src/core/prisma", () => ({
  users: {
    findUnique: jest.fn(),
  },
  sessionType: {
    findUnique: jest.fn(),
  },
}));

const prismaMock = require("../../src/core/prisma");

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
  telegram: {
    editMessageText: jest.fn(),
  },
};

const mockGoogleCalendarTool = {
  createCalendarEvent: jest.fn(),
};

// Mock date-fns-tz
jest.mock("date-fns-tz", () => ({
  formatInTimeZone: jest.fn((date, tz, format) => {
    if (format === "yyyy-MM-dd") {
      return "1990-01-15";
    }
    return "formatted-date";
  }),
  toDate: jest.fn((date) => new Date(date)),
}));

describe("PH6-16 Integration: Waiver Form Calendar Data Integration", () => {
  let app;

  beforeAll(() => {
    // Initialize handlers
    apiHandler.initialize({
      prisma: prismaMock,
      logger: mockLogger,
      telegramNotifier: mockTelegramNotifier,
      bot: mockBot,
      googleCalendarTool: mockGoogleCalendarTool,
    });

    sessionTypesApiHandler.initialize({
      logger: mockLogger,
    });

    // Create Express app
    app = express();
    app.use(express.json());

    // Add routes
    app.get("/api/user-data", apiHandler.getUserDataApi);
    app.get(
      "/api/session-types/:id",
      sessionTypesApiHandler.getSessionTypeById,
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/user-data", () => {
    it("should return user data in PH6-16 format without appointment data", async () => {
      const mockUser = {
        first_name: "John",
        last_name: "Doe",
        email: "john.doe@example.com",
        phone_number: "123-456-7890",
        date_of_birth: new Date("1990-01-15T00:00:00.000Z"),
        em_first_name: "Jane",
        em_last_name: "Doe",
        em_phone_number: "987-654-3210",
      };

      prismaMock.users.findUnique.mockResolvedValue(mockUser);

      const response = await request(app)
        .get("/api/user-data")
        .query({ telegramId: "123456789" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          phoneNumber: "123-456-7890",
          dateOfBirth: "1990-01-15",
          emergencyContactFirstName: "Jane",
          emergencyContactLastName: "Doe",
          emergencyContactPhone: "987-654-3210",
        },
      });

      // Verify no appointment data is included
      expect(response.body.data.appointmentDateTime).toBeUndefined();
      expect(response.body.data.rawAppointmentDateTime).toBeUndefined();
    });

    it("should handle missing user gracefully", async () => {
      prismaMock.users.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/user-data")
        .query({ telegramId: "999999999" });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        message: "User not found.",
      });
    });
  });

  describe("GET /api/session-types/:id", () => {
    it("should return session type details for waiver form display", async () => {
      const mockSessionType = {
        id: "standard-kambo",
        label: "Standard Kambo Session",
        durationMinutes: 90,
        description: "A standard 90-minute Kambo session.",
        price: 150.0,
        active: true,
      };

      // Mock the core sessionTypes module
      const coreSessionTypes = require("../../src/core/sessionTypes");
      jest
        .spyOn(coreSessionTypes, "getById")
        .mockResolvedValue(mockSessionType);

      const response = await request(app).get(
        "/api/session-types/standard-kambo",
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockSessionType,
      });
    });

    it("should handle missing session type gracefully", async () => {
      const coreSessionTypes = require("../../src/core/sessionTypes");
      jest.spyOn(coreSessionTypes, "getById").mockResolvedValue(null);

      const response = await request(app).get(
        "/api/session-types/non-existent",
      );

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        message: "Session type with ID 'non-existent' not found.",
      });
    });
  });

  describe("PH6-16 URL Parameter Validation", () => {
    it("should validate required URL parameters format", () => {
      // Test URL parameter parsing logic (this would be in the frontend)
      const testUrl =
        "https://example.com/waiver-form.html?telegramId=123456789&sessionTypeId=standard-kambo&appointmentDateTimeISO=2025-05-20T15:00:00.000Z";
      const url = new URL(testUrl);
      const params = new URLSearchParams(url.search);

      const telegramId = params.get("telegramId");
      const sessionTypeId = params.get("sessionTypeId");
      const appointmentDateTimeISO = params.get("appointmentDateTimeISO");

      expect(telegramId).toBe("123456789");
      expect(sessionTypeId).toBe("standard-kambo");
      expect(appointmentDateTimeISO).toBe("2025-05-20T15:00:00.000Z");

      // Validate that all required parameters are present
      expect(telegramId).toBeTruthy();
      expect(sessionTypeId).toBeTruthy();
      expect(appointmentDateTimeISO).toBeTruthy();

      // Validate date format
      const appointmentDate = new Date(appointmentDateTimeISO);
      expect(appointmentDate.toISOString()).toBe("2025-05-20T15:00:00.000Z");
    });

    it("should detect missing required parameters", () => {
      const testUrl =
        "https://example.com/waiver-form.html?telegramId=123456789&sessionTypeId=standard-kambo";
      const url = new URL(testUrl);
      const params = new URLSearchParams(url.search);

      const telegramId = params.get("telegramId");
      const sessionTypeId = params.get("sessionTypeId");
      const appointmentDateTimeISO = params.get("appointmentDateTimeISO");

      const hasAllRequiredParams = !!(
        telegramId &&
        sessionTypeId &&
        appointmentDateTimeISO
      );
      expect(hasAllRequiredParams).toBe(false);
    });
  });
});
