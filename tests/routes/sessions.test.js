/**
 * @fileoverview Unit tests for the sessions route handlers.
 */

const sessionsRouter = require("../../src/routes/sessions"); // Import the module

// Mock dependencies
const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock Prisma client specifically for sessionType model
const prismaMock = {
  sessionType: {
    findMany: jest.fn(),
  },
  // Add other models if they become necessary for other routes in sessions.js
};

describe("Sessions Route Handlers (sessions.js)", () => {
  let req, res, next;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {}; // GET request, no body or query needed for this placeholder
    res = {
      status: jest.fn().mockReturnThis(), // Though not directly used by success path
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
  });

  describe("Initialization", () => {
    it("should initialize successfully with logger and prisma", () => {
      expect(() => sessionsRouter.initialize({
        logger: loggerMock,
        prisma: prismaMock
      })).not.toThrow();
      expect(loggerMock.info).toHaveBeenCalledWith("[sessionsRouter] Initialized successfully.");
    });

    it("should throw an error if logger is missing", () => {
      expect(() => sessionsRouter.initialize({ prisma: prismaMock }))
        .toThrow("Missing dependencies for sessionsRouter");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "FATAL: sessionsRouter initialization failed. Missing dependencies."
      );
    });

    it("should throw an error if prisma is missing", () => {
      expect(() => sessionsRouter.initialize({ logger: loggerMock }))
        .toThrow("Missing dependencies for sessionsRouter");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "FATAL: sessionsRouter initialization failed. Missing dependencies."
      );
    });

     it("should throw an error if deps is undefined", () => {
        expect(() => sessionsRouter.initialize(undefined))
          .toThrow("Missing dependencies for sessionsRouter");
    });
  });

  describe("GET / (placeholder for session types)", () => {
    let routeStack;
    let handler;

    beforeEach(() => {
        // Initialize with mocks before each test in this describe block
        sessionsRouter.initialize({ logger: loggerMock, prisma: prismaMock });

        routeStack = sessionsRouter.router.stack.find(
            (layer) => layer.route && layer.route.path === "/" && layer.route.methods.get
        );
        expect(routeStack).toBeDefined();
        handler = routeStack.route.stack[0].handle;
    });

    it("should fetch session types and return them as JSON on success", async () => {
      const mockSessionTypes = [
        { id: 1, name: "Standard Kambo" },
        { id: 2, name: "Intensive Kambo" },
      ];
      prismaMock.sessionType.findMany.mockResolvedValue(mockSessionTypes);

      await handler(req, res, next);

      expect(loggerMock.info).toHaveBeenCalledWith("GET /api/sessions called (placeholder)");
      expect(prismaMock.sessionType.findMany).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith({ sessionTypes: mockSessionTypes });
      expect(next).not.toHaveBeenCalled();
    });

    it("should call next with error if prisma.sessionType.findMany fails", async () => {
      const dbError = new Error("Database query failed");
      prismaMock.sessionType.findMany.mockRejectedValue(dbError);

      await handler(req, res, next);

      expect(loggerMock.info).toHaveBeenCalledWith("GET /api/sessions called (placeholder)");
      expect(prismaMock.sessionType.findMany).toHaveBeenCalledTimes(1);
      expect(loggerMock.error).toHaveBeenCalledWith({ err: dbError }, "Failed to fetch session types");
      expect(next).toHaveBeenCalledWith(dbError);
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});