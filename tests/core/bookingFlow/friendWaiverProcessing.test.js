/**
 * @module tests/core/bookingFlow/friendWaiverProcessing
 * @description TDD tests for friend waiver processing logic according to Feature 6 specification
 */

const jwt = require("jsonwebtoken");

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

describe("Friend Waiver Processing - Feature 6 Implementation", () => {
  let flowStepHandlers;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Require the module under test after mocks are set up
    flowStepHandlers = require("../../../src/core/bookingFlow/flowStepHandlers");
  });

  describe("Friend Invite Token Validation", () => {
    it("should validate invite token and fetch parent session details", async () => {
      // Arrange
      const friendFlowContext = {
        userId: 987654321,
        flowType: "friend_invite",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
        activeInviteToken: "invite-token-456",
        parentSessionId: 101,
      };

      const formData = {
        telegramId: 987654321,
        firstName: "Jane",
        lastName: "Friend",
        liability_form_data: { consent: true, signature: "friend_signature" },
      };

      const mockSessionInvite = {
        id: "invite-1",
        status: "pending",
        parentSessionId: 101,
        sessions: {
          id: 101,
          googleEventId: "gcal-confirmed-123",
          telegram_id: 123456789,
          first_name: "John",
          last_name: "Doe",
          appointment_datetime: new Date("2024-01-15T10:00:00.000Z"),
          SessionType: { label: "Kambo Session" },
        },
      };

      mockPrisma.sessionInvite.findUnique.mockResolvedValue(mockSessionInvite);
      mockPrisma.sessionInvite.update.mockResolvedValue({});
      mockGoogleCalendarTool.getCalendarEvent.mockResolvedValue({
        description: "Original event",
      });
      mockGoogleCalendarTool.updateCalendarEventDescription.mockResolvedValue(
        true,
      );
      mockPrisma.sessionInvite.count.mockResolvedValue(1);
      mockGoogleCalendarTool.updateCalendarEventSummary.mockResolvedValue(true);
      mockTelegramNotifier.sendUserNotification.mockResolvedValue(true);
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      await flowStepHandlers.processWaiverSubmission(
        friendFlowContext,
        formData,
      );

      // Assert
      expect(mockPrisma.sessionInvite.findUnique).toHaveBeenCalledWith({
        where: { inviteToken: "invite-token-456" },
        include: {
          sessions: {
            include: {
              SessionType: true,
            },
          },
        },
      });
    });

    it("should return error for invalid invite token", async () => {
      // Arrange
      const friendFlowContext = {
        userId: 987654321,
        flowType: "friend_invite",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
        activeInviteToken: "invalid-token",
      };

      const formData = {
        telegramId: 987654321,
        firstName: "Jane",
        lastName: "Friend",
        liability_form_data: { consent: true },
      };

      mockPrisma.sessionInvite.findUnique.mockResolvedValue(null);

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        friendFlowContext,
        formData,
      );

      // Assert
      expect(result.nextStep.type).toBe("ERROR");
      expect(result.nextStep.message).toContain(
        "Invite invalid or already processed",
      );
    });

    it("should return error for already processed invite", async () => {
      // Arrange
      const friendFlowContext = {
        userId: 987654321,
        flowType: "friend_invite",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
        activeInviteToken: "used-token",
      };

      const formData = {
        telegramId: 987654321,
        firstName: "Jane",
        lastName: "Friend",
        liability_form_data: { consent: true },
      };

      const mockUsedInvite = {
        id: "invite-1",
        status: "waiver_completed_by_friend", // Already processed
        parentSessionId: 101,
        sessions: {
          id: 101,
          telegram_id: 123456789,
          first_name: "John",
          last_name: "Doe",
          SessionType: { label: "Kambo Session" },
        },
      };

      mockPrisma.sessionInvite.findUnique.mockResolvedValue(mockUsedInvite);

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        friendFlowContext,
        formData,
      );

      // Assert
      expect(result.nextStep.type).toBe("ERROR");
      expect(result.nextStep.message).toContain(
        "Invite invalid or already processed",
      );
    });

    it("should accept valid pre-waiver states like 'accepted_by_friend'", async () => {
      // Arrange
      const friendFlowContext = {
        userId: 987654321,
        flowType: "friend_invite",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
        activeInviteToken: "accepted-token",
      };

      const formData = {
        telegramId: 987654321,
        firstName: "Jane",
        lastName: "Friend",
        liability_form_data: { consent: true },
      };

      const mockAcceptedInvite = {
        id: "invite-1",
        status: "accepted_by_friend", // Valid pre-waiver state
        parentSessionId: 101,
        sessions: {
          id: 101,
          googleEventId: "gcal-confirmed-123",
          telegram_id: 123456789,
          first_name: "John",
          last_name: "Doe",
          appointment_datetime: new Date("2024-01-15T10:00:00.000Z"),
          SessionType: { label: "Kambo Session" },
        },
      };

      mockPrisma.sessionInvite.findUnique.mockResolvedValue(mockAcceptedInvite);
      mockPrisma.sessionInvite.update.mockResolvedValue({});
      mockGoogleCalendarTool.getCalendarEvent.mockResolvedValue({
        description: "Original event",
      });
      mockGoogleCalendarTool.updateCalendarEventDescription.mockResolvedValue(
        true,
      );
      mockPrisma.sessionInvite.count.mockResolvedValue(1);
      mockGoogleCalendarTool.updateCalendarEventSummary.mockResolvedValue(true);
      mockTelegramNotifier.sendUserNotification.mockResolvedValue(true);
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        friendFlowContext,
        formData,
      );

      // Assert
      expect(result.nextStep.type).toBe("COMPLETE");
      expect(mockPrisma.sessionInvite.update).toHaveBeenCalled();
    });
  });

  describe("SessionInvite Record Updates", () => {
    it("should update SessionInvite with friend details and waiver data", async () => {
      // Arrange
      const friendFlowContext = {
        userId: 987654321,
        flowType: "friend_invite",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
        activeInviteToken: "invite-token-456",
      };

      const formData = {
        telegramId: 987654321,
        firstName: "Jane",
        lastName: "Friend",
        liability_form_data: { consent: true, signature: "friend_signature" },
      };

      const mockSessionInvite = {
        id: "invite-1",
        status: "pending",
        parentSessionId: 101,
        sessions: {
          id: 101,
          googleEventId: "gcal-confirmed-123",
          telegram_id: 123456789,
          first_name: "John",
          last_name: "Doe",
          appointment_datetime: new Date("2024-01-15T10:00:00.000Z"),
          SessionType: { label: "Kambo Session" },
        },
      };

      mockPrisma.sessionInvite.findUnique.mockResolvedValue(mockSessionInvite);
      mockPrisma.sessionInvite.update.mockResolvedValue({});
      mockGoogleCalendarTool.getCalendarEvent.mockResolvedValue({
        description: "Original event",
      });
      mockGoogleCalendarTool.updateCalendarEventDescription.mockResolvedValue(
        true,
      );
      mockPrisma.sessionInvite.count.mockResolvedValue(1);
      mockGoogleCalendarTool.updateCalendarEventSummary.mockResolvedValue(true);
      mockTelegramNotifier.sendUserNotification.mockResolvedValue(true);
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      await flowStepHandlers.processWaiverSubmission(
        friendFlowContext,
        formData,
      );

      // Assert
      expect(mockPrisma.sessionInvite.update).toHaveBeenCalledWith({
        where: { inviteToken: "invite-token-456" },
        data: {
          status: "waiver_completed_by_friend",
          friendTelegramId: 987654321,
          friendNameOnWaiver: "Jane Friend",
          friendLiabilityFormData: {
            consent: true,
            signature: "friend_signature",
          },
        },
      });
    });
  });

  describe("Google Calendar Event Updates", () => {
    it("should update event description with friend name under Guests section", async () => {
      // Arrange
      const friendFlowContext = {
        userId: 987654321,
        flowType: "friend_invite",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
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
        sessions: {
          id: 101,
          googleEventId: "gcal-confirmed-123",
          telegram_id: 123456789,
          first_name: "John",
          last_name: "Doe",
          appointment_datetime: new Date("2024-01-15T10:00:00.000Z"),
          SessionType: { label: "Kambo Session" },
        },
      };

      const mockExistingEvent = {
        description: "Original event description",
      };

      mockPrisma.sessionInvite.findUnique.mockResolvedValue(mockSessionInvite);
      mockPrisma.sessionInvite.update.mockResolvedValue({});
      mockGoogleCalendarTool.getCalendarEvent.mockResolvedValue(
        mockExistingEvent,
      );
      mockGoogleCalendarTool.updateCalendarEventDescription.mockResolvedValue(
        true,
      );
      mockPrisma.sessionInvite.count.mockResolvedValue(1);
      mockGoogleCalendarTool.updateCalendarEventSummary.mockResolvedValue(true);
      mockTelegramNotifier.sendUserNotification.mockResolvedValue(true);
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      await flowStepHandlers.processWaiverSubmission(
        friendFlowContext,
        formData,
      );

      // Assert
      expect(mockGoogleCalendarTool.getCalendarEvent).toHaveBeenCalledWith(
        "gcal-confirmed-123",
      );
      expect(
        mockGoogleCalendarTool.updateCalendarEventDescription,
      ).toHaveBeenCalledWith(
        "gcal-confirmed-123",
        expect.stringContaining("Guests:"),
      );
      expect(
        mockGoogleCalendarTool.updateCalendarEventDescription,
      ).toHaveBeenCalledWith(
        "gcal-confirmed-123",
        expect.stringContaining("Jane Friend"),
      );
    });

    it("should update event title to GROUP format for first friend", async () => {
      // Arrange
      const friendFlowContext = {
        userId: 987654321,
        flowType: "friend_invite",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
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
        sessions: {
          id: 101,
          googleEventId: "gcal-confirmed-123",
          telegram_id: 123456789,
          first_name: "John",
          last_name: "Doe",
          appointment_datetime: new Date("2024-01-15T10:00:00.000Z"),
          SessionType: { label: "Kambo Session" },
        },
      };

      const mockExistingEvent = {
        summary: "Client John Doe - Kambo Session", // Not a group title yet
        description: "Original event",
      };

      mockPrisma.sessionInvite.findUnique.mockResolvedValue(mockSessionInvite);
      mockPrisma.sessionInvite.update.mockResolvedValue({});
      mockGoogleCalendarTool.getCalendarEvent.mockResolvedValue(
        mockExistingEvent,
      );
      mockGoogleCalendarTool.updateCalendarEventDescription.mockResolvedValue(
        true,
      );
      mockPrisma.sessionInvite.count.mockResolvedValue(1); // First friend to complete waiver
      mockGoogleCalendarTool.updateCalendarEventSummary.mockResolvedValue(true);
      mockTelegramNotifier.sendUserNotification.mockResolvedValue(true);
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      await flowStepHandlers.processWaiverSubmission(
        friendFlowContext,
        formData,
      );

      // Assert
      expect(mockPrisma.sessionInvite.count).toHaveBeenCalledWith({
        where: {
          parentSessionId: 101,
          status: "waiver_completed_by_friend",
        },
      });

      expect(
        mockGoogleCalendarTool.updateCalendarEventSummary,
      ).toHaveBeenCalledWith(
        "gcal-confirmed-123",
        "GROUP - John Doe & Friend(s) - Kambo Session",
      );
    });

    it("should not update title if already marked as GROUP", async () => {
      // Arrange
      const friendFlowContext = {
        userId: 987654321,
        flowType: "friend_invite",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
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
        sessions: {
          id: 101,
          googleEventId: "gcal-confirmed-123",
          telegram_id: 123456789,
          first_name: "John",
          last_name: "Doe",
          appointment_datetime: new Date("2024-01-15T10:00:00.000Z"),
          SessionType: { label: "Kambo Session" },
        },
      };

      const mockExistingEvent = {
        summary: "GROUP - John Doe & Friend(s) - Kambo Session", // Already a group title
        description: "Original event",
      };

      mockPrisma.sessionInvite.findUnique.mockResolvedValue(mockSessionInvite);
      mockPrisma.sessionInvite.update.mockResolvedValue({});
      mockGoogleCalendarTool.getCalendarEvent.mockResolvedValue(
        mockExistingEvent,
      );
      mockGoogleCalendarTool.updateCalendarEventDescription.mockResolvedValue(
        true,
      );
      mockPrisma.sessionInvite.count.mockResolvedValue(2); // Subsequent friend
      mockTelegramNotifier.sendUserNotification.mockResolvedValue(true);
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      await flowStepHandlers.processWaiverSubmission(
        friendFlowContext,
        formData,
      );

      // Assert
      expect(
        mockGoogleCalendarTool.updateCalendarEventSummary,
      ).not.toHaveBeenCalled();
    });

    it("should handle missing googleEventId gracefully", async () => {
      // Arrange
      const friendFlowContext = {
        userId: 987654321,
        flowType: "friend_invite",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
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
        sessions: {
          id: 101,
          googleEventId: null, // No calendar event
          telegram_id: 123456789,
          first_name: "John",
          last_name: "Doe",
          appointment_datetime: new Date("2024-01-15T10:00:00.000Z"),
          SessionType: { label: "Kambo Session" },
        },
      };

      mockPrisma.sessionInvite.findUnique.mockResolvedValue(mockSessionInvite);
      mockPrisma.sessionInvite.update.mockResolvedValue({});
      mockTelegramNotifier.sendUserNotification.mockResolvedValue(true);
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        friendFlowContext,
        formData,
      );

      // Assert
      expect(mockGoogleCalendarTool.getCalendarEvent).not.toHaveBeenCalled();
      expect(
        mockGoogleCalendarTool.updateCalendarEventDescription,
      ).not.toHaveBeenCalled();
      expect(
        mockGoogleCalendarTool.updateCalendarEventSummary,
      ).not.toHaveBeenCalled();
      expect(result.nextStep.type).toBe("COMPLETE");
    });
  });

  describe("Notification System", () => {
    it("should send confirmation to friend", async () => {
      // Arrange
      const friendFlowContext = {
        userId: 987654321,
        flowType: "friend_invite",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
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
        sessions: {
          id: 101,
          googleEventId: "gcal-confirmed-123",
          appointment_datetime: new Date("2024-01-15T10:00:00.000Z"),
          telegram_id: 123456789,
          first_name: "John",
          last_name: "Doe",
          SessionType: { label: "Kambo Session" },
        },
      };

      mockPrisma.sessionInvite.findUnique.mockResolvedValue(mockSessionInvite);
      mockPrisma.sessionInvite.update.mockResolvedValue({});
      mockGoogleCalendarTool.getCalendarEvent.mockResolvedValue({
        description: "Original event",
      });
      mockGoogleCalendarTool.updateCalendarEventDescription.mockResolvedValue(
        true,
      );
      mockPrisma.sessionInvite.count.mockResolvedValue(1);
      mockGoogleCalendarTool.updateCalendarEventSummary.mockResolvedValue(true);
      mockTelegramNotifier.sendUserNotification.mockResolvedValue(true);
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      await flowStepHandlers.processWaiverSubmission(
        friendFlowContext,
        formData,
      );

      // Assert
      expect(mockTelegramNotifier.sendUserNotification).toHaveBeenCalledWith(
        987654321,
        expect.stringContaining(
          "Your spot for the Kambo session with John Doe",
        ),
      );
    });

    it("should notify primary booker about friend confirmation", async () => {
      // Arrange
      const friendFlowContext = {
        userId: 987654321,
        flowType: "friend_invite",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
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
        sessions: {
          id: 101,
          googleEventId: "gcal-confirmed-123",
          appointment_datetime: new Date("2024-01-15T10:00:00.000Z"),
          telegram_id: 123456789,
          first_name: "John",
          last_name: "Doe",
          SessionType: { label: "Kambo Session" },
        },
      };

      mockPrisma.sessionInvite.findUnique.mockResolvedValue(mockSessionInvite);
      mockPrisma.sessionInvite.update.mockResolvedValue({});
      mockGoogleCalendarTool.getCalendarEvent.mockResolvedValue({
        description: "Original event",
      });
      mockGoogleCalendarTool.updateCalendarEventDescription.mockResolvedValue(
        true,
      );
      mockPrisma.sessionInvite.count.mockResolvedValue(1);
      mockGoogleCalendarTool.updateCalendarEventSummary.mockResolvedValue(true);
      mockTelegramNotifier.sendUserNotification.mockResolvedValue(true);
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      await flowStepHandlers.processWaiverSubmission(
        friendFlowContext,
        formData,
      );

      // Assert
      expect(mockTelegramNotifier.sendUserNotification).toHaveBeenCalledWith(
        123456789,
        expect.stringContaining(
          "Good news! Jane Friend has completed their waiver",
        ),
      );
    });

    it("should send admin notification about invited guest confirmation", async () => {
      // Arrange
      const friendFlowContext = {
        userId: 987654321,
        flowType: "friend_invite",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
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
        sessions: {
          id: 101,
          googleEventId: "gcal-confirmed-123",
          appointment_datetime: new Date("2024-01-15T10:00:00.000Z"),
          telegram_id: 123456789,
          first_name: "John",
          last_name: "Doe",
          SessionType: { label: "Kambo Session" },
        },
      };

      mockPrisma.sessionInvite.findUnique.mockResolvedValue(mockSessionInvite);
      mockPrisma.sessionInvite.update.mockResolvedValue({});
      mockGoogleCalendarTool.getCalendarEvent.mockResolvedValue({
        description: "Original event",
      });
      mockGoogleCalendarTool.updateCalendarEventDescription.mockResolvedValue(
        true,
      );
      mockPrisma.sessionInvite.count.mockResolvedValue(1);
      mockGoogleCalendarTool.updateCalendarEventSummary.mockResolvedValue(true);
      mockTelegramNotifier.sendUserNotification.mockResolvedValue(true);
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      await flowStepHandlers.processWaiverSubmission(
        friendFlowContext,
        formData,
      );

      // Assert
      expect(mockTelegramNotifier.sendAdminNotification).toHaveBeenCalledWith(
        expect.stringContaining(
          "INVITED GUEST CONFIRMED: Jane Friend (TGID: 987654321)",
        ),
      );
      expect(mockTelegramNotifier.sendAdminNotification).toHaveBeenCalledWith(
        expect.stringContaining("Invite Token: invite-token-456"),
      );
    });

    it("should handle notification failures gracefully", async () => {
      // Arrange
      const friendFlowContext = {
        userId: 987654321,
        flowType: "friend_invite",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
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
        sessions: {
          id: 101,
          googleEventId: "gcal-confirmed-123",
          telegram_id: 123456789,
          first_name: "John",
          last_name: "Doe",
          SessionType: { label: "Kambo Session" },
        },
      };

      mockPrisma.sessionInvite.findUnique.mockResolvedValue(mockSessionInvite);
      mockPrisma.sessionInvite.update.mockResolvedValue({});
      mockGoogleCalendarTool.getCalendarEvent.mockResolvedValue({
        description: "Original event",
      });
      mockGoogleCalendarTool.updateCalendarEventDescription.mockResolvedValue(
        true,
      );
      mockPrisma.sessionInvite.count.mockResolvedValue(1);
      mockGoogleCalendarTool.updateCalendarEventSummary.mockResolvedValue(true);

      // Mock notification failures
      mockTelegramNotifier.sendUserNotification.mockRejectedValue(
        new Error("Notification failed"),
      );
      mockTelegramNotifier.sendAdminNotification.mockRejectedValue(
        new Error("Admin notification failed"),
      );

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        friendFlowContext,
        formData,
      );

      // Assert - Should still complete successfully despite notification failures
      expect(result.nextStep.type).toBe("COMPLETE");
      expect(mockLogger.error).toHaveBeenCalled(); // Should log the errors
    });
  });

  describe("Flow Completion", () => {
    it("should return complete flow response with success message", async () => {
      // Arrange
      const friendFlowContext = {
        userId: 987654321,
        flowType: "friend_invite",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
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
        sessions: {
          id: 101,
          googleEventId: "gcal-confirmed-123",
          telegram_id: 123456789,
          first_name: "John",
          last_name: "Doe",
          SessionType: { label: "Kambo Session" },
        },
      };

      mockPrisma.sessionInvite.findUnique.mockResolvedValue(mockSessionInvite);
      mockPrisma.sessionInvite.update.mockResolvedValue({});
      mockGoogleCalendarTool.getCalendarEvent.mockResolvedValue({
        description: "Original event",
      });
      mockGoogleCalendarTool.updateCalendarEventDescription.mockResolvedValue(
        true,
      );
      mockPrisma.sessionInvite.count.mockResolvedValue(1);
      mockGoogleCalendarTool.updateCalendarEventSummary.mockResolvedValue(true);
      mockTelegramNotifier.sendUserNotification.mockResolvedValue(true);
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        friendFlowContext,
        formData,
      );

      // Assert
      expect(result).toEqual({
        nextStep: {
          type: "COMPLETE",
          message: "Waiver submitted successfully! Your spot is confirmed.",
          closeWebApp: true,
        },
      });
    });
  });
});
