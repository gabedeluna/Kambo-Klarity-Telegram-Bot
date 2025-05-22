// tests/middleware/userLookup.test.js

describe("userLookupMiddleware", () => {
  let mockPrisma;
  let mockLogger;
  let userLookupModule; // To hold the required module
  let mockCtx;
  let mockNext;
  let consoleErrorSpy;
  let processExitSpy;

  beforeEach(() => {
    jest.resetModules(); // Crucial for resetting module-level state (isInitialized, prisma, logger)

    mockPrisma = {
      users: {
        findUnique: jest.fn(),
      },
    };
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockCtx = {
      from: { id: "1234567890" }, // String ID, as Telegraf might provide
      state: {},
    };
    mockNext = jest.fn().mockResolvedValue(undefined); // Ensure next is async if awaited

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called"); // Make test fail if exit is called unexpectedly
    });

    // Require the module after mocks are set up for module-level variables
    userLookupModule = require("../../src/middleware/userLookup");
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe("initialize", () => {
    it("should call process.exit(1) if prisma is missing", () => {
      processExitSpy.mockImplementationOnce(() => {}); // Allow exit for this test
      userLookupModule.initialize({ logger: mockLogger /* prisma missing */ });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "FATAL: userLookupMiddleware initialization failed. Missing dependencies (prisma, logger).",
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("should call process.exit(1) if logger is missing", () => {
      processExitSpy.mockImplementationOnce(() => {}); // Allow exit for this test
      userLookupModule.initialize({ prisma: mockPrisma /* logger missing */ });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "FATAL: userLookupMiddleware initialization failed. Missing dependencies (prisma, logger).",
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("should initialize successfully with valid dependencies", () => {
      userLookupModule.initialize({ prisma: mockPrisma, logger: mockLogger });
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[userLookupMiddleware] Initialized successfully.",
      );
      expect(processExitSpy).not.toHaveBeenCalled();
      // isInitialized is internal, but subsequent tests of userLookupMiddleware will verify its effect
    });
  });

  describe("userLookupMiddleware (function)", () => {
    it("should log fatal error and call next if used before initialization", async () => {
      // Module is loaded in beforeEach, but initialize is not called yet for this specific instance
      // To test this, we need a fresh require without initialize
      jest.resetModules();
      const uninitializedModule = require("../../src/middleware/userLookup");
      // processExitSpy should not be armed here as initialize is not called

      await uninitializedModule.userLookupMiddleware(mockCtx, mockNext);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "FATAL: userLookupMiddleware used before initialization.",
      );
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockPrisma.users.findUnique).not.toHaveBeenCalled();
    });

    describe("when initialized", () => {
      beforeEach(() => {
        // Ensure module is initialized for these tests
        userLookupModule.initialize({ prisma: mockPrisma, logger: mockLogger });
        mockLogger.info.mockClear(); // Clear init log
      });

      it("should call next and log warning if ctx.from.id is missing", async () => {
        mockCtx.from = {}; // No id
        await userLookupModule.userLookupMiddleware(mockCtx, mockNext);

        expect(mockLogger.warn).toHaveBeenCalledWith(
          "User lookup skipped: ctx.from.id is missing.",
        );
        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockPrisma.users.findUnique).not.toHaveBeenCalled();
        expect(mockCtx.state.user).toBeUndefined();
        expect(mockCtx.state.isNewUser).toBeUndefined();
      });

      it("should handle ctx.from being undefined", async () => {
        mockCtx.from = undefined;
        await userLookupModule.userLookupMiddleware(mockCtx, mockNext);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          "User lookup skipped: ctx.from.id is missing.",
        );
        expect(mockNext).toHaveBeenCalledTimes(1);
      });

      it("should log error, set state to undefined, and call next if telegramIdSource cannot be BigInt", async () => {
        mockCtx.from.id = "not-a-number";
        await userLookupModule.userLookupMiddleware(mockCtx, mockNext);

        expect(mockLogger.error).toHaveBeenCalledWith(
          { err: expect.any(SyntaxError), telegramIdSource: "not-a-number" }, // BigInt throws SyntaxError for invalid strings
          "Failed to convert telegramIdSource to BigInt.",
        );
        expect(mockCtx.state.user).toBeUndefined();
        expect(mockCtx.state.isNewUser).toBeUndefined();
        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockPrisma.users.findUnique).not.toHaveBeenCalled();
      });

      it("should find existing user, set ctx.state, and call next", async () => {
        const fakeUser = {
          client_id: 1,
          telegram_id: BigInt(mockCtx.from.id),
          role: "USER",
          state: "IDLE",
          first_name: "Test",
          active_session_id: null,
        };
        mockPrisma.users.findUnique.mockResolvedValue(fakeUser);

        await userLookupModule.userLookupMiddleware(mockCtx, mockNext);

        expect(mockPrisma.users.findUnique).toHaveBeenCalledWith({
          where: { telegram_id: BigInt(mockCtx.from.id) },
          select: expect.any(Object),
        });
        expect(mockCtx.state.user).toEqual(fakeUser);
        expect(mockCtx.state.isNewUser).toBe(false);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          { telegramId: mockCtx.from.id, role: "USER" },
          "User found.",
        );
        expect(mockNext).toHaveBeenCalledTimes(1);
      });

      it("should handle new user (not found), set ctx.state, and call next", async () => {
        mockPrisma.users.findUnique.mockResolvedValue(null); // User not found

        await userLookupModule.userLookupMiddleware(mockCtx, mockNext);

        expect(mockPrisma.users.findUnique).toHaveBeenCalledWith({
          where: { telegram_id: BigInt(mockCtx.from.id) },
          select: expect.any(Object),
        });
        expect(mockCtx.state.user).toBeNull();
        expect(mockCtx.state.isNewUser).toBe(true);
        expect(mockLogger.info).toHaveBeenCalledWith(
          { telegramId: mockCtx.from.id },
          "New user detected.",
        );
        expect(mockNext).toHaveBeenCalledTimes(1);
      });

      it("should handle database error, set state to undefined, and call next", async () => {
        const dbError = new Error("DB connection failed");
        mockPrisma.users.findUnique.mockRejectedValue(dbError);

        await userLookupModule.userLookupMiddleware(mockCtx, mockNext);

        expect(mockPrisma.users.findUnique).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
          { err: dbError, telegramId: mockCtx.from.id },
          "Database error during user lookup.",
        );
        expect(mockCtx.state.user).toBeUndefined();
        expect(mockCtx.state.isNewUser).toBeUndefined();
        expect(mockNext).toHaveBeenCalledTimes(1);
      });

      it("should ensure ctx.state exists if not present initially", async () => {
        mockCtx.state = undefined; // Test case where ctx.state is not pre-existing
        mockPrisma.users.findUnique.mockResolvedValue(null); // Simulate a lookup path

        await userLookupModule.userLookupMiddleware(mockCtx, mockNext);

        expect(mockCtx.state).toBeDefined();
        expect(mockCtx.state.user).toBeNull(); // Check a property was set
        expect(mockNext).toHaveBeenCalledTimes(1);
      });
    });
  });
});
