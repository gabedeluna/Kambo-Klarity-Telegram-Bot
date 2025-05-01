/**
 * Global test setup file
 * This file is loaded before tests run to set up mocks and other test infrastructure
 */
const path = require("path");
const Module = require("module");

// Store the original require function
const originalRequire = Module.prototype.require;

// Create a mock map for modules that need to be mocked globally
const mockModules = {
  "@prisma/client": path.resolve(__dirname, "./mocks/prismaClientMock.js"),
};

// Override the require function to intercept specific module imports
Module.prototype.require = function (modulePath) {
  // If the module is in our mock map, return the mock instead
  if (mockModules[modulePath]) {
    return originalRequire.call(this, mockModules[modulePath]);
  }

  // Otherwise, use the original require
  return originalRequire.call(this, modulePath);
};

// This will be run before all tests
console.log("Test setup complete: Prisma client mocked globally");
