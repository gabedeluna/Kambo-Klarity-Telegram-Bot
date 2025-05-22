const errorHandler = require("../../src/middleware/errorHandler");
const logger = require("../../src/core/logger");

// Mock logger
jest.mock("../../src/core/logger", () => ({
  error: jest.fn(),
}));

// Mock AppError (if used, but not directly in this middleware's logic for now)
// jest.mock('../../src/errors/AppError');

describe("errorHandler Middleware", () => {
  let mockReq;
  let mockRes;
  let mockNext;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.resetModules(); // Important for fresh modules, though errorHandler is simple
    // Re-require the module if it had internal state or complex dependencies affected by mocks
    // errorHandler = require('../../src/middleware/errorHandler');

    mockReq = {
      method: "GET",
      originalUrl: "/test",
      ip: "127.0.0.1",
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      headersSent: false,
    };
    mockNext = jest.fn();
    logger.error.mockClear(); // Clear mock usage before each test

    // Suppress console.error for expected error logging during tests
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
    jest.clearAllMocks();
  });

  it("should log the error and send response for operational errors", () => {
    const operationalError = new Error("Operational error occurred");
    operationalError.statusCode = 400;
    operationalError.isOperational = true;

    errorHandler(operationalError, mockReq, mockRes, mockNext);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({
          name: "Error",
          message: "Operational error occurred",
          statusCode: 400,
          isOperational: true,
        }),
        req: expect.objectContaining({
          method: "GET",
          path: "/test",
        }),
      }),
      "Unhandled error caught by error handler: Operational error occurred",
    );
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      status: "error",
      message: "Operational error occurred",
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should use default 500 if operational error has no statusCode", () => {
    const operationalError = new Error("Operational error with no status code");
    operationalError.isOperational = true;
    // operationalError.statusCode is undefined

    errorHandler(operationalError, mockReq, mockRes, mockNext);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      status: "error",
      message: "Operational error with no status code",
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should log the error and send generic response for non-operational errors", () => {
    const nonOperationalError = new Error("Something unexpected broke");
    // nonOperationalError.isOperational is false or undefined

    errorHandler(nonOperationalError, mockReq, mockRes, mockNext);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({
          name: "Error",
          message: "Something unexpected broke",
          isOperational: undefined, // or false
        }),
        req: expect.objectContaining({
          method: "GET",
          path: "/test",
        }),
      }),
      "Unhandled error caught by error handler: Something unexpected broke",
    );
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        message: "Internal Server Error",
      }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should call next(err) if headers already sent", () => {
    const error = new Error("Test error");
    mockRes.headersSent = true;

    errorHandler(error, mockReq, mockRes, mockNext);

    expect(logger.error).toHaveBeenCalledTimes(1); // Still logs
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledWith(error);
  });

  describe("Stack Trace Handling", () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv; // Restore original NODE_ENV
    });

    it("should include stack trace for non-operational errors in non-production environment", () => {
      process.env.NODE_ENV = "development";
      const error = new Error("Non-operational dev error");
      error.stack = "Error stack trace";

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        status: "error",
        message: "Internal Server Error",
        stack: "Error stack trace",
      });
    });

    it("should NOT include stack trace for non-operational errors in production environment", () => {
      process.env.NODE_ENV = "production";
      const error = new Error("Non-operational prod error");
      error.stack = "Error stack trace";

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        status: "error",
        message: "Internal Server Error",
      });
      expect(mockRes.json.mock.calls[0][0].stack).toBeUndefined();
    });

    it("should NOT include stack trace for operational errors in non-production environment", () => {
      process.env.NODE_ENV = "development";
      const error = new Error("Operational dev error");
      error.isOperational = true;
      error.statusCode = 400;
      error.stack = "Error stack trace";

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        status: "error",
        message: "Operational dev error",
      });
      expect(mockRes.json.mock.calls[0][0].stack).toBeUndefined();
    });

    it("should NOT include stack trace for operational errors in production environment", () => {
      process.env.NODE_ENV = "production";
      const error = new Error("Operational prod error");
      error.isOperational = true;
      error.statusCode = 400;
      error.stack = "Error stack trace";

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        status: "error",
        message: "Operational prod error",
      });
      expect(mockRes.json.mock.calls[0][0].stack).toBeUndefined();
    });
  });

  it("should log detailed error and request information", () => {
    const detailedError = new Error("Detailed error");
    detailedError.statusCode = 404;
    detailedError.isOperational = true;
    detailedError.stack = "Custom stack";

    mockReq.body = { test: "data" }; // Example, though not logged by default in handler

    errorHandler(detailedError, mockReq, mockRes, mockNext);

    expect(logger.error).toHaveBeenCalledWith(
      {
        err: {
          name: "Error",
          message: "Detailed error",
          statusCode: 404,
          isOperational: true,
          stack: "Custom stack",
        },
        req: {
          method: "GET",
          path: "/test",
          ip: "127.0.0.1",
        },
      },
      "Unhandled error caught by error handler: Detailed error",
    );
  });
});
