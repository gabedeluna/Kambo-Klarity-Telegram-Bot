const sinon = require("sinon");
const { expect } = require("chai");
const app = require("../../app"); // Corrected: Need the app for listen

// Create a logger mock that we'll use for all tests
const loggerMock = {
  info: sinon.stub(),
  error: sinon.stub(),
  warn: sinon.stub(),
  debug: sinon.stub(),
  fatal: sinon.stub(),
  trace: sinon.stub(),
};

// Ensure the logger mock is used by the server module
const path = require("path");
const moduleDir = path.dirname(require.resolve("../../core/logger"));
const loggerPath = path.join(moduleDir, "logger.js");

// Override the logger module in the require cache
require.cache[loggerPath] = {
  id: loggerPath,
  filename: loggerPath,
  loaded: true,
  exports: loggerMock,
};

// Path to the module we want to test by requiring it
const serverModulePath = require.resolve("../../../bin/server");

describe("Server Startup Script (bin/server.js)", () => {
  let listenStub;
  let processExitStub;
  let mockServer;

  beforeEach(() => {
    // Create a mock server object that behaves like the result of app.listen
    // We need this because the real app.listen is stubbed
    mockServer = {
      on: sinon.stub(),
      address: sinon.stub().returns({ port: 3000 }), // Mock address function if needed
      close: sinon.stub().callsArg(0), // Mock close function if needed for cleanup
    };

    // Stub app.listen BEFORE requiring the server module
    listenStub = sinon.stub(app, "listen").returns(mockServer);

    // Reset logger mock stubs
    Object.values(loggerMock).forEach((stub) => stub.reset());

    // Stub process.exit to prevent tests from terminating
    processExitStub = sinon.stub(process, "exit");

    // Clear cache to ensure the module runs its setup code
    delete require.cache[serverModulePath];
  });

  afterEach(() => {
    // Restore all stubs and spies
    sinon.restore();
    // Make sure cache is clear for next test if needed
    delete require.cache[serverModulePath];
  });

  it("should log success message and listen on configured port", () => {
    // Just require the module - the stubs are already in place
    require("../../../bin/server");

    // Check that app.listen was called (implicitly tests PORT logic)
    expect(listenStub.calledOnce).to.be.true;
    // Check that the 'error' handler was attached
    expect(mockServer.on.calledWith("error", sinon.match.func)).to.be.true;

    // Optionally check console.log messages if needed (requires spying on console.log)
  });

  it("should handle EACCES error, log message, and exit", () => {
    const error = new Error("listen EACCES: permission denied");
    error.code = "EACCES";
    error.syscall = "listen";

    // Reset all stubs before this test
    Object.values(loggerMock).forEach((stub) => stub.reset());
    processExitStub.reset();

    // Clear the require cache to ensure a fresh server instance
    delete require.cache[serverModulePath];

    // Require the module to get the server instance
    const server = require("../../../bin/server");

    // Set our logger mock directly on the server instance
    server.setLogger(loggerMock);

    // Get the error handler that was registered
    const errorHandler = mockServer.on.firstCall.args[1];
    expect(errorHandler).to.be.a("function");

    // Manually call the error handler with our error
    errorHandler(error);

    // Verify logger.error was called
    expect(loggerMock.error.called, "logger.error should be called").to.be.true;

    // Verify process.exit was called with code 1
    expect(processExitStub.called, "process.exit should be called").to.be.true;
    expect(
      processExitStub.firstCall.args[0],
      "process.exit should be called with code 1",
    ).to.equal(1);
  });

  it("should handle EADDRINUSE error, log message, and exit", () => {
    const error = new Error("listen EADDRINUSE: address already in use");
    error.code = "EADDRINUSE";
    error.syscall = "listen";

    // Reset all stubs before this test
    Object.values(loggerMock).forEach((stub) => stub.reset());
    processExitStub.reset();

    // Clear the require cache to ensure a fresh server instance
    delete require.cache[serverModulePath];

    // Require the module to get the server instance
    const server = require("../../../bin/server");

    // Set our logger mock directly on the server instance
    server.setLogger(loggerMock);

    // Get the error handler that was registered
    const errorHandler = mockServer.on.firstCall.args[1];
    expect(errorHandler).to.be.a("function");

    // Manually call the error handler with our error
    errorHandler(error);

    // Verify logger.error was called
    expect(loggerMock.error.called, "logger.error should be called").to.be.true;

    // Verify process.exit was called with code 1
    expect(processExitStub.called, "process.exit should be called").to.be.true;
    expect(
      processExitStub.firstCall.args[0],
      "process.exit should be called with code 1",
    ).to.equal(1);
  });

  it("should re-throw non-listen errors", () => {
    const error = new Error("Some other error");
    error.code = "ENOENT"; // Different error code
    error.syscall = "open"; // Different syscall

    // Require the module to register the error handler
    require("../../../bin/server");

    // Get the error handler
    const errorHandler = mockServer.on.firstCall.args[1];

    // Expect the error handler to throw when called with a non-listen error
    expect(() => errorHandler(error)).to.throw(error);

    // Verify logger.error and process.exit were NOT called
    expect(loggerMock.error.called).to.be.false;
    expect(processExitStub.called).to.be.false;
  });

  it("should re-throw listen errors other than EACCES/EADDRINUSE", () => {
    const error = new Error("Some other listen error");
    error.code = "EAGAIN";
    error.syscall = "listen"; // Same syscall, different code

    // Require the module to register the error handler
    require("../../../bin/server");

    // Get the error handler
    const errorHandler = mockServer.on.firstCall.args[1];

    // Expect the error handler to throw when called with a non-EACCES/EADDRINUSE listen error
    expect(() => errorHandler(error)).to.throw(error);

    // Verify logger.error and process.exit were NOT called
    expect(loggerMock.error.called).to.be.false;
    expect(processExitStub.called).to.be.false;
  });
});
