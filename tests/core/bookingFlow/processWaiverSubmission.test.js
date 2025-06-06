/**
 * @module tests/core/bookingFlow/processWaiverSubmission
 * @description TDD tests for the processWaiverSubmission method according to Feature 6 specification
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

describe("processWaiverSubmission - Feature 6 Implementation", () => {
  let flowStepHandlers;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Require the module under test after mocks are set up
    flowStepHandlers = require("../../../src/core/bookingFlow/flowStepHandlers");
  });

  describe("Flow Context Validation and Branching", () => {
    it("should route to primary booker flow when no activeInviteToken present", async () => {
      // Arrange
      const primaryFlowContext = {
        userId: 123456789,
        flowType: "primary_booking",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
        placeholderId: "gcal-placeholder-123",
        // No activeInviteToken or inviteToken
      };

      const formData = {
        telegramId: 123456789,
        firstName: "John",
        lastName: "Doe",
        liability_form_data: { consent: true, signature: "signature_data" },
      };

      const mockSessionType = {
        id: "kambo-session-1",
        label: "Kambo Session",
        waiverType: "KAMBO_V1",
        allowsGroupInvites: false,
        durationMinutes: 120,
      };

      mockSessionTypesCore.getById.mockResolvedValue(mockSessionType);
      mockGoogleCalendarTool.deleteCalendarEvent.mockResolvedValue(true);
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
        primaryFlowContext,
        formData,
      );

      // Assert - Should call primary booker processing logic
      expect(mockGoogleCalendarTool.deleteCalendarEvent).toHaveBeenCalledWith(
        "gcal-placeholder-123",
      );
      expect(mockGoogleCalendarTool.isSlotTrulyAvailable).toHaveBeenCalled();
      expect(mockPrisma.sessions.create).toHaveBeenCalled();
      expect(result.nextStep.type).toBe("COMPLETE");
    });

    it("should route to friend flow when activeInviteToken is present", async () => {
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
      mockPrisma.sessionInvite.count.mockResolvedValue(1); // First friend
      mockGoogleCalendarTool.updateCalendarEventSummary.mockResolvedValue(true);
      mockTelegramNotifier.sendUserNotification.mockResolvedValue(true);
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        friendFlowContext,
        formData,
      );

      // Assert - Should call friend processing logic
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
      expect(mockPrisma.sessionInvite.update).toHaveBeenCalled();
      expect(result.nextStep.type).toBe("COMPLETE");
      expect(result.nextStep.message).toContain(
        "Waiver submitted successfully!",
      );
    });
  });

  describe("Primary Booker Flow - Placeholder Handling", () => {
    it("should delete placeholder and check slot availability before creating session", async () => {
      // Arrange
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
        label: "Kambo Session",
        durationMinutes: 120,
        allowsGroupInvites: false,
      };

      mockSessionTypesCore.getById.mockResolvedValue(mockSessionType);
      mockGoogleCalendarTool.deleteCalendarEvent.mockResolvedValue(true);
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
      await flowStepHandlers.processWaiverSubmission(flowContext, formData);

      // Assert
      expect(mockGoogleCalendarTool.deleteCalendarEvent).toHaveBeenCalledWith(
        "gcal-placeholder-123",
      );
      expect(mockGoogleCalendarTool.isSlotTrulyAvailable).toHaveBeenCalledWith(
        "2024-01-15T10:00:00.000Z",
        120,
      );
    });

    it("should return error when slot becomes unavailable after placeholder deletion", async () => {
      // Arrange
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
      mockGoogleCalendarTool.isSlotTrulyAvailable.mockResolvedValue(false); // Slot taken

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

    it("should still check slot availability when no placeholderId present", async () => {
      // Arrange
      const flowContext = {
        userId: 123456789,
        flowType: "primary_booking",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
        // No placeholderId
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
      await flowStepHandlers.processWaiverSubmission(flowContext, formData);

      // Assert
      expect(mockGoogleCalendarTool.deleteCalendarEvent).not.toHaveBeenCalled();
      expect(mockGoogleCalendarTool.isSlotTrulyAvailable).toHaveBeenCalledWith(
        "2024-01-15T10:00:00.000Z",
        120,
      );
      expect(mockPrisma.sessions.create).toHaveBeenCalled();
    });
  });

  describe("Primary Booker Flow - Session Creation", () => {
    it("should create session record with correct data", async () => {
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
        liability_form_data: { consent: true, signature: "signature_data" },
      };

      const mockSessionType = {
        id: "kambo-session-1",
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
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      await flowStepHandlers.processWaiverSubmission(flowContext, formData);

      // Assert
      expect(mockPrisma.sessions.create).toHaveBeenCalledWith({
        data: {
          telegram_id: 123456789,
          session_type_id_fk: "kambo-session-1",
          appointment_datetime: new Date("2024-01-15T10:00:00.000Z"),
          session_status: "CONFIRMED",
          liability_form_data: { consent: true, signature: "signature_data" },
          first_name: "John",
          last_name: "Doe",
        },
      });
    });

    it("should create Google Calendar event and update session with eventId", async () => {
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
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      await flowStepHandlers.processWaiverSubmission(flowContext, formData);

      // Assert
      expect(mockGoogleCalendarTool.createCalendarEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: "Client John Doe - Kambo Session",
          start: expect.any(Date),
          end: expect.any(Date),
          description: expect.any(String),
        }),
      );

      expect(mockPrisma.sessions.update).toHaveBeenCalledWith({
        where: { id: 101 },
        data: { googleEventId: "gcal-confirmed-123" },
      });
    });

    it("should update bot message and clear edit_msg_id", async () => {
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
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      await flowStepHandlers.processWaiverSubmission(flowContext, formData);

      // Assert
      expect(mockTelegramNotifier.editMessageText).toHaveBeenCalledWith(
        expect.objectContaining({
          telegramId: 123456789,
          messageId: 999,
          text: expect.stringContaining(
            "Your Kambo Session session is confirmed",
          ),
        }),
      );

      expect(mockPrisma.users.update).toHaveBeenCalledWith({
        where: { telegram_id: 123456789 },
        data: { edit_msg_id: null },
      });
    });

    it("should send admin notification with booking details", async () => {
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
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      await flowStepHandlers.processWaiverSubmission(flowContext, formData);

      // Assert
      expect(mockTelegramNotifier.sendAdminNotification).toHaveBeenCalledWith(
        expect.stringContaining(
          "CONFIRMED BOOKING: Client John Doe (TGID: 123456789) for Kambo Session",
        ),
      );
    });
  });

  describe("Primary Booker Flow - Group Invites", () => {
    it("should redirect to invite-friends when allowsGroupInvites is true", async () => {
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
        allowsGroupInvites: true,
        maxGroupSize: 4,
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
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        flowContext,
        formData,
      );

      // Assert
      expect(result.nextStep.type).toBe("REDIRECT");
      expect(result.nextStep.url).toContain("/invite-friends.html");
      expect(result.nextStep.url).toContain("sessionId=101");
      expect(result.nextStep.url).toContain("telegramId=123456789");
      expect(result.nextStep.url).toContain("maxGroupSize=4");
    });

    it("should complete flow when allowsGroupInvites is false", async () => {
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
        maxGroupSize: 1,
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
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      const result = await flowStepHandlers.processWaiverSubmission(
        flowContext,
        formData,
      );

      // Assert
      expect(result.nextStep.type).toBe("COMPLETE");
      expect(result.nextStep.message).toContain("Booking Confirmed!");
      expect(result.nextStep.closeWebApp).toBe(true);
    });
  });
});
