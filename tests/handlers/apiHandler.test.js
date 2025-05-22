// tests/handlers/apiHandler.test.js

const { toDate } = require("date-fns");
const { formatInTimeZone } = require("date-fns-tz");

// Mock dependencies
jest.mock("date-fns", () => ({
  ...jest.requireActual("date-fns"),
  toDate: jest.fn((date) => jest.requireActual("date-fns").toDate(date)),
}));
jest.mock("date-fns-tz", () => ({
  ...jest.requireActual("date-fns-tz"),
  formatInTimeZone: jest.fn((date, tz, format) =>
    jest.requireActual("date-fns-tz").formatInTimeZone(date, tz, format),
  ),
}));

const mockPrisma = {
  users: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  sessions: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
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
  telegram: {
    editMessageText: jest.fn(),
  },
};

// Mock Express req/res objects
const mockRequest = (query = {}, body = {}) => ({
  query,
  body,
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("API Handler", () => {
  let apiHandler;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.resetModules(); // Reset modules to ensure clean state for mocks
    jest.clearAllMocks(); // Clear all mock calls
    // Explicitly reset formatInTimeZone to its default mock behavior
    formatInTimeZone.mockImplementation((date, tz, format) =>
      jest.requireActual("date-fns-tz").formatInTimeZone(date, tz, format)
    );

    // Suppress console.error for expected error tests
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    // Require the module under test after mocks are set up
    apiHandler = require("../../src/handlers/apiHandler");
  });

  afterEach(() => {
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
  });

  describe("initialize", () => {
    it("should initialize successfully with all dependencies", () => {
      expect(() =>
        apiHandler.initialize({
          prisma: mockPrisma,
          logger: mockLogger,
          telegramNotifier: mockTelegramNotifier,
          bot: mockBot,
        }),
      ).not.toThrow();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "API Handler initialized successfully with Prisma, Logger, TelegramNotifier, and Bot.",
      );
    });

    it("should throw an error if prisma is missing", () => {
      expect(() =>
        apiHandler.initialize({
          logger: mockLogger,
          telegramNotifier: mockTelegramNotifier,
          bot: mockBot,
        }),
      ).toThrow("Dependency Error: prisma client is required for apiHandler.");
    });

    it("should throw an error if logger is missing", () => {
      expect(() =>
        apiHandler.initialize({
          prisma: mockPrisma,
          telegramNotifier: mockTelegramNotifier,
          bot: mockBot,
        }),
      ).toThrow("Dependency Error: logger is required for apiHandler.");
    });

    it("should throw an error if telegramNotifier is missing", () => {
      expect(() =>
        apiHandler.initialize({
          prisma: mockPrisma,
          logger: mockLogger,
          bot: mockBot,
        }),
      ).toThrow(
        "Dependency Error: telegramNotifier is required for apiHandler.",
      );
    });

    it("should throw an error if bot is missing", () => {
      expect(() =>
        apiHandler.initialize({
          prisma: mockPrisma,
          logger: mockLogger,
          telegramNotifier: mockTelegramNotifier,
        }),
      ).toThrow("Dependency Error: bot is required for apiHandler.");
    });
  });

  describe("getUserDataApi", () => {
    beforeEach(() => {
      // Initialize with mocks before each test in this describe block
      apiHandler.initialize({
        prisma: mockPrisma,
        logger: mockLogger,
        telegramNotifier: mockTelegramNotifier,
        bot: mockBot,
      });
    });

    it("should return 400 if telegramId is missing", async () => {
      const req = mockRequest({});
      const res = mockResponse();
      await apiHandler.getUserDataApi(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Missing or invalid telegramId query parameter.",
      });
    });

    it("should return 400 if telegramId is invalid", async () => {
      const req = mockRequest({ telegramId: "abc" });
      const res = mockResponse();
      await apiHandler.getUserDataApi(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Missing or invalid telegramId query parameter.",
      });
    });

    it("should return 404 if user is not found", async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);
      const req = mockRequest({ telegramId: "12345" });
      const res = mockResponse();
      await apiHandler.getUserDataApi(req, res);
      expect(mockPrisma.users.findUnique).toHaveBeenCalledWith({
        where: { telegram_id: BigInt("12345") },
        select: expect.any(Object),
      });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "User not found.",
      });
    });

    it("should return 500 if database error occurs during fetch", async () => {
      mockPrisma.users.findUnique.mockRejectedValue(new Error("DB Error"));
      const req = mockRequest({ telegramId: "12345" });
      const res = mockResponse();
      await apiHandler.getUserDataApi(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error.",
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: new Error("DB Error") }),
        "Database error fetching user data for API.",
      );
    });

    it("should return 200 with formatted user data on success", async () => {
      const mockUser = {
        first_name: "John",
        last_name: "Doe",
        email: "john.doe@example.com",
        phone_number: "+1234567890",
        date_of_birth: new Date("1990-05-15T00:00:00.000Z"), // Stored as UTC
        booking_slot: new Date("2025-05-20T15:00:00.000Z"), // UTC
        em_first_name: "Jane",
        em_last_name: "Doe",
        em_phone_number: "+1987654321",
      };
      mockPrisma.users.findUnique.mockResolvedValue(mockUser);

      const req = mockRequest({ telegramId: "12345" });
      const res = mockResponse();
      await apiHandler.getUserDataApi(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const expectedDob = formatInTimeZone(
        mockUser.date_of_birth,
        "UTC",
        "yyyy-MM-dd",
      ); // "1990-05-15"
      const expectedAppointmentDateTime = formatInTimeZone(
        mockUser.booking_slot,
        "America/Chicago",
        "EEEE, MMMM d, yyyy - h:mm aa zzzz",
      );

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        phone: "+1234567890",
        dob: expectedDob,
        appointmentDateTime: expectedAppointmentDateTime,
        rawAppointmentDateTime: mockUser.booking_slot.toISOString(),
        emergencyFirstName: "Jane",
        emergencyLastName: "Doe",
        emergencyPhone: "+1987654321",
      });
    });

    it("should handle null date_of_birth and booking_slot gracefully", async () => {
      const mockUser = {
        first_name: "Test",
        last_name: "User",
        email: "test@example.com",
        phone_number: null,
        date_of_birth: null,
        booking_slot: null,
        em_first_name: "Em",
        em_last_name: "Contact",
        em_phone_number: "111",
      };
      mockPrisma.users.findUnique.mockResolvedValue(mockUser);
      const req = mockRequest({ telegramId: "67890" });
      const res = mockResponse();
      await apiHandler.getUserDataApi(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        phone: "",
        dob: "",
        appointmentDateTime: "Not Scheduled",
        rawAppointmentDateTime: null,
        emergencyFirstName: "Em",
        emergencyLastName: "Contact",
        emergencyPhone: "111",
      });
    });

    it("should return 500 if date formatting fails unexpectedly", async () => {
      const mockUser = {
        first_name: "Bad",
        last_name: "Date",
        date_of_birth: "invalid-date-string", // Will cause formatInTimeZone to fail
        booking_slot: new Date(),
      };
      mockPrisma.users.findUnique.mockResolvedValue(mockUser);
      // Let the actual date-fns/date-fns-tz logic throw an error with bad input
      // No specific mock override needed here for formatInTimeZone,
      // as "invalid-date-string" will cause an error during toDate or formatInTimeZone.

      const req = mockRequest({ telegramId: "123" });
      const res = mockResponse();
      await apiHandler.getUserDataApi(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Error processing user data.",
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(RangeError), // Expect a RangeError from invalid date processing
        }),
        "Error formatting user data for API.",
      );
    });
  });

  describe("submitWaiverApi", () => {
    const validFormData = {
      telegramId: "12345",
      signature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...",
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
      phone: "1234567890",
      dob: "1990-01-01",
      emergencyFirstName: "Jane",
      emergencyLastName: "Doe",
      emergencyPhone: "0987654321",
      sessionType: "Kambo Basic",
      appointmentDateTime: "2025-06-01T10:00:00.000Z",
    };

    beforeEach(() => {
      apiHandler.initialize({
        prisma: mockPrisma,
        logger: mockLogger,
        telegramNotifier: mockTelegramNotifier,
        bot: mockBot,
      });
    });

    it("should return 400 if required fields are missing", async () => {
      const req = mockRequest({}, { ...validFormData, signature: "" }); // Missing signature
      const res = mockResponse();
      await apiHandler.submitWaiverApi(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message:
          "Missing required fields (e.g., signature, emergency contact, booking info).",
      });
    });

    it("should return 400 if telegramId is invalid", async () => {
      const req = mockRequest({}, { ...validFormData, telegramId: "abc" });
      const res = mockResponse();
      await apiHandler.submitWaiverApi(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid Telegram ID format.",
      });
    });

    it("should return 404 if user is not found", async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);
      const req = mockRequest({}, validFormData);
      const res = mockResponse();
      await apiHandler.submitWaiverApi(req, res);
      expect(mockPrisma.users.findUnique).toHaveBeenCalledWith({
        where: { telegram_id: BigInt(validFormData.telegramId) },
        select: { client_id: true },
      });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "User not found.",
      });
    });

    it("should return 500 if database error occurs during session creation", async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ client_id: 1 });
      mockPrisma.sessions.create.mockRejectedValue(new Error("DB Create Error"));
      const req = mockRequest({}, validFormData);
      const res = mockResponse();
      await apiHandler.submitWaiverApi(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error processing waiver.",
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: new Error("DB Create Error") }),
        "Error processing waiver submission (DB operations).",
      );
    });

    it("should return 500 if database error occurs during user update", async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ client_id: 1 });
      mockPrisma.sessions.create.mockResolvedValue({ id: 100 });
      mockPrisma.users.update.mockRejectedValue(new Error("DB Update Error"));
      const req = mockRequest({}, validFormData);
      const res = mockResponse();
      await apiHandler.submitWaiverApi(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error processing waiver.",
      });
    });

    it("should successfully submit waiver, create session, update user, notify admin, and return 200", async () => {
      const mockUserDb = { client_id: 1 };
      const mockNewSession = { id: 101, ...validFormData }; // Simplified
      mockPrisma.users.findUnique.mockResolvedValue(mockUserDb);
      mockPrisma.sessions.create.mockResolvedValue(mockNewSession);
      mockPrisma.users.update.mockResolvedValue({}); // Assume success
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue({}); // Assume success

      const req = mockRequest({}, validFormData);
      const res = mockResponse();
      await apiHandler.submitWaiverApi(req, res);

      expect(mockPrisma.sessions.create).toHaveBeenCalledWith({
        data: {
          user_id: mockUserDb.client_id,
          telegram_id: BigInt(validFormData.telegramId),
          session_type: validFormData.sessionType,
          appointment_datetime: new Date(validFormData.appointmentDateTime),
          liability_form_data: validFormData,
          session_status: "WAIVER_SUBMITTED",
        },
      });
      expect(mockPrisma.users.update).toHaveBeenCalledWith({
        where: { telegram_id: BigInt(validFormData.telegramId) },
        data: {
          first_name: validFormData.firstName,
          last_name: validFormData.lastName,
          email: validFormData.email,
          phone_number: validFormData.phone,
          date_of_birth: new Date(validFormData.dob),
          em_first_name: validFormData.emergencyFirstName,
          em_last_name: validFormData.emergencyLastName,
          em_phone_number: validFormData.emergencyPhone,
          booking_slot: null,
          updated_at: expect.any(Date),
        },
      });
      expect(mockTelegramNotifier.sendAdminNotification).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        sessionId: mockNewSession.id,
        message: "Waiver submitted successfully.",
      });
    });

    it("should proceed even if admin notification fails", async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ client_id: 1 });
      mockPrisma.sessions.create.mockResolvedValue({ id: 102 });
      mockPrisma.users.update.mockResolvedValue({});
      mockTelegramNotifier.sendAdminNotification.mockRejectedValue(
        new Error("Notify Error"),
      );

      const req = mockRequest({}, validFormData);
      const res = mockResponse();
      await apiHandler.submitWaiverApi(req, res);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: new Error("Notify Error") }),
        "Failed to send admin notification for waiver submission.",
      );
      expect(res.status).toHaveBeenCalledWith(200); // Still succeeds
    });
  });

  describe("waiverCompletedWebhook", () => {
    const validWebhookBody = {
      telegramId: "12345",
      sessionId: 101,
    };

    beforeEach(() => {
      apiHandler.initialize({
        prisma: mockPrisma,
        logger: mockLogger,
        telegramNotifier: mockTelegramNotifier,
        bot: mockBot,
      });
    });

    it("should return 400 if telegramId or sessionId is missing or invalid", async () => {
      const reqInvalidTg = mockRequest(
        {},
        { ...validWebhookBody, telegramId: "abc" },
      );
      const resInvalidTg = mockResponse();
      await apiHandler.waiverCompletedWebhook(reqInvalidTg, resInvalidTg);
      expect(resInvalidTg.status).toHaveBeenCalledWith(400);
      expect(resInvalidTg.json).toHaveBeenCalledWith({
        success: false,
        message: "Missing or invalid telegramId or sessionId.",
      });

      const reqMissingSession = mockRequest(
        {},
        { telegramId: "12345" /* sessionId missing */ },
      );
      const resMissingSession = mockResponse();
      await apiHandler.waiverCompletedWebhook(
        reqMissingSession,
        resMissingSession,
      );
      expect(resMissingSession.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 if user is not found", async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);
      const req = mockRequest({}, validWebhookBody);
      const res = mockResponse();
      await apiHandler.waiverCompletedWebhook(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "User not found.",
      });
    });

    it("should return 404 if session is not found", async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ edit_msg_id: 987 });
      mockPrisma.sessions.findUnique.mockResolvedValue(null);
      const req = mockRequest({}, validWebhookBody);
      const res = mockResponse();
      await apiHandler.waiverCompletedWebhook(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Session not found.",
      });
    });

    it("should return 500 if database error occurs during session update", async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ edit_msg_id: 987 });
      mockPrisma.sessions.findUnique.mockResolvedValue({
        appointment_datetime: new Date(),
      });
      mockPrisma.sessions.update.mockRejectedValue(new Error("DB Update Error"));
      const req = mockRequest({}, validWebhookBody);
      const res = mockResponse();
      await apiHandler.waiverCompletedWebhook(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error processing waiver completion.",
      });
    });

    it("should successfully process waiver completion, update session, clear edit_msg_id, edit Telegram message, and return 200", async () => {
      const mockUserDb = { edit_msg_id: 9876 };
      const mockSessionDb = {
        appointment_datetime: new Date("2025-07-01T14:30:00.000Z"),
      };
      mockPrisma.users.findUnique.mockResolvedValue(mockUserDb);
      mockPrisma.sessions.findUnique.mockResolvedValue(mockSessionDb);
      mockPrisma.sessions.update.mockResolvedValue({});
      mockPrisma.users.update.mockResolvedValue({});
      mockBot.telegram.editMessageText.mockResolvedValue({});

      const req = mockRequest({}, validWebhookBody);
      const res = mockResponse();
      await apiHandler.waiverCompletedWebhook(req, res);

      expect(mockPrisma.sessions.update).toHaveBeenCalledWith({
        where: { id: validWebhookBody.sessionId },
        data: { session_status: "CONFIRMED" },
      });
      expect(mockPrisma.users.update).toHaveBeenCalledWith({
        where: { telegram_id: BigInt(validWebhookBody.telegramId) },
        data: { edit_msg_id: null },
      });

      const expectedFormattedDate = formatInTimeZone(
        mockSessionDb.appointment_datetime,
        "America/Chicago",
        "EEEE, MMMM d, yyyy - h:mm aaaa zzzz",
      );
      const expectedConfirmationMessage = `✅ <b>Booking Confirmed!</b>\n\nYour Kambo session is scheduled for:\n<b>${expectedFormattedDate}</b>\n\nYou will receive reminders before your appointment.\nUse /cancel to manage this booking.`;

      expect(mockBot.telegram.editMessageText).toHaveBeenCalledWith(
        validWebhookBody.telegramId, // chatId
        mockUserDb.edit_msg_id, // originalMessageId
        undefined, // inline_message_id
        expectedConfirmationMessage,
        {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [] },
        },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Waiver completion processed.",
      });
    });

    it("should proceed and return 200 even if Telegram message edit fails", async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ edit_msg_id: 987 });
      mockPrisma.sessions.findUnique.mockResolvedValue({
        appointment_datetime: new Date(),
      });
      mockPrisma.sessions.update.mockResolvedValue({});
      mockPrisma.users.update.mockResolvedValue({});
      mockBot.telegram.editMessageText.mockRejectedValue(
        new Error("TG Edit Error"),
      );

      const req = mockRequest({}, validWebhookBody);
      const res = mockResponse();
      await apiHandler.waiverCompletedWebhook(req, res);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: { message: "TG Edit Error", code: undefined },
        }),
        "Failed to edit original booking message.",
      );
      expect(res.status).toHaveBeenCalledWith(200); // Still succeeds
    });

    it("should proceed and return 200 if user.edit_msg_id is null (no message to edit)", async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ edit_msg_id: null }); // No message ID
      mockPrisma.sessions.findUnique.mockResolvedValue({
        appointment_datetime: new Date(),
      });
      mockPrisma.sessions.update.mockResolvedValue({});
      // users.update for edit_msg_id should not be called if it's already null

      const req = mockRequest({}, validWebhookBody);
      const res = mockResponse();
      await apiHandler.waiverCompletedWebhook(req, res);

      expect(mockPrisma.users.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { edit_msg_id: null } }),
      );
      expect(mockBot.telegram.editMessageText).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        {
          telegramId: BigInt(validWebhookBody.telegramId),
          sessionId: validWebhookBody.sessionId,
        },
        "No original message ID (edit_msg_id) found for user, cannot edit Telegram message.",
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});