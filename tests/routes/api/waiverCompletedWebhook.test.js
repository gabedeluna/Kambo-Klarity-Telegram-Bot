/**
 * @fileoverview Unit tests for the waiverCompletedWebhook handler.
 */

const apiHandler = require("../../../src/handlers/apiHandler"); // Adjusted path
// const { PrismaClient } = require("@prisma/client"); // Not strictly needed

// Mock dependencies
jest.mock("../../../src/core/prisma", () => ({
  // Adjusted path
  users: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  sessions: {
    // create: jest.fn(), // Not used by waiverCompletedWebhook
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}));
const prismaMock = require("../../../src/core/prisma"); // Adjusted path

const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(), // Though not directly used by waiverCompletedWebhook
};

const telegramNotifierMock = {
  // Not used by waiverCompletedWebhook, but part of apiHandler init
  sendAdminNotification: jest.fn(),
};

const botMock = {
  telegram: {
    editMessageText: jest.fn(),
  },
};

// Mock date-fns-tz functions
jest.mock("date-fns-tz", () => ({
  ...jest.requireActual("date-fns-tz"),
  formatInTimeZone: jest.fn(),
  toDate: jest.fn((date) => jest.requireActual("date-fns-tz").toDate(date)),
}));
const { formatInTimeZone, toDate: _toDate } = require("date-fns-tz");

