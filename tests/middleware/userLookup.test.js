const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const { expect } = chai;

// Handle potential ES module default export
if (sinonChai && typeof sinonChai === "object" && sinonChai.default) {
  chai.use(sinonChai.default);
} else {
  chai.use(sinonChai);
}

// Import the module to test
const {
  initialize,
  userLookupMiddleware,
} = require("../../src/middleware/userLookup");

describe("Middleware: userLookup", () => {
  let mockPrisma;
  let mockLogger;
  let mockCtx;
  let nextSpy;
  let sandbox;
  let consoleErrorStub;
  let processExitStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock dependencies
    mockPrisma = {
      users: {
        findUnique: sandbox.stub(),
      },
    };
    mockLogger = {
      info: sandbox.stub(),
      error: sandbox.stub(),
      warn: sandbox.stub(),
      debug: sandbox.stub(),
    };
    nextSpy = sandbox.spy();

    // Mock console.error and process.exit for initialization tests
    consoleErrorStub = sandbox.stub(console, "error");
    processExitStub = sandbox.stub(process, "exit");

    // Base mock context for each test
    mockCtx = {
      from: { id: "123456789" },
      state: {}, // Ensure state exists
    };

    // Initialize middleware with mocks - do this in each test that needs it
    // to avoid state leakage between tests
  });

  afterEach(() => {
    sandbox.verifyAndRestore(); // Restore all stubs and verify all expectations

    // Reset module-level variables to avoid state leakage between tests
    // This is a bit of a hack, but necessary since we're testing a module with module-level state
    // In a real application, we might want to redesign to avoid this kind of global state
    try {
      // Re-require the module to reset its state
      delete require.cache[require.resolve("../../src/middleware/userLookup")];
    } catch (err) {
      console.warn("Failed to reset module cache:", err.message);
    }
  });

  describe("initialize", () => {
    it("should initialize with valid dependencies", () => {
      // Initialize here instead of in beforeEach
      initialize({ prisma: mockPrisma, logger: mockLogger });
      expect(mockLogger.info).to.have.been.calledWith(
        "[userLookupMiddleware] Initialized successfully.",
      );
      expect(consoleErrorStub).not.to.have.been.called;
      expect(processExitStub).not.to.have.been.called;
    });

    it("should exit process if prisma is missing", () => {
      initialize({ prisma: undefined, logger: mockLogger });
      expect(consoleErrorStub).to.have.been.calledWith(
        "FATAL: userLookupMiddleware initialization failed. Missing dependencies (prisma, logger).",
      );
      expect(processExitStub).to.have.been.calledWith(1);
    });

    it("should exit process if logger is missing", () => {
      initialize({ prisma: mockPrisma, logger: undefined });
      expect(consoleErrorStub).to.have.been.calledWith(
        "FATAL: userLookupMiddleware initialization failed. Missing dependencies (prisma, logger).",
      );
      expect(processExitStub).to.have.been.calledWith(1);
    });
  });

  describe("userLookupMiddleware", () => {
    beforeEach(() => {
      // Initialize middleware with mocks for all userLookupMiddleware tests
      initialize({ prisma: mockPrisma, logger: mockLogger });
    });
    it("should attach user data to ctx.state if user exists", async () => {
      // Arrange
      const fakeUser = {
        client_id: 1,
        telegram_id: 123456789n,
        role: "client",
        state: "active",
        first_name: "Test User",
        active_session_id: null,
      };
      mockPrisma.users.findUnique.resolves(fakeUser);

      // Act
      await userLookupMiddleware(mockCtx, nextSpy);

      // Assert
      expect(mockCtx.state.user).to.deep.equal(fakeUser);
      expect(mockCtx.state.isNewUser).to.be.false;
      expect(nextSpy).to.have.been.calledOnce;
      expect(mockPrisma.users.findUnique).to.have.been.calledOnceWith({
        where: { telegram_id: 123456789n },
        select: {
          client_id: true,
          telegram_id: true,
          role: true,
          state: true,
          first_name: true,
          active_session_id: true,
        },
      });
      expect(mockLogger.debug).to.have.been.calledWith(
        { telegramId: "123456789", role: "client" },
        "User found.",
      );
    });

    it("should set isNewUser flag if user does not exist", async () => {
      // Arrange
      mockPrisma.users.findUnique.resolves(null);

      // Act
      await userLookupMiddleware(mockCtx, nextSpy);

      // Assert
      expect(mockCtx.state.user).to.be.null;
      expect(mockCtx.state.isNewUser).to.be.true;
      expect(nextSpy).to.have.been.calledOnce;
      expect(mockPrisma.users.findUnique).to.have.been.calledOnce;
      expect(mockLogger.info).to.have.been.calledWith(
        { telegramId: "123456789" },
        "New user detected.",
      );
    });

    it("should call next and log error if database query fails", async () => {
      // Arrange
      const dbError = new Error("DB connection failed");
      mockPrisma.users.findUnique.rejects(dbError);

      // Act
      await userLookupMiddleware(mockCtx, nextSpy);

      // Assert
      expect(mockCtx.state.user).to.be.undefined;
      expect(mockCtx.state.isNewUser).to.be.undefined;
      expect(nextSpy).to.have.been.calledOnce;
      expect(mockLogger.error).to.have.been.calledWith(
        { err: dbError, telegramId: "123456789" },
        "Database error during user lookup.",
      );
    });

    it("should call next without DB query if ctx.from.id is missing", async () => {
      // Arrange
      mockCtx.from = undefined;

      // Act
      await userLookupMiddleware(mockCtx, nextSpy);

      // Assert
      expect(mockCtx.state).to.deep.equal({}); // State remains empty
      expect(nextSpy).to.have.been.calledOnce;
      expect(mockPrisma.users.findUnique).not.to.have.been.called;
      expect(mockLogger.warn).to.have.been.calledWith(
        "User lookup skipped: ctx.from.id is missing.",
      );
    });

    it("should call next and log error if ctx.from.id is not a valid number/BigInt", async () => {
      // Arrange
      mockCtx.from.id = "not-a-number";

      // Act
      await userLookupMiddleware(mockCtx, nextSpy);

      // Assert
      expect(mockCtx.state.user).to.be.undefined;
      expect(mockCtx.state.isNewUser).to.be.undefined;
      expect(nextSpy).to.have.been.calledOnce;
      expect(mockPrisma.users.findUnique).not.to.have.been.called;
      expect(mockLogger.error).to.have.been.calledWith(
        sinon.match.has("err", sinon.match.instanceOf(SyntaxError)),
        "Failed to convert telegramIdSource to BigInt.",
      );
    });

    it("should initialize ctx.state if it does not exist", async () => {
      // Arrange
      mockCtx.state = undefined;
      mockPrisma.users.findUnique.resolves(null);

      // Act
      await userLookupMiddleware(mockCtx, nextSpy);

      // Assert
      expect(mockCtx.state).to.be.an("object");
      expect(mockCtx.state.user).to.be.null;
      expect(mockCtx.state.isNewUser).to.be.true;
      expect(nextSpy).to.have.been.calledOnce;
    });

    it("should call next and log error if used before initialization", async () => {
      // First, get a fresh copy of the module with reset state
      delete require.cache[require.resolve("../../src/middleware/userLookup")];
      const {
        userLookupMiddleware: uninitializedMiddleware,
      } = require("../../src/middleware/userLookup");

      // Reset the call count on the existing console.error stub
      consoleErrorStub.resetHistory();

      // Act - call middleware without initializing
      await uninitializedMiddleware(mockCtx, nextSpy);

      // Assert
      expect(consoleErrorStub).to.have.been.calledWith(
        "FATAL: userLookupMiddleware used before initialization.",
      );
      expect(nextSpy).to.have.been.calledOnce;
    });
  });
});
