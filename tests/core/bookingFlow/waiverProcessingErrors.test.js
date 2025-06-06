/**
 * @module tests/core/bookingFlow/waiverProcessingErrors
 * @description TDD tests for error handling scenarios in waiver processing according to Feature 6 specification
 */

const _jwt = require("jsonwebtoken");

// Mock all external dependencies
const mockPrisma = {
  sessions: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  sessionInvite: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  users: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  sessionType: {
    findUnique: jest.fn(),
  },
};

const mockSessionTypesCore = {
  getById: jest.fn(),
};

const mockGoogleCalendarTool = {
  deleteCalendarEvent: jest.fn(),
  createCalendarEvent: jest.fn(),
  updateCalendarEventDescription: jest.fn(),
  updateCalendarEventSummary: jest.fn(),
  getCalendarEvent: jest.fn(),
  isSlotTrulyAvailable: jest.fn(),
};

const mockTelegramNotifier = {
  sendUserNotification: jest.fn(),
  sendAdminNotification: jest.fn(),
  editMessageText: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock the dependencies
jest.mock("../../../src/core/prisma", () => mockPrisma);
jest.mock("../../../src/core/sessionTypes", () => mockSessionTypesCore);
jest.mock("../../../src/tools/googleCalendar", () => mockGoogleCalendarTool);
jest.mock("../../../src/tools/telegramNotifier", () => mockTelegramNotifier);
jest.mock("../../../src/core/logger", () => mockLogger);

// Mock environment variables
const originalEnv = process.env;
beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-key-for-flow-tokens";
});

afterAll(() => {
  process.env = originalEnv;
});

