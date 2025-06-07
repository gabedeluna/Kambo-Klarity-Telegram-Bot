const jwt = require("jsonwebtoken");

// Mock all external dependencies
const mockPrisma = {
  session: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
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
  user: {
    findUnique: jest.fn(),
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
  createEvent: jest.fn(),
  updateEvent: jest.fn(),
  deleteEvent: jest.fn(),
  createCalendarEvent: jest.fn(),
  deleteCalendarEvent: jest.fn(),
  isSlotTrulyAvailable: jest.fn(),
  getCalendarEvent: jest.fn(),
  updateCalendarEventDescription: jest.fn(),
  updateCalendarEventSummary: jest.fn(),
};

const mockTelegramNotifier = {
  sendTextMessage: jest.fn(),
  sendAdminNotification: jest.fn(),
  sendUserNotification: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock the dependencies
jest.mock("../../src/core/prisma", () => mockPrisma);
jest.mock("../../src/core/sessionTypes", () => mockSessionTypesCore);
jest.mock("../../src/tools/googleCalendar", () => mockGoogleCalendarTool);
jest.mock("../../src/tools/telegramNotifier", () => mockTelegramNotifier);
jest.mock("../../src/core/logger", () => mockLogger);

// Mock environment variables
const originalEnv = process.env;
beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-key-for-flow-tokens";
});

afterAll(() => {
  process.env = originalEnv;
});

// Global mock session types
const mockSessionTypeWithWaiverAndInvites = {
  id: "kambo-session-1",
  label: "Kambo Session",
  waiverType: "KAMBO_V1",
  allowsGroupInvites: true,
  maxGroupSize: 4,
  durationMinutes: 120,
};

const mockSessionTypeNoWaiverNoInvites = {
  id: "simple-session",
  label: "Simple Session",
  waiverType: "NONE",
  allowsGroupInvites: false,
  maxGroupSize: 1,
  durationMinutes: 60,
};

