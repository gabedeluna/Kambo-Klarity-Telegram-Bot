/**
 * Test suite for env.js module
 */

jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

jest.mock('../../src/core/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

describe('env.js', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original process.env
    originalEnv = { ...process.env };
    
    // Reset modules before each test
    jest.resetModules();
    
    // Set minimum required env variables
    process.env.TG_TOKEN = 'test-token';
    process.env.DATABASE_URL = 'test-db-url';
    process.env.FORM_URL = 'test-form-url';
    process.env.LANGCHAIN_API_KEY = 'test-langchain-key';
    process.env.NGROK_URL = 'test-ngrok-url';
    
    // Reset AI_PROVIDER to default to check OpenAI dependency
    delete process.env.AI_PROVIDER;
    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  afterEach(() => {
    // Restore original process.env
    process.env = originalEnv;
  });

  test('exports frozen config object with required properties', () => {
    const config = require('../../src/core/env');
    
    expect(config).toBeDefined();
    expect(Object.isFrozen(config)).toBe(true);
    expect(config.tgToken).toBe('test-token');
    expect(config.databaseUrl).toBe('test-db-url');
    expect(config.formUrl).toBe('test-form-url');
    expect(config.aiProvider).toBe('openai'); // Default value
  });

  test('defaults to port 3000 if PORT env var not specified', () => {
    delete process.env.PORT;
    
    const config = require('../../src/core/env');
    
    expect(config.port).toBe(3000);
  });

  test('uses specified PORT env var when available', () => {
    process.env.PORT = '4000';
    
    const config = require('../../src/core/env');
    
    expect(config.port).toBe(4000);
  });

  test('throws error when required env vars are missing', () => {
    delete process.env.TG_TOKEN;
    
    const logger = require('../../src/core/logger');
    
    expect(() => {
      require('../../src/core/env');
    }).toThrow();
    
    expect(logger.error).toHaveBeenCalled();
  });

  test('supports Gemini AI provider configuration', () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GOOGLE_API_KEY = 'test-google-key';
    delete process.env.OPENAI_API_KEY; // Not needed for Gemini
    
    const config = require('../../src/core/env');
    
    expect(config.aiProvider).toBe('gemini');
    expect(config.googleApiKey).toBe('test-google-key');
  });
});