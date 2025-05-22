// tests/handlers/registrationHandler.test.js

const mockPrisma = {
  users: {
    upsert: jest.fn(),
  },
};
const mockTelegramNotifier = {
  sendAdminNotification: jest.fn(),
  sendTextMessage: jest.fn(),
};
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock Express req/res objects
const mockRequest = (body = {}) => ({
  body,
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("Registration Handler", () => {
  let registrationHandler;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    registrationHandler = require("../../src/handlers/registrationHandler");
  });

  afterEach(() => {
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
  });

  describe("initialize", () => {
    it("should initialize successfully with all dependencies", () => {
      expect(() =>
        registrationHandler.initialize({
          prisma: mockPrisma,
          telegramNotifier: mockTelegramNotifier,
          logger: mockLogger,
        }),
      ).not.toThrow();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "registrationHandler initialized successfully.",
      );
    });

    it("should throw an error if prisma is missing", () => {
      expect(() =>
        registrationHandler.initialize({
          telegramNotifier: mockTelegramNotifier,
          logger: mockLogger,
        }),
      ).toThrow("Prisma client dependency is missing for registrationHandler");
    });

    it("should throw an error if telegramNotifier is missing", () => {
      expect(() =>
        registrationHandler.initialize({
          prisma: mockPrisma,
          logger: mockLogger,
        }),
      ).toThrow(
        "TelegramNotifier dependency is missing for registrationHandler",
      );
    });

    it("should throw an error if logger is missing", () => {
      expect(() =>
        registrationHandler.initialize({
          prisma: mockPrisma,
          telegramNotifier: mockTelegramNotifier,
        }),
      ).toThrow("Logger dependency is missing for registrationHandler");
    });
  });

  describe("handleRegistrationSubmit", () => {
    const validFormData = {
      telegramId: "123456789",
      firstName: "Test",
      lastName: "User",
      email: "test.user@example.com",
      phoneNumber: "1234567890",
      dateOfBirth: "1990-01-01",
      reasonForSeeking: "Testing",
      is_veteran_or_responder: "true",
    };

    beforeEach(() => {
      registrationHandler.initialize({
        prisma: mockPrisma,
        telegramNotifier: mockTelegramNotifier,
        logger: mockLogger,
      });
    });

    it("should return 400 if required fields are missing", async () => {
      const req = mockRequest({ ...validFormData, firstName: "" }); // Missing firstName
      const res = mockResponse();
      await registrationHandler.handleRegistrationSubmit(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Missing required fields.",
      });
    });

    it("should return 400 if telegramId format is invalid", async () => {
      const req = mockRequest({ ...validFormData, telegramId: "abc" });
      const res = mockResponse();
      await registrationHandler.handleRegistrationSubmit(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid Telegram ID format.",
      });
    });

    it("should return 500 if database upsert fails", async () => {
      mockPrisma.users.upsert.mockRejectedValue(new Error("DB Upsert Error"));
      const req = mockRequest(validFormData);
      const res = mockResponse();
      await registrationHandler.handleRegistrationSubmit(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Database error during registration.",
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: new Error("DB Upsert Error") }),
        "Error saving user registration data to DB.",
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Full Prisma error object:",
        new Error("DB Upsert Error"),
      );
    });

    it("should successfully register user, send notifications, and return 201 (create path)", async () => {
      const mockSavedUser = { client_id: 1, ...validFormData };
      mockPrisma.users.upsert.mockResolvedValue(mockSavedUser);
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true);
      mockTelegramNotifier.sendTextMessage.mockResolvedValue(true);

      const req = mockRequest(validFormData);
      const res = mockResponse();
      await registrationHandler.handleRegistrationSubmit(req, res);

      const expectedTelegramIdBigInt = BigInt(validFormData.telegramId);
      const expectedUserData = {
        telegram_id: expectedTelegramIdBigInt,
        first_name: validFormData.firstName,
        last_name: validFormData.lastName,
        email: validFormData.email,
        phone_number: validFormData.phoneNumber,
        date_of_birth: new Date(validFormData.dateOfBirth),
        reason_for_seeking: validFormData.reasonForSeeking,
        is_veteran_or_responder: true,
        role: "client",
        state: "NONE",
        active_session_id: null,
      };

      expect(mockPrisma.users.upsert).toHaveBeenCalledWith({
        where: { telegram_id: expectedTelegramIdBigInt },
        update: { ...expectedUserData, updated_at: expect.any(Date) },
        create: expectedUserData,
      });

      expect(mockTelegramNotifier.sendAdminNotification).toHaveBeenCalled();
      expect(mockTelegramNotifier.sendTextMessage).toHaveBeenCalledWith({
        telegramId: validFormData.telegramId,
        text: `🎉 Welcome to the Kambo Klarity tribe, ${validFormData.firstName}! You are now registered.\n\nYou can use /book to schedule a session or /help for commands.`,
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Registration successful!",
        userId: mockSavedUser.client_id,
      });
    });

    it("should handle is_veteran_or_responder as false if not provided or not 'true'", async () => {
      const formDataNoVeteran = {
        ...validFormData,
        is_veteran_or_responder: undefined,
      };
      const mockSavedUser = { client_id: 2, ...formDataNoVeteran };
      mockPrisma.users.upsert.mockResolvedValue(mockSavedUser);
      const req = mockRequest(formDataNoVeteran);
      const res = mockResponse();
      await registrationHandler.handleRegistrationSubmit(req, res);

      const _expectedTelegramIdBigInt = BigInt(formDataNoVeteran.telegramId);
      expect(mockPrisma.users.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ is_veteran_or_responder: false }),
          update: expect.objectContaining({ is_veteran_or_responder: false }),
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("should proceed with registration even if admin notification fails", async () => {
      const mockSavedUser = { client_id: 3, ...validFormData };
      mockPrisma.users.upsert.mockResolvedValue(mockSavedUser);
      mockTelegramNotifier.sendAdminNotification.mockRejectedValue(
        new Error("Admin Notify Fail"),
      );
      mockTelegramNotifier.sendTextMessage.mockResolvedValue(true); // Client notification succeeds

      const req = mockRequest(validFormData);
      const res = mockResponse();
      await registrationHandler.handleRegistrationSubmit(req, res);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: new Error("Admin Notify Fail") }),
        "Error sending notifications after registration.",
      );
      expect(res.status).toHaveBeenCalledWith(201); // Still successful
      // If admin notification fails, the client welcome message in the same try block is also skipped.
      expect(mockTelegramNotifier.sendTextMessage).not.toHaveBeenCalled();
    });

    it("should proceed with registration even if client welcome message fails", async () => {
      const mockSavedUser = { client_id: 4, ...validFormData };
      mockPrisma.users.upsert.mockResolvedValue(mockSavedUser);
      mockTelegramNotifier.sendAdminNotification.mockResolvedValue(true); // Admin notification succeeds
      mockTelegramNotifier.sendTextMessage.mockRejectedValue(
        new Error("Client Notify Fail"),
      );

      const req = mockRequest(validFormData);
      const res = mockResponse();
      await registrationHandler.handleRegistrationSubmit(req, res);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: new Error("Client Notify Fail") }),
        "Error sending notifications after registration.",
      );
      expect(res.status).toHaveBeenCalledWith(201); // Still successful
      expect(mockTelegramNotifier.sendAdminNotification).toHaveBeenCalled(); // Admin still notified
    });

    it("should return 400 if dateOfBirth is null (due to !dateOfBirth validation)", async () => {
      const formDataNullDob = { ...validFormData, dateOfBirth: null };
      // No need to mock upsert as validation should fail first
      // const mockSavedUser = { client_id: 5, ...formDataNullDob };
      // mockPrisma.users.upsert.mockResolvedValue(mockSavedUser);
      const req = mockRequest(formDataNullDob);
      const res = mockResponse();
      await registrationHandler.handleRegistrationSubmit(req, res);

      expect(mockPrisma.users.upsert).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Missing required fields.", // Because !null is true
      });
    });
  });
});
