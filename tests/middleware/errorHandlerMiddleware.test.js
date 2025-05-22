// Define mock function first
const mockLoggerError = jest.fn();

// Mock the createLogger and its returned logger instance
jest.mock("../../src/core/logger", () => ({
  createLogger: jest.fn(() => ({
    error: mockLoggerError, // Now mockLoggerError is in scope for the hoisted mock
  })),
}));

// Require the module under test AFTER mocks are set up
const errorHandlerMiddleware = require("../../src/middleware/errorHandlerMiddleware");
const { createLogger } = require("../../src/core/logger"); // This would get the mock

describe("errorHandlerMiddleware", () => {
  let mockReq;
  let mockRes;
  let mockNext;
  let consoleErrorSpy; // For suppressing console.error from the logger itself if it logs to console

  beforeEach(() => {
    // Reset modules to ensure createLogger is called fresh if needed.
    // This is important because errorHandlerMiddleware calls createLogger() at its top level.
    jest.resetModules();
    
    // We need to re-require errorHandlerMiddleware IF its internal reference to the logger
    // (obtained from its top-level createLogger() call) needs to be fresh based on a per-test mock setup.
    // However, our current mock for createLogger is global to the file.
    // What needs re-requiring or careful handling is getting the reference to the *mocked* createLogger
    // if we were to change the mock behavior per test.
    // For now, clearing the globally mocked createLogger's history is key.

    // Re-assign `errorHandlerMiddleware` and `createLogger` from the fresh module context
    // if `jest.resetModules()` is used and they are needed directly in tests.
    // Note: `errorHandlerMiddleware` is already loaded at the top. `jest.resetModules()`
    // means that when `errorHandlerMiddleware` (the function) is *called*, the `createLogger()`
    // inside `src/middleware/errorHandlerMiddleware.js` will be called again, hitting the global mock.
    
    // const freshErrorHandlerMiddleware = require("../../src/middleware/errorHandlerMiddleware");
    // const { createLogger: freshCreateLoggerMock } = require("../../src/core/logger");


    mockReq = {
      method: "POST",
      originalUrl: "/api/data",
      ip: "192.168.1.100",
      headers: { "x-custom-header": "test-value" },
      body: { key: "value" },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      headersSent: false,
    };
    mockNext = jest.fn();

    // Clear mocks before each test
    mockLoggerError.mockClear(); // The function returned by the mocked logger's error property
    
    // `createLogger` is the mock function from `jest.mock`. We need to clear its call history.
    // This `createLogger` is the one imported at the top of the file.
    if (createLogger && createLogger.mockClear) {
        createLogger.mockClear();
    }
    
    // Suppress console.error for expected error logging during tests
    // This is important if the mocked logger still tries to output to console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
    jest.clearAllMocks(); // Clears all mocks, including createLogger and mockLoggerError
  });

  it("should log the error and send response with error's status and message", () => {
    const error = new Error("Custom error message");
    error.status = 400;
    error.code = "VALIDATION_ERROR";

    errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

    // createLogger is called when the errorHandlerMiddleware module is loaded,
    // not when the errorHandlerMiddleware function itself is invoked.
    // The critical check is that the logger's method (mockLoggerError) is called.
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({
          message: "Custom error message",
          status: 400,
          code: "VALIDATION_ERROR",
          stack: error.stack,
        }),
        req: expect.objectContaining({
          method: "POST",
          url: "/api/data",
          ip: "192.168.1.100",
          headers: mockReq.headers,
          body: mockReq.body,
        }),
      }),
      "Unhandled error occurred",
    );
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: {
        message: "Custom error message", // Message from error as status is not 500
      },
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should use 500 status and generic message if error.status is not a number", () => {
    const error = new Error("Non-numeric status error");
    error.status = "bad_request"; // Non-numeric

    errorHandlerMiddleware(error, mockReq, mockRes, mockNext);
    
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: {
          message: "Internal Server Error", // Generic message for 500
        },
      }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });
  
  it("should use 500 status and generic message if error has no status property", () => {
    const error = new Error("No status property error");

    errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

    expect(mockLoggerError).toHaveBeenCalledTimes(1);
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: {
          message: "Internal Server Error",
        },
      }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });


  it("should call next(err) if headers already sent", () => {
    const error = new Error("Headers sent error");
    mockRes.headersSent = true;

    errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

    expect(mockLoggerError).toHaveBeenCalledTimes(1); // Still logs
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledWith(error);
  });

  describe("Stack Trace Handling in Response", () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it("should include stack trace in development environment", () => {
      process.env.NODE_ENV = "development";
      const error = new Error("Dev error with stack");
      error.stack = "Error stack trace details";
      error.status = 500; // To ensure it hits the dev stack trace logic

      errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: "Internal Server Error",
          stack: "Error stack trace details",
        },
      });
    });

    it("should NOT include stack trace in production environment", () => {
      process.env.NODE_ENV = "production";
      const error = new Error("Prod error with stack");
      error.stack = "Error stack trace details";
      error.status = 403;

      errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

      const responseJson = mockRes.json.mock.calls[0][0];
      expect(responseJson.success).toBe(false);
      expect(responseJson.error.message).toBe("Prod error with stack");
      expect(responseJson.error.stack).toBeUndefined();
    });

     it("should NOT include stack trace in development if error status is not 500 but message is from error", () => {
      process.env.NODE_ENV = "development";
      const error = new Error("Dev error with stack, non-500");
      error.stack = "Error stack trace details";
      error.status = 400; 

      errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

      // Stack is only added if NODE_ENV is development, regardless of status code in this implementation
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: "Dev error with stack, non-500",
          stack: "Error stack trace details", 
        },
      });
    });
  });
});