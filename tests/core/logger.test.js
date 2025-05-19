/**
 * Test suite for logger.js module
 */

// Mock pino before importing logger
const mockPino = {
  level: 'info',
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
};

// Mock pino and pino-pretty
jest.mock('pino', () => {
  return jest.fn(() => mockPino);
});

describe('logger.js', () => {
  let originalNodeEnv;
  let logger;
  
  beforeEach(() => {
    // Save original NODE_ENV
    originalNodeEnv = process.env.NODE_ENV;
    
    // Reset modules before each test
    jest.resetModules();
    
    // Reset mock functions
    Object.keys(mockPino).forEach(key => {
      if (typeof mockPino[key] === 'function') {
        mockPino[key].mockClear();
      }
    });
  });
  
  afterEach(() => {
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });
  
  test('should create a logger instance', () => {
    // Import the logger
    logger = require('../../src/core/logger');
    
    // Verify logger was created
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.child).toBe('function');
  });
  
  test('should log messages with correct methods', () => {
    // Import the logger
    logger = require('../../src/core/logger');
    
    // Call log methods
    logger.info('Info message');
    logger.error('Error message');
    logger.warn('Warning message');
    logger.debug('Debug message');
    
    // Check that pino's methods were called
    expect(mockPino.info).toHaveBeenCalledWith('Info message');
    expect(mockPino.error).toHaveBeenCalledWith('Error message');
    expect(mockPino.warn).toHaveBeenCalledWith('Warning message');
    expect(mockPino.debug).toHaveBeenCalledWith('Debug message');
  });
  
  test('should create child loggers', () => {
    // Import the logger
    logger = require('../../src/core/logger');
    
    // Create a child logger
    const childLogger = logger.child({ module: 'test-module' });
    
    // Verify child method was called
    expect(mockPino.child).toHaveBeenCalledWith({ module: 'test-module' });
    expect(childLogger).toBeDefined();
  });
  
  test('should handle errors with correct parameters', () => {
    // Import the logger
    logger = require('../../src/core/logger');
    
    // Create an error
    const error = new Error('Test error');
    
    // Log error with message
    logger.error(error, 'Error occurred');
    
    // Check that pino's error method was called with the error object first
    expect(mockPino.error).toHaveBeenCalledWith(error, 'Error occurred');
  });
});