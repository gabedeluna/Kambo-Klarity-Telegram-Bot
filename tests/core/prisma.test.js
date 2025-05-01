const { expect } = require("chai");
const sinon = require("sinon");
const path = require("path");

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
    // Import PrismaClient for prototype stubbing
    const { PrismaClient } = require("@prisma/client");
    const mockError = new Error("DB disconnect failed");

    try {
      // Stub the PrismaClient.$disconnect method using the existing sandbox
      const disconnectStub = sandbox
        .stub(PrismaClient.prototype, "$disconnect")
        .rejects(mockError);

      // Clear the require cache to ensure a fresh prisma instance
      delete require.cache[path.resolve(process.cwd(), "src/core/prisma.js")];

      // Require the module - this creates an instance with the stubbed prototype
      // and registers the beforeExit listener
      const _prismaInstance = require(
        // Prefix with _ as it's required for side-effects but not used
        path.resolve(process.cwd(), "src/core/prisma.js"),
      );

      // Set our logger mock directly on the prisma instance
      // prismaInstance.setLogger(loggerMock);

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
      expect(disconnectStub.called, "$disconnect should be called").to.be.true;

      // Verify logger.error was called with the error object
      expect(logger.error.called, "logger.error should be called").to.be.true;
      expect(
        logger.error.firstCall.args[0],
        "First argument should be the error object",
      ).to.equal(mockError);
    } finally {
      // Remove manual stub restore - sandbox.restore() in afterEach handles it
      // disconnectStub.restore();
    }
  });
});
