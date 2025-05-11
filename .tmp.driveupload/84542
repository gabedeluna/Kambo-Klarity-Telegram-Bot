// src/routes/sessions.js

const express = require("express");
const router = express.Router();

let logger;
let prisma;

/**
 * Initializes the sessions router with dependencies.
 * @param {object} deps - Dependencies object.
 * @param {object} deps.logger - Logger instance.
 * @param {import('@prisma/client').PrismaClient} deps.prisma - Prisma client instance.
 */
function initialize(deps) {
  if (!deps.logger || !deps.prisma) {
    console.error(
      "FATAL: sessionsRouter initialization failed. Missing dependencies.",
    );
    throw new Error("Missing dependencies for sessionsRouter");
  }
  logger = deps.logger;
  prisma = deps.prisma;
  logger.info("[sessionsRouter] Initialized successfully.");
}

// --- Define Session Routes --- //

// Placeholder route - replace with actual session logic later
router.get("/", async (req, res, next) => {
  logger.info("GET /api/sessions called (placeholder)");
  try {
    // Example: Fetch session types or active sessions (replace with real logic)
    const sessionTypes = await prisma.sessionType.findMany();
    res.json({ sessionTypes });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch session types");
    next(error); // Pass error to the global error handler
  }
});

// Add other session-related routes here (e.g., POST /, GET /:id, PUT /:id)

// --- Export --- //
module.exports = {
  initialize,
  router,
};
