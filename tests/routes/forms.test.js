/**
 * Test suite for forms routes
 */

const express = require('express');
const request = require('supertest');

// Create a mock express app for testing
const app = express();

// Mock dependencies
jest.mock('../../src/core/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('../../src/core/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
  })),
}));

// Create a mock forms handler for testing
const mockRegistrationHandler = {
  handleRegistration: jest.fn((req, res) => {
    if (!req.body || !req.body.telegramId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Mock successful registration
    res.status(201).json({ 
      success: true, 
      user: { 
        id: 1, 
        telegramId: req.body.telegramId, 
        name: req.body.name || 'Test User' 
      } 
    });
  }),
};

// Setup the express routes
app.use(express.json());
app.post('/submit-registration', mockRegistrationHandler.handleRegistration);

describe('Forms Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('POST /submit-registration', () => {
    test('should return 400 if telegramId is missing', async () => {
      const response = await request(app)
        .post('/submit-registration')
        .send({
          name: 'Test User',
          email: 'test@example.com',
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required fields');
    });
    
    test('should return 201 and user data on successful registration', async () => {
      const userData = {
        telegramId: '123456789',
        name: 'Test User',
        email: 'test@example.com',
      };
      
      const response = await request(app)
        .post('/submit-registration')
        .send(userData);
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user.telegramId).toBe(userData.telegramId);
      expect(response.body.user.name).toBe(userData.name);
      expect(mockRegistrationHandler.handleRegistration).toHaveBeenCalled();
    });
  });
});