describe("Waiver Processing Error Handling - Feature 6 Implementation", () => {
  let flowStepHandlers;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Require the module under test after mocks are set up
    flowStepHandlers = require("../../../src/core/bookingFlow/flowStepHandlers");
  });

  describe("Flow Context Validation Errors", () => {
    it("should handle missing flowContext gracefully", async () => {
      // Arrange
      const invalidFlowContext = null;
      const formData = { telegramId: 123456789 };

      // Act & Assert
      await expect(
        flowStepHandlers.processWaiverSubmission(invalidFlowContext, formData),
      ).rejects.toThrow();
    });

    it("should handle missing required flowContext fields", async () => {
      // Arrange
      const incompleteFlowContext = {
        userId: 123456789,
        // Missing flowType, sessionTypeId, appointmentDateTimeISO
      };
      const formData = { telegramId: 123456789 };

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        incompleteFlowContext,
        formData,
      );

      // Assert
      expect(result.nextStep.type).toBe("ERROR");
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should handle malformed formData", async () => {
      // Arrange
      const flowContext = {
        userId: 123456789,
        flowType: "primary_booking",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
      };
      const invalidFormData = null;

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        flowContext,
        invalidFormData,
      );

      // Assert
      expect(result.nextStep.type).toBe("ERROR");
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("SessionType Retrieval Errors", () => {
    it("should handle sessionType not found", async () => {
      // Arrange
      const flowContext = {
        userId: 123456789,
        flowType: "primary_booking",
        sessionTypeId: "non-existent-session",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
      };
      const formData = {
        telegramId: 123456789,
        firstName: "John",
        lastName: "Doe",
        liability_form_data: { consent: true },
      };

      mockSessionTypesCore.getById.mockResolvedValue(null);

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        flowContext,
        formData,
      );

      // Assert
      expect(result.nextStep.type).toBe("ERROR");
      expect(result.nextStep.message).toContain("Session type not found");
    });

    it("should handle sessionTypesCore.getById error", async () => {
      // Arrange
      const flowContext = {
        userId: 123456789,
        flowType: "primary_booking",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
      };
      const formData = {
        telegramId: 123456789,
        firstName: "John",
        lastName: "Doe",
        liability_form_data: { consent: true },
      };

      mockSessionTypesCore.getById.mockRejectedValue(
        new Error("Database connection failed"),
      );

      // Act & Assert
      await expect(
        flowStepHandlers.processWaiverSubmission(flowContext, formData),
      ).rejects.toThrow();
    });
  });

  describe("Primary Booker Database Errors", () => {
    it("should handle session creation failure", async () => {
      // Arrange
      const flowContext = {
        userId: 123456789,
        flowType: "primary_booking",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
      };
      const formData = {
        telegramId: 123456789,
        firstName: "John",
        lastName: "Doe",
        liability_form_data: { consent: true },
      };

      const mockSessionType = {
        id: "kambo-session-1",
        durationMinutes: 120,
        allowsGroupInvites: false,
      };

      mockSessionTypesCore.getById.mockResolvedValue(mockSessionType);
      mockGoogleCalendarTool.isSlotTrulyAvailable.mockResolvedValue(true);
      mockPrisma.sessions.create.mockRejectedValue(
        new Error("Database constraint violation"),
      );

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        flowContext,
        formData,
      );

      // Assert
      expect(result.nextStep.type).toBe("ERROR");
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
        }),
        expect.stringContaining("Error in primary booker waiver processing"),
      );
    });

    it("should handle session update failure after calendar event creation", async () => {
      // Arrange
      const flowContext = {
        userId: 123456789,
        flowType: "primary_booking",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
      };
      const formData = {
        telegramId: 123456789,
        firstName: "John",
        lastName: "Doe",
        liability_form_data: { consent: true },
      };

      const mockSessionType = {
        id: "kambo-session-1",
        label: "Kambo Session",
        durationMinutes: 120,
        allowsGroupInvites: false,
      };

      mockSessionTypesCore.getById.mockResolvedValue(mockSessionType);
      mockGoogleCalendarTool.isSlotTrulyAvailable.mockResolvedValue(true);
      mockPrisma.sessions.create.mockResolvedValue({ id: 101 });
      mockGoogleCalendarTool.createCalendarEvent.mockResolvedValue(
        "gcal-confirmed-123",
      );
      mockPrisma.sessions.update.mockRejectedValue(new Error("Update failed"));

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        flowContext,
        formData,
      );

      // Assert
      expect(result.nextStep.type).toBe("ERROR");
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
        }),
        expect.stringContaining(
          "Failed to update session with Google Calendar event ID",
        ),
      );
    });
  });

  describe("Google Calendar API Errors", () => {
    it("should handle calendar event creation failure with rollback", async () => {
      // Arrange
      const flowContext = {
        userId: 123456789,
        flowType: "primary_booking",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
      };
      const formData = {
        telegramId: 123456789,
        firstName: "John",
        lastName: "Doe",
        liability_form_data: { consent: true },
      };

      const mockSessionType = {
        id: "kambo-session-1",
        label: "Kambo Session",
        durationMinutes: 120,
        allowsGroupInvites: false,
      };

      mockSessionTypesCore.getById.mockResolvedValue(mockSessionType);
      mockGoogleCalendarTool.isSlotTrulyAvailable.mockResolvedValue(true);
      mockPrisma.sessions.create.mockResolvedValue({ id: 101 });
      mockGoogleCalendarTool.createCalendarEvent.mockRejectedValue(
        new Error("Calendar API error"),
      );

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        flowContext,
        formData,
      );

      // Assert
      expect(result.nextStep.type).toBe("ERROR");
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
        }),
        expect.stringContaining("Calendar event creation failed"),
      );

      // Should notify admin about the inconsistency
      expect(mockTelegramNotifier.sendAdminNotification).toHaveBeenCalledWith(
        expect.stringContaining(
          "CRITICAL: Session created in DB but Calendar event failed",
        ),
      );
    });

    it("should handle placeholder deletion failure gracefully", async () => {
      // Arrange
      const flowContext = {
        userId: 123456789,
        flowType: "primary_booking",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
        placeholderId: "invalid-placeholder-id",
      };
      const formData = {
        telegramId: 123456789,
        firstName: "John",
        lastName: "Doe",
        liability_form_data: { consent: true },
      };

      const mockSessionType = {
        id: "kambo-session-1",
        label: "Kambo Session",
        durationMinutes: 120,
        allowsGroupInvites: false,
      };

      mockSessionTypesCore.getById.mockResolvedValue(mockSessionType);
      mockGoogleCalendarTool.deleteCalendarEvent.mockRejectedValue(
        new Error("Event not found"),
      );
      mockGoogleCalendarTool.isSlotTrulyAvailable.mockResolvedValue(true);
      mockPrisma.sessions.create.mockResolvedValue({ id: 101 });
      mockGoogleCalendarTool.createCalendarEvent.mockResolvedValue(
        "gcal-confirmed-123",
      );
      mockPrisma.sessions.update.mockResolvedValue({});
      mockPrisma.users.findUnique.mockResolvedValue({ edit_msg_id: 999 });
      mockPrisma.users.update.mockResolvedValue({});
      mockTelegramNotifier.editMessageText.mockResolvedValue(true);
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        flowContext,
        formData,
      );

      // Assert - Should continue despite placeholder deletion failure
      expect(result.nextStep.type).toBe("COMPLETE");
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
        }),
        expect.stringContaining("Failed to delete placeholder"),
      );
    });

    it("should handle calendar event retrieval failure for friend updates", async () => {
      // Arrange
      const friendFlowContext = {
        userId: 987654321,
        flowType: "friend_invite",
        activeInviteToken: "invite-token-456",
      };
      const formData = {
        telegramId: 987654321,
        firstName: "Jane",
        lastName: "Friend",
        liability_form_data: { consent: true },
      };

      const mockSessionInvite = {
        id: "invite-1",
        status: "pending",
        parentSessionId: 101,
        session: {
          id: 101,
          googleEventId: "gcal-confirmed-123",
          user: {
            first_name: "John",
            last_name: "Doe",
            telegram_id: 123456789,
          },
          sessionType: { label: "Kambo Session" },
        },
      };

      mockPrisma.sessionInvite.findUnique.mockResolvedValue(mockSessionInvite);
      mockPrisma.sessionInvite.update.mockResolvedValue({});
      mockGoogleCalendarTool.getCalendarEvent.mockRejectedValue(
        new Error("Calendar API error"),
      );
      mockTelegramNotifier.sendUserNotification.mockResolvedValue(true);
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        friendFlowContext,
        formData,
      );

      // Assert - Should complete despite calendar update failure
      expect(result.nextStep.type).toBe("COMPLETE");
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
        }),
        expect.stringContaining("Failed to update calendar event for friend"),
      );
    });
  });

  describe("Telegram Notification Errors", () => {
    it("should handle bot message update failure for primary booker", async () => {
      // Arrange
      const flowContext = {
        userId: 123456789,
        flowType: "primary_booking",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
      };
      const formData = {
        telegramId: 123456789,
        firstName: "John",
        lastName: "Doe",
        liability_form_data: { consent: true },
      };

      const mockSessionType = {
        id: "kambo-session-1",
        label: "Kambo Session",
        durationMinutes: 120,
        allowsGroupInvites: false,
      };

      mockSessionTypesCore.getById.mockResolvedValue(mockSessionType);
      mockGoogleCalendarTool.isSlotTrulyAvailable.mockResolvedValue(true);
      mockPrisma.sessions.create.mockResolvedValue({ id: 101 });
      mockGoogleCalendarTool.createCalendarEvent.mockResolvedValue(
        "gcal-confirmed-123",
      );
      mockPrisma.sessions.update.mockResolvedValue({});
      mockPrisma.users.findUnique.mockResolvedValue({ edit_msg_id: 999 });
      mockPrisma.users.update.mockResolvedValue({});
      mockTelegramNotifier.editMessageText.mockRejectedValue(
        new Error("Message not found"),
      );
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        flowContext,
        formData,
      );

      // Assert - Should complete despite notification failure
      expect(result.nextStep.type).toBe("COMPLETE");
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
        }),
        expect.stringContaining("Failed to update bot message"),
      );
    });

    it("should handle admin notification failure gracefully", async () => {
      // Arrange
      const flowContext = {
        userId: 123456789,
        flowType: "primary_booking",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
      };
      const formData = {
        telegramId: 123456789,
        firstName: "John",
        lastName: "Doe",
        liability_form_data: { consent: true },
      };

      const mockSessionType = {
        id: "kambo-session-1",
        label: "Kambo Session",
        durationMinutes: 120,
        allowsGroupInvites: false,
      };

      mockSessionTypesCore.getById.mockResolvedValue(mockSessionType);
      mockGoogleCalendarTool.isSlotTrulyAvailable.mockResolvedValue(true);
      mockPrisma.sessions.create.mockResolvedValue({ id: 101 });
      mockGoogleCalendarTool.createCalendarEvent.mockResolvedValue(
        "gcal-confirmed-123",
      );
      mockPrisma.sessions.update.mockResolvedValue({});
      mockPrisma.users.findUnique.mockResolvedValue({ edit_msg_id: 999 });
      mockPrisma.users.update.mockResolvedValue({});
      mockTelegramNotifier.editMessageText.mockResolvedValue(true);
      mockTelegramNotifier.sendAdminNotification.mockRejectedValue(
        new Error("Admin not reachable"),
      );

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        flowContext,
        formData,
      );

      // Assert - Should complete despite admin notification failure
      expect(result.nextStep.type).toBe("COMPLETE");
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
        }),
        expect.stringContaining("Failed to send admin notification"),
      );
    });
  });

  describe("Friend Invite Specific Errors", () => {
    it("should handle SessionInvite update failure", async () => {
      // Arrange
      const friendFlowContext = {
        userId: 987654321,
        flowType: "friend_invite",
        activeInviteToken: "invite-token-456",
      };
      const formData = {
        telegramId: 987654321,
        firstName: "Jane",
        lastName: "Friend",
        liability_form_data: { consent: true },
      };

      const mockSessionInvite = {
        id: "invite-1",
        status: "pending",
        parentSessionId: 101,
        session: {
          id: 101,
          googleEventId: "gcal-confirmed-123",
          user: {
            first_name: "John",
            last_name: "Doe",
            telegram_id: 123456789,
          },
          sessionType: { label: "Kambo Session" },
        },
      };

      mockPrisma.sessionInvite.findUnique.mockResolvedValue(mockSessionInvite);
      mockPrisma.sessionInvite.update.mockRejectedValue(
        new Error("Database update failed"),
      );

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        friendFlowContext,
        formData,
      );

      // Assert
      expect(result.nextStep.type).toBe("ERROR");
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
        }),
        expect.stringContaining("Error in friend waiver processing"),
      );
    });

    it("should handle missing parentSession data", async () => {
      // Arrange
      const friendFlowContext = {
        userId: 987654321,
        flowType: "friend_invite",
        activeInviteToken: "invite-token-456",
      };
      const formData = {
        telegramId: 987654321,
        firstName: "Jane",
        lastName: "Friend",
        liability_form_data: { consent: true },
      };

      const mockSessionInviteWithoutSession = {
        id: "invite-1",
        status: "pending",
        parentSessionId: 101,
        session: null, // Missing session data
      };

      mockPrisma.sessionInvite.findUnique.mockResolvedValue(
        mockSessionInviteWithoutSession,
      );

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        friendFlowContext,
        formData,
      );

      // Assert
      expect(result.nextStep.type).toBe("ERROR");
      expect(result.nextStep.message).toContain("Parent session not found");
    });
  });

  describe("Race Condition Scenarios", () => {
    it("should handle concurrent primary booker and friend waiver submissions", async () => {
      // Arrange - Simulate slot becoming unavailable during processing
      const flowContext = {
        userId: 123456789,
        flowType: "primary_booking",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
        placeholderId: "gcal-placeholder-123",
      };
      const formData = {
        telegramId: 123456789,
        firstName: "John",
        lastName: "Doe",
        liability_form_data: { consent: true },
      };

      const mockSessionType = {
        id: "kambo-session-1",
        durationMinutes: 120,
      };

      mockSessionTypesCore.getById.mockResolvedValue(mockSessionType);
      mockGoogleCalendarTool.deleteCalendarEvent.mockResolvedValue(true);
      // Simulate slot taken during processing
      mockGoogleCalendarTool.isSlotTrulyAvailable.mockResolvedValue(false);

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        flowContext,
        formData,
      );

      // Assert
      expect(result.nextStep.type).toBe("ERROR");
      expect(result.nextStep.message).toContain(
        "selected slot was taken while you were completing",
      );
      expect(mockPrisma.sessions.create).not.toHaveBeenCalled();
    });
  });

  describe("Data Integrity Edge Cases", () => {
    it("should handle malformed JWT tokens in flowContext", async () => {
      // Arrange
      const flowContext = {
        userId: "invalid-user-id", // Should be number
        flowType: "primary_booking",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "invalid-date", // Invalid date format
      };
      const formData = {
        telegramId: 123456789,
        firstName: "John",
        lastName: "Doe",
        liability_form_data: { consent: true },
      };

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        flowContext,
        formData,
      );

      // Assert
      expect(result.nextStep.type).toBe("ERROR");
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should handle missing liability_form_data", async () => {
      // Arrange
      const flowContext = {
        userId: 123456789,
        flowType: "primary_booking",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
      };
      const formData = {
        telegramId: 123456789,
        firstName: "John",
        lastName: "Doe",
        // Missing liability_form_data
      };

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        flowContext,
        formData,
      );

      // Assert
      expect(result.nextStep.type).toBe("ERROR");
      expect(result.nextStep.message).toContain("Missing liability form data");
    });
  });
});