describe("BookingFlowManager", () => {
  let BookingFlowManager;

  beforeEach(() => {
    // Reset all mocks
    jest.resetModules();
    jest.clearAllMocks();

    // Require the module under test after mocks are set up
    BookingFlowManager = require("../../src/core/bookingFlow/bookingFlowManager");
  });

  describe("startPrimaryBookingFlow", () => {
    const mockStartFlowData = {
      userId: 123456789,
      sessionTypeId: "kambo-session-1",
      appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
      placeholderId: "gcal-placeholder-123",
    };

    it("should return flowToken and waiver form redirect for session type requiring waiver", async () => {
      // Arrange
      mockPrisma.sessionType.findUnique.mockResolvedValue(
        mockSessionTypeWithWaiverAndInvites,
      );
      mockSessionTypesCore.getById.mockResolvedValue(
        mockSessionTypeWithWaiverAndInvites,
      );

      // Act
      const result =
        await BookingFlowManager.startPrimaryBookingFlow(mockStartFlowData);

      // Assert
      expect(mockPrisma.sessionType.findUnique).toHaveBeenCalledWith({
        where: { id: "kambo-session-1", active: true },
      });
      expect(mockSessionTypesCore.getById).toHaveBeenCalledWith(
        "kambo-session-1",
      );
      expect(result).toHaveProperty("flowToken");
      expect(result).toHaveProperty("nextStep");
      expect(result.nextStep.type).toBe("REDIRECT");
      expect(result.nextStep.url).toContain("form-handler.html");
      expect(result.nextStep.url).toContain("formType=KAMBO_V1");
      expect(result.nextStep.url).toContain("flowToken=");

      // Verify JWT token contains expected data
      const decodedToken = jwt.verify(result.flowToken, process.env.JWT_SECRET);
      expect(decodedToken.userId).toBe(123456789);
      expect(decodedToken.flowType).toBe("primary_booking");
      expect(decodedToken.currentStep).toBe("awaiting_waiver");
      expect(decodedToken.sessionTypeId).toBe("kambo-session-1");
      expect(decodedToken.appointmentDateTimeISO).toBe(
        "2024-01-15T10:00:00.000Z",
      );
      expect(decodedToken.placeholderId).toBe("gcal-placeholder-123");
      expect(decodedToken.exp).toBeDefined();
    });

    it("should return flowToken and completion for session type with no waiver and no invites", async () => {
      // Arrange
      mockPrisma.sessionType.findUnique.mockResolvedValue(
        mockSessionTypeNoWaiverNoInvites,
      );
      mockSessionTypesCore.getById.mockResolvedValue(
        mockSessionTypeNoWaiverNoInvites,
      );

      // Act
      const result = await BookingFlowManager.startPrimaryBookingFlow({
        ...mockStartFlowData,
        sessionTypeId: "simple-session",
      });

      // Assert
      expect(result.nextStep.type).toBe("REDIRECT");
      expect(result.nextStep.url).toContain(
        "/booking-confirmed.html?flowToken=",
      );

      const decodedToken = jwt.verify(result.flowToken, process.env.JWT_SECRET);
      expect(decodedToken.currentStep).toBe("finalize_booking");
    });

    it("should return error response for invalid session type", async () => {
      // Arrange
      mockPrisma.sessionType.findUnique.mockResolvedValue(null);

      // Act
      const result =
        await BookingFlowManager.startPrimaryBookingFlow(mockStartFlowData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe(
        "Session type not found or is no longer available.",
      );
    });

    it("should throw error for missing required data", async () => {
      // Act & Assert
      await expect(
        BookingFlowManager.startPrimaryBookingFlow({}),
      ).rejects.toThrow("Missing required flow data");
    });
  });

  describe("startInviteAcceptanceFlow", () => {
    const mockInviteData = {
      inviteToken: "invite-token-123",
      userId: 987654321,
    };

    const mockSessionInvite = {
      id: 1,
      inviteToken: "invite-token-123",
      status: "PENDING",
      session: {
        id: 10,
        sessionTypeId: "kambo-session-1",
        appointmentDateTime: new Date("2024-01-15T10:00:00.000Z"),
      },
    };

    it("should return flowToken and join session page for valid invite", async () => {
      // Arrange
      mockPrisma.sessionInvite.findUnique.mockResolvedValue(mockSessionInvite);
      mockSessionTypesCore.getById.mockResolvedValue(
        mockSessionTypeWithWaiverAndInvites,
      );

      // Act
      const result =
        await BookingFlowManager.startInviteAcceptanceFlow(mockInviteData);

      // Assert
      expect(mockPrisma.sessionInvite.findUnique).toHaveBeenCalledWith({
        where: { inviteToken: "invite-token-123" },
        include: { session: true },
      });
      expect(result.nextStep.type).toBe("REDIRECT");
      expect(result.nextStep.url).toContain("join-session.html");

      const decodedToken = jwt.verify(result.flowToken, process.env.JWT_SECRET);
      expect(decodedToken.flowType).toBe("friend_invite");
      expect(decodedToken.currentStep).toBe("awaiting_join_decision");
      expect(decodedToken.inviteToken).toBe("invite-token-123");
      expect(decodedToken.parentSessionId).toBe(10);
    });

    it("should throw error for invalid invite token", async () => {
      // Arrange
      mockPrisma.sessionInvite.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        BookingFlowManager.startInviteAcceptanceFlow(mockInviteData),
      ).rejects.toThrow("Invalid or expired invite token");
    });

    it("should throw error for already used invite", async () => {
      // Arrange
      const usedInvite = { ...mockSessionInvite, status: "ACCEPTED" };
      mockPrisma.sessionInvite.findUnique.mockResolvedValue(usedInvite);

      // Act & Assert
      await expect(
        BookingFlowManager.startInviteAcceptanceFlow(mockInviteData),
      ).rejects.toThrow("Invite has already been used");
    });
  });

  describe("continueFlow", () => {
    it("should throw error for invalid flow token", async () => {
      // Act & Assert
      await expect(
        BookingFlowManager.continueFlow({
          flowToken: "invalid-token",
          stepId: "waiver_submission",
          data: {},
        }),
      ).rejects.toThrow("Invalid or expired flow token");
    });

    it("should throw error for expired flow token", async () => {
      // Arrange
      const expiredToken = jwt.sign(
        {
          userId: 123456789,
          flowType: "primary_booking",
        },
        process.env.JWT_SECRET,
        { expiresIn: "-1h" },
      );

      // Act & Assert
      await expect(
        BookingFlowManager.continueFlow({
          flowToken: expiredToken,
          stepId: "waiver_submission",
          data: {},
        }),
      ).rejects.toThrow("Invalid or expired flow token");
    });
  });

  describe("processWaiverSubmission", () => {
    const mockFlowState = {
      userId: 123456789,
      flowType: "primary_booking",
      currentStep: "awaiting_waiver",
      sessionTypeId: "kambo-session-1",
      appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
      placeholderId: "gcal-placeholder-123",
    };

    const mockWaiverData = {
      firstName: "John",
      lastName: "Doe",
      fullName: "John Doe",
      email: "john@example.com",
      phone: "+1234567890",
      emergencyContact: "Jane Doe",
      emergencyPhone: "+0987654321",
      medicalConditions: "None",
      medications: "None",
      consent: true,
      telegramId: 123456789,
      liability_form_data: {
        signed: true,
        fullName: "John Doe",
        email: "john@example.com",
        date: "2024-01-15",
      },
    };

    it("should process primary waiver and redirect to invite friends for group session", async () => {
      // Arrange
      mockSessionTypesCore.getById.mockResolvedValue(
        mockSessionTypeWithWaiverAndInvites,
      );

      // Act
      const result = await BookingFlowManager.processWaiverSubmission(
        mockFlowState,
        mockWaiverData,
      );

      // Assert - No longer creates session during waiver processing
      expect(mockPrisma.sessions.create).not.toHaveBeenCalled();

      // Should redirect to invite friends for group sessions
      expect(result.nextStep.type).toBe("REDIRECT");
      expect(result.nextStep.url).toContain("invite-friends.html");

      const decodedToken = jwt.verify(result.flowToken, process.env.JWT_SECRET);
      expect(decodedToken.currentStep).toBe("awaiting_friend_invites");
      // Should store waiver data in flow token for later session creation
      expect(decodedToken.firstName).toBe("John");
      expect(decodedToken.lastName).toBe("Doe");
      expect(decodedToken.liability_form_data).toEqual(
        mockWaiverData.liability_form_data,
      );
    });

    it("should process primary waiver and complete flow for single session", async () => {
      // Arrange
      mockSessionTypesCore.getById.mockResolvedValue(
        mockSessionTypeNoWaiverNoInvites,
      );
      mockGoogleCalendarTool.isSlotTrulyAvailable.mockResolvedValue(true);
      mockPrisma.sessions.create.mockResolvedValue({ id: 10 });
      mockGoogleCalendarTool.deleteCalendarEvent.mockResolvedValue(true);
      mockGoogleCalendarTool.createCalendarEvent.mockResolvedValue(
        "gcal-event-123",
      );
      mockPrisma.sessions.update.mockResolvedValue({ id: 10 });
      mockTelegramNotifier.sendTextMessage.mockResolvedValue(true);

      const singleFlowState = {
        ...mockFlowState,
        sessionTypeId: "simple-session",
      };

      // Act
      const result = await BookingFlowManager.processWaiverSubmission(
        singleFlowState,
        mockWaiverData,
      );

      // Assert
      expect(result.nextStep.type).toBe("REDIRECT");
      expect(result.nextStep.url).toContain(
        "/booking-confirmed.html?flowToken=",
      );

      const decodedToken = jwt.verify(result.flowToken, process.env.JWT_SECRET);
      expect(decodedToken.currentStep).toBe("finalize_booking");
    });

    it("should process friend waiver and complete friend flow", async () => {
      // Arrange
      const friendFlowState = {
        ...mockFlowState,
        flowType: "friend_invite",
        currentStep: "awaiting_friend_waiver",
        parentSessionId: 10,
        inviteToken: "invite-token-123",
      };

      // Mock the complete sessionInvite with session relationship
      const mockSessionInvite = {
        id: 1,
        inviteToken: "invite-token-123",
        status: "pending",
        parentSessionId: 10,
        sessions: {
          id: 10,
          telegram_id: BigInt(123456789),
          first_name: "John",
          last_name: "Doe",
          appointment_datetime: new Date("2024-01-15T10:00:00.000Z"),
          googleEventId: "gcal-event-123",
          SessionType: {
            label: "Kambo Session",
          },
        },
      };

      mockPrisma.sessionInvite.findUnique.mockResolvedValue(mockSessionInvite);
      mockPrisma.sessionInvite.update.mockResolvedValue({ id: 1 });
      mockPrisma.sessionInvite.count.mockResolvedValue(1);
      mockGoogleCalendarTool.getCalendarEvent.mockResolvedValue({
        description: "Session details",
        summary: "Kambo Session - John Doe",
      });
      mockGoogleCalendarTool.updateCalendarEventDescription.mockResolvedValue(
        true,
      );
      mockGoogleCalendarTool.updateCalendarEventSummary.mockResolvedValue(true);
      mockTelegramNotifier.sendUserNotification.mockResolvedValue(true);
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      const result = await BookingFlowManager.processWaiverSubmission(
        friendFlowState,
        mockWaiverData,
      );

      // Assert - Should call findUnique to get session details
      expect(mockPrisma.sessionInvite.findUnique).toHaveBeenCalledWith({
        where: { inviteToken: "invite-token-123" },
        include: {
          sessions: {
            include: {
              SessionType: true,
            },
          },
        },
      });

      // Should update sessionInvite with friend waiver data
      expect(mockPrisma.sessionInvite.update).toHaveBeenCalledWith({
        where: { inviteToken: "invite-token-123" },
        data: {
          status: "waiver_completed_by_friend",
          friendTelegramId: mockWaiverData.telegramId,
          friendNameOnWaiver: "John Doe",
          friendLiabilityFormData: mockWaiverData.liability_form_data,
        },
      });

      expect(result.nextStep.type).toBe("COMPLETE");
    });

    it("should handle session type lookup errors gracefully", async () => {
      // Arrange - Primary waiver processing with sessionType lookup failure
      mockSessionTypesCore.getById.mockRejectedValue(
        new Error("Session type lookup failed"),
      );

      // Act
      const result = await BookingFlowManager.processWaiverSubmission(
        mockFlowState,
        mockWaiverData,
      );

      // Assert - Should return error response
      expect(result.nextStep.type).toBe("ERROR");
      expect(result.nextStep.message).toContain(
        "An error occurred while processing your booking",
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("processFriendInviteAcceptance", () => {
    const mockFlowState = {
      userId: 987654321,
      flowType: "friend_invite",
      currentStep: "awaiting_join_decision",
      sessionTypeId: "kambo-session-1",
      parentSessionId: 10,
      inviteToken: "invite-token-123",
    };

    it("should redirect to waiver form for session requiring waiver", async () => {
      // Arrange
      mockSessionTypesCore.getById.mockResolvedValue(
        mockSessionTypeWithWaiverAndInvites,
      );

      // Act
      const result =
        await BookingFlowManager.processFriendInviteAcceptance(mockFlowState);

      // Assert
      expect(result.nextStep.type).toBe("REDIRECT");
      expect(result.nextStep.url).toContain("form-handler.html");
      expect(result.nextStep.url).toContain("formType=KAMBO_V1");

      const decodedToken = jwt.verify(result.flowToken, process.env.JWT_SECRET);
      expect(decodedToken.currentStep).toBe("awaiting_friend_waiver");
    });

    it("should complete flow for session not requiring waiver", async () => {
      // Arrange
      mockSessionTypesCore.getById.mockResolvedValue(
        mockSessionTypeNoWaiverNoInvites,
      );
      mockPrisma.sessionInvite.update.mockResolvedValue({ id: 1 });
      mockGoogleCalendarTool.updateEvent.mockResolvedValue(true);
      mockTelegramNotifier.sendTextMessage.mockResolvedValue(true);

      // Act
      const result =
        await BookingFlowManager.processFriendInviteAcceptance(mockFlowState);

      // Assert
      expect(mockPrisma.sessionInvite.update).toHaveBeenCalledWith({
        where: { inviteToken: "invite-token-123" },
        data: { status: "ACCEPTED" },
      });
      expect(result.nextStep.type).toBe("COMPLETE");
    });
  });

  describe("handleFriendDecline", () => {
    const mockFlowState = {
      userId: 987654321,
      flowType: "friend_invite",
      currentStep: "awaiting_join_decision",
      inviteToken: "invite-token-123",
    };

    it("should update invite status to declined and complete flow", async () => {
      // Arrange
      mockPrisma.sessionInvite.update.mockResolvedValue({ id: 1 });
      mockTelegramNotifier.sendTextMessage.mockResolvedValue(true);

      // Act
      const result =
        await BookingFlowManager.handleFriendDecline(mockFlowState);

      // Assert
      expect(mockPrisma.sessionInvite.update).toHaveBeenCalledWith({
        where: { inviteToken: "invite-token-123" },
        data: { status: "DECLINED" },
      });
      expect(result.nextStep.type).toBe("COMPLETE");

      const decodedToken = jwt.verify(result.flowToken, process.env.JWT_SECRET);
      expect(decodedToken.currentStep).toBe("completed");
    });
  });

  describe("determineNextStep", () => {
    it("should return waiver form for session requiring waiver", () => {
      // Arrange
      const flowState = { currentStep: "initial", flowType: "primary_booking" };
      const sessionType = { waiverType: "KAMBO_V1", allowsGroupInvites: true };

      // Act
      const result = BookingFlowManager.determineNextStep(
        flowState,
        sessionType,
      );

      // Assert
      expect(result.nextStep).toBe("awaiting_waiver");
      expect(result.action.type).toBe("REDIRECT");
      expect(result.action.url).toContain("form-handler.html");
      expect(result.action.url).toContain("formType=KAMBO_V1");
    });

    it("should return invite friends for completed waiver with group invites allowed", () => {
      // Arrange
      const flowState = {
        currentStep: "waiver_completed",
        flowType: "primary_booking",
      };
      const sessionType = { waiverType: "KAMBO_V1", allowsGroupInvites: true };

      // Act
      const result = BookingFlowManager.determineNextStep(
        flowState,
        sessionType,
      );

      // Assert
      expect(result.nextStep).toBe("awaiting_friend_invites");
      expect(result.action.type).toBe("REDIRECT");
      expect(result.action.url).toContain("invite-friends.html");
    });

    it("should return redirect to confirmation page for session with no waiver and no invites", () => {
      // Arrange
      const flowState = { currentStep: "initial", flowType: "primary_booking" };
      const sessionType = { waiverType: "NONE", allowsGroupInvites: false };

      // Act
      const result = BookingFlowManager.determineNextStep(
        flowState,
        sessionType,
      );

      // Assert - Should redirect to confirmation page instead of completing
      expect(result.nextStep).toBe("finalize_booking");
      expect(result.action.type).toBe("REDIRECT");
      expect(result.action.url).toBe("/booking-confirmed.html?flowToken=");
    });
  });

  describe("JWT Token Management", () => {
    it("should generate valid JWT tokens with proper expiry", () => {
      // Arrange
      const flowData = {
        userId: 123456789,
        flowType: "primary_booking",
        currentStep: "awaiting_waiver",
        sessionTypeId: "kambo-session-1",
      };

      // Act
      const token = BookingFlowManager.generateFlowToken(flowData);

      // Assert
      expect(token).toBeDefined();
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.userId).toBe(123456789);
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
      expect(decoded.exp).toBeLessThanOrEqual(Date.now() / 1000 + 7200); // 2 hours
    });

    it("should parse valid JWT tokens correctly", () => {
      // Arrange
      const flowData = {
        userId: 123456789,
        flowType: "primary_booking",
        currentStep: "awaiting_waiver",
      };
      const token = jwt.sign(flowData, process.env.JWT_SECRET, {
        expiresIn: "2h",
      });

      // Act
      const parsed = BookingFlowManager.parseFlowToken(token);

      // Assert
      expect(parsed.userId).toBe(123456789);
      expect(parsed.flowType).toBe("primary_booking");
      expect(parsed.currentStep).toBe("awaiting_waiver");
    });

    it("should throw error for invalid JWT tokens", () => {
      // Act & Assert
      expect(() => BookingFlowManager.parseFlowToken("invalid-token")).toThrow(
        "Invalid or expired flow token",
      );
    });
  });

  describe("finalizeBookingAndNotify", () => {
    it("should successfully finalize a primary booking flow", async () => {
      // Arrange
      const flowData = {
        userId: 123456789,
        flowType: "primary_booking",
        currentStep: "finalize_booking",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
        placeholderId: "gcal-placeholder-123",
        firstName: "John",
        lastName: "Doe",
        liability_form_data: { signed: true },
      };

      const flowToken = jwt.sign(flowData, process.env.JWT_SECRET, {
        expiresIn: "2h",
      });

      // Mock session type
      mockSessionTypesCore.getById.mockResolvedValue(
        mockSessionTypeWithWaiverAndInvites,
      );

      // Mock slot availability check
      mockGoogleCalendarTool.isSlotTrulyAvailable = jest
        .fn()
        .mockResolvedValue(true);

      // Mock placeholder deletion
      mockGoogleCalendarTool.deleteCalendarEvent = jest
        .fn()
        .mockResolvedValue(true);

      // Mock session creation
      mockPrisma.sessions.create.mockResolvedValue({
        id: 1,
        telegram_id: BigInt(123456789),
        session_type_id_fk: "kambo-session-1",
        appointment_datetime: new Date("2024-01-15T10:00:00.000Z"),
        session_status: "CONFIRMED",
      });

      // Mock calendar event creation
      mockGoogleCalendarTool.createCalendarEvent = jest
        .fn()
        .mockResolvedValue("gcal-event-123");

      // Mock session update
      mockPrisma.sessions.update.mockResolvedValue({
        id: 1,
        googleEventId: "gcal-event-123",
      });

      // Mock admin notification
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act
      const result =
        await BookingFlowManager.finalizeBookingAndNotify(flowToken);

      // Assert
      expect(result.success).toBe(true);
      expect(result.sessionTypeLabel).toBe("Kambo Session");
      expect(result.appointmentDateTimeFormatted).toContain(
        "Monday, January 15, 2024",
      );

      // Verify core booking operations were called
      expect(mockGoogleCalendarTool.deleteCalendarEvent).toHaveBeenCalledWith(
        "gcal-placeholder-123",
      );
      expect(mockGoogleCalendarTool.isSlotTrulyAvailable).toHaveBeenCalledWith(
        "2024-01-15T10:00:00.000Z",
        120,
      );
      expect(mockPrisma.sessions.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          telegram_id: BigInt(123456789),
          session_type_id_fk: "kambo-session-1",
          appointment_datetime: new Date("2024-01-15T10:00:00.000Z"),
          session_status: "CONFIRMED",
          first_name: "John",
          last_name: "Doe",
          liability_form_data: { signed: true },
        }),
      });
      expect(mockGoogleCalendarTool.createCalendarEvent).toHaveBeenCalled();
      expect(mockTelegramNotifier.sendAdminNotification).toHaveBeenCalled();
    });

    it("should be idempotent when called twice with same flowToken", async () => {
      // Arrange
      const flowData = {
        userId: 123456789,
        flowType: "primary_booking",
        currentStep: "finalize_booking",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
        placeholderId: "gcal-placeholder-123",
        firstName: "John",
        lastName: "Doe",
        liability_form_data: { signed: true },
      };

      const flowToken = jwt.sign(flowData, process.env.JWT_SECRET, {
        expiresIn: "2h",
      });

      // Mock session type
      mockSessionTypesCore.getById.mockResolvedValue(
        mockSessionTypeWithWaiverAndInvites,
      );

      // Mock slot availability check
      mockGoogleCalendarTool.isSlotTrulyAvailable = jest
        .fn()
        .mockResolvedValue(true);

      // Mock successful database and external service calls
      mockGoogleCalendarTool.deleteCalendarEvent = jest
        .fn()
        .mockResolvedValue(true);
      mockPrisma.sessions.create.mockResolvedValue({
        id: 1,
        telegram_id: BigInt(123456789),
      });
      mockGoogleCalendarTool.createCalendarEvent = jest
        .fn()
        .mockResolvedValue("gcal-event-123");
      mockPrisma.sessions.update.mockResolvedValue({ id: 1 });
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act - Call twice with same token
      const result1 =
        await BookingFlowManager.finalizeBookingAndNotify(flowToken);
      const result2 =
        await BookingFlowManager.finalizeBookingAndNotify(flowToken);

      // Assert - Both calls should succeed and return the same result
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1).toEqual(result2);

      // Core logic should only be executed once
      expect(mockPrisma.sessions.create).toHaveBeenCalledTimes(1);
      expect(mockGoogleCalendarTool.createCalendarEvent).toHaveBeenCalledTimes(
        1,
      );
    });

    it("should handle slot unavailability error", async () => {
      // Arrange
      const flowData = {
        userId: 123456789,
        flowType: "primary_booking",
        currentStep: "finalize_booking",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
        placeholderId: "gcal-placeholder-123",
        firstName: "John",
        lastName: "Doe",
        liability_form_data: { signed: true },
      };

      const flowToken = jwt.sign(flowData, process.env.JWT_SECRET, {
        expiresIn: "2h",
      });

      // Mock session type
      mockSessionTypesCore.getById.mockResolvedValue(
        mockSessionTypeWithWaiverAndInvites,
      );

      // Mock slot unavailability
      mockGoogleCalendarTool.isSlotTrulyAvailable = jest
        .fn()
        .mockResolvedValue(false);

      // Act & Assert
      await expect(
        BookingFlowManager.finalizeBookingAndNotify(flowToken),
      ).rejects.toThrow(
        "Sorry, the selected slot was taken while you were completing the waiver.",
      );
    });

    it("should handle calendar event creation failure after session creation", async () => {
      // Arrange
      const flowData = {
        userId: 123456789,
        flowType: "primary_booking",
        currentStep: "finalize_booking",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
        placeholderId: "gcal-placeholder-123",
        firstName: "John",
        lastName: "Doe",
        liability_form_data: { signed: true },
      };

      const flowToken = jwt.sign(flowData, process.env.JWT_SECRET, {
        expiresIn: "2h",
      });

      // Mock session type
      mockSessionTypesCore.getById.mockResolvedValue(
        mockSessionTypeWithWaiverAndInvites,
      );

      // Mock successful slot availability and session creation
      mockGoogleCalendarTool.isSlotTrulyAvailable = jest
        .fn()
        .mockResolvedValue(true);
      mockGoogleCalendarTool.deleteCalendarEvent = jest
        .fn()
        .mockResolvedValue(true);
      mockPrisma.sessions.create.mockResolvedValue({
        id: 1,
        telegram_id: BigInt(123456789),
        session_type_id_fk: "kambo-session-1",
        appointment_datetime: new Date("2024-01-15T10:00:00.000Z"),
        session_status: "CONFIRMED",
      });

      // Mock calendar event creation failure
      mockGoogleCalendarTool.createCalendarEvent = jest
        .fn()
        .mockRejectedValue(new Error("Calendar API error"));

      // Mock session update for flagging manual review
      mockPrisma.sessions.update.mockResolvedValue({
        id: 1,
        session_status: "NEEDS_MANUAL_REVIEW",
      });

      // Mock admin notification
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);

      // Act & Assert
      await expect(
        BookingFlowManager.finalizeBookingAndNotify(flowToken),
      ).rejects.toThrow(
        "Session was created but calendar event failed. An admin has been notified.",
      );

      // Verify session was flagged for manual review
      expect(mockPrisma.sessions.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { session_status: "NEEDS_MANUAL_REVIEW" },
      });

      // Verify admin notification was sent
      expect(mockTelegramNotifier.sendAdminNotification).toHaveBeenCalledWith(
        expect.stringContaining(
          "CRITICAL: Session created in DB but Calendar event failed",
        ),
      );
    });
  });

  describe("determineNextStep - Confirmation Page Redirect", () => {
    it("should redirect to confirmation page for completed waiver without group invites", () => {
      // Arrange
      const flowState = {
        userId: 123456789,
        flowType: "primary_booking",
        currentStep: "waiver_completed",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
      };

      const sessionType = {
        ...mockSessionTypeNoWaiverNoInvites, // No group invites allowed
        allowsGroupInvites: false,
      };

      // Act
      const result = BookingFlowManager.determineNextStep(
        flowState,
        sessionType,
      );

      // Assert
      expect(result.nextStep).toBe("finalize_booking");
      expect(result.action.type).toBe("REDIRECT");
      expect(result.action.url).toBe("/booking-confirmed.html?flowToken=");
    });

    it("should redirect to confirmation page for simple flow without waiver or invites", () => {
      // Arrange
      const flowState = {
        userId: 123456789,
        flowType: "primary_booking",
        currentStep: "initial",
        sessionTypeId: "simple-session",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
      };

      const sessionType = mockSessionTypeNoWaiverNoInvites;

      // Act
      const result = BookingFlowManager.determineNextStep(
        flowState,
        sessionType,
      );

      // Assert
      expect(result.nextStep).toBe("finalize_booking");
      expect(result.action.type).toBe("REDIRECT");
      expect(result.action.url).toBe("/booking-confirmed.html?flowToken=");
    });
  });
});
