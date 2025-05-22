// tests/middleware/rateLimiterMiddleware.test.js

// Mock express-rate-limit. This is hoisted.
jest.mock("express-rate-limit", () => jest.fn(() => "mockedLimiter"));

describe("rateLimiterMiddleware", () => {
  let mockRateLimit; // To hold the reference to the mock

  beforeEach(() => {
    // Reset modules to ensure a clean state and that the module under test
    // re-evaluates its top-level require of 'express-rate-limit'.
    jest.resetModules();
        
    // Get a reference to the mock function.
    // This require call will hit the mock because of jest.mock at the top.
    mockRateLimit = require("express-rate-limit");
    // Clear any calls from previous tests or setups before the module under test is loaded.
    mockRateLimit.mockClear();
    
    // Load the module under test. This will trigger its internal require('express-rate-limit'),
    // which will call our (now cleared) mockRateLimit function once.
    require("../../src/middleware/rateLimiterMiddleware");
  });

  it("should configure express-rate-limit with correct options", () => {
    // The require("../../src/middleware/rateLimiterMiddleware") in beforeEach triggered the call
    // to the mocked express-rate-limit. We assert against our reference to the mock.
    expect(mockRateLimit).toHaveBeenCalledTimes(1);
    expect(mockRateLimit).toHaveBeenCalledWith({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false, // Disable the `X-RateLimit-*` headers
      message: "Too many requests from this IP, please try again after 15 minutes",
    });
  });

  it("should export the result of the rateLimit call", () => {
    // Re-require to get the exported value from this specific test's context
    // if the mock was more complex or if we needed to test the return value directly.
    // In this case, the mock returns "mockedLimiter".
    const limiterInstance = require("../../src/middleware/rateLimiterMiddleware");
    expect(limiterInstance).toBe("mockedLimiter");
  });
});