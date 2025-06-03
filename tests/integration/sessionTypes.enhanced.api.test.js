/**
 * @file tests/integration/sessionTypes.enhanced.api.test.js
 * @description Integration tests for SessionType API with enhanced dynamic flow fields
 */

const request = require("supertest");
const express = require("express");
const sessionTypesApiHandler = require("../../src/handlers/api/sessionTypesApiHandler");

// Mock the core sessionTypes module
jest.mock("../../src/core/sessionTypes");
const coreSessionTypes = require("../../src/core/sessionTypes");

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe("SessionType Enhanced API Integration Tests", () => {
  let app;

  beforeAll(() => {
    // Initialize handler
    sessionTypesApiHandler.initialize({
      logger: mockLogger,
    });

    // Create Express app
    app = express();
    app.use(express.json());

    // Add routes
    app.get(
      "/api/session-types/:id",
      sessionTypesApiHandler.getSessionTypeById,
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/session-types/:id with enhanced fields", () => {
    it("should return session type with all dynamic flow fields", async () => {
      const mockSessionType = {
        id: "kambo_group_ceremony",
        label: "Group Kambo Ceremony",
        description:
          "Group Kambo ceremony allowing up to 4 participants with friend invites",
        durationMinutes: 180,
        price: 200.0,
        active: true,
        createdAt: "2025-01-10T10:00:00.000Z",
        updatedAt: "2025-05-15T14:30:00.000Z",
        // Enhanced dynamic flow fields
        waiverType: "KAMBO_V1",
        allowsGroupInvites: true,
        maxGroupSize: 4,
        customFormDefinitions: null,
      };

      coreSessionTypes.getById.mockResolvedValue(mockSessionType);

      const response = await request(app).get(
        "/api/session-types/kambo_group_ceremony",
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockSessionType,
      });

      // Verify all enhanced fields are present
      expect(response.body.data.waiverType).toBe("KAMBO_V1");
      expect(response.body.data.allowsGroupInvites).toBe(true);
      expect(response.body.data.maxGroupSize).toBe(4);
      expect(response.body.data.customFormDefinitions).toBeNull();
    });

    it("should return session type with NONE waiver type", async () => {
      const mockSessionType = {
        id: "consultation_session",
        label: "Consultation Session",
        description: "Initial consultation session with no waiver required",
        durationMinutes: 60,
        price: 75.0,
        active: true,
        createdAt: "2025-01-10T10:00:00.000Z",
        updatedAt: "2025-05-15T14:30:00.000Z",
        // Enhanced dynamic flow fields
        waiverType: "NONE",
        allowsGroupInvites: false,
        maxGroupSize: 1,
        customFormDefinitions: null,
      };

      coreSessionTypes.getById.mockResolvedValue(mockSessionType);

      const response = await request(app).get(
        "/api/session-types/consultation_session",
      );

      expect(response.status).toBe(200);
      expect(response.body.data.waiverType).toBe("NONE");
      expect(response.body.data.allowsGroupInvites).toBe(false);
      expect(response.body.data.maxGroupSize).toBe(1);
    });

    it("should return session type with custom form definitions", async () => {
      const mockSessionType = {
        id: "kambo_advanced_ceremony",
        label: "Advanced Kambo Ceremony",
        description: "Advanced ceremony for experienced participants",
        durationMinutes: 240,
        price: 300.0,
        active: true,
        createdAt: "2025-01-10T10:00:00.000Z",
        updatedAt: "2025-05-15T14:30:00.000Z",
        // Enhanced dynamic flow fields
        waiverType: "KAMBO_ADVANCED_V1",
        allowsGroupInvites: true,
        maxGroupSize: 6,
        customFormDefinitions: {
          formType: "KAMBO_ADVANCED_V1",
          additionalRequirements: [
            "Previous Kambo experience verification",
            "Advanced medical screening",
            "Emergency contact verification",
          ],
        },
      };

      coreSessionTypes.getById.mockResolvedValue(mockSessionType);

      const response = await request(app).get(
        "/api/session-types/kambo_advanced_ceremony",
      );

      expect(response.status).toBe(200);
      expect(response.body.data.waiverType).toBe("KAMBO_ADVANCED_V1");
      expect(response.body.data.allowsGroupInvites).toBe(true);
      expect(response.body.data.maxGroupSize).toBe(6);
      expect(response.body.data.customFormDefinitions).toEqual({
        formType: "KAMBO_ADVANCED_V1",
        additionalRequirements: [
          "Previous Kambo experience verification",
          "Advanced medical screening",
          "Emergency contact verification",
        ],
      });
    });

    it("should return session type with default values", async () => {
      const mockSessionType = {
        id: "kambo_individual_standard",
        label: "Individual Kambo Session",
        description: "Standard individual Kambo ceremony",
        durationMinutes: 120,
        price: 150.0,
        active: true,
        createdAt: "2025-01-10T10:00:00.000Z",
        updatedAt: "2025-05-15T14:30:00.000Z",
        // Enhanced dynamic flow fields with defaults
        waiverType: "KAMBO_V1",
        allowsGroupInvites: false,
        maxGroupSize: 1,
        customFormDefinitions: null,
      };

      coreSessionTypes.getById.mockResolvedValue(mockSessionType);

      const response = await request(app).get(
        "/api/session-types/kambo_individual_standard",
      );

      expect(response.status).toBe(200);
      expect(response.body.data.waiverType).toBe("KAMBO_V1");
      expect(response.body.data.allowsGroupInvites).toBe(false);
      expect(response.body.data.maxGroupSize).toBe(1);
      expect(response.body.data.customFormDefinitions).toBeNull();
    });

    it("should handle missing session type gracefully", async () => {
      coreSessionTypes.getById.mockResolvedValue(null);

      const response = await request(app).get(
        "/api/session-types/non-existent",
      );

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        message: "Session type with ID 'non-existent' not found.",
      });
    });

    it("should handle core module errors gracefully", async () => {
      coreSessionTypes.getById.mockRejectedValue(
        new Error("Database connection failed"),
      );

      const response = await request(app).get(
        "/api/session-types/test-session",
      );

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message:
          "An internal error occurred while fetching session type details.",
      });
    });

    it("should handle missing session type ID parameter", async () => {
      const response = await request(app).get("/api/session-types/");

      expect(response.status).toBe(404); // Express returns 404 for unmatched routes
    });
  });

  describe("API Response Format Validation", () => {
    it("should return consistent response format for successful requests", async () => {
      const mockSessionType = {
        id: "test_session",
        label: "Test Session",
        durationMinutes: 90,
        price: 100.0,
        active: true,
        waiverType: "KAMBO_V1",
        allowsGroupInvites: false,
        maxGroupSize: 1,
        customFormDefinitions: null,
      };

      coreSessionTypes.getById.mockResolvedValue(mockSessionType);

      const response = await request(app).get(
        "/api/session-types/test_session",
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data).toHaveProperty("label");
      expect(response.body.data).toHaveProperty("waiverType");
      expect(response.body.data).toHaveProperty("allowsGroupInvites");
      expect(response.body.data).toHaveProperty("maxGroupSize");
      expect(response.body.data).toHaveProperty("customFormDefinitions");
    });

    it("should return consistent error format for failed requests", async () => {
      coreSessionTypes.getById.mockResolvedValue(null);

      const response = await request(app).get("/api/session-types/missing");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("message");
      expect(typeof response.body.message).toBe("string");
    });
  });
});
