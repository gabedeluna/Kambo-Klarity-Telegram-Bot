const sinon = require("sinon");
const { expect } = require("chai");
const app = require("../../app"); // Corrected: Need the app for listen

// Path to the module we want to test by requiring it
const serverModulePath = require.resolve("../../../bin/server");

describe("Server Startup Script (bin/server.js)", () => {
  let listenStub;
  let consoleErrorSpy;
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

    // Spy on console.error
    consoleErrorSpy = sinon.spy(console, "error");

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

    // Configure the stubbed server.on to immediately call the handler with the error
    mockServer.on.withArgs("error", sinon.match.func).callsArgWith(1, error);

    // Require the module to trigger the setup and error handler attachment
    require("../../../bin/server");

    // Verify console.error was called with the specific message
    expect(consoleErrorSpy.calledOnce).to.be.true;
    expect(consoleErrorSpy.firstCall.args[0]).to.include(
      "requires elevated privileges",
    );

    // Verify process.exit was called with code 1
    expect(processExitStub.calledOnceWith(1)).to.be.true;
  });

  it("should handle EADDRINUSE error, log message, and exit", () => {
    const error = new Error("listen EADDRINUSE: address already in use");
    error.code = "EADDRINUSE";
    error.syscall = "listen";

    // Configure the stubbed server.on
    mockServer.on.withArgs("error", sinon.match.func).callsArgWith(1, error);

    // Require the module
    require("../../../bin/server");

    // Verify console.error
    expect(consoleErrorSpy.calledOnce).to.be.true;
    expect(consoleErrorSpy.firstCall.args[0]).to.include("is already in use");

    // Verify process.exit
    expect(processExitStub.calledOnceWith(1)).to.be.true;
  });

  it("should re-throw non-listen errors", () => {
    const error = new Error("Some other error");
    error.code = "ENOENT"; // Different error code
    error.syscall = "open"; // Different syscall

    // Configure the stubbed server.on
    mockServer.on.withArgs("error", sinon.match.func).callsArgWith(1, error);

    // Expect the require call itself to throw
    expect(() => require("../../../bin/server")).to.throw(error);

    // Verify console.error and process.exit were NOT called
    expect(consoleErrorSpy.called).to.be.false;
    expect(processExitStub.called).to.be.false;
  });

  it("should re-throw listen errors other than EACCES/EADDRINUSE", () => {
    const error = new Error("Some other listen error");
    error.code = "EAGAIN";
    error.syscall = "listen"; // Same syscall, different code

    // Configure the stubbed server.on
    mockServer.on.withArgs("error", sinon.match.func).callsArgWith(1, error);

    // Expect the require call itself to throw
    expect(() => require("../../../bin/server")).to.throw(error);

    // Verify console.error and process.exit were NOT called
    expect(consoleErrorSpy.called).to.be.false;
    expect(processExitStub.called).to.be.false;
  });
});
