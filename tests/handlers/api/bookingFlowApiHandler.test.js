/**
 * @fileoverview Unit tests for bookingFlowApiHandler
 * Tests the API endpoints for BookingFlowManager integration
 */

const {
  mockBookingFlowManager,
  mockLogger,
  mockRequest,
  mockResponse,
} = require("./testUtils/bookingFlowTestUtils");

describe("BookingFlow API Handler", () => {
  let bookingFlowApiHandler;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Suppress console.error for expected error tests
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    // Mock the BookingFlowManager module
    jest.doMock(
      "../../../src/core/bookingFlow/bookingFlowManager",
      () => mockBookingFlowManager,
    );

    // Require the module under test after mocks are set up
    bookingFlowApiHandler = require("../../../src/handlers/api/bookingFlowApiHandler");
  });

  afterEach(() => {
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
  });

  describe("initialize", () => {
    it("should initialize successfully with logger dependency", () => {
      expect(() =>
        bookingFlowApiHandler.initialize({ logger: mockLogger }),
      ).not.toThrow();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "BookingFlow API Handler initialized successfully.",
      );
    });

    it("should throw an error if logger is missing", () => {
      expect(() => bookingFlowApiHandler.initialize({})).toThrow(
        "Dependency Error: logger is required for bookingFlowApiHandler.",
      );
    });
  });

  describe("handleStartPrimaryFlow", () => {
    beforeEach(() => {
      bookingFlowApiHandler.initialize({ logger: mockLogger });
    });

    it("should successfully start primary booking flow with valid input", async () => {
      const mockFlowResponse = {
        flowToken: "generated.jwt.flow.token",
        nextStep: {
          type: "REDIRECT",
          url: "/form-handler.html?flowToken=generated.jwt.flow.token&formType=KAMBO_WAIVER_V1",
        },
      };

      mockBookingFlowManager.startPrimaryBookingFlow.mockResolvedValue(
        mockFlowResponse,
      );

      const req = mockRequest({
        telegramId: "123456789",
        sessionTypeId: "session-type-uuid-1",
        appointmentDateTimeISO: "2025-07-15T10:00:00.000Z",
        placeholderId: "gcal-placeholder-event-id",
        initialSessionTypeDetails: {
          waiverType: "KAMBO_V1",
          allowsGroupInvites: true,
          maxGroupSize: 4,
        },
      });
      const res = mockResponse();

      await bookingFlowApiHandler.handleStartPrimaryFlow(req, res);

      expect(
        mockBookingFlowManager.startPrimaryBookingFlow,
      ).toHaveBeenCalledWith({
        userId: 123456789,
        sessionTypeId: "session-type-uuid-1",
        appointmentDateTimeISO: "2025-07-15T10:00:00.000Z",
        placeholderId: "gcal-placeholder-event-id",
        initialSessionTypeDetails: {
          waiverType: "KAMBO_V1",
          allowsGroupInvites: true,
          maxGroupSize: 4,
        },
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        flowToken: "generated.jwt.flow.token",
        nextStep: {
          type: "REDIRECT",
          url: "/form-handler.html?flowToken=generated.jwt.flow.token&formType=KAMBO_WAIVER_V1",
        },
      });
    });

    const primaryFlowValidationTests = [
      {
        name: "missing telegramId",
        body: {
          sessionTypeId: "session-type-uuid-1",
          appointmentDateTimeISO: "2025-07-15T10:00:00.000Z",
        },
        expectedMessage: "Invalid input: telegramId is required.",
      },
      {
        name: "invalid telegramId format",
        body: {
          telegramId: "invalid-id",
          sessionTypeId: "session-type-uuid-1",
          appointmentDateTimeISO: "2025-07-15T10:00:00.000Z",
        },
        expectedMessage: "Invalid input: telegramId must be a valid number.",
      },
      {
        name: "missing sessionTypeId",
        body: {
          telegramId: "123456789",
          appointmentDateTimeISO: "2025-07-15T10:00:00.000Z",
        },
        expectedMessage: "Invalid input: sessionTypeId is required.",
      },
      {
        name: "missing appointmentDateTimeISO",
        body: { telegramId: "123456789", sessionTypeId: "session-type-uuid-1" },
        expectedMessage: "Invalid input: appointmentDateTimeISO is required.",
      },
      {
        name: "invalid appointmentDateTimeISO format",
        body: {
          telegramId: "123456789",
          sessionTypeId: "session-type-uuid-1",
          appointmentDateTimeISO: "invalid-date",
        },
        expectedMessage:
          "Invalid input: appointmentDateTimeISO must be a valid ISO date string.",
      },
    ];

    primaryFlowValidationTests.forEach(({ name, body, expectedMessage }) => {
      it(`should return 400 for ${name}`, async () => {
        const req = mockRequest(body);
        const res = mockResponse();

        await bookingFlowApiHandler.handleStartPrimaryFlow(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: expectedMessage,
        });
      });
    });

    it("should return 500 for BookingFlowManager errors", async () => {
      mockBookingFlowManager.startPrimaryBookingFlow.mockRejectedValue(
        new Error("Session type not found"),
      );

      const req = mockRequest({
        telegramId: "123456789",
        sessionTypeId: "invalid-session-type",
        appointmentDateTimeISO: "2025-07-15T10:00:00.000Z",
      });
      const res = mockResponse();

      await bookingFlowApiHandler.handleStartPrimaryFlow(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "An internal error occurred while starting the booking flow.",
      });
    });
  });

  describe("handleStartInviteFlow", () => {
    beforeEach(() => {
      bookingFlowApiHandler.initialize({ logger: mockLogger });
    });

    it("should successfully start invite acceptance flow with valid input", async () => {
      const mockFlowResponse = {
        flowToken: "generated.jwt.flow.token.for.friend",
        nextStep: {
          type: "REDIRECT",
          url: "/join-session.html?flowToken=generated.jwt.flow.token.for.friend",
        },
        inviteDetails: {
          primaryBookerName: "John Doe",
          sessionTypeLabel: "Standard Kambo Session",
          appointmentTimeFormatted: "Monday, July 15, 2025 at 10:00 AM PDT",
          parentSessionId: 123,
          sessionTypeId: "session-type-uuid-1",
          appointmentDateTimeISO: "2025-07-15T10:00:00.000Z",
        },
      };

      mockBookingFlowManager.startInviteAcceptanceFlow.mockResolvedValue(
        mockFlowResponse,
      );

      const req = mockRequest(
        {},
        { inviteToken: "friend-invite-token-xyz" },
        { friend_tg_id: "987654321" },
      );
      const res = mockResponse();

      await bookingFlowApiHandler.handleStartInviteFlow(req, res);

      expect(
        mockBookingFlowManager.startInviteAcceptanceFlow,
      ).toHaveBeenCalledWith({
        inviteToken: "friend-invite-token-xyz",
        userId: 987654321,
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        flowToken: "generated.jwt.flow.token.for.friend",
        nextStep: {
          type: "REDIRECT",
          url: "/join-session.html?flowToken=generated.jwt.flow.token.for.friend",
        },
        inviteDetails: {
          primaryBookerName: "John Doe",
          sessionTypeLabel: "Standard Kambo Session",
          appointmentTimeFormatted: "Monday, July 15, 2025 at 10:00 AM PDT",
          parentSessionId: 123,
          sessionTypeId: "session-type-uuid-1",
          appointmentDateTimeISO: "2025-07-15T10:00:00.000Z",
        },
      });
    });

    const inviteFlowValidationTests = [
      {
        name: "missing inviteToken",
        params: {},
        query: { friend_tg_id: "987654321" },
        expectedMessage: "Invalid input: inviteToken is required.",
      },
      {
        name: "missing friend_tg_id",
        params: { inviteToken: "friend-invite-token-xyz" },
        query: {},
        expectedMessage: "Invalid input: friend_tg_id is required.",
      },
      {
        name: "invalid friend_tg_id format",
        params: { inviteToken: "friend-invite-token-xyz" },
        query: { friend_tg_id: "invalid-id" },
        expectedMessage: "Invalid input: friend_tg_id must be a valid number.",
      },
    ];

    inviteFlowValidationTests.forEach(
      ({ name, params, query, expectedMessage }) => {
        it(`should return 400 for ${name}`, async () => {
          const req = mockRequest({}, params, query);
          const res = mockResponse();

          await bookingFlowApiHandler.handleStartInviteFlow(req, res);

          expect(res.status).toHaveBeenCalledWith(400);
          expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: expectedMessage,
          });
        });
      },
    );

    it("should return 404 for invalid invite token", async () => {
      mockBookingFlowManager.startInviteAcceptanceFlow.mockRejectedValue(
        new Error("Invalid or expired invite token"),
      );

      const req = mockRequest(
        {},
        { inviteToken: "invalid-token" },
        { friend_tg_id: "987654321" },
      );
      const res = mockResponse();

      await bookingFlowApiHandler.handleStartInviteFlow(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invite token is invalid or has expired.",
      });
    });

    it("should return 500 for other BookingFlowManager errors", async () => {
      mockBookingFlowManager.startInviteAcceptanceFlow.mockRejectedValue(
        new Error("Database connection error"),
      );

      const req = mockRequest(
        {},
        { inviteToken: "friend-invite-token-xyz" },
        { friend_tg_id: "987654321" },
      );
      const res = mockResponse();

      await bookingFlowApiHandler.handleStartInviteFlow(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "An internal error occurred while starting the invite flow.",
      });
    });
  });

  describe("handleContinueFlow", () => {
    beforeEach(() => {
      bookingFlowApiHandler.initialize({ logger: mockLogger });
    });

    it("should successfully continue flow with waiver submission", async () => {
      const mockFlowResponse = {
        flowToken: "updated.jwt.flow.token",
        nextStep: {
          type: "REDIRECT",
          url: "/invite-friends.html?flowToken=updated.jwt.flow.token&sessionId=123",
        },
      };

      mockBookingFlowManager.continueFlow.mockResolvedValue(mockFlowResponse);

      const req = mockRequest({
        flowToken: "active.jwt.flow.token",
        stepId: "waiver_submission",
        formData: {
          firstName: "Jane",
          lastName: "Doe",
          liability_form_data: { question1: "answer1" },
          telegramId: "123456789",
          sessionTypeId: "session-type-uuid-1",
          appointmentDateTimeISO: "2025-07-15T10:00:00.000Z",
        },
      });
      const res = mockResponse();

      await bookingFlowApiHandler.handleContinueFlow(req, res);

      expect(mockBookingFlowManager.continueFlow).toHaveBeenCalledWith({
        flowToken: "active.jwt.flow.token",
        stepId: "waiver_submission",
        data: {
          firstName: "Jane",
          lastName: "Doe",
          liability_form_data: { question1: "answer1" },
          telegramId: "123456789",
          sessionTypeId: "session-type-uuid-1",
          appointmentDateTimeISO: "2025-07-15T10:00:00.000Z",
        },
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        flowToken: "updated.jwt.flow.token",
        nextStep: {
          type: "REDIRECT",
          url: "/invite-friends.html?flowToken=updated.jwt.flow.token&sessionId=123",
        },
      });
    });

    it("should successfully continue flow with friend invite acceptance", async () => {
      const mockFlowResponse = {
        nextStep: {
          type: "COMPLETE",
          message:
            "Your booking is confirmed! You will receive a message from the bot shortly.",
          closeWebApp: true,
        },
      };

      mockBookingFlowManager.continueFlow.mockResolvedValue(mockFlowResponse);

      const req = mockRequest({
        flowToken: "active.jwt.flow.token",
        stepId: "friend_invite_acceptance",
        formData: {},
      });
      const res = mockResponse();

      await bookingFlowApiHandler.handleContinueFlow(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        nextStep: {
          type: "COMPLETE",
          message:
            "Your booking is confirmed! You will receive a message from the bot shortly.",
          closeWebApp: true,
        },
      });
    });

    const continueFlowValidationTests = [
      {
        name: "missing flowToken",
        body: { stepId: "waiver_submission", formData: {} },
        expectedMessage: "Invalid input: flowToken is required.",
      },
      {
        name: "missing stepId",
        body: { flowToken: "active.jwt.flow.token", formData: {} },
        expectedMessage: "Invalid input: stepId is required.",
      },
    ];

    continueFlowValidationTests.forEach(({ name, body, expectedMessage }) => {
      it(`should return 400 for ${name}`, async () => {
        const req = mockRequest(body);
        const res = mockResponse();

        await bookingFlowApiHandler.handleContinueFlow(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: expectedMessage,
        });
      });
    });

    const continueFlowErrorTests = [
      {
        name: "invalid flow token",
        error: new Error("Invalid flow token"),
        expectedStatus: 400,
        expectedMessage: "Invalid flow token or form data.",
      },
      {
        name: "business rule violations",
        error: new Error("Slot is no longer available"),
        expectedStatus: 409,
        expectedMessage: "Slot is no longer available",
      },
      {
        name: "other internal errors",
        error: new Error("Database connection error"),
        expectedStatus: 500,
        expectedMessage:
          "An internal error occurred while continuing the flow.",
      },
    ];

    continueFlowErrorTests.forEach(
      ({ name, error, expectedStatus, expectedMessage }) => {
        it(`should return ${expectedStatus} for ${name}`, async () => {
          mockBookingFlowManager.continueFlow.mockRejectedValue(error);

          const req = mockRequest({
            flowToken: "active.jwt.flow.token",
            stepId: "waiver_submission",
            formData: {},
          });
          const res = mockResponse();

          await bookingFlowApiHandler.handleContinueFlow(req, res);

          expect(res.status).toHaveBeenCalledWith(expectedStatus);
          expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: expectedMessage,
          });
        });
      },
    );
  });
});
