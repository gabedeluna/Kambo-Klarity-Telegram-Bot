/**
 * Test helpers for common test setup and mocking
 */
const sinon = require("sinon");
const mockPrisma = require("../mocks/prisma.mock");
const proxyquire = require("proxyquire");

/**
 * Creates a proxyquired module with mocked dependencies
 *
 * @param {string} modulePath - Path to the module to load with mocked dependencies
 * @param {object} mocks - Object with mocked dependencies
 * @returns {object} - The loaded module with mocked dependencies
 */
function loadModuleWithMocks(modulePath, mocks = {}) {
  // Always include the Prisma mock to avoid real database connections
  const combinedMocks = {
    "../core/prisma": mockPrisma,
    "../../core/prisma": mockPrisma,
    "@prisma/client": {
      PrismaClient: function () {
        return mockPrisma;
      },
    },
    ...mocks,
  };

  return proxyquire(modulePath, combinedMocks);
}

/**
 * Creates a sandbox and common mocks for tests
 *
 * @returns {object} - Object with sandbox and common mocks
 */
function createTestSandbox() {
  const sandbox = sinon.createSandbox();

  const commonMocks = {
    logger: {
      info: sandbox.stub(),
      error: sandbox.stub(),
      warn: sandbox.stub(),
      debug: sandbox.stub(),
      child: sandbox.stub().returnsThis(),
    },
    prisma: mockPrisma,
  };

  return {
    sandbox,
    mocks: commonMocks,
  };
}

module.exports = {
  loadModuleWithMocks,
  createTestSandbox,
  mockPrisma,
};
