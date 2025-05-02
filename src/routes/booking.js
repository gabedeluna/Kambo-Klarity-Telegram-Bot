// src/routes/booking.js

const express = require("express");
const router = express.Router();

let logger;

/**
 * Initializes the booking router with dependencies.
 * @param {object} deps - Dependencies object.
 * @param {object} deps.logger - Logger instance.
 */
function initialize(deps) {
  if (!deps.logger) {
    console.error(
      "FATAL: bookingRouter initialization failed. Missing dependencies.",
    );
    throw new Error("Missing dependencies for bookingRouter");
  }
  logger = deps.logger;
  logger.info("[bookingRouter] Initialized successfully.");
}

// --- Define Booking Routes --- //

// Placeholder route - replace with actual booking logic later
router.get("/", (req, res) => {
  logger.info("GET /api/booking called (placeholder)");
  res.status(501).json({ message: "Booking API not fully implemented yet." });
});

// Add other booking-related routes here (e.g., POST /, GET /:id, DELETE /:id)

// --- Export --- //
module.exports = {
  initialize,
  router,
};
