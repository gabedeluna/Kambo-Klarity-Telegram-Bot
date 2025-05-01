/**
 * Mock for @prisma/client module
 * This provides a consistent mock for the PrismaClient constructor
 */
// eslint-disable-next-line no-unused-vars
const { PrismaClient } = require("@prisma/client"); // Keep for reference, comment out if truly unused
// eslint-disable-next-line no-unused-vars
const sinon = require("sinon"); // May be needed for future complex mocks

const mockPrisma = require("./prisma.mock");

// Create a mock PrismaClient constructor
const PrismaClientMock = function () {
  return mockPrisma;
};

module.exports = {
  PrismaClientMock,
};
