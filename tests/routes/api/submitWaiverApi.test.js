/**
 * @fileoverview Unit tests for the submitWaiverApi handler.
 */

const apiHandler = require("../../../src/handlers/apiHandler"); // Adjusted path
// const { PrismaClient } = require("@prisma/client"); // Not strictly needed

// Mock dependencies
jest.mock("../../../src/core/prisma", () => ({ // Adjusted path
  users: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  sessions: {
    create: jest.fn(),
    // findUnique: jest.fn(), // Not directly used by submitWaiverApi
    // update: jest.fn(), // Not directly used by submitWaiverApi
  },
}));
const prismaMock = require("../../../src/core/prisma"); // Adjusted path

const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const telegramNotifierMock = {
  sendAdminNotification: jest.fn(),
};

const botMock = { // Not used by submitWaiverApi, but part of apiHandler init
  telegram: {
    editMessageText: jest.fn(),
  },
};

// Mock date-fns-tz - not directly used by submitWaiverApi but good to keep if other parts of apiHandler use it
jest.mock('date-fns-tz', () => ({
  ...jest.requireActual('date-fns-tz'),
  formatInTimeZone: jest.fn(),
  toDate: jest.fn((date) => jest.requireActual('date-fns-tz').toDate(date)),
}));
// const { formatInTimeZone, toDate } = require('date-fns-tz'); // Not directly used here

