/**
 * Test suite for the main app.js module
 */

const request = require('supertest');

// Mock dependencies
jest.mock('../src/core/bot', () => ({
  webhookCallback: jest.fn(() => (req, res, next) => {
    if (req.path === '/webhook') {
      return res.status(200).send('Webhook handled');
    }
    return next();
  }),
}));

jest.mock('../src/core/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('../src/middleware/errorHandler', () => ({
  errorHandler: jest.fn((err, req, res, next) => {
    res.status(500).json({ error: 'Test error handler' });
  }),
}));

jest.mock('../src/middleware/userLookup', () => ({
  userLookup: jest.fn((req, res, next) => next()),
}));

jest.mock('../src/middleware/updateRouter', () => ({
  updateRouter: jest.fn((req, res, next) => next()),
}));

jest.mock('../src/routes/api', () => {
  const express = require('express');
  const router = express.Router();
  
  router.get('/test', (req, res) => {
    res.status(200).json({ message: 'API route works' });
  });
  
  return router;
});

jest.mock('../src/routes/forms', () => {
  const express = require('express');
  const router = express.Router();
  
  router.get('/test', (req, res) => {
    res.status(200).json({ message: 'Forms route works' });
  });
  
  return router;
});

describe('app.js', () => {
  let app, server;
  
  beforeEach(() => {
    // Reset modules to ensure a fresh app instance
    jest.resetModules();
    // Import the app module
    app = require('../src/app');
    // Create a test server
    server = app.listen();
  });
  
  afterEach(() => {
    // Close the server after each test
    server.close();
  });
  
  test('should respond with 200 to health check endpoint', async () => {
    const response = await request(server).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
  
  test('should handle webhook requests', async () => {
    const response = await request(server).post('/webhook');
    
    expect(response.status).toBe(200);
    expect(response.text).toBe('Webhook handled');
  });
  
  test('should route API requests', async () => {
    const response = await request(server).get('/api/test');
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'API route works' });
  });
  
  test('should route form requests', async () => {
    const response = await request(server).get('/forms/test');
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Forms route works' });
  });
  
  test('should return 404 for unknown routes', async () => {
    const response = await request(server).get('/unknown-route');
    
    expect(response.status).toBe(404);
  });
});