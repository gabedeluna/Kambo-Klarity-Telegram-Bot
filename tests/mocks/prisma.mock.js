/**
 * Mock Prisma client for testing
 * This provides a consistent mock for tests to use instead of the real Prisma client
 */
const sinon = require("sinon");

// Create a base mock PrismaClient
const mockPrismaClient = {
  // Add common models and methods used across tests
  users: {
    findUnique: sinon.stub().resolves(null),
    findMany: sinon.stub().resolves([]),
    create: sinon.stub().resolves({ id: "mock-id" }),
    update: sinon.stub().resolves({ id: "mock-id" }),
    delete: sinon.stub().resolves({ id: "mock-id" }),
  },
  sessions: {
    findUnique: sinon.stub().resolves(null),
    findMany: sinon.stub().resolves([]),
    create: sinon.stub().resolves({ id: "mock-id" }),
    update: sinon.stub().resolves({ id: "mock-id" }),
    delete: sinon.stub().resolves({ id: "mock-id" }),
  },
  // Add other models as needed

  // Add common Prisma client methods
  $connect: sinon.stub().resolves(undefined),
  $disconnect: sinon.stub().resolves(undefined),
  $transaction: sinon
    .stub()
    .callsFake((callback) => Promise.resolve(callback())),
};

// Add setLogger method to match the real prisma.js module
mockPrismaClient.setLogger = sinon.stub().returns(mockPrismaClient);

module.exports = mockPrismaClient;
