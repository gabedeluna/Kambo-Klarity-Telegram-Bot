/**
 * @fileoverview Unit tests for the getUserDataApi handler.
 */

const apiHandler = require("../../../src/handlers/apiHandler"); // Adjusted path
// const { PrismaClient } = require("@prisma/client"); // Not strictly needed if only using mocks

// Mock dependencies
jest.mock("../../../src/core/prisma", () => ({
  // Adjusted path
  users: {
    findUnique: jest.fn(),
    // update: jest.fn(), // Not used by getUserDataApi
  },
  // sessions: { // Not used by getUserDataApi
  //   create: jest.fn(),
  //   findUnique: jest.fn(),
  //   update: jest.fn(),
  // },
}));
const prismaMock = require("../../../src/core/prisma"); // Adjusted path

const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(), // Though not directly used by getUserDataApi, keep for consistency
};

const telegramNotifierMock = {
  // Not used by getUserDataApi, but part of apiHandler init
  sendAdminNotification: jest.fn(),
};

const botMock = {
  // Not used by getUserDataApi, but part of apiHandler init
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

describe("API Handler - getUserDataApi", () => {
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
    jest.resetModules(); // Important if apiHandler itself was mocked or had internal state
    jest.clearAllMocks();

    req = {
      query: {},
      body: {}, // Not used by getUserDataApi but good for consistency
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

  // getUserDataApi tests (lines 92-365 from original api.test.js)
  it("should return 400 if telegramId is missing", async () => {
    await apiHandler.getUserDataApi(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Missing or invalid telegramId query parameter.",
    });
    expect(loggerMock.warn).toHaveBeenCalledWith(
      { query: {} },
      "Missing or invalid telegramId query parameter.",
    );
  });

  it("should return 400 if telegramId is invalid", async () => {
    req.query.telegramId = "invalidId";
    await apiHandler.getUserDataApi(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Missing or invalid telegramId query parameter.",
    });
    expect(loggerMock.warn).toHaveBeenCalledWith(
      { query: { telegramId: "invalidId" } },
      "Missing or invalid telegramId query parameter.",
    );
  });

  it("should return 404 if user is not found", async () => {
    req.query.telegramId = "12345";
    prismaMock.users.findUnique.mockResolvedValue(null);
    await apiHandler.getUserDataApi(req, res);
    expect(prismaMock.users.findUnique).toHaveBeenCalledWith({
      where: { telegram_id: BigInt("12345") },
      select: expect.any(Object),
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "User not found.",
    });
    expect(loggerMock.warn).toHaveBeenCalledWith(
      { telegramId: BigInt("12345") },
      "User not found for /api/user-data",
    );
  });

  it("should return 500 if database error occurs during user fetch", async () => {
    req.query.telegramId = "12345";
    const dbError = new Error("DB Read Error");
    prismaMock.users.findUnique.mockRejectedValue(dbError);
    await apiHandler.getUserDataApi(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Internal server error.",
    });
    expect(loggerMock.error).toHaveBeenCalledWith(
      { err: dbError, telegramId: BigInt("12345") },
      "Database error fetching user data for API.",
    );
  });

  it("should return 200 with formatted user data on success (with DOB and booking_slot)", async () => {
    req.query.telegramId = "12345";
    const mockUser = {
      first_name: "John",
      last_name: "Doe",
      email: "john.doe@example.com",
      phone_number: "1234567890",
      date_of_birth: new Date("1990-01-15T00:00:00.000Z"), // UTC
      booking_slot: new Date("2025-07-20T10:00:00.000Z"), // UTC
      em_first_name: "Jane",
      em_last_name: "Doe",
      em_phone_number: "0987654321",
    };
    prismaMock.users.findUnique.mockResolvedValue(mockUser);

    formatInTimeZone.mockImplementation((date, tz, formatString) => {
      if (
        formatString === "yyyy-MM-dd" &&
        date.toISOString() === mockUser.date_of_birth.toISOString()
      ) {
        return "1990-01-15";
      }
      if (
        formatString === "EEEE, MMMM d, yyyy - h:mm aa zzzz" &&
        date.toISOString() === mockUser.booking_slot.toISOString()
      ) {
        return "Sunday, July 20, 2025 - 5:00 AM Central Daylight Time";
      }
      return jest
        .requireActual("date-fns-tz")
        .formatInTimeZone(date, tz, formatString);
    });

    await apiHandler.getUserDataApi(req, res);

    expect(prismaMock.users.findUnique).toHaveBeenCalledWith({
      where: { telegram_id: BigInt("12345") },
      select: {
        first_name: true,
        last_name: true,
        email: true,
        phone_number: true,
        date_of_birth: true,
        booking_slot: true,
        em_first_name: true,
        em_last_name: true,
        em_phone_number: true,
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
      phone: "1234567890",
      dob: "1990-01-15",
      appointmentDateTime:
        "Sunday, July 20, 2025 - 5:00 AM Central Daylight Time",
      rawAppointmentDateTime: "2025-07-20T10:00:00.000Z",
      emergencyFirstName: "Jane",
      emergencyLastName: "Doe",
      emergencyPhone: "0987654321",
    });
    expect(loggerMock.info).toHaveBeenCalledWith(
      { telegramId: BigInt("12345") },
      "User data found.",
    );
    expect(formatInTimeZone).toHaveBeenCalledWith(
      mockUser.date_of_birth,
      "UTC",
      "yyyy-MM-dd",
    );
    expect(formatInTimeZone).toHaveBeenCalledWith(
      expect.any(Date),
      "America/Chicago",
      "EEEE, MMMM d, yyyy - h:mm aa zzzz",
    );
  });

  it("should return 200 with formatted user data (DOB null, booking_slot null)", async () => {
    req.query.telegramId = "67890";
    const mockUserNullDates = {
      first_name: "Alice",
      last_name: "Smith",
      email: "alice@example.com",
      phone_number: "1112223333",
      date_of_birth: null,
      booking_slot: null,
      em_first_name: "Bob",
      em_last_name: "Smith",
      em_phone_number: "4445556666",
    };
    prismaMock.users.findUnique.mockResolvedValue(mockUserNullDates);

    await apiHandler.getUserDataApi(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      firstName: "Alice",
      lastName: "Smith",
      email: "alice@example.com",
      phone: "1112223333",
      dob: "",
      appointmentDateTime: "Not Scheduled",
      rawAppointmentDateTime: null,
      emergencyFirstName: "Bob",
      emergencyLastName: "Smith",
      emergencyPhone: "4445556666",
    });
    expect(formatInTimeZone).not.toHaveBeenCalled();
  });

  it("should return 500 if date formatting fails for DOB", async () => {
    req.query.telegramId = "12345";
    const mockUser = {
      first_name: "John",
      last_name: "Doe",
      date_of_birth: new Date("1990-01-15T00:00:00.000Z"),
      booking_slot: null,
    };
    prismaMock.users.findUnique.mockResolvedValue(mockUser);

    const formatError = new Error("Date Formatting Failed");
    formatInTimeZone.mockImplementation((date, tz, formatString) => {
      if (formatString === "yyyy-MM-dd") {
        throw formatError;
      }
      return jest
        .requireActual("date-fns-tz")
        .formatInTimeZone(date, tz, formatString);
    });

    await apiHandler.getUserDataApi(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Error processing user data.",
    });
    expect(loggerMock.error).toHaveBeenCalledWith(
      { err: formatError, telegramId: BigInt("12345"), userRawData: mockUser },
      "Error formatting user data for API.",
    );
  });

  it("should handle invalid booking_slot date from DB gracefully", async () => {
    req.query.telegramId = "12345";
    const mockUserInvalidBooking = {
      first_name: "Test",
      last_name: "User",
      date_of_birth: null,
      booking_slot: "invalid-date-string",
      em_first_name: "Em",
      em_last_name: "Contact",
      em_phone_number: "123",
    };
    prismaMock.users.findUnique.mockResolvedValue(mockUserInvalidBooking);

    await apiHandler.getUserDataApi(req, res);

    // Current behavior: if booking_slot is a string, .toISOString() call on it will throw,
    // leading to the outer catch (formatErr) and a 500 response.
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Error processing user data.",
    });
    // The loggerMock.error would be called by the catch(formatErr) block.
    // The specific error would be a TypeError from calling .toISOString() on a string.
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(TypeError), // TypeError: user.booking_slot.toISOString is not a function
        telegramId: BigInt("12345"),
        userRawData: mockUserInvalidBooking,
      }),
      "Error formatting user data for API.",
    );
    // loggerMock.warn for "Invalid booking_slot format received from DB." would not be reached.
    // formatInTimeZone for booking slot would also not be reached.
  });

  it("should handle error during booking_slot parsing gracefully", async () => {
    req.query.telegramId = "12345";
    const mockUserBookingError = {
      first_name: "Test",
      last_name: "User",
      date_of_birth: null,
      booking_slot: new Date(),
      em_first_name: "Em",
      em_last_name: "Contact",
      em_phone_number: "123",
    };
    prismaMock.users.findUnique.mockResolvedValue(mockUserBookingError);

    const parseError = new Error("Simulated parsing error");
    formatInTimeZone.mockImplementation((date, tz, formatString) => {
      if (formatString === "EEEE, MMMM d, yyyy - h:mm aa zzzz") {
        throw parseError;
      }
      return jest
        .requireActual("date-fns-tz")
        .formatInTimeZone(date, tz, formatString);
    });

    await apiHandler.getUserDataApi(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        appointmentDateTime: "Not Scheduled",
        rawAppointmentDateTime: null,
      }),
    );
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: parseError,
        bookingSlotRaw: mockUserBookingError.booking_slot,
        telegramId: BigInt("12345"),
      }),
      "Error parsing booking_slot.",
    );
  });
});
