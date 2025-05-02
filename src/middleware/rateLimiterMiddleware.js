// src/middleware/rateLimiterMiddleware.js

const rateLimit = require("express-rate-limit");

/**
 * Basic rate limiter middleware to prevent abuse.
 * Limits each IP to 100 requests per 15 minutes.
 * Adjust windowMs and max as needed for your application.
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: "Too many requests from this IP, please try again after 15 minutes",
});

// Export the configured limiter directly, as it's used without an initialize function
module.exports = limiter;
