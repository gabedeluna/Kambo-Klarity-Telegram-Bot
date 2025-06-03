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
    const sessionType = await sessionTypesCore.getById(
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
};
