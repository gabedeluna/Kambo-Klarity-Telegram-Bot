// tests/core/logger.test.js

// Mock the pino library
const _mockLogEvent = jest.fn();
const mockPinoInstance = {
  // Simpler mocks for logger methods
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  trace: jest.fn(),
  // Add any other methods or properties your logger.js might expect
  // If your logger directly uses pino.destination or pino.transport,
  // those might need to be mocked here as well.
};

// This is the mock for the pino() constructor function itself.
// When logger.js calls pino(options), this mock function will be invoked.
const mockPinoFactory = jest.fn(() => mockPinoInstance);
jest.mock("pino", () => mockPinoFactory);

// Store original process.env
const ORIGINAL_ENV = process.env;

// logger will be required dynamically in tests after setting up env
let logger;

describe("Core Logger (logger.js)", () => {
  beforeEach(() => {
    jest.resetModules(); // Reset modules to re-evaluate logger.js with new env
    process.env = { ...ORIGINAL_ENV }; // Reset process.env

    // Clear all mock calls, including pinoMockConstructor and mockPinoInstance methods
    mockPinoFactory.mockClear(); // Clear the factory mock
    // mockLogEvent.mockClear(); // mockLogEvent is no longer used directly by mockPinoInstance methods
    Object.values(mockPinoInstance).forEach((mockFn) => {
      if (jest.isMockFunction(mockFn)) {
        mockFn.mockClear();
      }
    });
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV; // Restore original environment
  });

  it("should be the mocked pino instance", () => {
    logger = require("../../src/core/logger"); // Require here after setup
    expect(logger).toBe(mockPinoInstance);
  });

  it("should have standard logging methods (mocked)", () => {
    logger = require("../../src/core/logger");
    expect(logger.info).toEqual(expect.any(Function));
    expect(logger.warn).toEqual(expect.any(Function));
    expect(logger.error).toEqual(expect.any(Function));
    expect(logger.debug).toEqual(expect.any(Function));
    expect(logger.fatal).toEqual(expect.any(Function));
    expect(logger.trace).toEqual(expect.any(Function));
  });

  it("logger.info(message) should call the mockPinoInstance.info with the message", () => {
    logger = require("../../src/core/logger");
    const testMessage = "This is an info message";
    logger.info(testMessage);
    expect(mockPinoInstance.info).toHaveBeenCalledWith(testMessage);
  });

  // Test for logger.info(object)
  it("logger.info(object) should call mockPinoInstance.info with the object", () => {
    logger = require("../../src/core/logger");
    const testObject = { data: "some data only" };
    logger.info(testObject);
    expect(mockPinoInstance.info).toHaveBeenCalledWith(testObject);
  });

  it("logger.info(object, message) should call mockPinoInstance.info with the object and message", () => {
    const testObject = { data: "some data" };
    logger = require("../../src/core/logger");
    const testMessage = "Info with object";
    logger.info(testObject, testMessage);
    expect(mockPinoInstance.info).toHaveBeenCalledWith(testObject, testMessage);
  });

  it("logger.warn(message) should call mockPinoInstance.warn", () => {
    logger = require("../../src/core/logger");
    const testMessage = "This is a warning";
    logger.warn(testMessage);
    expect(mockPinoInstance.warn).toHaveBeenCalledWith(testMessage);
  });

  it("logger.warn(object, message) should call mockPinoInstance.warn", () => {
    logger = require("../../src/core/logger");
    const testObject = { detail: "warning detail" };
    const testMessage = "Warning with object";
    logger.warn(testObject, testMessage);
    expect(mockPinoInstance.warn).toHaveBeenCalledWith(testObject, testMessage);
  });

  it("logger.error(message) should call mockPinoInstance.error", () => {
    logger = require("../../src/core/logger");
    const testMessage = "This is an error";
    logger.error(testMessage);
    expect(mockPinoInstance.error).toHaveBeenCalledWith(testMessage);
  });

  it("logger.error(object, message) should call mockPinoInstance.error", () => {
    logger = require("../../src/core/logger");
    const testObject = { errCode: 500 };
    const testMessage = "Error with object";
    logger.error(testObject, testMessage);
    expect(mockPinoInstance.error).toHaveBeenCalledWith(
      testObject,
      testMessage,
    );
  });

  it("logger.error(Error object) should call mockPinoInstance.error with error object", () => {
    logger = require("../../src/core/logger");
    const testError = new Error("Test error object");
    logger.error(testError);
    // Pino typically handles Error objects as the first argument if no preceding object.
    expect(mockPinoInstance.error).toHaveBeenCalledWith(testError);
  });

  it("logger.debug(message) should call mockPinoInstance.debug", () => {
    logger = require("../../src/core/logger");
    const testMessage = "This is a debug message";
    logger.debug(testMessage);
    expect(mockPinoInstance.debug).toHaveBeenCalledWith(testMessage);
  });

  it("logger.debug(object, message) should call mockPinoInstance.debug", () => {
    logger = require("../../src/core/logger");
    const testObject = { data: "debug data" };
    const testMessage = "Debug with object";
    logger.debug(testObject, testMessage);
    expect(mockPinoInstance.debug).toHaveBeenCalledWith(
      testObject,
      testMessage,
    );
  });

  describe("Pino Configuration based on Environment", () => {
    it('should set level to "silent" when NODE_ENV is "test"', () => {
      process.env.NODE_ENV = "test";
      logger = require("../../src/core/logger");
      expect(mockPinoFactory).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "silent",
        }),
      );
    });

    it('should use default LOG_LEVEL "info" if not set and not in test/prod', () => {
      process.env.NODE_ENV = "development";
      delete process.env.LOG_LEVEL;
      logger = require("../../src/core/logger");
      expect(mockPinoFactory).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "info",
          transport: expect.objectContaining({ target: "pino-pretty" }),
        }),
      );
    });

    it("should use LOG_LEVEL from env if set and not in test", () => {
      process.env.NODE_ENV = "development";
      process.env.LOG_LEVEL = "debug";
      logger = require("../../src/core/logger");
      expect(mockPinoFactory).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "debug",
          transport: expect.objectContaining({ target: "pino-pretty" }),
        }),
      );
    });

    it("should use pino-pretty transport in development", () => {
      process.env.NODE_ENV = "development";
      logger = require("../../src/core/logger");
      expect(mockPinoFactory).toHaveBeenCalledWith(
        expect.objectContaining({
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
              ignore: "pid,hostname",
            },
          },
        }),
      );
    });

    it("should use default JSON transport in production", () => {
      process.env.NODE_ENV = "production";
      logger = require("../../src/core/logger");
      expect(mockPinoFactory).toHaveBeenCalledWith(
        expect.objectContaining({
          transport: undefined, // Default JSON transport
        }),
      );
    });

    it('should be silent if process.argv includes "--allow-empty" (simulating test runner specific flag)', () => {
      process.env.NODE_ENV = "development"; // Not 'test'
      process.argv.push("--allow-empty"); // Add the flag
      logger = require("../../src/core/logger");
      expect(mockPinoFactory).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "silent",
        }),
      );
      process.argv = process.argv.filter((arg) => arg !== "--allow-empty"); // Clean up argv
    });
  });
});
