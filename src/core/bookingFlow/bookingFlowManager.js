/**
 * @module core/bookingFlow/bookingFlowManager
 * @description Central module for orchestrating dynamic booking and invitation flows based on SessionType configurations.
 * Uses JWT-based flow tokens for stateless flow management.
 */

const prisma = require("../prisma");
const sessionTypesCore = require("../sessionTypes");
const logger = require("../logger");
const { generateFlowToken, parseFlowToken } = require("./flowTokenManager");
const {
  determineNextStep,
  processWaiverSubmission,
  processFriendInviteAcceptance,
  handleFriendDecline,
} = require("./flowStepHandlers");

// In-memory store for tracking finalized flow tokens
// In production, this could be Redis or a database table
const finalizedFlows = new Map();

/**
 * Starts a primary booking flow for a user
 * @param {object} data - Flow initiation data
 * @param {number} data.userId - Telegram user ID
 * @param {string} data.sessionTypeId - Session type ID
 * @param {string} data.appointmentDateTimeISO - Appointment date/time in ISO format
 * @param {string} [data.placeholderId] - Google Calendar placeholder event ID
 * @returns {Promise<object>} Flow token and next step information
 */
async function startPrimaryBookingFlow(data) {
  logger.info(
    { userId: data.userId, sessionTypeId: data.sessionTypeId },
    "[BookingFlowManager] Starting primary booking flow",
  );

  // Validate required data
  if (!data.userId || !data.sessionTypeId || !data.appointmentDateTimeISO) {
    logger.error({ data }, "[BookingFlowManager] Missing required flow data");
    throw new Error("Missing required flow data");
  }

  try {
    // Validate session type exists and is active
    const _sessionType = await prisma.sessionType.findUnique({
      where: { id: data.sessionTypeId, active: true },
    });

    if (!_sessionType) {
      logger.warn(
        { sessionTypeId: data.sessionTypeId },
        "Session type not found or inactive",
      );
      return {
        success: false,
        message: "Session type not found or is no longer available.",
      };
    }

    // Fetch session type configuration
    const sessionType = await sessionTypesCore.getById(data.sessionTypeId);
    if (!sessionType) {
      logger.error(
        { sessionTypeId: data.sessionTypeId },
        "[BookingFlowManager] Session type not found",
      );
      throw new Error("Session type not found");
    }

    // Create initial flow state
    const flowState = {
      userId: data.userId,
      flowType: "primary_booking",
      currentStep: "initial",
      sessionTypeId: data.sessionTypeId,
      appointmentDateTimeISO: data.appointmentDateTimeISO,
      placeholderId: data.placeholderId,
    };

    // Determine next step
    const { nextStep, action } = determineNextStep(flowState, sessionType);

    // Update flow state with next step
    flowState.currentStep = nextStep;

    // Generate flow token
    const flowToken = generateFlowToken(flowState);

    // Prepare response
    const response = {
      flowToken,
      nextStep: {
        type: action.type,
        ...(action.url && { url: action.url + flowToken }),
      },
    };

    logger.info(
      { userId: data.userId, nextStep },
      "[BookingFlowManager] Primary booking flow started",
    );
    return response;
  } catch (error) {
    logger.error(
      { error, data },
      "[BookingFlowManager] Error starting primary booking flow",
    );
    throw error;
  }
}

/**
 * Starts an invite acceptance flow for a friend
 * @param {object} data - Invite acceptance data
 * @param {string} data.inviteToken - Session invite token
 * @param {number} data.userId - Telegram user ID of the friend
 * @returns {Promise<object>} Flow token and next step information
 */
async function startInviteAcceptanceFlow(data) {
  logger.info(
    { userId: data.userId, inviteToken: data.inviteToken },
    "[BookingFlowManager] Starting invite acceptance flow",
  );

  try {
    // Validate invite token
    const sessionInvite = await prisma.sessionInvite.findUnique({
      where: { inviteToken: data.inviteToken },
      include: { session: true },
    });

    if (!sessionInvite) {
      logger.error(
        { inviteToken: data.inviteToken },
        "[BookingFlowManager] Invalid invite token",
      );
      throw new Error("Invalid or expired invite token");
    }

    if (sessionInvite.status !== "PENDING") {
      logger.error(
        { inviteToken: data.inviteToken, status: sessionInvite.status },
        "[BookingFlowManager] Invite already used",
      );
      throw new Error("Invite has already been used");
    }

    // Fetch session type configuration
    const _sessionType = await sessionTypesCore.getById(
      sessionInvite.session.sessionTypeId,
    );

    // Create flow state
    const flowState = {
      userId: data.userId,
      flowType: "friend_invite",
      currentStep: "awaiting_join_decision",
      sessionTypeId: sessionInvite.session.sessionTypeId,
      appointmentDateTimeISO:
        sessionInvite.session.appointmentDateTime.toISOString(),
      parentSessionId: sessionInvite.session.id,
      inviteToken: data.inviteToken,
    };

    // Generate flow token
    const flowToken = generateFlowToken(flowState);

    // Prepare response - always redirect to join session page first
    const response = {
      flowToken,
      nextStep: {
        type: "REDIRECT",
        url: `/join-session.html?flowToken=${flowToken}`,
      },
    };

    logger.info(
      { userId: data.userId, parentSessionId: sessionInvite.session.id },
      "[BookingFlowManager] Invite acceptance flow started",
    );
    return response;
  } catch (error) {
    logger.error(
      { error, data },
      "[BookingFlowManager] Error starting invite acceptance flow",
    );
    throw error;
  }
}

