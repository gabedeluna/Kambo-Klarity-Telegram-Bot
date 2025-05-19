// Set up Jest environment
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock environment variables
process.env.TG_TOKEN = 'test-token';
process.env.DATABASE_URL = 'test-database-url';
process.env.FORM_URL = 'http://test-form-url.com';
process.env.LANGCHAIN_API_KEY = 'test-langchain-key';
process.env.NGROK_URL = 'http://test-ngrok-url.com';
process.env.AI_PROVIDER = 'test-provider';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.GOOGLE_API_KEY = 'test-google-key';
process.env.NODE_ENV = 'test';

// Mock Prisma globally
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    sessionType: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    availabilityRule: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

// Global afterEach to clear mocks
afterEach(() => {
  jest.clearAllMocks();
});

console.log('Jest setup complete');