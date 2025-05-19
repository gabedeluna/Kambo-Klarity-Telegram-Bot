/**
 * Test suite for bot.js module
 */

// Mock Telegraf
const mockTelegraf = jest.fn();
const mockBot = {
  telegram: {
    getMe: jest.fn().mockResolvedValue({ id: 123, username: 'test_bot' }),
  },
  catch: jest.fn(),
};

// Mock getMe response
mockTelegraf.mockReturnValue(mockBot);

// Mock Telegraf module
jest.mock('telegraf', () => ({
  Telegraf: mockTelegraf,
}));

// Mock env config
jest.mock('../../src/core/env', () => ({
  tgToken: 'test-token',
}));

// Mock logger
jest.mock('../../src/core/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('bot.js', () => {
  let originalEnv;
  let bot;
  
  beforeEach(() => {
    // Reset modules before each test
    jest.resetModules();
    
    // Reset mock functions
    mockTelegraf.mockClear();
    mockBot.catch.mockClear();
    mockBot.telegram.getMe.mockClear();
  });
  
  test('should create a Telegraf instance with the correct token', () => {
    // Import the bot module
    bot = require('../../src/core/bot');
    
    // Verify Telegraf was called with the correct token
    expect(mockTelegraf).toHaveBeenCalledWith('test-token');
    
    // Verify bot instance was returned
    expect(bot).toBe(mockBot);
  });
  
  test('should add error handler', () => {
    // Import the bot module
    bot = require('../../src/core/bot');
    
    // Verify catch method was called
    expect(mockBot.catch).toHaveBeenCalled();
  });
  
  test('should fetch bot info when initialized', async () => {
    // Import the bot module
    bot = require('../../src/core/bot');
    
    // Wait for any promises to resolve
    await Promise.resolve();
    
    // Verify getMe was called
    expect(mockBot.telegram.getMe).toHaveBeenCalled();
  });
  
  test('should return the same instance when required multiple times', () => {
    // Import bot modules
    const bot1 = require('../../src/core/bot');
    const bot2 = require('../../src/core/bot');
    
    // Verify Telegraf was called only once
    expect(mockTelegraf).toHaveBeenCalledTimes(1);
    
    // Verify both instances are the same
    expect(bot1).toBe(bot2);
  });
});