/**
 * Continues a flow based on the provided flow token and step data
 * @param {object} data - Continue flow data
 * @param {string} data.flowToken - JWT flow token
 * @param {string} data.stepId - Step identifier
 * @param {object} [data.data] - Step-specific data
 * @returns {Promise<object>} Updated flow token and next step information
 */
async function continueFlow(data) {
  logger.info({ stepId: data.stepId }, "[BookingFlowManager] Continuing flow");

  try {
    // Parse and validate flow token
    const flowState = parseFlowToken(data.flowToken);

    // Route to appropriate step handler
    switch (data.stepId) {
      case "waiver_submission":
        return await processWaiverSubmission(flowState, data.data);
      case "friend_invite_acceptance":
        return await processFriendInviteAcceptance(flowState);
      case "friend_decline":
        return await handleFriendDecline(flowState);
      default:
        logger.error(
          { stepId: data.stepId },
          "[BookingFlowManager] Unknown step ID",
        );
        throw new Error(`Unknown step ID: ${data.stepId}`);
    }
  } catch (error) {
    logger.error(
      { error, stepId: data.stepId },
      "[BookingFlowManager] Error continuing flow",
    );
    throw error;
  }
}

/**
 * Finalizes a booking flow by completing all booking actions
 * Implements idempotency to handle multiple calls with the same flowToken
 * @param {string} flowToken - JWT flow token containing booking details
 * @returns {Promise<object>} Result of the finalization process
 */
