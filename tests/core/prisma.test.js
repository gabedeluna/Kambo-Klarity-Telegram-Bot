/**
 * Test suite for prisma.js module
 */

// Mock dependencies
jest.mock('@prisma/client', () => {
  const mockDisconnect = jest.fn();
  const mockClient = {
    $disconnect: mockDisconnect,
  };
  
  return {
    PrismaClient: jest.fn(() => mockClient),
    mockDisconnect, // Export for test assertions
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
  
  test('returns the same instance when required multiple times', () => {
    const prisma1 = require('../../src/core/prisma');
    const prisma2 = require('../../src/core/prisma');
    
    expect(prisma1).toBe(prisma2);
  });
  
  test('registers beforeExit handler to disconnect from database', () => {
    // Store original process.on
    const originalProcessOn = process.on;
    
    // Mock process.on
    const mockProcessOn = jest.fn();
    process.on = mockProcessOn;
    
    try {
      // Import module to trigger the process.on registration
      require('../../src/core/prisma');
      
      // Check that process.on was called with 'beforeExit'
      expect(mockProcessOn).toHaveBeenCalledWith('beforeExit', expect.any(Function));
    } finally {
      // Restore original process.on
      process.on = originalProcessOn;
    }
  });
  
  test('disconnects from database on beforeExit', () => {
    // Store original process.on
    const originalProcessOn = process.on;
    
    // Mock process.on to capture the callback
    let beforeExitCallback;
    process.on = (event, callback) => {
      if (event === 'beforeExit') {
        beforeExitCallback = callback;
      }
    };
    
    try {
      // Get the mockDisconnect function
      const { mockDisconnect } = require('@prisma/client');
      
      // Import module to trigger the process.on registration
      require('../../src/core/prisma');
      
      // Ensure callback was registered
      expect(beforeExitCallback).toBeDefined();
      
      // Execute the beforeExit callback
      beforeExitCallback();
      
      // Verify that disconnect was called
      expect(mockDisconnect).toHaveBeenCalled();
    } finally {
      // Restore original process.on
      process.on = originalProcessOn;
    }
  });
});