describe("API Handler - waiverCompletedWebhook", () => {
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
      query: {}, // Not used by waiverCompletedWebhook
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    formatInTimeZone.mockReset();
  });

  afterEach(() => {
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
  });

  // waiverCompletedWebhook tests (lines 626-872 from original api.test.js)
  const validWebhookPayload = {
    telegramId: "987654321",
    sessionId: 202,
  };

  it("should return 400 if telegramId is missing", async () => {
    req.body = { ...validWebhookPayload, telegramId: undefined };
    await apiHandler.waiverCompletedWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Missing or invalid telegramId or sessionId.",
    });
    expect(loggerMock.warn).toHaveBeenCalledWith(
      { body: req.body },
      "Missing or invalid telegramId/sessionId in /waiver-completed request.",
    );
  });

  it("should return 400 if sessionId is missing", async () => {
    req.body = { ...validWebhookPayload, sessionId: undefined };
    await apiHandler.waiverCompletedWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Missing or invalid telegramId or sessionId.",
    });
  });

  it("should return 400 if telegramId is invalid format", async () => {
    req.body = { ...validWebhookPayload, telegramId: "invalid-tg-id" };
    await apiHandler.waiverCompletedWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Missing or invalid telegramId or sessionId.",
    });
  });

  it("should return 400 if sessionId is not a number", async () => {
    req.body = { ...validWebhookPayload, sessionId: "not-a-number" };
    await apiHandler.waiverCompletedWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Missing or invalid telegramId or sessionId.",
    });
  });

  it("should return 404 if user not found", async () => {
    req.body = validWebhookPayload;
    prismaMock.users.findUnique.mockResolvedValue(null);
    await apiHandler.waiverCompletedWebhook(req, res);
    expect(prismaMock.users.findUnique).toHaveBeenCalledWith({
      where: { telegram_id: BigInt(validWebhookPayload.telegramId) },
      select: { edit_msg_id: true },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "User not found.",
    });
    expect(loggerMock.error).toHaveBeenCalledWith(
      { telegramId: BigInt(validWebhookPayload.telegramId) },
      "User not found processing waiver completion.",
    );
  });

  it("should return 404 if session not found", async () => {
    req.body = validWebhookPayload;
    prismaMock.users.findUnique.mockResolvedValue({ edit_msg_id: 12345 });
    prismaMock.sessions.findUnique.mockResolvedValue(null);
    await apiHandler.waiverCompletedWebhook(req, res);
    expect(prismaMock.sessions.findUnique).toHaveBeenCalledWith({
      where: { id: validWebhookPayload.sessionId },
      select: { appointment_datetime: true },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Session not found.",
    });
    expect(loggerMock.error).toHaveBeenCalledWith(
      {
        telegramId: BigInt(validWebhookPayload.telegramId),
        sessionId: validWebhookPayload.sessionId,
      },
      "Session not found processing waiver completion.",
    );
  });

  it("should successfully process waiver completion, update DB, and edit message if edit_msg_id exists", async () => {
    req.body = validWebhookPayload;
    const mockUser = { edit_msg_id: 54321 };
    const mockSession = {
      appointment_datetime: new Date("2025-09-10T12:00:00.000Z"),
    };
    const formattedDate =
      "Wednesday, September 10, 2025 - 7:00 AM Central Daylight Time";

    prismaMock.users.findUnique.mockResolvedValue(mockUser);
    prismaMock.sessions.findUnique.mockResolvedValue(mockSession);
    prismaMock.sessions.update.mockResolvedValue({});
    prismaMock.users.update.mockResolvedValue({});
    botMock.telegram.editMessageText.mockResolvedValue({});
    formatInTimeZone.mockReturnValue(formattedDate);

    await apiHandler.waiverCompletedWebhook(req, res);

    expect(prismaMock.users.findUnique).toHaveBeenCalledWith({
      where: { telegram_id: BigInt(validWebhookPayload.telegramId) },
      select: { edit_msg_id: true },
    });
    expect(prismaMock.sessions.findUnique).toHaveBeenCalledWith({
      where: { id: validWebhookPayload.sessionId },
      select: { appointment_datetime: true },
    });
    expect(prismaMock.sessions.update).toHaveBeenCalledWith({
      where: { id: validWebhookPayload.sessionId },
      data: { session_status: "CONFIRMED" },
    });
    expect(prismaMock.users.update).toHaveBeenCalledWith({
      where: { telegram_id: BigInt(validWebhookPayload.telegramId) },
      data: { edit_msg_id: null },
    });
    expect(formatInTimeZone).toHaveBeenCalledWith(
      mockSession.appointment_datetime,
      "America/Chicago",
      "EEEE, MMMM d, yyyy - h:mm aaaa zzzz",
    );
    expect(botMock.telegram.editMessageText).toHaveBeenCalledWith(
      validWebhookPayload.telegramId.toString(),
      mockUser.edit_msg_id,
      undefined,
      `✅ <b>Booking Confirmed!</b>\n\nYour Kambo session is scheduled for:\n<b>${formattedDate}</b>\n\nYou will receive reminders before your appointment.\nUse /cancel to manage this booking.`,
      { parse_mode: "HTML", reply_markup: { inline_keyboard: [] } },
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Waiver completion processed.",
    });
    expect(loggerMock.info).toHaveBeenCalledWith(
      {
        telegramId: BigInt(validWebhookPayload.telegramId),
        sessionId: validWebhookPayload.sessionId,
      },
      "Session status updated to CONFIRMED.",
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      { telegramId: BigInt(validWebhookPayload.telegramId) },
      "Cleared edit_msg_id for user.",
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      {
        telegramId: BigInt(validWebhookPayload.telegramId),
        messageId: mockUser.edit_msg_id,
      },
      "Successfully edited original booking message to confirmed.",
    );
  });

  it("should process successfully but not edit message if edit_msg_id is null", async () => {
    req.body = validWebhookPayload;
    const mockUserNoEditId = { edit_msg_id: null };
    const mockSession = { appointment_datetime: new Date() };

    prismaMock.users.findUnique.mockResolvedValue(mockUserNoEditId);
    prismaMock.sessions.findUnique.mockResolvedValue(mockSession);
    prismaMock.sessions.update.mockResolvedValue({});

    await apiHandler.waiverCompletedWebhook(req, res);

    expect(prismaMock.sessions.update).toHaveBeenCalledWith({
      where: { id: validWebhookPayload.sessionId },
      data: { session_status: "CONFIRMED" },
    });
    expect(prismaMock.users.update).not.toHaveBeenCalled(); // edit_msg_id is already null
    expect(botMock.telegram.editMessageText).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Waiver completion processed.",
    });
    expect(loggerMock.warn).toHaveBeenCalledWith(
      {
        telegramId: BigInt(validWebhookPayload.telegramId),
        sessionId: validWebhookPayload.sessionId,
      },
      "No original message ID (edit_msg_id) found for user, cannot edit Telegram message.",
    );
  });

  it("should return 500 if DB error on finding user", async () => {
    req.body = validWebhookPayload;
    const dbError = new Error("DB User Find Error");
    prismaMock.users.findUnique.mockRejectedValue(dbError);
    await apiHandler.waiverCompletedWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Internal server error processing waiver completion.",
    });
    expect(loggerMock.error).toHaveBeenCalledWith(
      {
        err: dbError,
        telegramId: BigInt(validWebhookPayload.telegramId),
        sessionId: validWebhookPayload.sessionId,
      },
      "Error processing waiver completion webhook.",
    );
  });

  it("should return 500 if DB error on finding session", async () => {
    req.body = validWebhookPayload;
    prismaMock.users.findUnique.mockResolvedValue({ edit_msg_id: 123 });
    const dbError = new Error("DB Session Find Error");
    prismaMock.sessions.findUnique.mockRejectedValue(dbError);
    await apiHandler.waiverCompletedWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Internal server error processing waiver completion.",
    });
    expect(loggerMock.error).toHaveBeenCalledWith(
      {
        err: dbError,
        telegramId: BigInt(validWebhookPayload.telegramId),
        sessionId: validWebhookPayload.sessionId,
      },
      "Error processing waiver completion webhook.",
    );
  });

  it("should return 500 if DB error on updating session", async () => {
    req.body = validWebhookPayload;
    prismaMock.users.findUnique.mockResolvedValue({ edit_msg_id: 123 });
    prismaMock.sessions.findUnique.mockResolvedValue({
      appointment_datetime: new Date(),
    });
    const dbError = new Error("DB Session Update Error");
    prismaMock.sessions.update.mockRejectedValue(dbError);
    await apiHandler.waiverCompletedWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Internal server error processing waiver completion.",
    });
    expect(loggerMock.error).toHaveBeenCalledWith(
      {
        err: dbError,
        telegramId: BigInt(validWebhookPayload.telegramId),
        sessionId: validWebhookPayload.sessionId,
      },
      "Error processing waiver completion webhook.",
    );
  });

  it("should return 500 if DB error on updating user (clearing edit_msg_id)", async () => {
    req.body = validWebhookPayload;
    prismaMock.users.findUnique.mockResolvedValue({ edit_msg_id: 123 });
    prismaMock.sessions.findUnique.mockResolvedValue({
      appointment_datetime: new Date(),
    });
    prismaMock.sessions.update.mockResolvedValue({});
    const dbError = new Error("DB User Update Error");
    prismaMock.users.update.mockRejectedValue(dbError); // This is the one that fails
    await apiHandler.waiverCompletedWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Internal server error processing waiver completion.",
    });
    expect(loggerMock.error).toHaveBeenCalledWith(
      {
        err: dbError,
        telegramId: BigInt(validWebhookPayload.telegramId),
        sessionId: validWebhookPayload.sessionId,
      },
      "Error processing waiver completion webhook.",
    );
  });

  it("should return 200 but log error if bot.telegram.editMessageText fails", async () => {
    req.body = validWebhookPayload;
    const mockUser = { edit_msg_id: 54321 };
    const mockSession = { appointment_datetime: new Date() };
    const editError = new Error("Telegram API Error");
    editError.response = { description: "Chat not found" };
    editError.code = 400;

    prismaMock.users.findUnique.mockResolvedValue(mockUser);
    prismaMock.sessions.findUnique.mockResolvedValue(mockSession);
    prismaMock.sessions.update.mockResolvedValue({});
    prismaMock.users.update.mockResolvedValue({});
    botMock.telegram.editMessageText.mockRejectedValue(editError);
    formatInTimeZone.mockReturnValue("Formatted Date");

    await apiHandler.waiverCompletedWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Waiver completion processed.",
    });
    expect(loggerMock.error).toHaveBeenCalledWith(
      {
        err: { message: "Chat not found", code: 400 },
        telegramId: BigInt(validWebhookPayload.telegramId),
        messageId: mockUser.edit_msg_id,
      },
      "Failed to edit original booking message.",
    );
  });
});
