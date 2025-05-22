/**
 * @fileoverview Unit tests for the forms route handlers.
 */

const formsRouter = require("../../src/routes/forms"); // Import the module

// Mock dependencies
const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const registrationHandlerMock = {
  handleRegistrationSubmit: jest.fn(),
};

describe("Forms Route Handlers (forms.js)", () => {
  let req, res, next;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      body: { telegramId: "testUser123" }, // Example body
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    next = jest.fn();

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
    // Reset the internal state of formsRouter if necessary, by re-initializing with nulls or mocks
    // This is to ensure that 'regHandler' is reset between tests for the initialization checks.
    // A bit of a hack, but necessary if the module retains state.
    try {
        formsRouter.initialize({ logger: {}, registrationHandler: {} }); // Minimal valid init
    } catch(e) { /* ignore if it fails, already tested */ }
  });

  describe("Initialization", () => {
    it("should initialize successfully with logger and registrationHandler", () => {
      expect(() => formsRouter.initialize({
        logger: loggerMock,
        registrationHandler: registrationHandlerMock
      })).not.toThrow();
      expect(loggerMock.info).toHaveBeenCalledWith("[formsRouter] Initialized successfully.");
    });

    it("should throw an error if logger is missing", () => {
      expect(() => formsRouter.initialize({ registrationHandler: registrationHandlerMock }))
        .toThrow("Missing dependencies for formsRouter");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "FATAL: formsRouter initialization failed. Missing dependencies.",
        { logger: false, registrationHandler: true }
      );
    });

    it("should throw an error if registrationHandler is missing", () => {
      expect(() => formsRouter.initialize({ logger: loggerMock }))
        .toThrow("Missing dependencies for formsRouter");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "FATAL: formsRouter initialization failed. Missing dependencies.",
        { logger: true, registrationHandler: false }
      );
    });

    it("should throw an error if deps is undefined", () => {
        expect(() => formsRouter.initialize(undefined))
          .toThrow("Missing dependencies for formsRouter");
        // consoleErrorSpy might be called depending on how robust the internal checks are
    });
  });

  describe("POST /submit-registration", () => {
    let routeStack;
    let handler;

    beforeEach(() => {
        // To get the handler, we need to access the router's stack.
        // This assumes the route is the first one defined for POST /submit-registration.
        routeStack = formsRouter.router.stack.find(
            (layer) => layer.route && layer.route.path === "/submit-registration" && layer.route.methods.post
        );
        expect(routeStack).toBeDefined(); // Ensure the route exists
        handler = routeStack.route.stack[0].handle;
    });

    it("should log receipt of POST request", () => {
      formsRouter.initialize({ logger: loggerMock, registrationHandler: registrationHandlerMock });
      handler(req, res, next);
      expect(loggerMock.info).toHaveBeenCalledWith(
        `[forms.js] Received POST to /submit-registration for user: ${req.body.telegramId}`
      );
    });

    // This test is removed because initialize() would throw an error if registrationHandler is null,
    // preventing regHandler from being set to null to test the route's internal guard.
    // The case where initialize() itself fails due to missing registrationHandler is covered
    // in the "Initialization" describe block.

    it("should return 500 if registrationHandler.handleRegistrationSubmit is not a function", () => {
      formsRouter.initialize({ logger: loggerMock, registrationHandler: { handleRegistrationSubmit: "not-a-function" } });

      handler(req, res, next);

      expect(loggerMock.error).toHaveBeenCalledWith(
        "Registration handler or submit method not initialized or not a function."
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith("Internal Server Error: Registration handler not ready.");
    });

    it("should delegate to registrationHandler.handleRegistrationSubmit if properly initialized", () => {
      formsRouter.initialize({ logger: loggerMock, registrationHandler: registrationHandlerMock });
      // Ensure the mock is a function
      registrationHandlerMock.handleRegistrationSubmit = jest.fn();


      handler(req, res, next);

      expect(registrationHandlerMock.handleRegistrationSubmit).toHaveBeenCalledWith(req, res, next);
      expect(res.status).not.toHaveBeenCalledWith(500); // Assuming the handler itself doesn't send 500 for this test
    });

     it("should log receipt of POST request even if telegramId is missing in body", () => {
      formsRouter.initialize({ logger: loggerMock, registrationHandler: registrationHandlerMock });
      req.body.telegramId = undefined;
      handler(req, res, next);
      expect(loggerMock.info).toHaveBeenCalledWith(
        `[forms.js] Received POST to /submit-registration for user: UnknownTelegramId`
      );
    });
  });
});