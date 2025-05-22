// tests/middleware/loggingMiddleware.test.js

describe("loggingMiddleware", () => {
  let mockLogger;
  let loggingMiddleware;
  let consoleErrorSpy;

  beforeEach(() => {
    // Reset modules to clear the module-level 'logger' variable
    jest.resetModules();
    loggingMiddleware = require("../../src/middleware/loggingMiddleware");

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(), // Add error mock if initialize logs errors
    };

    // Suppress console.error for expected error logging during tests
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
    jest.clearAllMocks();
  });

  describe("initialize", () => {
    it("should throw an error if logger dependency is missing", () => {
      expect(() => loggingMiddleware.initialize({})).toThrow(
        "Missing logger dependency for loggingMiddleware",
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "FATAL: loggingMiddleware initialization failed. Missing logger.",
      );
    });

    it("should throw an error if deps.logger is null or undefined", () => {
      expect(() => loggingMiddleware.initialize({ logger: null })).toThrow(
        "Missing logger dependency for loggingMiddleware",
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "FATAL: loggingMiddleware initialization failed. Missing logger.",
      );

      consoleErrorSpy.mockClear(); // Clear for next assertion

      expect(() => loggingMiddleware.initialize({ logger: undefined })).toThrow(
        "Missing logger dependency for loggingMiddleware",
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "FATAL: loggingMiddleware initialization failed. Missing logger.",
      );
    });

    it("should set the logger and log initialization message", () => {
      loggingMiddleware.initialize({ logger: mockLogger });
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[loggingMiddleware] Initialized successfully.",
      );
      // Further tests will verify if this logger is used by logRequest
    });
  });

  describe("logRequest", () => {
    let mockReq;
    let mockRes; // Not used by this middleware but required by Express
    let mockNext;

    beforeEach(() => {
      mockReq = {
        method: "GET",
        originalUrl: "/test-path",
        ip: "127.0.0.1",
        headers: {
          "user-agent": "TestAgent/1.0",
          referer: "http://localhost/referer",
        },
      };
      mockRes = {}; // Placeholder
      mockNext = jest.fn();
    });

    it("should call next and log to console.error if logger is not initialized", () => {
      // Directly call logRequest without prior initialization
      loggingMiddleware.logRequest(mockReq, mockRes, mockNext);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Logging middleware called before initialization!",
      );
      expect(mockLogger.info).not.toHaveBeenCalled(); // Ensure internal logger wasn't called
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith(); // Called with no arguments
    });

    it("should log request details and call next if logger is initialized", () => {
      loggingMiddleware.initialize({ logger: mockLogger }); // Initialize first
      loggingMiddleware.logRequest(mockReq, mockRes, mockNext);

      expect(mockLogger.info).toHaveBeenCalledTimes(2); // 1 for init, 1 for request
      expect(mockLogger.info).toHaveBeenNthCalledWith(
        2,
        {
          method: "GET",
          url: "/test-path",
          ip: "127.0.0.1",
          headers: {
            "user-agent": "TestAgent/1.0",
            referer: "http://localhost/referer",
          },
        },
        "Incoming request",
      );
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
      expect(consoleErrorSpy).not.toHaveBeenCalled(); // No console error if initialized
    });

    it("should handle missing user-agent and referer headers gracefully", () => {
      loggingMiddleware.initialize({ logger: mockLogger });
      const reqWithoutHeaders = {
        method: "POST",
        originalUrl: "/another-path",
        ip: "192.168.0.1",
        headers: {}, // Empty headers
      };
      loggingMiddleware.logRequest(reqWithoutHeaders, mockRes, mockNext);

      expect(mockLogger.info).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenNthCalledWith(
        2,
        {
          method: "POST",
          url: "/another-path",
          ip: "192.168.0.1",
          headers: {
            "user-agent": undefined,
            referer: undefined,
          },
        },
        "Incoming request",
      );
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should correctly use the initialized logger instance", () => {
      const anotherMockLogger = { info: jest.fn(), error: jest.fn() };
      loggingMiddleware.initialize({ logger: anotherMockLogger });
      loggingMiddleware.logRequest(mockReq, mockRes, mockNext);

      expect(anotherMockLogger.info).toHaveBeenCalledTimes(2); // Init + request
      expect(anotherMockLogger.info).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ method: "GET" }),
        "Incoming request",
      );
      expect(mockLogger.info).not.toHaveBeenCalled(); // Original mockLogger should not be used
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });
});
