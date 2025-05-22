/**
 * @fileoverview Unit tests for the booking route handlers.
 */

const bookingRouter = require("../../src/routes/booking"); // Import the module

// Mock dependencies
const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  // Add fatal if it's used by the actual logger, though console.error is used in initialize
};

describe("Booking Route Handlers (booking.js)", () => {
  let req, res;
  let consoleErrorSpy; // To spy on console.error during initialization tests

  beforeEach(() => {
    jest.clearAllMocks(); // Clear all mock calls and instances

    // Re-initialize mocks for req and res for each test
    req = {
      query: {},
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    // Suppress console.error for expected error tests if any, or for the init failure
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
  });

  describe("Initialization", () => {
    it("should initialize successfully with a logger", () => {
      expect(() => bookingRouter.initialize({ logger: loggerMock })).not.toThrow();
      expect(loggerMock.info).toHaveBeenCalledWith("[bookingRouter] Initialized successfully.");
    });

    it("should throw an error if logger is missing during initialization", () => {
      expect(() => bookingRouter.initialize({})).toThrow("Missing dependencies for bookingRouter");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "FATAL: bookingRouter initialization failed. Missing dependencies."
      );
    });
     it("should throw an error if deps is undefined during initialization", () => {
      expect(() => bookingRouter.initialize(undefined)).toThrow("Missing dependencies for bookingRouter");
      // The internal check is `!deps.logger`, so `deps` itself being undefined will cause `deps.logger` to throw.
      // The console.error in the original code might not be reached if `deps` is undefined before `deps.logger` is accessed.
      // However, the custom error "Missing dependencies for bookingRouter" should still be thrown.
      // Depending on how robust the check `!deps.logger` is, console.error might or might not be called.
      // For this test, we primarily care about the thrown error.
    });
  });

  describe("GET / (placeholder)", () => {
    // It's good practice to initialize the router before testing its routes
    // even if the route itself doesn't directly use the initialized dependencies.
    beforeEach(() => {
        bookingRouter.initialize({ logger: loggerMock });
    });

    it("should return 501 and a placeholder message", () => {
      // The router is an Express router instance. We need to get the actual handler function.
      // This can be a bit tricky without an Express app instance.
      // We'll assume the first handler for the '/' GET route is our target.
      const routeStack = bookingRouter.router.stack.find(
        (layer) => layer.route && layer.route.path === "/" && layer.route.methods.get
      );
      expect(routeStack).toBeDefined();
      const handler = routeStack.route.stack[0].handle;

      handler(req, res); // Call the handler directly

      expect(loggerMock.info).toHaveBeenCalledWith("GET /api/booking called (placeholder)");
      expect(res.status).toHaveBeenCalledWith(501);
      expect(res.json).toHaveBeenCalledWith({
        message: "Booking API not fully implemented yet.",
      });
    });
  });
});