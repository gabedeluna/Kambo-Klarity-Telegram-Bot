/**
 * Test suite for prisma.js module
 */

// Mock dependencies
jest.mock('@prisma/client', () => {
  const mockClient = {
    $disconnect: jest.fn(),
  };
  
  return {
    PrismaClient: jest.fn(() => mockClient),
  };
});

jest.mock('../../src/core/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('prisma.js', () => {
  beforeEach(() => {
    jest.resetModules();
  });
  
  test('exports a PrismaClient instance', () => {
    const prisma = require('../../src/core/prisma');
    
    expect(prisma).toBeDefined();
    expect(typeof prisma).toBe('object');
  });
});