async function finalizeBookingAndNotify(flowToken) {
  logger.info("[BookingFlowManager] Finalizing booking flow");

  try {
    // Parse and validate flow token
    const flowState = parseFlowToken(flowToken);

    // Check if this flow has already been finalized (idempotency check)
    if (finalizedFlows.has(flowToken)) {
      const cachedResult = finalizedFlows.get(flowToken);
      logger.info(
        { flowToken: flowToken.substring(0, 20) + "..." },
        "[BookingFlowManager] Flow already finalized, returning cached result",
      );
      return cachedResult;
    }

    // Validate required flow state data
    if (
      !flowState.userId ||
      !flowState.sessionTypeId ||
      !flowState.appointmentDateTimeISO
    ) {
      logger.error(
        { flowState },
        "[BookingFlowManager] Invalid flow state for finalization",
      );
      throw new Error("Invalid flow state: missing required booking data");
    }

    // Get session type configuration
    const sessionType = await sessionTypesCore.getById(flowState.sessionTypeId);
    if (!sessionType) {
      logger.error(
        { sessionTypeId: flowState.sessionTypeId },
        "Session type not found",
      );
      throw new Error("Session type not found");
    }

    // Delete placeholder event if exists
    if (flowState.placeholderId) {
      try {
        logger.debug(
          { placeholderId: flowState.placeholderId },
          "Deleting placeholder event",
        );
        const googleCalendarTool = require("../../tools/googleCalendar");
        await googleCalendarTool.deleteCalendarEvent(flowState.placeholderId);
        logger.debug("Placeholder event deleted successfully");
      } catch (error) {
        logger.warn(
          { error, placeholderId: flowState.placeholderId },
          "Failed to delete placeholder event - continuing anyway",
        );
      }
    }

    // Final slot availability check (critical)
    const googleCalendarTool = require("../../tools/googleCalendar");
    const isAvailable = await googleCalendarTool.isSlotTrulyAvailable(
      flowState.appointmentDateTimeISO,
      sessionType.durationMinutes,
    );

    if (!isAvailable) {
      logger.warn(
        { appointmentDateTime: flowState.appointmentDateTimeISO },
        "Slot became unavailable during booking finalization",
      );
      throw new Error(
        "Sorry, the selected slot was taken while you were completing the waiver. Please return to the calendar and choose a new time.",
      );
    }

    // Create Session record
    const sessionData = {
      telegram_id: BigInt(flowState.userId),
      session_type_id_fk: flowState.sessionTypeId,
      appointment_datetime: new Date(flowState.appointmentDateTimeISO),
      session_status: "CONFIRMED",
      liability_form_data: flowState.liability_form_data || {},
      first_name: flowState.firstName || "",
      last_name: flowState.lastName || "",
    };

    const session = await prisma.sessions.create({ data: sessionData });
    logger.debug({ sessionId: session.id }, "Session created successfully");

    // Create confirmed Google Calendar event
    const eventStartTime = new Date(flowState.appointmentDateTimeISO);
    const eventEndTime = new Date(
      eventStartTime.getTime() + sessionType.durationMinutes * 60000,
    );

    const eventData = {
      summary: `Client ${flowState.firstName || "Unknown"} ${flowState.lastName || "User"} - ${sessionType.label}`,
      start: eventStartTime,
      end: eventEndTime,
      description: `${sessionType.label} session for ${flowState.firstName || "Unknown"} ${flowState.lastName || "User"}\nBooking ID: ${session.id}`,
    };

    let googleEventId;
    try {
      googleEventId = await googleCalendarTool.createCalendarEvent(eventData);
      logger.debug(
        { googleEventId, sessionId: session.id },
        "Calendar event created successfully",
      );

      // Update session with Google Calendar event ID
      await prisma.sessions.update({
        where: { id: session.id },
        data: { googleEventId },
      });
    } catch (error) {
      logger.error(
        { error, sessionId: session.id },
        "Calendar event creation failed - session exists in DB but not on calendar",
      );

      // Flag session for manual review due to critical failure
      try {
        await prisma.sessions.update({
          where: { id: session.id },
          data: { session_status: "NEEDS_MANUAL_REVIEW" },
        });
        logger.warn(
          { sessionId: session.id },
          "Session flagged for manual review due to calendar event failure",
        );
      } catch (updateError) {
        logger.error(
          { updateError, sessionId: session.id },
          "Failed to flag session for manual review",
        );
      }

      // Notify admin about the critical inconsistency
      const telegramNotifier = require("../../tools/telegramNotifier");
      try {
        await telegramNotifier.sendAdminNotification(
          `CRITICAL: Session created in DB but Calendar event failed. Session ID: ${session.id}, User: ${flowState.firstName} ${flowState.lastName} (${flowState.userId}), Time: ${flowState.appointmentDateTimeISO}. Error: ${error.message}`,
        );
      } catch (notifError) {
        logger.error(
          { notifError },
          "Failed to send admin notification about calendar failure",
        );
      }

      throw new Error(
        "Session was created but calendar event failed. An admin has been notified.",
      );
    }

    // Send admin notification
    try {
      const formattedDateTime = new Date(
        flowState.appointmentDateTimeISO,
      ).toLocaleString("en-US", {
        timeZone: "America/Chicago",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      const telegramNotifier = require("../../tools/telegramNotifier");
      await telegramNotifier.sendAdminNotification(
        `CONFIRMED BOOKING: Client ${flowState.firstName || "Unknown"} ${flowState.lastName || "User"} (TGID: ${flowState.userId}) for ${sessionType.label} on ${formattedDateTime}. Waiver submitted.`,
      );
    } catch (error) {
      logger.error(
        { error, userId: flowState.userId },
        "Failed to send admin notification - continuing anyway",
      );
    }

    // Prepare result
    const formattedDateTime = new Date(
      flowState.appointmentDateTimeISO,
    ).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const result = {
      success: true,
      sessionTypeLabel: sessionType.label,
      appointmentDateTimeFormatted: formattedDateTime,
      sessionId: session.id,
    };

    // Mark this flow as finalized for idempotency
    finalizedFlows.set(flowToken, result);

    logger.info(
      { userId: flowState.userId, sessionId: session.id },
      "[BookingFlowManager] Booking flow finalized successfully",
    );

    return result;
  } catch (error) {
    logger.error(
      { error },
      "[BookingFlowManager] Error finalizing booking flow",
    );
    throw error;
  }
}

module.exports = {
  startPrimaryBookingFlow,
  startInviteAcceptanceFlow,
  continueFlow,
  processWaiverSubmission,
  processFriendInviteAcceptance,
  handleFriendDecline,
  determineNextStep,
  generateFlowToken,
  parseFlowToken,
  finalizeBookingAndNotify,
};