describe("API Handler - submitWaiverApi", () => {
  let req, res;
  let consoleErrorSpy;

  beforeAll(() => {
    apiHandler.initialize({
      prisma: prismaMock,
      logger: loggerMock,
      telegramNotifier: telegramNotifierMock,
      bot: botMock,
    });
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    req = {
      query: {}, // Not used by submitWaiverApi
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // formatInTimeZone.mockReset(); // Not directly used here
  });

  afterEach(() => {
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
  });

  // submitWaiverApi tests (lines 367-624 from original api.test.js)
  const validFormData = {
    telegramId: "123456789",
    signature: "UserSignatureData",
    firstName: "Test",
    lastName: "User",
    email: "test.user@example.com",
    phone: "1234567890",
    dob: "1990-05-15",
    emergencyFirstName: "Emergency",
    emergencyLastName: "Contact",
    emergencyPhone: "0987654321",
    sessionType: "STANDARD_SESSION",
    appointmentDateTime: "2025-08-15T14:00:00.000Z",
  };

  it("should return 400 if required fields are missing", async () => {
    req.body = { ...validFormData, signature: undefined };
    await apiHandler.submitWaiverApi(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Missing required fields (e.g., signature, emergency contact, booking info).",
    });
    expect(loggerMock.warn).toHaveBeenCalledWith(
      { telegramIdString: validFormData.telegramId, signatureProvided: false },
      "Missing required waiver submission fields.",
    );
  });

  it("should return 400 if telegramId is invalid format", async () => {
    req.body = { ...validFormData, telegramId: "invalid-id" };
    await apiHandler.submitWaiverApi(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid Telegram ID format.",
    });
    expect(loggerMock.warn).toHaveBeenCalledWith(
      expect.objectContaining({ telegramIdString: "invalid-id", error: expect.any(String) }),
      "Invalid Telegram ID format in waiver submission.",
    );
  });

  it("should return 404 if user is not found", async () => {
    req.body = validFormData;
    prismaMock.users.findUnique.mockResolvedValue(null);
    await apiHandler.submitWaiverApi(req, res);
    expect(prismaMock.users.findUnique).toHaveBeenCalledWith({
      where: { telegram_id: BigInt(validFormData.telegramId) },
      select: { client_id: true },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "User not found.",
    });
    expect(loggerMock.error).toHaveBeenCalledWith(
      { telegramId: BigInt(validFormData.telegramId) },
      "User not found during waiver submission.",
    );
  });

  it("should return 500 if DB error on finding user", async () => {
    req.body = validFormData;
    const dbError = new Error("DB Find User Error");
    prismaMock.users.findUnique.mockRejectedValue(dbError);
    await apiHandler.submitWaiverApi(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Internal server error processing waiver.",
    });
    expect(loggerMock.error).toHaveBeenCalledWith(
      { err: dbError, telegramId: BigInt(validFormData.telegramId) },
      "Error processing waiver submission (DB operations).",
    );
  });

  it("should successfully submit waiver, create session, update user, and notify admin", async () => {
    req.body = validFormData;
    const mockUser = { client_id: 1 };
    const mockNewSession = { id: 101, ...validFormData };

    prismaMock.users.findUnique.mockResolvedValue(mockUser);
    prismaMock.sessions.create.mockResolvedValue(mockNewSession);
    prismaMock.users.update.mockResolvedValue({});
    telegramNotifierMock.sendAdminNotification.mockResolvedValue({});

    await apiHandler.submitWaiverApi(req, res);

    expect(prismaMock.users.findUnique).toHaveBeenCalledWith({
      where: { telegram_id: BigInt(validFormData.telegramId) },
      select: { client_id: true },
    });
    expect(prismaMock.sessions.create).toHaveBeenCalledWith({
      data: {
        user_id: mockUser.client_id,
        telegram_id: BigInt(validFormData.telegramId),
        session_type: validFormData.sessionType,
        appointment_datetime: new Date(validFormData.appointmentDateTime),
        liability_form_data: validFormData,
        session_status: "WAIVER_SUBMITTED",
      },
    });
    expect(prismaMock.users.update).toHaveBeenCalledWith({
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
    expect(telegramNotifierMock.sendAdminNotification).toHaveBeenCalledWith({
      text: ` Waiver Submitted:\nClient: ${validFormData.firstName} ${validFormData.lastName} (TG ID: ${validFormData.telegramId})\nSession: ${validFormData.sessionType}\nTime: ${new Date(validFormData.appointmentDateTime).toLocaleString("en-US", { timeZone: "America/Chicago" })}`,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      sessionId: mockNewSession.id,
      message: "Waiver submitted successfully.",
    });
    expect(loggerMock.info).toHaveBeenCalledWith(
      { telegramId: BigInt(validFormData.telegramId), sessionId: mockNewSession.id },
      "Session record created.",
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      { telegramId: BigInt(validFormData.telegramId) },
      "User record updated with waiver data.",
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      { telegramId: BigInt(validFormData.telegramId) },
      "Sent admin notification for waiver submission.",
    );
  });

  it("should return 500 if DB error on creating session", async () => {
    req.body = validFormData;
    const mockUser = { client_id: 1 };
    prismaMock.users.findUnique.mockResolvedValue(mockUser);
    const dbError = new Error("DB Create Session Error");
    prismaMock.sessions.create.mockRejectedValue(dbError);

    await apiHandler.submitWaiverApi(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Internal server error processing waiver.",
    });
    expect(loggerMock.error).toHaveBeenCalledWith(
      { err: dbError, telegramId: BigInt(validFormData.telegramId) },
      "Error processing waiver submission (DB operations).",
    );
  });

  it("should return 500 if DB error on updating user", async () => {
    req.body = validFormData;
    const mockUser = { client_id: 1 };
    const mockNewSession = { id: 101 };
    prismaMock.users.findUnique.mockResolvedValue(mockUser);
    prismaMock.sessions.create.mockResolvedValue(mockNewSession);
    const dbError = new Error("DB Update User Error");
    prismaMock.users.update.mockRejectedValue(dbError);

    await apiHandler.submitWaiverApi(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Internal server error processing waiver.",
    });
    expect(loggerMock.error).toHaveBeenCalledWith(
      { err: dbError, telegramId: BigInt(validFormData.telegramId) },
      "Error processing waiver submission (DB operations).",
    );
  });

  it("should still return 200 if admin notification fails, but log error", async () => {
    req.body = validFormData;
    const mockUser = { client_id: 1 };
    const mockNewSession = { id: 101 };
    prismaMock.users.findUnique.mockResolvedValue(mockUser);
    prismaMock.sessions.create.mockResolvedValue(mockNewSession);
    prismaMock.users.update.mockResolvedValue({});
    const notifyError = new Error("Notify Admin Error");
    telegramNotifierMock.sendAdminNotification.mockRejectedValue(notifyError);

    await apiHandler.submitWaiverApi(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      sessionId: mockNewSession.id,
      message: "Waiver submitted successfully.",
    });
    expect(loggerMock.error).toHaveBeenCalledWith(
      { err: notifyError, telegramId: BigInt(validFormData.telegramId) },
      "Failed to send admin notification for waiver submission.",
    );
  });

  it("should handle optional fields (firstName, lastName, email, phone, dob) being undefined", async () => {
      const partialFormData = {
          ...validFormData,
          firstName: undefined,
          lastName: undefined,
          email: undefined,
          phone: undefined,
          dob: undefined,
      };
      req.body = partialFormData;
      const mockUser = { client_id: 1 };
      const mockNewSession = { id: 101 };

      prismaMock.users.findUnique.mockResolvedValue(mockUser);
      prismaMock.sessions.create.mockResolvedValue(mockNewSession);
      prismaMock.users.update.mockResolvedValue({});
      telegramNotifierMock.sendAdminNotification.mockResolvedValue({});

      await apiHandler.submitWaiverApi(req, res);

      expect(prismaMock.users.update).toHaveBeenCalledWith({
          where: { telegram_id: BigInt(partialFormData.telegramId) },
          data: {
            first_name: undefined,
            last_name: undefined,
            email: undefined,
            phone_number: undefined,
            date_of_birth: undefined,
            em_first_name: partialFormData.emergencyFirstName,
            em_last_name: partialFormData.emergencyLastName,
            em_phone_number: partialFormData.emergencyPhone,
            booking_slot: null,
            updated_at: expect.any(Date),
          },
        });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(telegramNotifierMock.sendAdminNotification).toHaveBeenCalledWith({
          text: ` Waiver Submitted:\nClient: N/A N/A (TG ID: ${partialFormData.telegramId})\nSession: ${partialFormData.sessionType}\nTime: ${new Date(partialFormData.appointmentDateTime).toLocaleString("en-US", { timeZone: "America/Chicago" })}`,
      });
  });
});