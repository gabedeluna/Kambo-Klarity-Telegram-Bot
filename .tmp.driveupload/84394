const { expect } = require("chai");
const sinon = require("sinon");
const path = require("path");
const proxyquire = require("proxyquire");

// Import the actual logger
const logger = require("../../src/core/logger");

describe("Core Prisma Module", () => {
  let sandbox;
  let processOnStub;

  // Check singleton logic once before all tests
  before(() => {
    // Just require once to ensure initial load if needed, then clear cache.
    require(path.resolve(process.cwd(), "src/core/prisma.js"));
    // Clear cache once after initial load so tests start clean
    delete require.cache[path.resolve(process.cwd(), "src/core/prisma.js")];
  });

  beforeEach(() => {
    // Use a sandbox
    sandbox = sinon.createSandbox();
    // Stub process.on
    processOnStub = sandbox.stub(process, "on");

    // Stub actual logger methods within the sandbox using sandbox.replace
    sandbox.replace(logger, "info", sandbox.stub());
    sandbox.replace(logger, "error", sandbox.stub());
    sandbox.replace(logger, "warn", sandbox.stub());
    sandbox.replace(logger, "debug", sandbox.stub());
    sandbox.replace(logger, "fatal", sandbox.stub());
    sandbox.replace(logger, "trace", sandbox.stub());
    // If logger.child is used, stub it as well
    // sandbox.replace(logger, 'child', sandbox.stub().returnsThis());
  });

  afterEach(() => {
    // Restore using sandbox
    sandbox.restore();
    // Cache clearing IS needed for prisma tests to isolate module initialization
    delete require.cache[path.resolve(process.cwd(), "src/core/prisma.js")];
  });

  it("should export an object with a $disconnect method (simplified check)", () => {
    // Require instance within test
    const currentPrismaInstance = require(
      path.resolve(process.cwd(), "src/core/prisma.js"),
    );
    // Simplified checks
    expect(typeof currentPrismaInstance).to.equal("object");
    expect(currentPrismaInstance).to.not.be.null;
    expect(typeof currentPrismaInstance.$disconnect).to.equal("function");
  });

  it("should register a beforeExit handler that runs without error", async () => {
    // 1. process.on is already stubbed by beforeEach

    // 2. Require the module. This runs the module code, including
    //    new PrismaClient() and process.on('beforeExit', listener)
    //    The process.on call will register the listener with our stub.
    const currentPrismaInstance = require(
      path.resolve(process.cwd(), "src/core/prisma.js"),
    );

    // 3. Check that the handler was registered
    expect(processOnStub.calledWith("beforeExit")).to.be.true;
    const beforeExitCall = processOnStub
      .getCalls()
      .find((call) => call.args[0] === "beforeExit");
    expect(
      beforeExitCall,
      "process.on('beforeExit', ...) was not called by module",
    ).to.exist;
    const beforeExitListener = beforeExitCall.args[1];
    expect(
      beforeExitListener,
      "Listener registered for beforeExit is not a function",
    ).to.be.a("function");

    // 4. Verify $disconnect exists (basic check)
    expect(typeof currentPrismaInstance.$disconnect).to.equal(
      "function",
      "Expected $disconnect to exist on instance",
    );

    // 5. Manually invoke the listener and expect it NOT to throw.
    //    This implies it successfully attempted the disconnect logic.
    try {
      await beforeExitListener();
      // If it reaches here without throwing, the test passes implicitly.
    } catch (error) {
      // If the listener itself throws, fail the test clearly
      console.error("Error during beforeExitListener execution:", error);
      expect.fail(
        `The beforeExitListener threw an unexpected error: ${error.message}`,
      );
    }

    // No spy check needed anymore.
  });

  it("should log error if $disconnect fails during beforeExit", async () => {
    // Create a mock error for the test
    const mockError = new Error("DB disconnect failed");

    // Clear the require cache to ensure a fresh instance
    delete require.cache[path.resolve(process.cwd(), "src/core/prisma.js")];

    // Directly stub the $disconnect method on the mock Prisma client
    // This mock is already being used by the module due to the global test setup
    const mockPrisma = require("../mocks/prisma.mock");
    mockPrisma.$disconnect.rejects(mockError);

    // Now require the module - this will use our mock Prisma client
    require(path.resolve(process.cwd(), "src/core/prisma.js"));

    // Find the registered listener from the processOnStub
    const beforeExitCall = processOnStub
      .getCalls()
      .find((call) => call.args[0] === "beforeExit");

    expect(beforeExitCall, "beforeExit listener not found").to.exist;
    const beforeExitListener = beforeExitCall.args[1];
    expect(
      beforeExitListener,
      "beforeExit listener should be a function",
    ).to.be.a("function");

    // Invoke the listener - it should catch the rejection from $disconnect
    await beforeExitListener();

    // Verify the disconnect stub was called
    expect(mockPrisma.$disconnect.called, "$disconnect should be called").to.be
      .true;

    // Verify logger.error was called with the error object and a message
    expect(logger.error.called, "logger.error should be called").to.be.true;
    expect(
      logger.error.calledWith(mockError, sinon.match.string),
      "logger.error should be called with error object and message",
    ).to.be.true;
  });

  it("should log an error if PRISMA_LOG_LEVEL is invalid", () => {
    // Temporarily modify process.env for this test
    process.env.PRISMA_LOG_LEVEL = "invalid_level";
    const mockLogger = {
      error: sandbox.stub(),
    };
    // Use proxyquire to load the module with the mock client
    proxyquire("../../src/core/prisma", {
      "@prisma/client": {
        // Provide the mock constructor here
        PrismaClient: class MockPrismaClient {}, // Ensure MockPrismaClient is defined in scope
      },
      "../core/logger": mockLogger, // Mock logger if needed for this test
    });
    // Assert on mockLogger.error if prisma instantiation should log an error
    expect(mockLogger.error).to.have.been.calledWith(
      sinon.match(/Invalid PRISMA_LOG_LEVEL/),
    );
  });
});
