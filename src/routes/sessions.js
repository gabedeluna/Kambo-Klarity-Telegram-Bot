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
  if (!deps || !deps.logger || !deps.prisma) {
    // Added !deps check
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

/**
 * Get invite context for a session
 * GET /api/sessions/:sessionId/invite-context?telegramId={telegramId}
 */
router.get("/:sessionId/invite-context", async (req, res, next) => {
  logger.info(
    { sessionId: req.params.sessionId, telegramId: req.query.telegramId },
    "GET invite context",
  );

  try {
    const { sessionId } = req.params;
    const { telegramId } = req.query;

    if (!sessionId || !telegramId) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters: sessionId and telegramId",
      });
    }

    // Find the session and verify ownership
    const session = await prisma.sessions.findUnique({
      where: { id: parseInt(sessionId) },
      include: {
        SessionType: true,
        SessionInvite: {
          where: { parentSessionId: parseInt(sessionId) },
        },
      },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    // Verify the user owns this session
    if (session.telegram_id !== telegramId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this session",
      });
    }

    // Calculate max invites (total group size - 1 for primary booker)
    const maxInvites = Math.max(
      0,
      (session.SessionType?.maxGroupSize || 1) - 1,
    );

    // Format session details
    const sessionDetails = {
      sessionTypeLabel: session.SessionType?.label || "Kambo Session",
      formattedDateTime: new Date(session.appointment_datetime).toLocaleString(
        "en-US",
        {
          timeZone: "America/Chicago",
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        },
      ),
    };

    // Format existing invites
    const existingInvites = session.SessionInvite.map((invite) => ({
      token: invite.token,
      status: invite.status,
      friendName: invite.friendName,
      createdAt: invite.createdAt,
      updatedAt: invite.updatedAt,
    }));

    res.json({
      success: true,
      data: {
        maxInvites,
        sessionDetails,
        existingInvites,
      },
    });
  } catch (error) {
    logger.error(
      { error, sessionId: req.params.sessionId },
      "Failed to get invite context",
    );
    next(error);
  }
});

/**
 * Generate a new invite token for a session
 * POST /api/sessions/:sessionId/generate-invite-token
 */
router.post("/:sessionId/generate-invite-token", async (req, res, next) => {
  logger.info(
    { sessionId: req.params.sessionId, body: req.body },
    "POST generate invite token",
  );

  try {
    const { sessionId } = req.params;
    const { telegramId } = req.body;

    if (!sessionId || !telegramId) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters: sessionId and telegramId",
      });
    }

    // Find the session and verify ownership
    const session = await prisma.sessions.findUnique({
      where: { id: parseInt(sessionId) },
      include: {
        SessionType: true,
        SessionInvite: true,
      },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    // Verify the user owns this session
    if (session.telegram_id !== telegramId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this session",
      });
    }

    // Check if session allows group invites
    if (!session.SessionType?.allowsGroupInvites) {
      return res.status(400).json({
        success: false,
        message: "This session type does not allow group invites",
      });
    }

    // Calculate max invites and check limit
    const maxInvites = Math.max(
      0,
      (session.SessionType?.maxGroupSize || 1) - 1,
    );
    const existingInviteCount = session.SessionInvite.length;

    if (existingInviteCount >= maxInvites) {
      return res.status(400).json({
        success: false,
        message: "Invite limit reached",
      });
    }

    // Generate a unique token
    const { v4: uuidv4 } = require("uuid");
    const token = uuidv4();

    // Create the invite record
    const newInvite = await prisma.sessionInvite.create({
      data: {
        parentSessionId: parseInt(sessionId),
        token: token,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: {
        id: newInvite.id,
        token: newInvite.token,
        status: newInvite.status,
        createdAt: newInvite.createdAt,
        updatedAt: newInvite.updatedAt,
      },
    });
  } catch (error) {
    logger.error(
      { error, sessionId: req.params.sessionId },
      "Failed to generate invite token",
    );
    next(error);
  }
});

// Add other session-related routes here (e.g., POST /, GET /:id, PUT /:id)

// --- Export --- //
module.exports = {
  initialize,
  router,
};
