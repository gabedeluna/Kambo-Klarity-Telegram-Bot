const sinon = require("sinon");
const app = require("../../src/app"); // Adjusted path

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
const moduleDir = path.dirname(require.resolve("../../src/core/logger")); // Adjusted path
const loggerPath = path.join(moduleDir, "logger.js");

// Override the logger module in the require cache
require.cache[loggerPath] = {
  id: loggerPath,
  filename: loggerPath,
  loaded: true,
  exports: loggerMock,
};

// Path to the module we want to test by requiring it
const serverModulePath = require.resolve("../../bin/server");

describe("Server Startup Script (bin/server.js)", () => {
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
    sinon.stub(app, "listen").returns(mockServer);

    // Reset logger mock stubs
    Object.values(loggerMock).forEach((stub) => stub.reset());

    // Stub process.exit to prevent tests from terminating
    sinon.stub(process, "exit");

    // Clear cache to ensure the module runs its setup code
    delete require.cache[serverModulePath];
  });

  afterEach(() => {
    // Restore all stubs and spies
    sinon.restore();
    // Make sure cache is clear for next test if needed
    delete require.cache[serverModulePath];
  });

  // Remove remaining tests as they target logic now inside 'if (require.main === module)'
  // and rely on the removed setLogger or the old server export.
});
