/**
 * @fileoverview Test utilities for booking flow API handler tests
 * Contains common mocks and helper functions
 */

// Mock dependencies
const mockBookingFlowManager = {
  startPrimaryBookingFlow: jest.fn(),
  startInviteAcceptanceFlow: jest.fn(),
  continueFlow: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock Express req/res objects
const mockRequest = (body = {}, params = {}, query = {}) => ({
  body,
  params,
  query,
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

module.exports = {
  mockBookingFlowManager,
  mockLogger,
  mockRequest,
  mockResponse,
};
